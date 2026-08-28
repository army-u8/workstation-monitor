use crate::collectors::token_analyzer::pricing::PricingEngine;
use crate::types::TokenRecord;
use serde_json::Value;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

pub struct LocalAgentsParser;

impl LocalAgentsParser {
    pub fn scan_records(home_dir: &Path) -> Vec<TokenRecord> {
        let mut records = Vec::new();

        // 1. Continue.dev (~/.continue/sessions)
        let continue_sessions = home_dir.join(".continue/sessions");
        if continue_sessions.exists() {
            Self::scan_continue_sessions(&continue_sessions, &mut records);
        }

        // 2. Kimi CLI (~/.kimi/sessions)
        let kimi_sessions = home_dir.join(".kimi/sessions");
        if kimi_sessions.exists() {
            Self::scan_generic_json_sessions(&kimi_sessions, "kimi", "kimi-k1.5", &mut records);
        }

        // 3. Qwen CLI (~/.qwen/sessions)
        let qwen_sessions = home_dir.join(".qwen/sessions");
        if qwen_sessions.exists() {
            Self::scan_generic_json_sessions(&qwen_sessions, "qwen", "qwen-2.5-coder", &mut records);
        }

        // 4. Aider history
        let aider_hist = home_dir.join(".aider.input.history");
        if aider_hist.exists() {
            if let Ok(metadata) = aider_hist.metadata() {
                let bytes = metadata.len();
                if bytes > 0 {
                    let in_tok = (bytes / 4).max(100);
                    let out_tok = (bytes / 2).max(200);
                    let (cost_usd, cost_cny, _) =
                        PricingEngine::calculate_cost("claude-3-5-sonnet", in_tok, out_tok, 0, 0);

                    records.push(TokenRecord {
                        id: "aider_local_session".to_string(),
                        client: "aider".to_string(),
                        session_id: "aider_main".to_string(),
                        project_path: None,
                        project_name: Some("Aider Coding".to_string()),
                        model: "claude-3-5-sonnet".to_string(),
                        timestamp: chrono::Utc::now().timestamp_millis(),
                        input_tokens: in_tok,
                        output_tokens: out_tok,
                        cache_read_tokens: 0,
                        cache_write_tokens: 0,
                        reasoning_tokens: 0,
                        cost_usd,
                        cost_cny,
                    });
                }
            }
        }

        records
    }

    fn scan_continue_sessions(dir: &Path, records: &mut Vec<TokenRecord>) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("json") {
                    Self::parse_continue_session(&path, records);
                }
            }
        }
    }

    fn parse_continue_session(file_path: &Path, records: &mut Vec<TokenRecord>) {
        let file = match File::open(file_path) {
            Ok(f) => f,
            Err(_) => return,
        };

        let reader = BufReader::new(file);
        let json: Value = match serde_json::from_reader(reader) {
            Ok(j) => j,
            Err(_) => return,
        };

        let session_id = file_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("continue_session");

        let mut total_in = 0;
        let mut total_out = 0;
        let model = json.get("model").and_then(|v| v.as_str()).unwrap_or("claude-3-5-sonnet");

        if let Some(history) = json.get("history").and_then(|h| h.as_array()) {
            for item in history {
                let in_tok = item.get("promptTokens").and_then(|v| v.as_u64()).unwrap_or(0);
                let out_tok = item.get("completionTokens").and_then(|v| v.as_u64()).unwrap_or(0);
                total_in += in_tok;
                total_out += out_tok;
            }
        }

        if total_in > 0 || total_out > 0 {
            let (cost_usd, cost_cny, _) =
                PricingEngine::calculate_cost(model, total_in, total_out, 0, 0);

            records.push(TokenRecord {
                id: format!("continue_{}", session_id),
                client: "continue".to_string(),
                session_id: session_id.to_string(),
                project_path: None,
                project_name: Some(session_id.to_string()),
                model: model.to_string(),
                timestamp: chrono::Utc::now().timestamp_millis(),
                input_tokens: total_in,
                output_tokens: total_out,
                cache_read_tokens: 0,
                cache_write_tokens: 0,
                reasoning_tokens: 0,
                cost_usd,
                cost_cny,
            });
        }
    }

    fn scan_generic_json_sessions(
        dir: &Path,
        client_id: &str,
        default_model: &str,
        records: &mut Vec<TokenRecord>,
    ) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("json") {
                    if let Ok(file) = File::open(&path) {
                        let reader = BufReader::new(file);
                        if let Ok(json) = serde_json::from_reader::<_, Value>(reader) {
                            let in_tok = json.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                            let out_tok = json.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                            if in_tok > 0 || out_tok > 0 {
                                let model = json.get("model").and_then(|v| v.as_str()).unwrap_or(default_model);
                                let (cost_usd, cost_cny, _) =
                                    PricingEngine::calculate_cost(model, in_tok, out_tok, 0, 0);
                                let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("sess");

                                records.push(TokenRecord {
                                    id: format!("{}_{}", client_id, stem),
                                    client: client_id.to_string(),
                                    session_id: stem.to_string(),
                                    project_path: None,
                                    project_name: Some(stem.to_string()),
                                    model: model.to_string(),
                                    timestamp: chrono::Utc::now().timestamp_millis(),
                                    input_tokens: in_tok,
                                    output_tokens: out_tok,
                                    cache_read_tokens: 0,
                                    cache_write_tokens: 0,
                                    reasoning_tokens: 0,
                                    cost_usd,
                                    cost_cny,
                                });
                            }
                        }
                    }
                }
            }
        }
    }
}
