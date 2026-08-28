use crate::collectors::token_analyzer::pricing::PricingEngine;
use crate::types::TokenRecord;
use serde_json::Value;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

pub struct ClaudeCodeParser;

impl ClaudeCodeParser {
    pub fn scan_records(home_dir: &Path) -> Vec<TokenRecord> {
        let mut records = Vec::new();
        let claude_dir = home_dir.join(".claude");
        if !claude_dir.exists() {
            return records;
        }

        // 1. Scan ~/.claude/projects/*
        let projects_dir = claude_dir.join("projects");
        if projects_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&projects_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        Self::scan_project_dir(&path, &mut records);
                    }
                }
            }
        }

        // 2. Scan direct ~/.claude/*.jsonl
        if let Ok(entries) = std::fs::read_dir(&claude_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
                    Self::parse_jsonl_file(&path, None, &mut records);
                }
            }
        }

        records
    }

    fn scan_project_dir(project_dir: &Path, records: &mut Vec<TokenRecord>) {
        let dir_name = project_dir
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("default");
        // Often project directory name is sanitized/hashed, let's extract a readable project name
        let project_name = dir_name.to_string();

        // 1. Direct jsonl files in project directory
        if let Ok(entries) = std::fs::read_dir(project_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
                    Self::parse_jsonl_file(&path, Some(&project_name), records);
                } else if path.is_dir() {
                    // Check subdirectories e.g. sessions/
                    if let Ok(sub_entries) = std::fs::read_dir(&path) {
                        for sub_entry in sub_entries.flatten() {
                            let sub_path = sub_entry.path();
                            if sub_path.is_file()
                                && sub_path.extension().and_then(|e| e.to_str()) == Some("jsonl")
                            {
                                Self::parse_jsonl_file(&sub_path, Some(&project_name), records);
                            }
                        }
                    }
                }
            }
        }
    }

    pub fn parse_jsonl_file(
        file_path: &PathBuf,
        project_name: Option<&str>,
        records: &mut Vec<TokenRecord>,
    ) {
        let file = match File::open(file_path) {
            Ok(f) => f,
            Err(_) => return,
        };

        let reader = BufReader::new(file);
        let session_file_id = file_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("session")
            .to_string();

        for (line_idx, line) in reader.lines().enumerate() {
            let line_str = match line {
                Ok(l) => l,
                Err(_) => continue,
            };

            let trimmed = line_str.trim();
            if trimmed.is_empty() {
                continue;
            }

            if let Ok(json) = serde_json::from_str::<Value>(trimmed) {
                if let Some(record) = Self::parse_json_line(&json, &session_file_id, line_idx, project_name) {
                    records.push(record);
                }
            }
        }
    }

    fn parse_json_line(
        json: &Value,
        session_file_id: &str,
        line_idx: usize,
        project_name: Option<&str>,
    ) -> Option<TokenRecord> {
        // Usage can be located at:
        // 1. json["usage"]
        // 2. json["message"]["usage"]
        // 3. json["response"]["usage"]
        let usage = json
            .get("usage")
            .or_else(|| json.get("message").and_then(|m| m.get("usage")))
            .or_else(|| json.get("response").and_then(|r| r.get("usage")))?;

        let input_tokens = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
        let output_tokens = usage.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
        let cache_read = usage
            .get("cache_read_input_tokens")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        let cache_write = usage
            .get("cache_creation_input_tokens")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        let reasoning_tokens = usage
            .get("reasoning_tokens")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        if input_tokens == 0 && output_tokens == 0 && cache_read == 0 && cache_write == 0 {
            return None;
        }

        // Extract Model
        let model = json
            .get("model")
            .or_else(|| json.get("message").and_then(|m| m.get("model")))
            .or_else(|| json.get("response").and_then(|r| r.get("model")))
            .and_then(|v| v.as_str())
            .unwrap_or("claude-3-7-sonnet");

        // Extract Timestamp
        let timestamp = if let Some(ts_num) = json.get("timestamp").and_then(|v| v.as_i64()) {
            if ts_num < 10_000_000_000 {
                ts_num * 1000 // Convert seconds to milliseconds
            } else {
                ts_num
            }
        } else if let Some(ts_str) = json
            .get("created_at")
            .or_else(|| json.get("timestamp"))
            .and_then(|v| v.as_str())
        {
            chrono::DateTime::parse_from_rfc3339(ts_str)
                .map(|dt| dt.timestamp_millis())
                .unwrap_or_else(|_| chrono::Utc::now().timestamp_millis())
        } else {
            chrono::Utc::now().timestamp_millis()
        };

        // Extract session ID
        let session_id = json
            .get("sessionId")
            .or_else(|| json.get("session_id"))
            .and_then(|v| v.as_str())
            .unwrap_or(session_file_id)
            .to_string();

        let resolved_project = project_name
            .map(|s| s.to_string())
            .or_else(|| {
                json.get("projectName")
                    .or_else(|| json.get("project_name"))
                    .or_else(|| json.get("cwd"))
                    .and_then(|v| v.as_str())
                    .map(|p| {
                        Path::new(p)
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or(p)
                            .to_string()
                    })
            });

        let recorded_cost_usd = json
            .get("costUSD")
            .or_else(|| json.get("cost_usd"))
            .or_else(|| json.get("cost"))
            .or_else(|| json.get("totalCost"))
            .and_then(|v| v.as_f64());

        let (calc_usd, _, _) = PricingEngine::calculate_cost(
            model,
            input_tokens,
            output_tokens,
            cache_read,
            cache_write,
        );

        let cost_usd = recorded_cost_usd.unwrap_or(calc_usd);
        let cost_cny = cost_usd * crate::collectors::token_analyzer::pricing::USD_TO_CNY_RATE;

        Some(TokenRecord {
            id: format!("claude_{}_{}_{}", session_file_id, line_idx, timestamp),
            client: "claude_code".to_string(),
            session_id,
            project_path: json.get("cwd").and_then(|v| v.as_str()).map(|s| s.to_string()),
            project_name: resolved_project,
            model: model.to_string(),
            timestamp,
            input_tokens,
            output_tokens,
            cache_read_tokens: cache_read,
            cache_write_tokens: cache_write,
            reasoning_tokens,
            cost_usd,
            cost_cny,
        })
    }
}
