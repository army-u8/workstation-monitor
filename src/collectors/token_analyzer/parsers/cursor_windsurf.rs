use crate::collectors::token_analyzer::pricing::PricingEngine;
use crate::types::TokenRecord;
use rusqlite::Connection;
use serde_json::Value;
use std::path::Path;

pub struct CursorWindsurfParser;

impl CursorWindsurfParser {
    pub fn scan_records(home_dir: &Path) -> Vec<TokenRecord> {
        let mut records = Vec::new();

        // 1. Cursor IDE databases
        let cursor_global = home_dir.join("Library/Application Support/Cursor/User/globalStorage/state.vscdb");
        if cursor_global.exists() {
            Self::parse_vscdb(&cursor_global, "cursor", "Cursor", &mut records);
        }

        let cursor_workspace_dir = home_dir.join("Library/Application Support/Cursor/User/workspaceStorage");
        if cursor_workspace_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&cursor_workspace_dir) {
                for entry in entries.flatten() {
                    let db_path = entry.path().join("state.vscdb");
                    if db_path.exists() {
                        Self::parse_vscdb(&db_path, "cursor", "Cursor", &mut records);
                    }
                }
            }
        }

        // 2. Windsurf IDE databases
        let windsurf_global = home_dir.join("Library/Application Support/Windsurf/User/globalStorage/state.vscdb");
        if windsurf_global.exists() {
            Self::parse_vscdb(&windsurf_global, "windsurf", "Windsurf", &mut records);
        }

        records
    }

    fn parse_vscdb(db_path: &Path, client_id: &str, client_name: &str, records: &mut Vec<TokenRecord>) {
        let conn = match Connection::open_with_flags(
            db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
        ) {
            Ok(c) => c,
            Err(_) => return,
        };

        // Query ItemTable for relevant AI keys
        let mut stmt = match conn.prepare("SELECT key, value FROM ItemTable WHERE key LIKE '%ai%' OR key LIKE '%chat%' OR key LIKE '%prompt%' OR key LIKE '%session%' OR key LIKE '%usage%'") {
            Ok(s) => s,
            Err(_) => return,
        };

        let rows = match stmt.query_map([], |row| {
            let key: String = row.get(0)?;
            let value: String = match row.get::<_, String>(1) {
                Ok(s) => s,
                Err(_) => {
                    // Try as blob
                    if let Ok(bytes) = row.get::<_, Vec<u8>>(1) {
                        String::from_utf8_lossy(&bytes).to_string()
                    } else {
                        String::new()
                    }
                }
            };
            Ok((key, value))
        }) {
            Ok(r) => r,
            Err(_) => return,
        };

        let db_stem = db_path.parent().and_then(|p| p.file_name()).and_then(|n| n.to_str()).unwrap_or("ws");

        for item in rows.flatten() {
            let (key, value) = item;
            if value.is_empty() {
                continue;
            }

            if let Ok(json) = serde_json::from_str::<Value>(&value) {
                Self::extract_from_json(&json, &key, db_stem, client_id, client_name, records);
            }
        }
    }

    fn extract_from_json(
        json: &Value,
        key: &str,
        db_stem: &str,
        client_id: &str,
        _client_name: &str,
        records: &mut Vec<TokenRecord>,
    ) {
        // Look for token numbers or usages inside object or arrays
        if let Some(arr) = json.as_array() {
            for (idx, elem) in arr.iter().enumerate() {
                Self::process_json_node(elem, &format!("{}_{}", key, idx), db_stem, client_id, records);
            }
        } else if json.is_object() {
            Self::process_json_node(json, key, db_stem, client_id, records);
        }
    }

    fn process_json_node(
        json: &Value,
        key: &str,
        db_stem: &str,
        client_id: &str,
        records: &mut Vec<TokenRecord>,
    ) {
        let input_tokens = json
            .get("inputTokens")
            .or_else(|| json.get("prompt_tokens"))
            .or_else(|| json.get("tokensIn"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        let output_tokens = json
            .get("outputTokens")
            .or_else(|| json.get("completion_tokens"))
            .or_else(|| json.get("tokensOut"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        if input_tokens == 0 && output_tokens == 0 {
            // Check if there is an array of messages with token stats
            if let Some(requests) = json.get("requests").or_else(|| json.get("generations")).and_then(|v| v.as_array()) {
                for (idx, req) in requests.iter().enumerate() {
                    Self::process_json_node(req, &format!("{}_req_{}", key, idx), db_stem, client_id, records);
                }
            }
            return;
        }

        let model = json
            .get("model")
            .or_else(|| json.get("modelId"))
            .or_else(|| json.get("model_name"))
            .and_then(|v| v.as_str())
            .unwrap_or(if client_id == "cursor" { "claude-3-5-sonnet" } else { "gpt-4o" });

        let timestamp = json
            .get("timestamp")
            .or_else(|| json.get("createdAt"))
            .and_then(|v| v.as_i64())
            .unwrap_or_else(|| chrono::Utc::now().timestamp_millis());

        let cache_read = json.get("cacheRead").and_then(|v| v.as_u64()).unwrap_or(0);
        let cache_write = json.get("cacheWrite").and_then(|v| v.as_u64()).unwrap_or(0);

        let (cost_usd, cost_cny, _) = PricingEngine::calculate_cost(
            model,
            input_tokens,
            output_tokens,
            cache_read,
            cache_write,
        );

        records.push(TokenRecord {
            id: format!("{}_{}_{}_{}", client_id, db_stem, key, timestamp),
            client: client_id.to_string(),
            session_id: format!("{}_{}", db_stem, key),
            project_path: None,
            project_name: Some(db_stem.to_string()),
            model: model.to_string(),
            timestamp: if timestamp < 10_000_000_000 { timestamp * 1000 } else { timestamp },
            input_tokens,
            output_tokens,
            cache_read_tokens: cache_read,
            cache_write_tokens: cache_write,
            reasoning_tokens: 0,
            cost_usd,
            cost_cny,
        });
    }
}
