use crate::types::SpeedTestResult;
use futures::StreamExt;
use std::time::Instant;

pub struct SpeedTester;

struct SpeedEndpoint {
    name: &'static str,
    url: &'static str,
}

impl SpeedTester {
    pub async fn run_speed_test() -> Result<SpeedTestResult, String> {
        let endpoints = [
            SpeedEndpoint {
                name: "Cloudflare Global Edge CDN",
                url: "https://speed.cloudflare.com/__down?bytes=25000000",
            },
            SpeedEndpoint {
                name: "Aliyun Cloud High-Speed CDN",
                url: "https://mirrors.aliyun.com/ubuntu/ls-lR.gz",
            },
            SpeedEndpoint {
                name: "Tsinghua High-Speed Mirror",
                url: "https://mirrors.tuna.tsinghua.edu.cn/ubuntu/ls-lR.gz",
            },
        ];

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(12))
            .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
            .build()
            .map_err(|e| format!("构建 HTTP 客户端失败: {}", e))?;

        let mut last_err = String::from("所有测速节点均不可达");

        for ep in &endpoints {
            match Self::measure_endpoint(&client, ep.url, ep.name).await {
                Ok(result) => return Ok(result),
                Err(err) => {
                    tracing::warn!("Speed test candidate failed for {}: {}", ep.name, err);
                    last_err = format!("{}: {}", ep.name, err);
                }
            }
        }

        Err(last_err)
    }

    async fn measure_endpoint(
        client: &reqwest::Client,
        url: &str,
        server_name: &str,
    ) -> Result<SpeedTestResult, String> {
        let start = Instant::now();

        let res = client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        if !res.status().is_success() {
            return Err(format!("状态码异常: HTTP {}", res.status()));
        }

        let mut stream = res.bytes_stream();
        let mut total_bytes: u64 = 0;

        // Progressive stream sampling: accumulate data chunks with steady time window
        while let Some(chunk_res) = stream.next().await {
            let chunk = chunk_res.map_err(|e| format!("流传输中断: {}", e))?;
            total_bytes += chunk.len() as u64;

            let elapsed = start.elapsed().as_secs_f64();
            // Stop when >= 20MB is downloaded or elapsed duration reaches 4.5s
            if total_bytes >= 20_000_000 || elapsed >= 4.5 {
                break;
            }
        }

        let duration = start.elapsed().as_secs_f64();

        // Ensure we got meaningful bandwidth sample (at least 1MB to avoid fake small html pages)
        if total_bytes < 1_000_000 || duration <= 0.05 {
            return Err(format!(
                "采样数据过小 ({} bytes, {:.2}s)",
                total_bytes, duration
            ));
        }

        // Calculate Mbps = (bytes * 8) / (duration * 1_000_000)
        let download_mbps = (total_bytes as f64 * 8.0) / (duration * 1_000_000.0);

        Ok(SpeedTestResult {
            download_mbps,
            duration_secs: duration,
            bytes_downloaded: total_bytes,
            server: server_name.to_string(),
        })
    }
}
