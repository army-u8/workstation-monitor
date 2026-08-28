pub mod parsers;
pub mod pricing;

use crate::control::repository::default_database_path;
use crate::types::{
    Claude5hBlockInfo, TokenAgentStats, TokenAnalyticsResponse, TokenHeatmapDay, TokenModelStats,
    TokenProjectStats, TokenRecord, TokenSessionItem, TokenSessionsResponse, TokenTrendPoint,
    TokenUsageSummary,
};
use chrono::{Local, TimeZone, Utc};
use parsers::{
    AntigravityParser, ClaudeCodeParser, ClineRooParser, CursorWindsurfParser, LocalAgentsParser,
    OpenCodeCodexParser,
};
use pricing::PricingEngine;
use rusqlite::{params, Connection};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock, RwLock};

static ANALYZER_INSTANCE: OnceLock<TokenAnalyzerManager> = OnceLock::new();

pub struct TokenAnalyzerManager {
    db_path: PathBuf,
    lock: Mutex<()>,
    cached_records: RwLock<Vec<TokenRecord>>,
}

impl TokenAnalyzerManager {
    pub fn global() -> &'static Self {
        ANALYZER_INSTANCE.get_or_init(|| {
            let path = default_database_path();
            let manager = Self {
                db_path: path,
                lock: Mutex::new(()),
                cached_records: RwLock::new(Vec::new()),
            };
            manager.init_db();
            manager.load_records_since(0);
            manager
        })
    }

    #[cfg(test)]
    pub fn new_with_path(db_path: PathBuf) -> Self {
        let manager = Self {
            db_path,
            lock: Mutex::new(()),
            cached_records: RwLock::new(Vec::new()),
        };
        manager.init_db();
        manager
    }

    fn get_connection(&self) -> Result<Connection, rusqlite::Error> {
        if let Some(parent) = self.db_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let conn = Connection::open(&self.db_path)?;
        conn.busy_timeout(std::time::Duration::from_secs(5))?;
        Ok(conn)
    }

    fn init_db(&self) {
        if let Ok(conn) = self.get_connection() {
            let _ = conn.execute_batch(
                "PRAGMA journal_mode = WAL;
                 PRAGMA synchronous = NORMAL;
                 PRAGMA temp_store = MEMORY;
                 CREATE TABLE IF NOT EXISTS token_records (
                    id TEXT PRIMARY KEY,
                    client TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    project_path TEXT,
                    project_name TEXT,
                    model TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    input_tokens INTEGER NOT NULL DEFAULT 0,
                    output_tokens INTEGER NOT NULL DEFAULT 0,
                    cache_read_tokens INTEGER NOT NULL DEFAULT 0,
                    cache_write_tokens INTEGER NOT NULL DEFAULT 0,
                    reasoning_tokens INTEGER NOT NULL DEFAULT 0,
                    cost_usd REAL NOT NULL DEFAULT 0.0,
                    cost_cny REAL NOT NULL DEFAULT 0.0
                );
                CREATE INDEX IF NOT EXISTS idx_token_records_ts ON token_records(timestamp DESC);
                CREATE INDEX IF NOT EXISTS idx_token_records_client ON token_records(client);
                CREATE INDEX IF NOT EXISTS idx_token_records_model ON token_records(model);",
            );
        }
    }

    pub fn scan_and_sync(&self) -> usize {
        let _guard = self.lock.lock().unwrap();
        let home_dir = std::env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("/Users"));

        let mut all_records = Vec::new();

        // 1. Scan Claude Code
        all_records.extend(ClaudeCodeParser::scan_records(&home_dir));
        // 2. Scan Cursor & Windsurf
        all_records.extend(CursorWindsurfParser::scan_records(&home_dir));
        // 3. Scan Cline & Roo Code
        all_records.extend(ClineRooParser::scan_records(&home_dir));
        // 4. Scan OpenCode, Codex, Goose
        all_records.extend(OpenCodeCodexParser::scan_records(&home_dir));
        // 5. Scan Antigravity / Gemini CLI
        all_records.extend(AntigravityParser::scan_records(&home_dir));
        // 6. Scan Local Agents (Continue, Aider, Kimi, Qwen)
        all_records.extend(LocalAgentsParser::scan_records(&home_dir));

        let count = all_records.len();
        self.save_records(&all_records);
        count
    }

    pub fn save_records(&self, records: &[TokenRecord]) {
        if records.is_empty() {
            return;
        }

        if let Ok(mut cache) = self.cached_records.write() {
            *cache = records.to_vec();
        }

        if let Ok(mut conn) = self.get_connection() {
            if let Ok(tx) = conn.transaction() {
                let _ = tx.execute("DELETE FROM token_records", params![]);
                for r in records {
                    let _ = tx.execute(
                        "INSERT OR REPLACE INTO token_records (
                            id, client, session_id, project_path, project_name, model,
                            timestamp, input_tokens, output_tokens, cache_read_tokens,
                            cache_write_tokens, reasoning_tokens, cost_usd, cost_cny
                        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
                        params![
                            r.id,
                            r.client,
                            r.session_id,
                            r.project_path,
                            r.project_name,
                            r.model,
                            r.timestamp,
                            r.input_tokens,
                            r.output_tokens,
                            r.cache_read_tokens,
                            r.cache_write_tokens,
                            r.reasoning_tokens,
                            r.cost_usd,
                            r.cost_cny
                        ],
                    );
                }
                let _ = tx.commit();
            }
        }
    }

    pub fn get_summary(&self, time_range: Option<&str>) -> TokenUsageSummary {
        // Auto sync if empty
        if self.count_records() == 0 {
            self.scan_and_sync();
        }

        let cutoff = self.resolve_cutoff_timestamp(time_range);
        let records = self.load_records_since(cutoff);
        self.compute_summary(&records)
    }

    pub fn compute_summary(&self, records: &[TokenRecord]) -> TokenUsageSummary {
        let mut total_in = 0;
        let mut total_out = 0;
        let mut total_cache_read = 0;
        let mut total_cache_write = 0;
        let mut total_reasoning = 0;
        let mut total_cost_usd = 0.0;
        let mut total_cost_cny = 0.0;
        let mut total_savings_usd = 0.0;

        let mut unique_agents = HashSet::new();
        let mut unique_sessions = HashSet::new();

        for r in records {
            total_in += r.input_tokens;
            total_out += r.output_tokens;
            total_cache_read += r.cache_read_tokens;
            total_cache_write += r.cache_write_tokens;
            total_reasoning += r.reasoning_tokens;
            total_cost_usd += r.cost_usd;
            total_cost_cny += r.cost_cny;

            let price = PricingEngine::get_model_price(&r.model);
            if price.input_per_m > price.cache_read_per_m && r.cache_read_tokens > 0 {
                total_savings_usd += (r.cache_read_tokens as f64 / 1_000_000.0)
                    * (price.input_per_m - price.cache_read_per_m);
            }

            unique_agents.insert(&r.client);
            unique_sessions.insert(&r.session_id);
        }

        let total_tokens = total_in + total_out + total_cache_read + total_cache_write;
        let total_savings_cny = total_savings_usd * pricing::USD_TO_CNY_RATE;

        let cache_hit_rate_pct = if (total_in + total_cache_read) > 0 {
            (total_cache_read as f64 / (total_in + total_cache_read) as f64) * 100.0
        } else {
            0.0
        };

        let claude_5h_block = self.calculate_claude_5h_block(records);

        TokenUsageSummary {
            total_input_tokens: total_in,
            total_output_tokens: total_out,
            total_cache_read_tokens: total_cache_read,
            total_cache_write_tokens: total_cache_write,
            total_reasoning_tokens: total_reasoning,
            total_tokens,
            total_cost_usd: (total_cost_usd * 1000.0).round() / 1000.0,
            total_cost_cny: (total_cost_cny * 100.0).round() / 100.0,
            cache_savings_usd: (total_savings_usd * 100.0).round() / 100.0,
            cache_savings_cny: (total_savings_cny * 100.0).round() / 100.0,
            cache_hit_rate_pct: (cache_hit_rate_pct * 10.0).round() / 10.0,
            active_agents_count: unique_agents.len(),
            total_sessions_count: unique_sessions.len(),
            total_requests_count: records.len(),
            claude_5h_block,
            last_scanned_at: chrono::Utc::now().timestamp_millis(),
        }
    }

    fn compute_summary_from_refs(&self, records: &[&TokenRecord]) -> TokenUsageSummary {
        let mut total_in = 0;
        let mut total_out = 0;
        let mut total_cache_read = 0;
        let mut total_cache_write = 0;
        let mut total_reasoning = 0;
        let mut total_cost_usd = 0.0;
        let mut total_cost_cny = 0.0;
        let mut total_savings_usd = 0.0;

        let mut unique_agents = HashSet::new();
        let mut unique_sessions = HashSet::new();

        for r in records {
            total_in += r.input_tokens;
            total_out += r.output_tokens;
            total_cache_read += r.cache_read_tokens;
            total_cache_write += r.cache_write_tokens;
            total_reasoning += r.reasoning_tokens;
            total_cost_usd += r.cost_usd;
            total_cost_cny += r.cost_cny;

            let price = PricingEngine::get_model_price(&r.model);
            if price.input_per_m > price.cache_read_per_m && r.cache_read_tokens > 0 {
                total_savings_usd += (r.cache_read_tokens as f64 / 1_000_000.0)
                    * (price.input_per_m - price.cache_read_per_m);
            }

            unique_agents.insert(&r.client);
            unique_sessions.insert(&r.session_id);
        }

        let total_tokens = total_in + total_out + total_cache_read + total_cache_write;
        let total_savings_cny = total_savings_usd * pricing::USD_TO_CNY_RATE;

        let cache_hit_rate_pct = if (total_in + total_cache_read) > 0 {
            (total_cache_read as f64 / (total_in + total_cache_read) as f64) * 100.0
        } else {
            0.0
        };

        let claude_5h_block = self.calculate_claude_5h_block_from_refs(records);

        TokenUsageSummary {
            total_input_tokens: total_in,
            total_output_tokens: total_out,
            total_cache_read_tokens: total_cache_read,
            total_cache_write_tokens: total_cache_write,
            total_reasoning_tokens: total_reasoning,
            total_tokens,
            total_cost_usd: (total_cost_usd * 1000.0).round() / 1000.0,
            total_cost_cny: (total_cost_cny * 100.0).round() / 100.0,
            cache_savings_usd: (total_savings_usd * 100.0).round() / 100.0,
            cache_savings_cny: (total_savings_cny * 100.0).round() / 100.0,
            cache_hit_rate_pct: (cache_hit_rate_pct * 10.0).round() / 10.0,
            active_agents_count: unique_agents.len(),
            total_sessions_count: unique_sessions.len(),
            total_requests_count: records.len(),
            claude_5h_block,
            last_scanned_at: chrono::Utc::now().timestamp_millis(),
        }
    }

    pub fn get_analytics(&self, time_range: Option<&str>) -> TokenAnalyticsResponse {
        if self.count_records() == 0 {
            self.scan_and_sync();
        }

        // Ensure cache is loaded
        {
            let is_empty = self.cached_records.read().map(|c| c.is_empty()).unwrap_or(true);
            if is_empty {
                self.load_records_since(0);
            }
        }

        let cache_guard = self.cached_records.read().unwrap();
        let records: &[TokenRecord] = &cache_guard;

        // 1. Heatmap (365 days)
        let heatmap = self.build_heatmap(records);

        // 2. Trend lines (24h, 7d, 30d)
        let trend_24h = self.build_hourly_trend(records, 24);
        let trend_7d = self.build_daily_trend(records, 7);
        let trend_30d = self.build_daily_trend(records, 30);

        let cutoff_selected = self.resolve_cutoff_timestamp(time_range);
        let selected_records: Vec<&TokenRecord> = records
            .iter()
            .filter(|r| r.timestamp >= cutoff_selected)
            .collect();

        let summary = self.compute_summary_from_refs(&selected_records);
        let models = self.build_model_stats_from_refs(&selected_records, summary.total_tokens);
        let agents = self.build_agent_stats_from_refs(&selected_records, summary.total_tokens);
        let projects = self.build_project_stats_from_refs(&selected_records, summary.total_tokens);

        TokenAnalyticsResponse {
            summary,
            heatmap,
            trend_24h,
            trend_7d,
            trend_30d,
            models,
            agents,
            projects,
        }
    }

    pub fn get_sessions(&self, limit: usize, offset: usize, client_filter: Option<&str>) -> TokenSessionsResponse {
        {
            if let Ok(cache) = self.cached_records.read() {
                if !cache.is_empty() {
                    let filtered: Vec<&TokenRecord> = if let Some(client) = client_filter {
                        cache.iter().filter(|r| r.client == client).collect()
                    } else {
                        cache.iter().collect()
                    };

                    let total_count = filtered.len();
                    let page: Vec<TokenSessionItem> = filtered
                        .into_iter()
                        .rev()
                        .skip(offset)
                        .take(limit)
                        .map(|r| {
                            let total = r.input_tokens + r.output_tokens + r.cache_read_tokens + r.cache_write_tokens;
                            TokenSessionItem {
                                id: r.id.clone(),
                                client: r.client.clone(),
                                session_id: r.session_id.clone(),
                                project_name: r.project_name.clone(),
                                model: PricingEngine::format_model_name(&r.model),
                                timestamp: r.timestamp,
                                input_tokens: r.input_tokens,
                                output_tokens: r.output_tokens,
                                cache_read_tokens: r.cache_read_tokens,
                                cache_write_tokens: r.cache_write_tokens,
                                total_tokens: total,
                                cost_usd: (r.cost_usd * 1000.0).round() / 1000.0,
                            }
                        })
                        .collect();

                    return TokenSessionsResponse {
                        sessions: page,
                        total_count,
                    };
                }
            }
        }

        let conn = match self.get_connection() {
            Ok(c) => c,
            Err(_) => {
                return TokenSessionsResponse {
                    sessions: Vec::new(),
                    total_count: 0,
                }
            }
        };

        let (query, count_query) = if let Some(client) = client_filter {
            (
                format!("SELECT id, client, session_id, project_name, model, timestamp, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd FROM token_records WHERE client = '{}' ORDER BY timestamp DESC LIMIT {} OFFSET {}", client, limit, offset),
                format!("SELECT COUNT(*) FROM token_records WHERE client = '{}'", client)
            )
        } else {
            (
                format!("SELECT id, client, session_id, project_name, model, timestamp, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd FROM token_records ORDER BY timestamp DESC LIMIT {} OFFSET {}", limit, offset),
                "SELECT COUNT(*) FROM token_records".to_string()
            )
        };

        let total_count: usize = conn.query_row(&count_query, [], |r| r.get(0)).unwrap_or(0);

        let mut stmt = match conn.prepare(&query) {
            Ok(s) => s,
            Err(_) => {
                return TokenSessionsResponse {
                    sessions: Vec::new(),
                    total_count,
                }
            }
        };

        let sessions = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                let client: String = row.get(1)?;
                let session_id: String = row.get(2)?;
                let project_name: Option<String> = row.get(3)?;
                let model: String = row.get(4)?;
                let timestamp: i64 = row.get(5)?;
                let in_tok: i64 = row.get(6)?;
                let out_tok: i64 = row.get(7)?;
                let cache_read: i64 = row.get(8)?;
                let cache_write: i64 = row.get(9)?;
                let cost_usd: f64 = row.get(10)?;

                let in_u64 = in_tok.max(0) as u64;
                let out_u64 = out_tok.max(0) as u64;
                let cache_r_u64 = cache_read.max(0) as u64;
                let cache_w_u64 = cache_write.max(0) as u64;
                let total = in_u64 + out_u64 + cache_r_u64 + cache_w_u64;

                Ok(TokenSessionItem {
                    id,
                    client,
                    session_id,
                    project_name,
                    model: PricingEngine::format_model_name(&model),
                    timestamp,
                    input_tokens: in_u64,
                    output_tokens: out_u64,
                    cache_read_tokens: cache_r_u64,
                    cache_write_tokens: cache_w_u64,
                    total_tokens: total,
                    cost_usd: (cost_usd * 1000.0).round() / 1000.0,
                })
            })
            .map(|rows| rows.flatten().collect())
            .unwrap_or_default();

        TokenSessionsResponse {
            sessions,
            total_count,
        }
    }

    fn calculate_claude_5h_block(&self, records: &[TokenRecord]) -> Option<Claude5hBlockInfo> {
        let now = Utc::now().timestamp_millis();
        let five_hours_ago = now - (5 * 3600 * 1000);

        let claude_records: Vec<&TokenRecord> = records
            .iter()
            .filter(|r| r.client == "claude_code" && r.timestamp >= five_hours_ago)
            .collect();

        if claude_records.is_empty() {
            return None;
        }

        let mut block_tokens = 0;
        let mut block_cost = 0.0;
        let mut oldest_ts = now;
        let mut newest_ts = five_hours_ago;

        for r in &claude_records {
            block_tokens += r.input_tokens + r.output_tokens + r.cache_read_tokens + r.cache_write_tokens;
            block_cost += r.cost_usd;
            if r.timestamp < oldest_ts {
                oldest_ts = r.timestamp;
            }
            if r.timestamp > newest_ts {
                newest_ts = r.timestamp;
            }
        }

        let block_start = oldest_ts;
        let block_end = block_start + (5 * 3600 * 1000);
        let resets_in_seconds = ((block_end - now) / 1000).max(0);

        let duration_mins = (((newest_ts - oldest_ts) / 60000).max(1)) as f64;
        let burn_rate = (block_tokens as f64 / duration_mins).round();

        Some(Claude5hBlockInfo {
            is_active: resets_in_seconds > 0,
            block_start_at: block_start,
            block_end_at: block_end,
            resets_in_seconds,
            current_tokens: block_tokens,
            current_cost_usd: (block_cost * 100.0).round() / 100.0,
            request_count: claude_records.len(),
            burn_rate_tokens_per_min: burn_rate,
        })
    }

    fn calculate_claude_5h_block_from_refs(&self, records: &[&TokenRecord]) -> Option<Claude5hBlockInfo> {
        let now = Utc::now().timestamp_millis();
        let five_hours_ago = now - (5 * 3600 * 1000);

        let claude_records: Vec<&&TokenRecord> = records
            .iter()
            .filter(|r| r.client == "claude_code" && r.timestamp >= five_hours_ago)
            .collect();

        if claude_records.is_empty() {
            return None;
        }

        let mut block_tokens = 0;
        let mut block_cost = 0.0;
        let mut oldest_ts = now;
        let mut newest_ts = five_hours_ago;

        for r in &claude_records {
            block_tokens += r.input_tokens + r.output_tokens + r.cache_read_tokens + r.cache_write_tokens;
            block_cost += r.cost_usd;
            if r.timestamp < oldest_ts {
                oldest_ts = r.timestamp;
            }
            if r.timestamp > newest_ts {
                newest_ts = r.timestamp;
            }
        }

        let block_start = oldest_ts;
        let block_end = block_start + (5 * 3600 * 1000);
        let resets_in_seconds = ((block_end - now) / 1000).max(0);

        let duration_mins = (((newest_ts - oldest_ts) / 60000).max(1)) as f64;
        let burn_rate = (block_tokens as f64 / duration_mins).round();

        Some(Claude5hBlockInfo {
            is_active: resets_in_seconds > 0,
            block_start_at: block_start,
            block_end_at: block_end,
            resets_in_seconds,
            current_tokens: block_tokens,
            current_cost_usd: (block_cost * 100.0).round() / 100.0,
            request_count: claude_records.len(),
            burn_rate_tokens_per_min: burn_rate,
        })
    }

    fn build_heatmap(&self, records: &[TokenRecord]) -> Vec<TokenHeatmapDay> {
        let mut day_map: BTreeMap<String, (u64, f64, usize)> = BTreeMap::new();

        // Initialize last 365 days
        let now = Local::now();
        for i in (0..365).rev() {
            let day = now - chrono::Duration::days(i);
            let date_str = day.format("%Y-%m-%d").to_string();
            day_map.insert(date_str, (0, 0.0, 0));
        }

        for r in records {
            let dt = Local.timestamp_millis_opt(r.timestamp).single().unwrap_or(now);
            let date_str = dt.format("%Y-%m-%d").to_string();
            if let Some(entry) = day_map.get_mut(&date_str) {
                entry.0 += r.input_tokens + r.output_tokens + r.cache_read_tokens + r.cache_write_tokens;
                entry.1 += r.cost_usd;
                entry.2 += 1;
            }
        }

        // Find max tokens for intensity scale
        let max_tokens = day_map.values().map(|v| v.0).max().unwrap_or(1).max(1);

        day_map
            .into_iter()
            .map(|(date, (toks, cost_usd, reqs))| {
                let level = if toks == 0 {
                    0
                } else if toks < max_tokens / 10 {
                    1
                } else if toks < max_tokens / 4 {
                    2
                } else if toks < max_tokens / 2 {
                    3
                } else {
                    4
                };

                TokenHeatmapDay {
                    date,
                    total_tokens: toks,
                    cost_usd: (cost_usd * 100.0).round() / 100.0,
                    cost_cny: (cost_usd * pricing::USD_TO_CNY_RATE * 100.0).round() / 100.0,
                    requests_count: reqs,
                    level,
                }
            })
            .collect()
    }

    fn build_hourly_trend(&self, records: &[TokenRecord], hours: i64) -> Vec<TokenTrendPoint> {
        let mut hour_map: BTreeMap<String, (i64, u64, u64, u64, u64, f64)> = BTreeMap::new();
        let local_now = Local::now();

        for i in (0..hours).rev() {
            let h = local_now - chrono::Duration::hours(i);
            let label = h.format("%H:00").to_string();
            hour_map.insert(label, (h.timestamp_millis(), 0, 0, 0, 0, 0.0));
        }

        for r in records {
            let dt = Local.timestamp_millis_opt(r.timestamp).single().unwrap_or(local_now);
            let label = dt.format("%H:00").to_string();
            if let Some(entry) = hour_map.get_mut(&label) {
                entry.1 += r.input_tokens;
                entry.2 += r.output_tokens;
                entry.3 += r.cache_read_tokens;
                entry.4 += r.cache_write_tokens;
                entry.5 += r.cost_usd;
            }
        }

        hour_map
            .into_iter()
            .map(|(label, (ts, in_tok, out_tok, cache_r, cache_w, cost))| {
                TokenTrendPoint {
                    label,
                    timestamp: ts,
                    input_tokens: in_tok,
                    output_tokens: out_tok,
                    cache_read_tokens: cache_r,
                    cache_write_tokens: cache_w,
                    total_tokens: in_tok + out_tok + cache_r + cache_w,
                    cost_usd: (cost * 1000.0).round() / 1000.0,
                }
            })
            .collect()
    }

    fn build_daily_trend(&self, records: &[TokenRecord], days: i64) -> Vec<TokenTrendPoint> {
        let mut day_map: BTreeMap<String, (i64, u64, u64, u64, u64, f64)> = BTreeMap::new();
        let local_now = Local::now();

        for i in (0..days).rev() {
            let d = local_now - chrono::Duration::days(i);
            let label = d.format("%m/%d").to_string();
            day_map.insert(label, (d.timestamp_millis(), 0, 0, 0, 0, 0.0));
        }

        for r in records {
            let dt = Local.timestamp_millis_opt(r.timestamp).single().unwrap_or(local_now);
            let label = dt.format("%m/%d").to_string();
            if let Some(entry) = day_map.get_mut(&label) {
                entry.1 += r.input_tokens;
                entry.2 += r.output_tokens;
                entry.3 += r.cache_read_tokens;
                entry.4 += r.cache_write_tokens;
                entry.5 += r.cost_usd;
            }
        }

        day_map
            .into_iter()
            .map(|(label, (ts, in_tok, out_tok, cache_r, cache_w, cost))| {
                TokenTrendPoint {
                    label,
                    timestamp: ts,
                    input_tokens: in_tok,
                    output_tokens: out_tok,
                    cache_read_tokens: cache_r,
                    cache_write_tokens: cache_w,
                    total_tokens: in_tok + out_tok + cache_r + cache_w,
                    cost_usd: (cost * 100.0).round() / 100.0,
                }
            })
            .collect()
    }

    #[allow(dead_code)]
    fn build_model_stats(&self, records: &[TokenRecord], total_tokens: u64) -> Vec<TokenModelStats> {
        let mut map: HashMap<String, (u64, u64, u64, f64, usize)> = HashMap::new();

        for r in records {
            let entry = map.entry(r.model.clone()).or_insert((0, 0, 0, 0.0, 0));
            entry.0 += r.input_tokens;
            entry.1 += r.output_tokens;
            entry.2 += r.cache_read_tokens;
            entry.3 += r.cost_usd;
            entry.4 += 1;
        }

        let mut list: Vec<TokenModelStats> = map
            .into_iter()
            .map(|(model, (in_tok, out_tok, cache_r, cost_usd, reqs))| {
                let total = in_tok + out_tok + cache_r;
                let (provider_name, _) = PricingEngine::resolve_provider(&model);
                let pct = if total_tokens > 0 {
                    (total as f64 / total_tokens as f64) * 100.0
                } else {
                    0.0
                };

                TokenModelStats {
                    model: model.clone(),
                    display_name: PricingEngine::format_model_name(&model),
                    provider: provider_name.to_string(),
                    input_tokens: in_tok,
                    output_tokens: out_tok,
                    cache_read_tokens: cache_r,
                    total_tokens: total,
                    cost_usd: (cost_usd * 1000.0).round() / 1000.0,
                    cost_cny: (cost_usd * pricing::USD_TO_CNY_RATE * 100.0).round() / 100.0,
                    percentage: (pct * 10.0).round() / 10.0,
                    requests_count: reqs,
                }
            })
            .collect();

        list.sort_by(|a, b| b.total_tokens.cmp(&a.total_tokens));
        list
    }

    #[allow(dead_code)]
    fn build_agent_stats(&self, records: &[TokenRecord], total_tokens: u64) -> Vec<TokenAgentStats> {
        let mut map: HashMap<String, (u64, u64, u64, f64, HashSet<String>)> = HashMap::new();

        for r in records {
            let entry = map.entry(r.client.clone()).or_insert((0, 0, 0, 0.0, HashSet::new()));
            entry.0 += r.input_tokens;
            entry.1 += r.output_tokens;
            entry.2 += r.cache_read_tokens + r.cache_write_tokens;
            entry.3 += r.cost_usd;
            entry.4.insert(r.session_id.clone());
        }

        let mut list: Vec<TokenAgentStats> = map
            .into_iter()
            .map(|(client, (in_tok, out_tok, cache_tok, cost_usd, sessions))| {
                let total = in_tok + out_tok + cache_tok;
                let pct = if total_tokens > 0 {
                    (total as f64 / total_tokens as f64) * 100.0
                } else {
                    0.0
                };

                let (name, icon) = match client.as_str() {
                    "claude_code" => ("Claude Code".to_string(), "sparkles"),
                    "cursor" => ("Cursor IDE".to_string(), "code"),
                    "windsurf" => ("Windsurf IDE".to_string(), "bolt"),
                    "cline" => ("Cline Agent".to_string(), "robot"),
                    "roo_code" => ("Roo Code".to_string(), "robot"),
                    "antigravity" => ("Google Antigravity".to_string(), "antenna"),
                    "codex" => ("OpenAI Codex".to_string(), "brain"),
                    "opencode" => ("OpenCode".to_string(), "code"),
                    "continue" => ("Continue.dev".to_string(), "terminal"),
                    "aider" => ("Aider Pair".to_string(), "terminal"),
                    "kimi" => ("Kimi CLI".to_string(), "flame"),
                    "qwen" => ("Qwen Code".to_string(), "brain"),
                    "goose" => ("Goose Agent".to_string(), "robot"),
                    _ => (client.clone(), "robot"),
                };

                TokenAgentStats {
                    agent_id: client,
                    name,
                    icon: icon.to_string(),
                    input_tokens: in_tok,
                    output_tokens: out_tok,
                    cache_tokens: cache_tok,
                    total_tokens: total,
                    cost_usd: (cost_usd * 1000.0).round() / 1000.0,
                    cost_cny: (cost_usd * pricing::USD_TO_CNY_RATE * 100.0).round() / 100.0,
                    percentage: (pct * 10.0).round() / 10.0,
                    sessions_count: sessions.len(),
                }
            })
            .collect();

        list.sort_by(|a, b| b.total_tokens.cmp(&a.total_tokens));
        list
    }

    #[allow(dead_code)]
    fn build_project_stats(&self, records: &[TokenRecord], total_tokens: u64) -> Vec<TokenProjectStats> {
        let mut map: HashMap<String, (Option<String>, u64, f64, usize)> = HashMap::new();

        for r in records {
            let proj_name = r.project_name.clone().unwrap_or_else(|| "General Workspace".to_string());
            let entry = map.entry(proj_name).or_insert((r.project_path.clone(), 0, 0.0, 0));
            entry.1 += r.input_tokens + r.output_tokens + r.cache_read_tokens + r.cache_write_tokens;
            entry.2 += r.cost_usd;
            entry.3 += 1;
        }

        let mut list: Vec<TokenProjectStats> = map
            .into_iter()
            .map(|(name, (path, total, cost_usd, reqs))| {
                let pct = if total_tokens > 0 {
                    (total as f64 / total_tokens as f64) * 100.0
                } else {
                    0.0
                };

                TokenProjectStats {
                    project_name: name,
                    project_path: path,
                    total_tokens: total,
                    cost_usd: (cost_usd * 1000.0).round() / 1000.0,
                    cost_cny: (cost_usd * pricing::USD_TO_CNY_RATE * 100.0).round() / 100.0,
                    percentage: (pct * 10.0).round() / 10.0,
                    requests_count: reqs,
                }
            })
            .collect();

        list.sort_by(|a, b| b.total_tokens.cmp(&a.total_tokens));
        list
    }

    fn build_model_stats_from_refs(&self, records: &[&TokenRecord], total_tokens: u64) -> Vec<TokenModelStats> {
        let mut map: HashMap<String, (u64, u64, u64, f64, usize)> = HashMap::new();

        for r in records {
            let entry = map.entry(r.model.clone()).or_insert((0, 0, 0, 0.0, 0));
            entry.0 += r.input_tokens;
            entry.1 += r.output_tokens;
            entry.2 += r.cache_read_tokens;
            entry.3 += r.cost_usd;
            entry.4 += 1;
        }

        let mut list: Vec<TokenModelStats> = map
            .into_iter()
            .map(|(model, (in_tok, out_tok, cache_r, cost_usd, reqs))| {
                let total = in_tok + out_tok + cache_r;
                let (provider_name, _) = PricingEngine::resolve_provider(&model);
                let pct = if total_tokens > 0 {
                    (total as f64 / total_tokens as f64) * 100.0
                } else {
                    0.0
                };

                TokenModelStats {
                    model: model.clone(),
                    display_name: PricingEngine::format_model_name(&model),
                    provider: provider_name.to_string(),
                    input_tokens: in_tok,
                    output_tokens: out_tok,
                    cache_read_tokens: cache_r,
                    total_tokens: total,
                    cost_usd: (cost_usd * 1000.0).round() / 1000.0,
                    cost_cny: (cost_usd * pricing::USD_TO_CNY_RATE * 100.0).round() / 100.0,
                    percentage: (pct * 10.0).round() / 10.0,
                    requests_count: reqs,
                }
            })
            .collect();

        list.sort_by(|a, b| b.total_tokens.cmp(&a.total_tokens));
        list
    }

    fn build_agent_stats_from_refs(&self, records: &[&TokenRecord], total_tokens: u64) -> Vec<TokenAgentStats> {
        let mut map: HashMap<String, (u64, u64, u64, f64, HashSet<String>)> = HashMap::new();

        for r in records {
            let entry = map.entry(r.client.clone()).or_insert((0, 0, 0, 0.0, HashSet::new()));
            entry.0 += r.input_tokens;
            entry.1 += r.output_tokens;
            entry.2 += r.cache_read_tokens + r.cache_write_tokens;
            entry.3 += r.cost_usd;
            entry.4.insert(r.session_id.clone());
        }

        let mut list: Vec<TokenAgentStats> = map
            .into_iter()
            .map(|(client, (in_tok, out_tok, cache_tok, cost_usd, sessions))| {
                let total = in_tok + out_tok + cache_tok;
                let pct = if total_tokens > 0 {
                    (total as f64 / total_tokens as f64) * 100.0
                } else {
                    0.0
                };

                let (name, icon) = match client.as_str() {
                    "claude_code" => ("Claude Code".to_string(), "sparkles"),
                    "cursor" => ("Cursor IDE".to_string(), "code"),
                    "windsurf" => ("Windsurf IDE".to_string(), "bolt"),
                    "cline" => ("Cline Agent".to_string(), "robot"),
                    "roo_code" => ("Roo Code".to_string(), "robot"),
                    "antigravity" => ("Google Antigravity".to_string(), "antenna"),
                    "codex" => ("OpenAI Codex".to_string(), "brain"),
                    "opencode" => ("OpenCode".to_string(), "code"),
                    "continue" => ("Continue.dev".to_string(), "terminal"),
                    "aider" => ("Aider Pair".to_string(), "terminal"),
                    "kimi" => ("Kimi CLI".to_string(), "flame"),
                    "qwen" => ("Qwen Code".to_string(), "brain"),
                    "goose" => ("Goose Agent".to_string(), "robot"),
                    _ => (client.clone(), "robot"),
                };

                TokenAgentStats {
                    agent_id: client,
                    name,
                    icon: icon.to_string(),
                    input_tokens: in_tok,
                    output_tokens: out_tok,
                    cache_tokens: cache_tok,
                    total_tokens: total,
                    cost_usd: (cost_usd * 1000.0).round() / 1000.0,
                    cost_cny: (cost_usd * pricing::USD_TO_CNY_RATE * 100.0).round() / 100.0,
                    percentage: (pct * 10.0).round() / 10.0,
                    sessions_count: sessions.len(),
                }
            })
            .collect();

        list.sort_by(|a, b| b.total_tokens.cmp(&a.total_tokens));
        list
    }

    fn build_project_stats_from_refs(&self, records: &[&TokenRecord], total_tokens: u64) -> Vec<TokenProjectStats> {
        let mut map: HashMap<String, (Option<String>, u64, f64, usize)> = HashMap::new();

        for r in records {
            let proj_name = r.project_name.clone().unwrap_or_else(|| "General Workspace".to_string());
            let entry = map.entry(proj_name).or_insert((r.project_path.clone(), 0, 0.0, 0));
            entry.1 += r.input_tokens + r.output_tokens + r.cache_read_tokens + r.cache_write_tokens;
            entry.2 += r.cost_usd;
            entry.3 += 1;
        }

        let mut list: Vec<TokenProjectStats> = map
            .into_iter()
            .map(|(name, (path, total, cost_usd, reqs))| {
                let pct = if total_tokens > 0 {
                    (total as f64 / total_tokens as f64) * 100.0
                } else {
                    0.0
                };

                TokenProjectStats {
                    project_name: name,
                    project_path: path,
                    total_tokens: total,
                    cost_usd: (cost_usd * 1000.0).round() / 1000.0,
                    cost_cny: (cost_usd * pricing::USD_TO_CNY_RATE * 100.0).round() / 100.0,
                    percentage: (pct * 10.0).round() / 10.0,
                    requests_count: reqs,
                }
            })
            .collect();

        list.sort_by(|a, b| b.total_tokens.cmp(&a.total_tokens));
        list
    }

    fn load_records_since(&self, since_timestamp: i64) -> Vec<TokenRecord> {
        {
            if let Ok(cache) = self.cached_records.read() {
                if !cache.is_empty() {
                    return cache
                        .iter()
                        .filter(|r| r.timestamp >= since_timestamp)
                        .cloned()
                        .collect();
                }
            }
        }

        let conn = match self.get_connection() {
            Ok(c) => c,
            Err(_) => return Vec::new(),
        };

        let mut stmt = match conn.prepare(
            "SELECT id, client, session_id, project_path, project_name, model,
                    timestamp, input_tokens, output_tokens, cache_read_tokens,
                    cache_write_tokens, reasoning_tokens, cost_usd, cost_cny
             FROM token_records ORDER BY timestamp ASC",
        ) {
            Ok(s) => s,
            Err(_) => return Vec::new(),
        };

        let all_records: Vec<TokenRecord> = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                let client: String = row.get(1)?;
                let session_id: String = row.get(2)?;
                let project_path: Option<String> = row.get(3)?;
                let project_name: Option<String> = row.get(4)?;
                let model: String = row.get(5)?;
                let timestamp: i64 = row.get(6)?;
                let input_tokens: i64 = row.get(7)?;
                let output_tokens: i64 = row.get(8)?;
                let cache_read_tokens: i64 = row.get(9)?;
                let cache_write_tokens: i64 = row.get(10)?;
                let reasoning_tokens: i64 = row.get(11)?;
                let cost_usd: f64 = row.get(12)?;
                let cost_cny: f64 = row.get(13)?;

                Ok(TokenRecord {
                    id,
                    client,
                    session_id,
                    project_path,
                    project_name,
                    model,
                    timestamp,
                    input_tokens: input_tokens.max(0) as u64,
                    output_tokens: output_tokens.max(0) as u64,
                    cache_read_tokens: cache_read_tokens.max(0) as u64,
                    cache_write_tokens: cache_write_tokens.max(0) as u64,
                    reasoning_tokens: reasoning_tokens.max(0) as u64,
                    cost_usd,
                    cost_cny,
                })
            })
            .map(|rows| rows.flatten().collect())
            .unwrap_or_default();

        let filtered = all_records
            .iter()
            .filter(|r| r.timestamp >= since_timestamp)
            .cloned()
            .collect();

        if let Ok(mut cache) = self.cached_records.write() {
            *cache = all_records;
        }

        filtered
    }

    fn count_records(&self) -> usize {
        if let Ok(conn) = self.get_connection() {
            conn.query_row("SELECT COUNT(*) FROM token_records", [], |r| r.get(0)).unwrap_or(0)
        } else {
            0
        }
    }

    fn resolve_cutoff_timestamp(&self, time_range: Option<&str>) -> i64 {
        let now = Utc::now().timestamp_millis();
        match time_range.unwrap_or("30d") {
            "today" | "24h" | "1d" => now - (24 * 3600 * 1000),
            "7d" => now - (7 * 86400 * 1000),
            "30d" => now - (30 * 86400 * 1000),
            "90d" => now - (90 * 86400 * 1000),
            "year" | "365d" => now - (365 * 86400 * 1000),
            "all" => 0,
            _ => now - (30 * 86400 * 1000),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pricing_engine_calculations() {
        let (cost_usd, cost_cny, savings_usd) = PricingEngine::calculate_cost(
            "claude-3-7-sonnet-20250219",
            1_000_000, // 1M in = $3.00
            100_000,   // 100k out = $1.50
            500_000,   // 500k cache read = $0.15 (saved $1.35)
            0,
        );

        assert!((cost_usd - 4.65).abs() < 0.01);
        assert!((cost_cny - 4.65 * pricing::USD_TO_CNY_RATE).abs() < 0.05);
        assert!((savings_usd - 1.35).abs() < 0.01);
    }

    #[test]
    fn test_model_provider_resolution() {
        assert_eq!(PricingEngine::resolve_provider("claude-3-5-sonnet").0, "Anthropic");
        assert_eq!(PricingEngine::resolve_provider("gpt-4o").0, "OpenAI");
        assert_eq!(PricingEngine::resolve_provider("deepseek-chat").0, "DeepSeek");
        assert_eq!(PricingEngine::resolve_provider("gemini-2.0-flash").0, "Google");
        assert_eq!(PricingEngine::resolve_provider("mistral-large").0, "Mistral AI");
        assert_eq!(PricingEngine::resolve_provider("qwen2.5-coder-32b").0, "Alibaba Cloud");
        assert_eq!(PricingEngine::resolve_provider("llama-3.3-70b").0, "Meta");
        assert_eq!(PricingEngine::resolve_provider("ollama-qwen").0, "Ollama Local");
    }

    #[test]
    fn test_dynamic_model_formatting() {
        assert_eq!(PricingEngine::format_model_name("claude-3-7-sonnet-20250219"), "Claude 3.7 Sonnet");
        assert_eq!(PricingEngine::format_model_name("gpt-4.5-preview-2025-02-27"), "GPT-4.5 Preview");
        assert_eq!(PricingEngine::format_model_name("openrouter/deepseek/deepseek-r1"), "DeepSeek R1");
        assert_eq!(PricingEngine::format_model_name("my_custom_code_agent_v2"), "My Custom Code Agent V2");
    }

    #[test]
    fn test_token_analyzer_sqlite_persistence() {
        let temp_dir = std::env::temp_dir().join(format!("test-token-db-{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let db_path = temp_dir.join("test_vibedesk.db");

        let manager = TokenAnalyzerManager::new_with_path(db_path.clone());

        let test_records = vec![
            TokenRecord {
                id: "test_rec_1".to_string(),
                client: "claude_code".to_string(),
                session_id: "sess_1".to_string(),
                project_path: Some("/Users/test/my_project".to_string()),
                project_name: Some("my_project".to_string()),
                model: "claude-3-7-sonnet".to_string(),
                timestamp: Utc::now().timestamp_millis() - 1000,
                input_tokens: 10_000,
                output_tokens: 2_000,
                cache_read_tokens: 5_000,
                cache_write_tokens: 1_000,
                reasoning_tokens: 0,
                cost_usd: 0.06,
                cost_cny: 0.435,
            },
            TokenRecord {
                id: "test_rec_2".to_string(),
                client: "cursor".to_string(),
                session_id: "sess_2".to_string(),
                project_path: None,
                project_name: Some("cursor_workspace".to_string()),
                model: "gpt-4o".to_string(),
                timestamp: Utc::now().timestamp_millis() - 2000,
                input_tokens: 20_000,
                output_tokens: 1_000,
                cache_read_tokens: 0,
                cache_write_tokens: 0,
                reasoning_tokens: 0,
                cost_usd: 0.06,
                cost_cny: 0.435,
            },
        ];

        manager.save_records(&test_records);
        assert_eq!(manager.count_records(), 2);

        let summary = manager.get_summary(Some("today"));
        assert_eq!(summary.total_requests_count, 2);
        assert_eq!(summary.active_agents_count, 2);
        assert_eq!(summary.total_input_tokens, 30_000);
        assert_eq!(summary.total_output_tokens, 3_000);

        let analytics = manager.get_analytics(Some("today"));
        assert_eq!(analytics.models.len(), 2);
        assert_eq!(analytics.agents.len(), 2);
        assert_eq!(analytics.projects.len(), 2);

        let sessions = manager.get_sessions(10, 0, None);
        assert_eq!(sessions.total_count, 2);
        assert_eq!(sessions.sessions.len(), 2);

        let _ = std::fs::remove_dir_all(temp_dir);
    }
}

