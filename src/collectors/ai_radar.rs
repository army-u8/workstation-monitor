use std::time::Instant;
use serde_json::Value;
use crate::types::{LlmApiLatency, OllamaModelInfo, OllamaStatusResponse};

pub struct AiRadarManager;

impl AiRadarManager {
    pub async fn probe_llm_apis() -> Vec<LlmApiLatency> {
        let targets = vec![
            ("deepseek", "DeepSeek (深度求索)", "https://api.deepseek.com/models"),
            ("claude", "Anthropic Claude", "https://api.anthropic.com/v1/messages"),
            ("openai", "OpenAI (GPT-4o)", "https://api.openai.com/v1/models"),
            ("gemini", "Google Gemini", "https://generativelanguage.googleapis.com/"),
            ("openrouter", "OpenRouter", "https://openrouter.ai/api/v1/models"),
            ("siliconflow", "SiliconFlow (硅基流动)", "https://api.siliconflow.cn/v1/models"),
            ("ollama", "Ollama Local (本地模型)", "http://127.0.0.1:11434/api/tags"),
        ];

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(3500))
            .danger_accept_invalid_certs(true)
            .redirect(reqwest::redirect::Policy::limited(2))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        let mut tasks = Vec::new();
        for (id, name, endpoint) in targets {
            let client = client.clone();
            tasks.push(tokio::spawn(async move {
                Self::probe_target(&client, id, name, endpoint).await
            }));
        }

        let mut results = Vec::new();
        for task in tasks {
            if let Ok(res) = task.await {
                results.push(res);
            }
        }

        results
    }

    async fn probe_target(
        client: &reqwest::Client,
        provider_id: &str,
        name: &str,
        endpoint: &str,
    ) -> LlmApiLatency {
        let start = Instant::now();
        let res = client.get(endpoint).send().await;
        let latency_ms = start.elapsed().as_secs_f64() * 1000.0;

        match res {
            Ok(resp) => {
                let status = resp.status().as_u16();
                // If we get an HTTP response (even 401 Unauthorized or 404), the host is reachable!
                let is_reachable = status > 0 && status < 599;
                LlmApiLatency {
                    provider_id: provider_id.to_string(),
                    name: name.to_string(),
                    endpoint: endpoint.to_string(),
                    is_reachable,
                    latency_ms: Some((latency_ms * 10.0).round() / 10.0),
                    status_code: Some(status),
                    error_message: if !is_reachable {
                        Some(format!("HTTP {}", status))
                    } else {
                        None
                    },
                }
            }
            Err(err) => {
                let error_str = if err.is_timeout() {
                    "连接超时 (请检查网络或科学代理)".to_string()
                } else if err.is_connect() {
                    "连接被拒绝 (服务未启动或梯子端口未配置)".to_string()
                } else {
                    err.to_string()
                };

                LlmApiLatency {
                    provider_id: provider_id.to_string(),
                    name: name.to_string(),
                    endpoint: endpoint.to_string(),
                    is_reachable: false,
                    latency_ms: None,
                    status_code: None,
                    error_message: Some(error_str),
                }
            }
        }
    }

    pub async fn get_ollama_status() -> OllamaStatusResponse {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(1500))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        // 1. Probe version & tags
        let tags_res = client.get("http://127.0.0.1:11434/api/tags").send().await;
        let mut is_running = false;
        let mut version = None;
        let mut installed_models = Vec::new();

        if let Ok(resp) = tags_res {
            if resp.status().is_success() {
                is_running = true;
                if let Ok(txt) = resp.text().await {
                    if let Ok(json) = serde_json::from_str::<Value>(&txt) {
                        if let Some(models) = json.get("models").and_then(|m| m.as_array()) {
                            for m in models {
                                if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                                    installed_models.push(name.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }

        if !is_running {
            return OllamaStatusResponse {
                is_running: false,
                version: None,
                total_vram_used_bytes: 0,
                loaded_models: Vec::new(),
                installed_models: Vec::new(),
            };
        }

        // Get version
        if let Ok(ver_resp) = client.get("http://127.0.0.1:11434/api/version").send().await {
            if let Ok(v_txt) = ver_resp.text().await {
                if let Ok(v_json) = serde_json::from_str::<Value>(&v_txt) {
                    version = v_json.get("version").and_then(|v| v.as_str()).map(|s| s.to_string());
                }
            }
        }

        // 2. Probe running models (api/ps)
        let mut loaded_models = Vec::new();
        let mut total_vram: u64 = 0;

        if let Ok(ps_resp) = client.get("http://127.0.0.1:11434/api/ps").send().await {
            if let Ok(ps_txt) = ps_resp.text().await {
                if let Ok(ps_json) = serde_json::from_str::<Value>(&ps_txt) {
                    if let Some(models) = ps_json.get("models").and_then(|m| m.as_array()) {
                        for m in models {
                            let name = m.get("name").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
                            let size_bytes = m.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
                            let vram_bytes = m.get("size_vram").and_then(|v| v.as_u64()).unwrap_or(size_bytes);
                            total_vram += vram_bytes;

                            let details = m.get("details");
                            let format = details
                                .and_then(|d| d.get("format"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("gguf")
                                .to_string();
                            let family = details
                                .and_then(|d| d.get("family"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("llama")
                                .to_string();
                            let parameter_size = details
                                .and_then(|d| d.get("parameter_size"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("-")
                                .to_string();
                            let quantization_level = details
                                .and_then(|d| d.get("quantization_level"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("-")
                                .to_string();
                            let expires_at = m.get("expires_at").and_then(|v| v.as_str()).map(|s| s.to_string());

                            loaded_models.push(OllamaModelInfo {
                                name,
                                size_bytes,
                                vram_bytes,
                                format,
                                family,
                                parameter_size,
                                quantization_level,
                                expires_at,
                            });
                        }
                    }
                }
            }
        }

        OllamaStatusResponse {
            is_running: true,
            version,
            total_vram_used_bytes: total_vram,
            loaded_models,
            installed_models,
        }
    }

    pub async fn unload_ollama_model(model_name: &str) -> Result<String, String> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .map_err(|e| e.to_string())?;

        let body = serde_json::json!({
            "model": model_name,
            "keep_alive": 0
        });

        let res = client
            .post("http://127.0.0.1:11434/api/generate")
            .header("Content-Type", "application/json")
            .body(body.to_string())
            .send()
            .await
            .map_err(|e| format!("Failed to contact Ollama: {}", e))?;

        if res.status().is_success() {
            Ok(format!("模型 {} 显存已成功释放！", model_name))
        } else {
            Err(format!("Ollama returned status {}", res.status()))
        }
    }
}
