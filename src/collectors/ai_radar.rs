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

    pub fn detect_local_agents() -> Vec<crate::types::LocalAgentInfo> {
        use sysinfo::System;
        let mut system = System::new();
        system.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

        // Map lowercase process name -> PID
        let mut running_processes: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
        for (pid, proc_) in system.processes() {
            let p_name = proc_.name().to_string_lossy().to_lowercase();
            running_processes.insert(p_name, pid.as_u32());
        }

        let home = std::env::var("HOME").unwrap_or_else(|_| "/Users".to_string());

        let mut list = Vec::new();

        // 1. Claude Code CLI
        let claude_paths = [
            "/opt/homebrew/bin/claude",
            "/usr/local/bin/claude",
            &format!("{}/.npm-global/bin/claude", home),
            &format!("{}/.local/bin/claude", home),
        ];
        let mut claude_bin = None;
        for p in &claude_paths {
            if std::path::Path::new(p).exists() {
                claude_bin = Some(p.to_string());
                break;
            }
        }
        if claude_bin.is_none() {
            if let Ok(out) = std::process::Command::new("which").arg("claude").output() {
                if out.status.success() {
                    claude_bin = Some(String::from_utf8_lossy(&out.stdout).trim().to_string());
                }
            }
        }
        let claude_installed = claude_bin.is_some();
        let claude_version = if let Some(ref bin) = claude_bin {
            std::process::Command::new(bin)
                .arg("--version")
                .output()
                .ok()
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        } else {
            None
        };
        let claude_pid = running_processes.get("claude").copied();
        list.push(crate::types::LocalAgentInfo {
            id: "claude_code".to_string(),
            name: "Claude Code CLI".to_string(),
            category: "cli_agent".to_string(),
            is_installed: claude_installed,
            is_running: claude_pid.is_some(),
            version: claude_version,
            path: claude_bin,
            app_bundle: None,
            icon: "claude".to_string(),
            description: "Anthropic 官方终端自主编码 Agent (Agentic Coding Tool)".to_string(),
            pid: claude_pid,
        });

        // 2. Cursor IDE
        let cursor_app = Self::check_app_bundle(
            "/Applications/Cursor.app",
            &format!("{}/Applications/Cursor.app", home),
        );
        let cursor_pid = running_processes.get("cursor").copied();
        list.push(crate::types::LocalAgentInfo {
            id: "cursor".to_string(),
            name: "Cursor IDE".to_string(),
            category: "ai_ide".to_string(),
            is_installed: cursor_app.0,
            is_running: cursor_pid.is_some(),
            version: cursor_app.1,
            path: cursor_app.2.clone(),
            app_bundle: cursor_app.2,
            icon: "cursor".to_string(),
            description: "原生 AI 赋能 IDE，支持 Tab 智能补全与 Composer 多文件自主重构".to_string(),
            pid: cursor_pid,
        });

        // 3. Windsurf IDE
        let windsurf_app = Self::check_app_bundle(
            "/Applications/Windsurf.app",
            &format!("{}/Applications/Windsurf.app", home),
        );
        let windsurf_pid = running_processes.get("windsurf").copied();
        list.push(crate::types::LocalAgentInfo {
            id: "windsurf".to_string(),
            name: "Windsurf (Codeium)".to_string(),
            category: "ai_ide".to_string(),
            is_installed: windsurf_app.0,
            is_running: windsurf_pid.is_some(),
            version: windsurf_app.1,
            path: windsurf_app.2.clone(),
            app_bundle: windsurf_app.2,
            icon: "windsurf".to_string(),
            description: "Codeium 旗下新一代 Cascade 实时协同 AI 开发环境".to_string(),
            pid: windsurf_pid,
        });

        // 4. Google Antigravity (AGY)
        let agy_app = Self::check_app_bundle(
            "/Applications/Antigravity.app",
            &format!("{}/Applications/Antigravity.app", home),
        );
        let mut agy_bin = None;
        if let Ok(out) = std::process::Command::new("which").arg("agy").output() {
            if out.status.success() {
                agy_bin = Some(String::from_utf8_lossy(&out.stdout).trim().to_string());
            }
        }
        let agy_pid = running_processes
            .get("antigravity")
            .or_else(|| running_processes.get("agy"))
            .copied();
        let agy_installed = agy_app.0 || agy_bin.is_some();
        let agy_ver = agy_app.1.or_else(|| {
            agy_bin.as_ref().and_then(|b| {
                std::process::Command::new(b)
                    .arg("--version")
                    .output()
                    .ok()
                    .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            })
        });
        list.push(crate::types::LocalAgentInfo {
            id: "antigravity".to_string(),
            name: "Google Antigravity (AGY)".to_string(),
            category: "cli_agent".to_string(),
            is_installed: agy_installed,
            is_running: agy_pid.is_some(),
            version: agy_ver,
            path: agy_bin.or(agy_app.2.clone()),
            app_bundle: agy_app.2,
            icon: "antigravity".to_string(),
            description: "Google DeepMind 高级自主编码 Agent 工具与多智能体框架".to_string(),
            pid: agy_pid,
        });

        // 5. Aider Pair Programmer
        let mut aider_bin = None;
        if let Ok(out) = std::process::Command::new("which").arg("aider").output() {
            if out.status.success() {
                aider_bin = Some(String::from_utf8_lossy(&out.stdout).trim().to_string());
            }
        }
        let aider_installed = aider_bin.is_some();
        let aider_ver = aider_bin.as_ref().and_then(|b| {
            std::process::Command::new(b)
                .arg("--version")
                .output()
                .ok()
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        });
        let aider_pid = running_processes.get("aider").copied();
        list.push(crate::types::LocalAgentInfo {
            id: "aider".to_string(),
            name: "Aider AI Pair Programmer".to_string(),
            category: "cli_agent".to_string(),
            is_installed: aider_installed,
            is_running: aider_pid.is_some(),
            version: aider_ver,
            path: aider_bin,
            app_bundle: None,
            icon: "aider".to_string(),
            description: "终端自然语言结对编程 Agent，支持 Git 自动提交与代码树全景理解".to_string(),
            pid: aider_pid,
        });

        // 6. Ollama Local Engine
        let ollama_app = Self::check_app_bundle(
            "/Applications/Ollama.app",
            &format!("{}/Applications/Ollama.app", home),
        );
        let mut ollama_bin = None;
        if let Ok(out) = std::process::Command::new("which").arg("ollama").output() {
            if out.status.success() {
                ollama_bin = Some(String::from_utf8_lossy(&out.stdout).trim().to_string());
            }
        }
        let ollama_pid = running_processes.get("ollama").copied();
        let ollama_installed = ollama_app.0 || ollama_bin.is_some();
        list.push(crate::types::LocalAgentInfo {
            id: "ollama".to_string(),
            name: "Ollama Local Engine".to_string(),
            category: "local_engine".to_string(),
            is_installed: ollama_installed,
            is_running: ollama_pid.is_some(),
            version: ollama_app.1,
            path: ollama_bin.or(ollama_app.2.clone()),
            app_bundle: ollama_app.2,
            icon: "ollama".to_string(),
            description: "轻量级本地大模型运行与推理引擎，支持 Llama 3、DeepSeek-R1、Qwen".to_string(),
            pid: ollama_pid,
        });

        // 7. LM Studio
        let lm_studio_app = Self::check_app_bundle(
            "/Applications/LM Studio.app",
            &format!("{}/Applications/LM Studio.app", home),
        );
        let lm_pid = running_processes
            .get("lm studio")
            .or_else(|| running_processes.get("lmstudio"))
            .copied();
        list.push(crate::types::LocalAgentInfo {
            id: "lm_studio".to_string(),
            name: "LM Studio".to_string(),
            category: "local_engine".to_string(),
            is_installed: lm_studio_app.0,
            is_running: lm_pid.is_some(),
            version: lm_studio_app.1,
            path: lm_studio_app.2.clone(),
            app_bundle: lm_studio_app.2,
            icon: "lm_studio".to_string(),
            description: "可视化本地大模型发现、下载与本地兼容 OpenAI API 服务器".to_string(),
            pid: lm_pid,
        });

        // 8. Visual Studio Code
        let vscode_app = Self::check_app_bundle(
            "/Applications/Visual Studio Code.app",
            &format!("{}/Applications/Visual Studio Code.app", home),
        );
        let vscode_pid = running_processes
            .get("electron")
            .or_else(|| running_processes.get("code"))
            .copied();
        list.push(crate::types::LocalAgentInfo {
            id: "vscode".to_string(),
            name: "Visual Studio Code".to_string(),
            category: "ai_ide".to_string(),
            is_installed: vscode_app.0,
            is_running: vscode_pid.is_some(),
            version: vscode_app.1,
            path: vscode_app.2.clone(),
            app_bundle: vscode_app.2,
            icon: "vscode".to_string(),
            description: "主流代码编辑器，支持 Copilot、Continue、Cline 等 AI 智能体插件".to_string(),
            pid: vscode_pid,
        });

        // 9. Claude Desktop
        let claude_desktop = Self::check_app_bundle(
            "/Applications/Claude.app",
            &format!("{}/Applications/Claude.app", home),
        );
        let claude_desk_pid = running_processes.get("claude").copied();
        list.push(crate::types::LocalAgentInfo {
            id: "claude_desktop".to_string(),
            name: "Claude Desktop App".to_string(),
            category: "chat_client".to_string(),
            is_installed: claude_desktop.0,
            is_running: claude_desk_pid.is_some(),
            version: claude_desktop.1,
            path: claude_desktop.2.clone(),
            app_bundle: claude_desktop.2,
            icon: "claude".to_string(),
            description: "Anthropic 官方桌面客户端，支持 MCP (Model Context Protocol) 扩展".to_string(),
            pid: claude_desk_pid,
        });

        // 10. ChatGPT Desktop
        let chatgpt_app = Self::check_app_bundle(
            "/Applications/ChatGPT.app",
            &format!("{}/Applications/ChatGPT.app", home),
        );
        let chatgpt_pid = running_processes.get("chatgpt").copied();
        list.push(crate::types::LocalAgentInfo {
            id: "chatgpt_desktop".to_string(),
            name: "ChatGPT Desktop App".to_string(),
            category: "chat_client".to_string(),
            is_installed: chatgpt_app.0,
            is_running: chatgpt_pid.is_some(),
            version: chatgpt_app.1,
            path: chatgpt_app.2.clone(),
            app_bundle: chatgpt_app.2,
            icon: "openai".to_string(),
            description: "OpenAI 官方 macOS 原生客户端，支持屏幕感知与高级语音模式".to_string(),
            pid: chatgpt_pid,
        });

        list
    }

    fn check_app_bundle(
        sys_path: &str,
        user_path: &str,
    ) -> (bool, Option<String>, Option<String>) {
        let p = if std::path::Path::new(sys_path).exists() {
            Some(sys_path.to_string())
        } else if std::path::Path::new(user_path).exists() {
            Some(user_path.to_string())
        } else {
            None
        };

        if let Some(ref path_str) = p {
            let plist_path = format!("{}/Contents/Info.plist", path_str);
            let mut ver = None;
            if let Ok(out) = std::process::Command::new("defaults")
                .args(["read", &plist_path, "CFBundleShortVersionString"])
                .output()
            {
                if out.status.success() {
                    let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if !v.is_empty() {
                        ver = Some(v);
                    }
                }
            }
            (true, ver, Some(path_str.clone()))
        } else {
            (false, None, None)
        }
    }
}

