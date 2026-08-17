use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use std::process::Command;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use crate::collectors::{
    kill_process, kill_process_by_port, AutoUpdater, GitRadar, HostsManager, MachineInfoCollector,
    ObsidianManager, SpeedTester, SystemCleaner,
};
use crate::server::embedded::static_handler;
use crate::server::ws::{ws_handler, AppState};
use crate::types::{
    CleanRequest, KillPortRequest, KillProcessRequest, OpenAppRequest, OpenObsidianRequest,
    OpsResponse, PingRequest, PingResponse, QuickCaptureRequest, UpdateApplyRequest,
    UpdateApplyResponse,
};

pub fn build_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        // Query APIs
        .route("/api/status", get(get_status))
        .route("/api/traffic", get(get_traffic))
        .route("/api/sockets", get(get_sockets))
        .route("/api/latency", get(get_latency))
        .route("/api/processes", get(get_processes))
        .route("/api/disks", get(get_disks))
        .route("/api/battery", get(get_battery))
        .route("/api/dev-tools", get(get_dev_tools))
        // New Features APIs
        .route("/api/system/machine-info", get(get_machine_info))
        .route("/api/system/update/check", get(get_update_check))
        .route("/api/system/update/apply", post(post_update_apply))
        .route("/api/cleaner/scan", get(get_cleaner_scan))
        .route("/api/cleaner/clean", post(post_cleaner_clean))
        .route("/api/git/projects", get(get_git_projects))
        .route("/api/git/account", get(get_git_account))
        .route("/api/hosts/get", get(get_hosts))
        .route("/api/tools/speedtest", post(post_speedtest))
        .route("/api/tools/open-app", post(post_open_app))
        // Obsidian APIs
        .route("/api/obsidian/vault", get(get_obsidian_vault))
        .route("/api/obsidian/note", get(get_obsidian_note))
        .route("/api/obsidian/search", post(post_obsidian_search))
        .route("/api/obsidian/quick-capture", post(post_obsidian_quick_capture))
        .route("/api/obsidian/open", post(post_obsidian_open))
        // Ops & Actions
        .route("/api/process/kill", post(post_kill_process))
        .route("/api/port/kill", post(post_kill_port))
        .route("/api/tools/flush-dns", post(post_flush_dns))
        .route("/api/tools/ping", post(post_ping))
        // WebSocket & Static UI
        .route("/ws", get(ws_handler))
        .fallback(static_handler)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn get_status(State(state): State<AppState>) -> impl IntoResponse {
    let stats = state.latest_stats.read().await.clone();
    match stats {
        Some(s) => (StatusCode::OK, Json(serde_json::to_value(s).unwrap())),
        None => (StatusCode::NO_CONTENT, Json(serde_json::json!({}))),
    }
}

async fn get_traffic(State(state): State<AppState>) -> impl IntoResponse {
    let traffic = state.latest_traffic.read().await.clone();
    match traffic {
        Some(t) => (StatusCode::OK, Json(serde_json::to_value(t).unwrap())),
        None => (StatusCode::NO_CONTENT, Json(serde_json::json!({}))),
    }
}

async fn get_sockets(State(state): State<AppState>) -> impl IntoResponse {
    let sockets = state.latest_sockets.read().await.clone();
    match sockets {
        Some(s) => (StatusCode::OK, Json(serde_json::to_value(s).unwrap())),
        None => (StatusCode::NO_CONTENT, Json(serde_json::json!({}))),
    }
}

async fn get_latency(State(state): State<AppState>) -> impl IntoResponse {
    let latency = state.latest_latency.read().await.clone();
    (StatusCode::OK, Json(serde_json::to_value(latency).unwrap()))
}

async fn get_processes(State(state): State<AppState>) -> impl IntoResponse {
    let processes = state.latest_processes.read().await.clone();
    (StatusCode::OK, Json(serde_json::to_value(processes).unwrap()))
}

async fn get_disks(State(state): State<AppState>) -> impl IntoResponse {
    let disks = state.latest_disks.read().await.clone();
    (StatusCode::OK, Json(serde_json::to_value(disks).unwrap()))
}

async fn get_battery(State(state): State<AppState>) -> impl IntoResponse {
    let battery = state.latest_battery.read().await.clone();
    match battery {
        Some(b) => (StatusCode::OK, Json(serde_json::to_value(b).unwrap())),
        None => (StatusCode::OK, Json(serde_json::json!(null))),
    }
}

async fn get_dev_tools(State(state): State<AppState>) -> impl IntoResponse {
    let dev_tools = state.latest_dev_tools.read().await.clone();
    (StatusCode::OK, Json(serde_json::to_value(dev_tools).unwrap()))
}

// 0. Machine Info & App Versions
async fn get_machine_info() -> impl IntoResponse {
    let info = tokio::task::spawn_blocking(MachineInfoCollector::collect)
        .await
        .unwrap_or_else(|_| crate::types::MachineInfoSummary {
            hardware: crate::types::MachineHardwareInfo {
                model_name: "Mac".to_string(),
                chip_name: "Apple Silicon".to_string(),
                cpu_cores: 8,
                memory_total_human: "16 GB".to_string(),
                memory_total_bytes: 17179869184,
                arch: "arm64".to_string(),
                os_name: "macOS".to_string(),
                os_version: "15.5".to_string(),
                build_version: "24F74".to_string(),
                kernel_version: "Darwin".to_string(),
                default_shell: "/bin/zsh".to_string(),
                sip_status: "Enabled".to_string(),
                host_name: "localhost".to_string(),
                current_user: "user".to_string(),
            },
            core_apps: vec![],
        });
    (StatusCode::OK, Json(serde_json::to_value(info).unwrap()))
}

// 1. Cleaner Handlers
async fn get_cleaner_scan() -> impl IntoResponse {
    let items = tokio::task::spawn_blocking(SystemCleaner::scan).await.unwrap_or_default();
    (StatusCode::OK, Json(serde_json::to_value(items).unwrap()))
}

async fn post_cleaner_clean(Json(payload): Json<CleanRequest>) -> impl IntoResponse {
    let target = payload.id.clone();
    let res = tokio::task::spawn_blocking(move || SystemCleaner::clean(&target)).await;
    match res {
        Ok(Ok(msg)) => (
            StatusCode::OK,
            Json(OpsResponse {
                success: true,
                message: msg,
                data: None,
            }),
        ),
        Ok(Err(err)) => (
            StatusCode::BAD_REQUEST,
            Json(OpsResponse {
                success: false,
                message: err,
                data: None,
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(OpsResponse {
                success: false,
                message: format!("清理执行异常: {}", e),
                data: None,
            }),
        ),
    }
}

// 2. Git Projects Radar Handlers
async fn get_git_projects() -> impl IntoResponse {
    let projects = tokio::task::spawn_blocking(GitRadar::scan_projects).await.unwrap_or_default();
    (StatusCode::OK, Json(serde_json::to_value(projects).unwrap()))
}

async fn get_git_account() -> impl IntoResponse {
    let summary = tokio::task::spawn_blocking(GitRadar::get_account_summary).await.unwrap_or_else(|_| {
        crate::types::GitAccountSummary {
            git: crate::types::GitIdentityInfo {
                user_name: None,
                user_email: None,
                signing_key: None,
                editor: None,
                default_branch: None,
                credential_helper: None,
                config_path: "~/.gitconfig".to_string(),
            },
            github: None,
        }
    });
    (StatusCode::OK, Json(serde_json::to_value(summary).unwrap()))
}

// 3. Hosts Manager Handlers
async fn get_hosts() -> impl IntoResponse {
    let entries = HostsManager::read_hosts();
    (StatusCode::OK, Json(serde_json::to_value(entries).unwrap()))
}

// 4. Speed Test Handlers
async fn post_speedtest() -> impl IntoResponse {
    match SpeedTester::run_speed_test().await {
        Ok(result) => (StatusCode::OK, Json(serde_json::to_value(result).unwrap())),
        Err(err) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": err })),
        ),
    }
}

// 5. Open Project in Editor, Terminal, or Finder
async fn post_open_app(Json(payload): Json<OpenAppRequest>) -> impl IntoResponse {
    let path = payload.path.trim().to_string();
    let app = payload.app.unwrap_or_else(|| "finder".to_string()).to_lowercase();

    let cmd_res = match app.as_str() {
        "code" => Command::new("code").arg(&path).spawn(),
        "cursor" => Command::new("cursor").arg(&path).spawn(),
        "terminal" => {
            // Try Ghostty / iTerm / Warp / default macOS Terminal
            Command::new("open").args(["-a", "Ghostty", &path]).spawn()
                .or_else(|_| Command::new("open").args(["-a", "iTerm", &path]).spawn())
                .or_else(|_| Command::new("open").args(["-a", "Warp", &path]).spawn())
                .or_else(|_| Command::new("open").args(["-a", "Terminal", &path]).spawn())
        }
        "iterm" | "iterm2" => Command::new("open").args(["-a", "iTerm", &path]).spawn(),
        "ghostty" => Command::new("open").args(["-a", "Ghostty", &path]).spawn(),
        "warp" => Command::new("open").args(["-a", "Warp", &path]).spawn(),
        _ => Command::new("open").arg(&path).spawn(),
    };

    match cmd_res {
        Ok(_) => (
            StatusCode::OK,
            Json(OpsResponse {
                success: true,
                message: format!("已在 {} 中打开: {}", app, path),
                data: None,
            }),
        ),
        Err(err) => (
            StatusCode::BAD_REQUEST,
            Json(OpsResponse {
                success: false,
                message: format!("打开失败: {}", err),
                data: None,
            }),
        ),
    }
}

async fn post_kill_process(
    Json(payload): Json<KillProcessRequest>,
) -> impl IntoResponse {
    match kill_process(payload.pid) {
        Ok(_) => (
            StatusCode::OK,
            Json(OpsResponse {
                success: true,
                message: format!("已成功终止进程 PID {}", payload.pid),
                data: None,
            }),
        ),
        Err(err) => (
            StatusCode::BAD_REQUEST,
            Json(OpsResponse {
                success: false,
                message: err,
                data: None,
            }),
        ),
    }
}

async fn post_kill_port(
    Json(payload): Json<KillPortRequest>,
) -> impl IntoResponse {
    match kill_process_by_port(payload.port) {
        Ok(pids) => (
            StatusCode::OK,
            Json(OpsResponse {
                success: true,
                message: format!("已成功终止占用端口 :{} 的进程: {:?}", payload.port, pids),
                data: Some(serde_json::json!({ "pids": pids })),
            }),
        ),
        Err(err) => (
            StatusCode::BAD_REQUEST,
            Json(OpsResponse {
                success: false,
                message: err,
                data: None,
            }),
        ),
    }
}

async fn post_flush_dns() -> impl IntoResponse {
    let mut err_msg = None;

    let res1 = Command::new("dscacheutil").arg("-flushcache").output();
    let res2 = Command::new("killall").args(["-HUP", "mDNSResponder"]).output();

    if res1.is_err() && res2.is_err() {
        err_msg = Some("执行清理 DNS 指令失败".to_string());
    }

    match err_msg {
        None => (
            StatusCode::OK,
            Json(OpsResponse {
                success: true,
                message: "macOS DNS 缓存已成功刷新并重载 mDNSResponder".to_string(),
                data: None,
            }),
        ),
        Some(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(OpsResponse {
                success: false,
                message: e,
                data: None,
            }),
        ),
    }
}

async fn post_ping(Json(payload): Json<PingRequest>) -> impl IntoResponse {
    let count = payload.count.unwrap_or(4).clamp(1, 10);
    let host_raw = payload.host.trim().to_string();

    if host_raw.is_empty() || host_raw.contains('&') || host_raw.contains(';') || host_raw.contains('|') {
        return (
            StatusCode::BAD_REQUEST,
            Json(PingResponse {
                host: host_raw,
                is_alive: false,
                avg_latency_ms: None,
                min_latency_ms: None,
                max_latency_ms: None,
                packets_sent: count,
                packets_received: 0,
                raw_output: "非法或空目标主机地址".to_string(),
            }),
        );
    }

    // 1. Attempt system ping first
    let clean_host = host_raw.split(':').next().unwrap_or(&host_raw);
    let ping_out = Command::new("ping")
        .arg("-c")
        .arg(count.to_string())
        .arg(clean_host)
        .output();

    if let Ok(out) = ping_out {
        let raw = String::from_utf8_lossy(&out.stdout).to_string();
        let (is_alive, avg, min, max, recv) = parse_ping_output(&raw, count);
        if is_alive {
            return (
                StatusCode::OK,
                Json(PingResponse {
                    host: host_raw,
                    is_alive,
                    avg_latency_ms: avg,
                    min_latency_ms: min,
                    max_latency_ms: max,
                    packets_sent: count,
                    packets_received: recv,
                    raw_output: raw,
                }),
            );
        }
    }

    // 2. Fallback to TCP Socket RTT probe across potential ports
    let candidate_ports: Vec<u16> = if host_raw.contains(':') {
        let parts: Vec<&str> = host_raw.split(':').collect();
        vec![parts[1].parse::<u16>().unwrap_or(80)]
    } else if clean_host == "127.0.0.1" || clean_host == "localhost" {
        vec![9527, 80, 22, 53]
    } else {
        vec![80, 443, 53, 22]
    };

    let mut latencies = Vec::new();
    let mut working_target = String::new();

    for port in candidate_ports {
        let target = format!("{}:{}", clean_host, port);
        latencies.clear();

        for _ in 0..count {
            let start = std::time::Instant::now();
            let res = tokio::time::timeout(
                std::time::Duration::from_millis(1500),
                tokio::net::TcpStream::connect(&target),
            )
            .await;

            let is_responsive = match res {
                Ok(Ok(_)) => true,
                Ok(Err(err)) => err.kind() == std::io::ErrorKind::ConnectionRefused,
                _ => false,
            };

            if is_responsive {
                let ms = start.elapsed().as_secs_f64() * 1000.0;
                latencies.push(ms);
            }
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }

        if !latencies.is_empty() {
            working_target = target;
            break;
        }
    }

    if !latencies.is_empty() {
        let min = latencies.iter().cloned().fold(f64::INFINITY, f64::min);
        let max = latencies.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let avg = latencies.iter().sum::<f64>() / latencies.len() as f64;
        let recv = latencies.len() as u8;

        return (
            StatusCode::OK,
            Json(PingResponse {
                host: host_raw.clone(),
                is_alive: true,
                avg_latency_ms: Some(avg),
                min_latency_ms: Some(min),
                max_latency_ms: Some(max),
                packets_sent: count,
                packets_received: recv,
                raw_output: format!(
                    "连通探测就绪: {} (响应: {}/{})\nmin/avg/max = {:.3}/{:.3}/{:.3} ms",
                    working_target, recv, count, min, avg, max
                ),
            }),
        );
    }

    (
        StatusCode::OK,
        Json(PingResponse {
            host: host_raw,
            is_alive: false,
            avg_latency_ms: None,
            min_latency_ms: None,
            max_latency_ms: None,
            packets_sent: count,
            packets_received: 0,
            raw_output: "目标主机未响应 ICMP 或无法建立网络连接".to_string(),
        }),
    )
}

fn parse_ping_output(text: &str, count: u8) -> (bool, Option<f64>, Option<f64>, Option<f64>, u8) {
    let mut recv = 0;
    let mut min = None;
    let mut avg = None;
    let mut max = None;

    for line in text.lines() {
        if line.contains("packets transmitted") && line.contains("received") {
            if let Some(pos) = line.find("packets received") {
                let prev_part = &line[..pos];
                if let Some(num_str) = prev_part.split_whitespace().last() {
                    if let Ok(n) = num_str.parse::<u8>() {
                        recv = n;
                    }
                }
            }
        }

        if line.contains("min/avg/max") || line.contains("round-trip") {
            if let Some(eq_pos) = line.find('=') {
                let stats_part = line[eq_pos + 1..].trim();
                let nums: Vec<&str> = stats_part
                    .trim_end_matches("ms")
                    .trim()
                    .split('/')
                    .collect();
                if nums.len() >= 3 {
                    min = nums[0].trim().parse::<f64>().ok();
                    avg = nums[1].trim().parse::<f64>().ok();
                    max = nums[2].trim().parse::<f64>().ok();
                }
            }
        }
    }

    let is_alive = recv > 0;
    (is_alive, avg, min, max, recv.min(count))
}

// ----------------------------------------------------
// Obsidian Handlers
// ----------------------------------------------------

#[derive(Deserialize)]
pub struct NoteQuery {
    pub path: String,
}

#[derive(Deserialize)]
pub struct SearchQueryPayload {
    pub query: String,
}

async fn get_obsidian_vault() -> impl IntoResponse {
    match tokio::task::spawn_blocking(ObsidianManager::get_vault_summary).await {
        Ok(Some(summary)) => (StatusCode::OK, Json(serde_json::to_value(summary).unwrap())),
        _ => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "success": false,
                "message": "Obsidian Vault not found on this machine"
            })),
        ),
    }
}

async fn get_obsidian_note(Query(query): Query<NoteQuery>) -> impl IntoResponse {
    let path = query.path;
    match tokio::task::spawn_blocking(move || ObsidianManager::get_note_detail(&path)).await {
        Ok(Some(detail)) => (StatusCode::OK, Json(serde_json::to_value(detail).unwrap())),
        _ => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "success": false,
                "message": "Note not found or cannot be read"
            })),
        ),
    }
}

async fn post_obsidian_search(Json(payload): Json<SearchQueryPayload>) -> impl IntoResponse {
    let q = payload.query;
    let res = tokio::task::spawn_blocking(move || ObsidianManager::search_vault(&q))
        .await
        .unwrap_or_else(|_| crate::types::ObsidianSearchResponse {
            query: "".to_string(),
            total_matches: 0,
            matches: Vec::new(),
        });
    (StatusCode::OK, Json(serde_json::to_value(res).unwrap()))
}

async fn post_obsidian_quick_capture(Json(payload): Json<QuickCaptureRequest>) -> impl IntoResponse {
    match tokio::task::spawn_blocking(move || ObsidianManager::quick_capture(payload)).await {
        Ok(Ok(msg)) => (
            StatusCode::OK,
            Json(OpsResponse {
                success: true,
                message: msg,
                data: None,
            }),
        ),
        Ok(Err(err)) => (
            StatusCode::BAD_REQUEST,
            Json(OpsResponse {
                success: false,
                message: err,
                data: None,
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(OpsResponse {
                success: false,
                message: format!("Internal error: {}", e),
                data: None,
            }),
        ),
    }
}

async fn post_obsidian_open(Json(payload): Json<OpenObsidianRequest>) -> impl IntoResponse {
    let file_path = payload.file_path;
    let target_app = payload.target_app;
    match tokio::task::spawn_blocking(move || {
        ObsidianManager::open_obsidian(file_path.as_deref(), target_app.as_deref())
    })
    .await
    {
        Ok(Ok(msg)) => (
            StatusCode::OK,
            Json(OpsResponse {
                success: true,
                message: msg,
                data: None,
            }),
        ),
        Ok(Err(err)) => (
            StatusCode::BAD_REQUEST,
            Json(OpsResponse {
                success: false,
                message: err,
                data: None,
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(OpsResponse {
                success: false,
                message: format!("Internal error: {}", e),
                data: None,
            }),
        ),
    }
}

// 7. System Auto-Updater Handlers
async fn get_update_check() -> impl IntoResponse {
    let update_info = AutoUpdater::check_update().await;
    (StatusCode::OK, Json(serde_json::to_value(update_info).unwrap()))
}

async fn post_update_apply(Json(payload): Json<UpdateApplyRequest>) -> impl IntoResponse {
    match AutoUpdater::apply_update(payload.download_url).await {
        Ok(msg) => (
            StatusCode::OK,
            Json(UpdateApplyResponse {
                success: true,
                message: msg,
                new_version: None,
            }),
        ),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(UpdateApplyResponse {
                success: false,
                message: err,
                new_version: None,
            }),
        ),
    }
}

