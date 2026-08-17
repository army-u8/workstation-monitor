use std::time::Instant;
use crate::types::SpeedTestResult;

pub struct SpeedTester;

impl SpeedTester {
    pub async fn run_speed_test() -> Result<SpeedTestResult, String> {
        // Test endpoints: Cloudflare 25MB test chunk or Fast.com CDN
        let test_url = "https://speed.cloudflare.com/__down?bytes=25000000";
        let server_name = "Cloudflare Global CDN (25MB Chunk)".to_string();

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(12))
            .build()
            .map_err(|e| format!("构建 HTTP 客户端失败: {}", e))?;

        let start = Instant::now();

        let res = client
            .get(test_url)
            .send()
            .await
            .map_err(|e| format!("测速请求失败: {}", e))?;

        if !res.status().is_success() {
            return Err(format!("测速端点响应异常: HTTP {}", res.status()));
        }

        let bytes = res
            .bytes()
            .await
            .map_err(|e| format!("读取测速数据流失败: {}", e))?;

        let duration = start.elapsed().as_secs_f64();
        let total_bytes = bytes.len() as u64;

        if duration <= 0.001 {
            return Err("测速耗时过短".to_string());
        }

        // Calculate Mbps = (bytes * 8) / (duration * 1_000_000)
        let download_mbps = (total_bytes as f64 * 8.0) / (duration * 1_000_000.0);

        Ok(SpeedTestResult {
            download_mbps,
            duration_secs: duration,
            bytes_downloaded: total_bytes,
            server: server_name,
        })
    }
}
