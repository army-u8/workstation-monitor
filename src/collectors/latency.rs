use crate::types::LatencyTarget;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::time::timeout;

pub struct LatencyProbeConfig {
    pub name: String,
    pub host: String,
    pub port: u16,
}

pub struct LatencyCollector {
    targets: Vec<LatencyProbeConfig>,
}

impl LatencyCollector {
    pub fn new() -> Self {
        let targets = vec![
            LatencyProbeConfig {
                name: "Cloudflare DNS".to_string(),
                host: "1.1.1.1".to_string(),
                port: 53,
            },
            LatencyProbeConfig {
                name: "Google DNS".to_string(),
                host: "8.8.8.8".to_string(),
                port: 53,
            },
            LatencyProbeConfig {
                name: "Alibaba DNS".to_string(),
                host: "223.5.5.5".to_string(),
                port: 53,
            },
            LatencyProbeConfig {
                name: "GitHub API".to_string(),
                host: "api.github.com".to_string(),
                port: 443,
            },
            LatencyProbeConfig {
                name: "Local Gateway".to_string(),
                host: "192.168.1.1".to_string(),
                port: 80,
            },
            LatencyProbeConfig {
                name: "Baidu Core".to_string(),
                host: "www.baidu.com".to_string(),
                port: 443,
            },
        ];

        Self { targets }
    }

    pub async fn collect(&self) -> Vec<LatencyTarget> {
        let mut tasks = Vec::new();

        for target in &self.targets {
            let name = target.name.clone();
            let host = target.host.clone();
            let port = target.port;

            tasks.push(tokio::spawn(async move {
                let addr = format!("{}:{}", host, port);
                let start = Instant::now();
                let res = timeout(Duration::from_millis(1500), TcpStream::connect(&addr)).await;

                let (latency_ms, is_alive) = match res {
                    Ok(Ok(_stream)) => {
                        let elapsed = start.elapsed().as_secs_f64() * 1000.0;
                        (Some(elapsed), true)
                    }
                    Ok(Err(_)) => {
                        // Connection refused or reset still indicates host is reachable
                        let elapsed = start.elapsed().as_secs_f64() * 1000.0;
                        if elapsed < 100.0 {
                            (Some(elapsed), true)
                        } else {
                            (None, false)
                        }
                    }
                    Err(_) => (None, false), // Timeout
                };

                LatencyTarget {
                    name,
                    host,
                    port,
                    latency_ms,
                    is_alive,
                    last_checked: chrono::Utc::now().timestamp_millis(),
                }
            }));
        }

        let mut results = Vec::new();
        for task in tasks {
            if let Ok(target_result) = task.await {
                results.push(target_result);
            }
        }

        results
    }
}
