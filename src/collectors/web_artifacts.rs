use std::collections::{HashMap, HashSet};
use std::time::Instant;
use netstat2::{get_sockets_info, AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo, TcpState};
use sysinfo::System;
use crate::types::WebArtifactInfo;

pub struct WebArtifactsManager;

impl WebArtifactsManager {
    pub async fn scan_web_artifacts() -> Vec<WebArtifactInfo> {
        let mut system = System::new();
        system.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

        let mut pid_to_name: HashMap<u32, String> = HashMap::new();
        for (pid, proc_) in system.processes() {
            pid_to_name.insert(pid.as_u32(), proc_.name().to_string_lossy().to_string());
        }

        let af_flags = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
        let proto_flags = ProtocolFlags::TCP;

        let mut candidate_ports: HashMap<u16, (Option<u32>, Option<String>)> = HashMap::new();

        if let Ok(sockets) = get_sockets_info(af_flags, proto_flags) {
            for s in sockets {
                if let ProtocolSocketInfo::Tcp(tcp) = s.protocol_socket_info {
                    if tcp.state == TcpState::Listen {
                        let port = tcp.local_port;
                        // Filter for user-level ports (> 1024 or standard 80/443/8080)
                        if port > 1024 || port == 80 || port == 443 || port == 8080 {
                            let pid = s.associated_pids.first().copied();
                            let process_name = pid.and_then(|p| pid_to_name.get(&p).cloned());
                            candidate_ports.insert(port, (pid, process_name));
                        }
                    }
                }
            }
        }

        // Build list of ports to probe, prioritizing common web dev ports
        let dev_ports: HashSet<u16> = [
            3000, 3001, 3002, 5173, 5174, 5175, 8000, 8080, 8081, 8888, 9000, 9528, 4321, 4000, 4200, 11434,
        ]
        .iter()
        .copied()
        .collect();

        let mut sorted_ports: Vec<u16> = candidate_ports.keys().copied().collect();
        sorted_ports.sort_by_key(|p| (!dev_ports.contains(p), *p));

        // Limit probe concurrency to first 30 listening ports
        let top_ports: Vec<u16> = sorted_ports.into_iter().take(30).collect();

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(1500))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        let mut tasks = Vec::new();
        for port in top_ports {
            let (pid, process_name) = candidate_ports.get(&port).cloned().unwrap_or((None, None));
            let client = client.clone();
            tasks.push(tokio::spawn(async move {
                Self::probe_port(&client, port, pid, process_name).await
            }));
        }

        let mut results = Vec::new();
        for task in tasks {
            if let Ok(Some(artifact)) = task.await {
                results.push(artifact);
            }
        }

        // Sort by dev ports first, then port number
        results.sort_by(|a, b| {
            let a_dev = dev_ports.contains(&a.port);
            let b_dev = dev_ports.contains(&b.port);
            match (a_dev, b_dev) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.port.cmp(&b.port),
            }
        });

        results
    }

    async fn probe_port(
        client: &reqwest::Client,
        port: u16,
        pid: Option<u32>,
        process_name: Option<String>,
    ) -> Option<WebArtifactInfo> {
        let url = format!("http://127.0.0.1:{}/", port);
        let start = Instant::now();

        let response = client.get(&url).send().await;
        let duration_ms = start.elapsed().as_secs_f64() * 1000.0;

        match response {
            Ok(resp) => {
                let status = resp.status().as_u16();
                let headers = resp.headers().clone();

                let body_text = resp.text().await.unwrap_or_default();
                let title = Self::extract_title(&body_text);
                let framework = Self::detect_framework(&headers, &body_text, &process_name);

                Some(WebArtifactInfo {
                    port,
                    url,
                    title,
                    framework,
                    status_code: Some(status),
                    response_time_ms: Some((duration_ms * 10.0).round() / 10.0),
                    pid,
                    process_name,
                    is_healthy: status < 500,
                })
            }
            Err(_) => {
                // If it's a known active listening dev port with an identified process, report it as starting/non-HTTP
                if let Some(ref pname) = process_name {
                    let is_dev = port == 3000 || port == 5173 || port == 8000 || port == 8080 || port == 9528;
                    if is_dev || pname.to_lowercase().contains("node") || pname.to_lowercase().contains("python") || pname.to_lowercase().contains("cargo") {
                        return Some(WebArtifactInfo {
                            port,
                            url,
                            title: None,
                            framework: "Starting / TCP Service".to_string(),
                            status_code: None,
                            response_time_ms: None,
                            pid,
                            process_name: Some(pname.clone()),
                            is_healthy: false,
                        });
                    }
                }
                None
            }
        }
    }

    fn extract_title(html: &str) -> Option<String> {
        let lower = html.to_lowercase();
        let start_tag = "<title";
        if let Some(start_idx) = lower.find(start_tag) {
            if let Some(tag_close) = html[start_idx..].find('>') {
                let content_start = start_idx + tag_close + 1;
                if let Some(end_tag) = lower[content_start..].find("</title>") {
                    let title = html[content_start..content_start + end_tag].trim();
                    if !title.is_empty() && title.len() < 120 {
                        return Some(title.to_string());
                    }
                }
            }
        }
        None
    }

    fn detect_framework(
        headers: &reqwest::header::HeaderMap,
        body: &str,
        process_name: &Option<String>,
    ) -> String {
        let body_lower = body.to_lowercase();

        // Check response headers
        if let Some(val) = headers.get("x-powered-by").and_then(|v| v.to_str().ok()) {
            if val.to_lowercase().contains("next") {
                return "Next.js".to_string();
            }
            if val.to_lowercase().contains("express") {
                return "Node / Express".to_string();
            }
        }

        if let Some(val) = headers.get("server").and_then(|v| v.to_str().ok()) {
            if val.to_lowercase().contains("uvicorn") {
                return "FastAPI / Uvicorn".to_string();
            }
            if val.to_lowercase().contains("werkzeug") {
                return "Flask / Python".to_string();
            }
            if val.to_lowercase().contains("caddy") {
                return "Caddy Server".to_string();
            }
            if val.to_lowercase().contains("nginx") {
                return "Nginx".to_string();
            }
        }

        // Check HTML signatures
        if body_lower.contains("/@vite/client") || body_lower.contains("vite") {
            if body_lower.contains("solid") {
                return "SolidJS + Vite".to_string();
            }
            if body_lower.contains("vue") {
                return "Vue3 + Vite".to_string();
            }
            if body_lower.contains("react") {
                return "React + Vite".to_string();
            }
            return "Vite Web".to_string();
        }

        if body_lower.contains("__next_data__") || body_lower.contains("/_next/") {
            return "Next.js".to_string();
        }

        if body_lower.contains("__nuxt__") || body_lower.contains("/_nuxt/") {
            return "Nuxt / Vue".to_string();
        }

        if body_lower.contains("_astro/") || body_lower.contains("astro") {
            return "Astro".to_string();
        }

        if body_lower.contains("data-reactroot") {
            return "React App".to_string();
        }

        if body_lower.contains("ollama is running") {
            return "Ollama AI API".to_string();
        }

        // Process name inference
        if let Some(pname) = process_name {
            let p_lower = pname.to_lowercase();
            if p_lower.contains("node") || p_lower.contains("bun") || p_lower.contains("deno") {
                return "Node.js Web App".to_string();
            }
            if p_lower.contains("python") || p_lower.contains("uvicorn") {
                return "Python Web Service".to_string();
            }
            if p_lower.contains("ollama") {
                return "Ollama Local LLM".to_string();
            }
            if p_lower.contains("cargo") || p_lower.contains("rust") {
                return "Rust Web Service".to_string();
            }
        }

        "Web Application".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_title() {
        let html = r#"<!DOCTYPE html><html><head><title>My Awesome Dashboard</title></head><body></body></html>"#;
        assert_eq!(
            WebArtifactsManager::extract_title(html),
            Some("My Awesome Dashboard".to_string())
        );

        let empty_html = r#"<div>No title tag here</div>"#;
        assert_eq!(WebArtifactsManager::extract_title(empty_html), None);
    }

    #[test]
    fn test_detect_framework() {
        let headers = reqwest::header::HeaderMap::new();
        let vite_body = r#"<script type="module" src="/@vite/client"></script>"#;
        assert_eq!(
            WebArtifactsManager::detect_framework(&headers, vite_body, &None),
            "Vite Web"
        );

        let next_body = r#"<div id="__next"><script id="__NEXT_DATA__"></script></div>"#;
        assert_eq!(
            WebArtifactsManager::detect_framework(&headers, next_body, &None),
            "Next.js"
        );
    }
}
