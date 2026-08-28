use crate::collectors::token_analyzer::pricing::PricingEngine;
use crate::types::TokenRecord;
use serde_json::Value;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

pub struct OpenCodeCodexParser;

impl OpenCodeCodexParser {
    pub fn scan_records(home_dir: &Path) -> Vec<TokenRecord> {
        let mut records = Vec::new();

        // 1. OpenAI Codex CLI & Desktop (~/.codex)
        let codex_dir = home_dir.join(".codex");
        if codex_dir.exists() {
            Self::scan_codex_dir(&codex_dir, &mut records);
        }

        // 2. OpenCode (~/.local/share/opencode, ~/.config/opencode, ~/.opencode)
        let opencode_dirs = [
            home_dir.join(".local/share/opencode"),
            home_dir.join(".config/opencode"),
            home_dir.join(".opencode"),
            home_dir.join("Library/Application Support/OpenCode"),
        ];
        for dir in &opencode_dirs {
            if dir.exists() {
                Self::scan_opencode_dir(dir, &mut records);
            }
        }

        // 3. Goose CLI (~/.local/share/goose, ~/.config/goose)
        let goose_dirs = [
            home_dir.join(".local/share/goose/sessions"),
            home_dir.join(".config/goose/sessions"),
        ];
        for dir in &goose_dirs {
            if dir.exists() {
                Self::scan_json_sessions_dir(dir, "goose", &mut records);
            }
        }

        records
    }

    fn scan_opencode_dir(opencode_dir: &Path, records: &mut Vec<TokenRecord>) {
        let storage_dir = opencode_dir.join("storage");
        if storage_dir.exists() {
            Self::scan_json_sessions_dir(&storage_dir, "opencode", records);
        }
        let sessions_dir = opencode_dir.join("sessions");
        if sessions_dir.exists() {
            Self::scan_json_sessions_dir(&sessions_dir, "opencode", records);
        }
    }

    fn scan_codex_dir(codex_dir: &Path, records: &mut Vec<TokenRecord>) {
        // Recursive search for all .jsonl rollout session files in ~/.codex/sessions/**
        let sessions_dir = codex_dir.join("sessions");
        if sessions_dir.exists() {
            let mut jsonl_files = Vec::new();
            Self::collect_files_recursive(&sessions_dir, "jsonl", &mut jsonl_files);
            for path in jsonl_files {
                Self::parse_codex_rollout_file(&path, records);
            }
        }

        let history_file = codex_dir.join("history.jsonl");
        if history_file.exists() {
            Self::parse_codex_rollout_file(&history_file, records);
        }
    }

    fn collect_files_recursive(dir: &Path, extension: &str, files: &mut Vec<PathBuf>) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    Self::collect_files_recursive(&path, extension, files);
                } else if path.is_file() {
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                        if ext.eq_ignore_ascii_case(extension) {
                            files.push(path);
                        }
                    }
                }
            }
        }
    }

    fn scan_json_sessions_dir(dir: &Path, client_id: &str, records: &mut Vec<TokenRecord>) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("json") {
                    Self::parse_single_json_session(&path, client_id, records);
                }
            }
        }
    }

    fn parse_single_json_session(file_path: &Path, client_id: &str, records: &mut Vec<TokenRecord>) {
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
            .unwrap_or("session");

        let input_tokens = json
            .get("prompt_tokens")
            .or_else(|| json.get("input_tokens"))
            .or_else(|| json.get("tokens_in"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        let output_tokens = json
            .get("completion_tokens")
            .or_else(|| json.get("output_tokens"))
            .or_else(|| json.get("tokens_out"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        if input_tokens > 0 || output_tokens > 0 {
            let model = json.get("model").and_then(|v| v.as_str()).unwrap_or("gpt-4o");
            let timestamp = json
                .get("created_at")
                .or_else(|| json.get("timestamp"))
                .and_then(|v| v.as_i64())
                .unwrap_or_else(|| chrono::Utc::now().timestamp_millis());

            let (cost_usd, cost_cny, _) =
                PricingEngine::calculate_cost(model, input_tokens, output_tokens, 0, 0);

            records.push(TokenRecord {
                id: format!("{}_{}_{}", client_id, session_id, timestamp),
                client: client_id.to_string(),
                session_id: session_id.to_string(),
                project_path: None,
                project_name: Some(session_id.to_string()),
                model: model.to_string(),
                timestamp: if timestamp < 10_000_000_000 { timestamp * 1000 } else { timestamp },
                input_tokens,
                output_tokens,
                cache_read_tokens: 0,
                cache_write_tokens: 0,
                reasoning_tokens: 0,
                cost_usd,
                cost_cny,
            });
        }
    }

    pub fn parse_codex_rollout_file(file_path: &Path, records: &mut Vec<TokenRecord>) {
        let file = match File::open(file_path) {
            Ok(f) => f,
            Err(_) => return,
        };

        let reader = BufReader::new(file);
        let session_id = file_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("codex_session")
            .to_string();

        let mut current_model = String::from("gpt-5.5");
        let mut current_project: Option<String> = None;
        let mut current_cwd: Option<String> = None;

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
                let msg_type = json.get("type").and_then(|v| v.as_str()).unwrap_or("");

                // 1. Check for turn_context or session_meta to extract model & project path
                if msg_type == "turn_context" || msg_type == "session_meta" {
                    if let Some(payload) = json.get("payload") {
                        if let Some(m) = payload.get("model").and_then(|v| v.as_str()) {
                            current_model = m.to_string();
                        }
                        if let Some(cwd) = payload.get("cwd").and_then(|v| v.as_str()) {
                            current_cwd = Some(cwd.to_string());
                            let p_name = Path::new(cwd)
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or(cwd)
                                .to_string();
                            current_project = Some(p_name);
                        }
                    }
                }

                // 2. Check for token_count event
                if msg_type == "event_msg" {
                    if let Some(payload) = json.get("payload") {
                        let payload_type = payload.get("type").and_then(|v| v.as_str()).unwrap_or("");
                        if payload_type == "token_count" {
                            let info = payload.get("info");
                            if let Some(info_obj) = info {
                                let usage_obj = info_obj
                                    .get("last_token_usage")
                                    .or_else(|| info_obj.get("total_token_usage"));

                                if let Some(usage) = usage_obj {
                                    let in_tok = usage
                                        .get("input_tokens")
                                        .and_then(|v| v.as_u64())
                                        .unwrap_or(0);
                                    let cached_in = usage
                                        .get("cached_input_tokens")
                                        .and_then(|v| v.as_u64())
                                        .unwrap_or(0);
                                    let out_tok = usage
                                        .get("output_tokens")
                                        .and_then(|v| v.as_u64())
                                        .unwrap_or(0);
                                    let reasoning_tok = usage
                                        .get("reasoning_output_tokens")
                                        .and_then(|v| v.as_u64())
                                        .unwrap_or(0);

                                    if in_tok == 0 && out_tok == 0 && cached_in == 0 {
                                        continue;
                                    }

                                    let timestamp = if let Some(ts_str) = json.get("timestamp").and_then(|v| v.as_str()) {
                                        chrono::DateTime::parse_from_rfc3339(ts_str)
                                            .map(|dt| dt.timestamp_millis())
                                            .unwrap_or_else(|_| chrono::Utc::now().timestamp_millis())
                                    } else {
                                        chrono::Utc::now().timestamp_millis()
                                    };

                                    let (cost_usd, cost_cny, _) = PricingEngine::calculate_cost(
                                        &current_model,
                                        in_tok,
                                        out_tok,
                                        cached_in,
                                        0,
                                    );

                                    records.push(TokenRecord {
                                        id: format!("codex_{}_{}_{}", session_id, line_idx, timestamp),
                                        client: "codex".to_string(),
                                        session_id: session_id.clone(),
                                        project_path: current_cwd.clone(),
                                        project_name: current_project.clone().or_else(|| Some(session_id.clone())),
                                        model: current_model.clone(),
                                        timestamp,
                                        input_tokens: in_tok,
                                        output_tokens: out_tok,
                                        cache_read_tokens: cached_in,
                                        cache_write_tokens: 0,
                                        reasoning_tokens: reasoning_tok,
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
}
