use crate::collectors::token_analyzer::pricing::PricingEngine;
use crate::types::TokenRecord;
use serde_json::Value;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

pub struct ClineRooParser;

impl ClineRooParser {
    pub fn scan_records(home_dir: &Path) -> Vec<TokenRecord> {
        let mut records = Vec::new();

        // 1. VS Code Cline: saoudrizwan.claude-dev
        let cline_dir = home_dir.join("Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/tasks");
        if cline_dir.exists() {
            Self::scan_tasks_dir(&cline_dir, "cline", &mut records);
        }

        // 2. VS Code Roo Code: rooveterinaryinc.roo-cline
        let roo_dir = home_dir.join("Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/tasks");
        if roo_dir.exists() {
            Self::scan_tasks_dir(&roo_dir, "roo_code", &mut records);
        }

        // 3. Cursor Roo Code: rooveterinaryinc.roo-cline
        let cursor_roo_dir = home_dir.join("Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/tasks");
        if cursor_roo_dir.exists() {
            Self::scan_tasks_dir(&cursor_roo_dir, "roo_code", &mut records);
        }

        records
    }

    fn scan_tasks_dir(tasks_dir: &Path, client_id: &str, records: &mut Vec<TokenRecord>) {
        let entries = match std::fs::read_dir(tasks_dir) {
            Ok(e) => e,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let task_dir = entry.path();
            if !task_dir.is_dir() {
                continue;
            }

            let task_id = task_dir.file_name().and_then(|n| n.to_str()).unwrap_or("task");
            let ui_messages_file = task_dir.join("ui_messages.json");
            if ui_messages_file.exists() {
                Self::parse_ui_messages(&ui_messages_file, task_id, client_id, records);
            }
        }
    }

    fn parse_ui_messages(
        file_path: &Path,
        task_id: &str,
        client_id: &str,
        records: &mut Vec<TokenRecord>,
    ) {
        let file = match File::open(file_path) {
            Ok(f) => f,
            Err(_) => return,
        };

        let reader = BufReader::new(file);
        let json: Value = match serde_json::from_reader(reader) {
            Ok(j) => j,
            Err(_) => return,
        };

        let messages = match json.as_array() {
            Some(arr) => arr,
            None => return,
        };

        for (idx, msg) in messages.iter().enumerate() {
            // Check api_req_started / api_req_finished or usage fields
            let tokens_in = msg.get("tokensIn").and_then(|v| v.as_u64()).unwrap_or(0);
            let tokens_out = msg.get("tokensOut").and_then(|v| v.as_u64()).unwrap_or(0);
            let cache_reads = msg.get("cacheReads").and_then(|v| v.as_u64()).unwrap_or(0);
            let cache_writes = msg.get("cacheWrites").and_then(|v| v.as_u64()).unwrap_or(0);

            if tokens_in == 0 && tokens_out == 0 && cache_reads == 0 && cache_writes == 0 {
                continue;
            }

            let model = msg
                .get("model")
                .or_else(|| msg.get("modelId"))
                .and_then(|v| v.as_str())
                .unwrap_or("claude-3-5-sonnet");

            let timestamp = msg
                .get("ts")
                .or_else(|| msg.get("timestamp"))
                .and_then(|v| v.as_i64())
                .unwrap_or_else(|| chrono::Utc::now().timestamp_millis());

            let recorded_cost_usd = msg
                .get("totalCost")
                .or_else(|| msg.get("cost"))
                .or_else(|| msg.get("costUSD"))
                .and_then(|v| v.as_f64());

            let (calc_usd, _, _) = PricingEngine::calculate_cost(
                model,
                tokens_in,
                tokens_out,
                cache_reads,
                cache_writes,
            );

            let cost_usd = recorded_cost_usd.unwrap_or(calc_usd);
            let cost_cny = cost_usd * crate::collectors::token_analyzer::pricing::USD_TO_CNY_RATE;

            records.push(TokenRecord {
                id: format!("{}_{}_{}", client_id, task_id, idx),
                client: client_id.to_string(),
                session_id: task_id.to_string(),
                project_path: None,
                project_name: Some(format!("task-{}", &task_id[..task_id.len().min(8)])),
                model: model.to_string(),
                timestamp: if timestamp < 10_000_000_000 { timestamp * 1000 } else { timestamp },
                input_tokens: tokens_in,
                output_tokens: tokens_out,
                cache_read_tokens: cache_reads,
                cache_write_tokens: cache_writes,
                reasoning_tokens: 0,
                cost_usd,
                cost_cny,
            });
        }
    }
}
