use crate::collectors::token_analyzer::pricing::PricingEngine;
use crate::types::TokenRecord;
use serde_json::Value;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;

pub struct AntigravityParser;

impl AntigravityParser {
    pub fn scan_records(home_dir: &Path) -> Vec<TokenRecord> {
        let mut records = Vec::new();
        let gemini_brain_dir = home_dir.join(".gemini/antigravity/brain");
        if !gemini_brain_dir.exists() {
            return records;
        }

        if let Ok(entries) = std::fs::read_dir(&gemini_brain_dir) {
            for entry in entries.flatten() {
                let conv_dir = entry.path();
                if !conv_dir.is_dir() {
                    continue;
                }

                let conv_id = conv_dir
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("conv");

                // Check .system_generated/logs/transcript.jsonl or transcript.jsonl
                let log_file = conv_dir.join(".system_generated/logs/transcript.jsonl");
                if log_file.exists() {
                    Self::parse_transcript(&log_file, conv_id, &mut records);
                } else {
                    let direct_log = conv_dir.join("transcript.jsonl");
                    if direct_log.exists() {
                        Self::parse_transcript(&direct_log, conv_id, &mut records);
                    }
                }
            }
        }

        records
    }

    fn parse_transcript(file_path: &Path, conv_id: &str, records: &mut Vec<TokenRecord>) {
        let file = match File::open(file_path) {
            Ok(f) => f,
            Err(_) => return,
        };

        let reader = BufReader::new(file);
        let mut session_in_tokens: u64 = 0;
        let mut session_out_tokens: u64 = 0;
        let mut latest_ts: i64 = chrono::Utc::now().timestamp_millis();
        let mut request_count = 0;
        let mut detected_model = String::from("gemini-3.7-flash");

        for line in reader.lines() {
            let line_str = match line {
                Ok(l) => l,
                Err(_) => continue,
            };
            let trimmed = line_str.trim();
            if trimmed.is_empty() {
                continue;
            }

            if let Ok(json) = serde_json::from_str::<Value>(trimmed) {
                let source = json.get("source").and_then(|v| v.as_str()).unwrap_or("");
                let step_type = json.get("type").and_then(|v| v.as_str()).unwrap_or("");

                // 1. Detect dynamic model from settings change or subagent calls
                if let Some(content) = json.get("content").and_then(|v| v.as_str()) {
                    if (step_type == "USER_INPUT" || source == "USER_EXPLICIT" || source == "SYSTEM")
                        && content.contains("<USER_SETTINGS_CHANGE>")
                    {
                        if let Some(change_start) = content.find("<USER_SETTINGS_CHANGE>") {
                            let change_block = &content[change_start..];
                            if let Some(change_end) = change_block.find("</USER_SETTINGS_CHANGE>") {
                                let inner = &change_block[..change_end];
                                if inner.contains("Model Selection") {
                                if let Some(pos) = inner.find("from None to ") {
                                    let rest = &inner[pos + "from None to ".len()..];
                                    let model_part = if let Some(end_pos) = rest.find(". No need") {
                                        &rest[..end_pos]
                                    } else if let Some(end_pos) = rest.find('\n') {
                                        &rest[..end_pos]
                                    } else {
                                        rest
                                    };
                                    let trimmed_model = model_part
                                        .replace("(High)", "")
                                        .replace("(Medium)", "")
                                        .replace("(Low)", "")
                                        .trim_matches(|c: char| c == '.' || c == '`' || c == ' ' || c == '\n' || c == '\r' || c == '"' || c == '\'')
                                        .to_string();
                                    if !trimmed_model.is_empty() {
                                        detected_model = trimmed_model;
                                    }
                                }
                            }
                        }
                    }
                }
            }

                if let Some(ts_str) = json.get("created_at").and_then(|v| v.as_str()) {
                    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(ts_str) {
                        latest_ts = dt.timestamp_millis();
                    }
                }

                if source == "MODEL" || step_type == "PLANNER_RESPONSE" {
                    request_count += 1;
                    let thinking_len = json
                        .get("thinking")
                        .and_then(|v| v.as_str())
                        .map(|s| s.len())
                        .unwrap_or(0);
                    let content_len = json
                        .get("content")
                        .and_then(|v| v.as_str())
                        .map(|s| s.len())
                        .unwrap_or(0);

                    let out_tokens = ((thinking_len + content_len) as f64 / 3.5).ceil() as u64;
                    // In a typical conversation turn, input context builds up
                    let in_tokens = (1500 + request_count * 800) as u64;

                    session_in_tokens += in_tokens;
                    session_out_tokens += out_tokens.max(50);
                }
            }
        }

        if session_in_tokens > 0 || session_out_tokens > 0 {
            let (cost_usd, cost_cny, _) = PricingEngine::calculate_cost(
                &detected_model,
                session_in_tokens,
                session_out_tokens,
                0,
                0,
            );

            records.push(TokenRecord {
                id: format!("antigravity_{}", conv_id),
                client: "antigravity".to_string(),
                session_id: conv_id.to_string(),
                project_path: None,
                project_name: Some(format!("task-{}", &conv_id[..conv_id.len().min(8)])),
                model: detected_model,
                timestamp: latest_ts,
                input_tokens: session_in_tokens,
                output_tokens: session_out_tokens,
                cache_read_tokens: 0,
                cache_write_tokens: 0,
                reasoning_tokens: (session_out_tokens / 2),
                cost_usd,
                cost_cny,
            });
        }
    }
}
