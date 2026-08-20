use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterfaceTraffic {
    pub name: String,
    pub rx_bytes: u64,
    pub tx_bytes: u64,
    pub rx_speed: u64,
    pub tx_speed: u64,
    pub total_rx: u64,
    pub total_tx: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrafficSummary {
    pub total_rx_speed: u64,
    pub total_tx_speed: u64,
    pub total_rx_bytes: u64,
    pub total_tx_bytes: u64,
    pub interfaces: Vec<InterfaceTraffic>,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SocketEntry {
    pub protocol: String,
    pub local_ip: String,
    pub local_port: u16,
    pub remote_ip: Option<String>,
    pub remote_port: Option<u16>,
    pub state: String,
    pub pid: Option<u32>,
    pub process_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exe_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SocketsPayload {
    pub listening_ports: Vec<SocketEntry>,
    pub active_connections: Vec<SocketEntry>,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatencyTarget {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub latency_ms: Option<f64>,
    pub is_alive: bool,
    pub last_checked: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapturedPacket {
    pub id: u64,
    pub timestamp: i64,
    pub protocol: String,
    pub src_ip: String,
    pub src_port: Option<u16>,
    pub dst_ip: String,
    pub dst_port: Option<u16>,
    pub length: usize,
    pub info: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub memory_used: u64,
    pub memory_total: u64,
    pub memory_percent: f32,
    pub uptime_secs: u64,
    pub os_name: String,
    pub host_name: String,
    pub sniffer_active: bool,
    pub sniffer_device: Option<String>,
    pub sniffer_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_usage: f32,
    pub memory_bytes: u64,
    pub memory_percent: f32,
    pub disk_read_bytes: u64,
    pub disk_written_bytes: u64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
    pub used_bytes: u64,
    pub used_percent: f32,
    pub file_system: String,
    pub is_removable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatteryInfo {
    pub percentage: u8,
    pub is_charging: bool,
    pub state: String,
    pub time_remaining: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevToolInfo {
    pub name: String,
    pub category: String,
    pub version: Option<String>,
    pub path: Option<String>,
    pub is_installed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanerItem {
    pub id: String,
    pub name: String,
    pub category: String,
    pub path: Option<String>,
    pub size_bytes: u64,
    pub size_human: String,
    pub is_cleanable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanRequest {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitProjectInfo {
    pub name: String,
    pub path: String,
    pub branch: String,
    pub is_dirty: bool,
    pub uncommitted_count: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status_error: Option<String>,
    pub ahead: usize,
    pub behind: usize,
    pub last_commit_msg: String,
    pub last_commit_author: String,
    pub last_commit_time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitIdentityInfo {
    pub user_name: Option<String>,
    pub user_email: Option<String>,
    pub signing_key: Option<String>,
    pub editor: Option<String>,
    pub default_branch: Option<String>,
    pub credential_helper: Option<String>,
    pub config_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubAccountInfo {
    pub username: Option<String>,
    pub host: String,
    pub git_protocol: String,
    pub is_authenticated: bool,
    pub status_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitAccountSummary {
    pub git: GitIdentityInfo,
    pub github: Option<GitHubAccountInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppVersionInfo {
    pub name: String,
    pub bundle_id: Option<String>,
    pub category: String,
    pub version: Option<String>,
    pub is_installed: bool,
    pub path: String,
    pub icon_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MachineHardwareInfo {
    pub model_name: String,
    pub chip_name: String,
    pub cpu_cores: usize,
    pub memory_total_human: String,
    pub memory_total_bytes: u64,
    pub arch: String,
    pub os_name: String,
    pub os_version: String,
    pub build_version: String,
    pub kernel_version: String,
    pub default_shell: String,
    pub sip_status: String,
    pub host_name: String,
    pub current_user: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MachineInfoSummary {
    pub hardware: MachineHardwareInfo,
    pub core_apps: Vec<AppVersionInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostEntry {
    pub ip: String,
    pub domain: String,
    pub is_enabled: bool,
    pub line_number: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeedTestResult {
    pub download_mbps: f64,
    pub duration_secs: f64,
    pub bytes_downloaded: u64,
    pub server: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAppRequest {
    pub path: String,
    pub app: Option<String>, // "code", "cursor", "finder", "terminal"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KillProcessRequest {
    pub pid: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KillPortRequest {
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingRequest {
    pub host: String,
    pub count: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingResponse {
    pub host: String,
    pub is_alive: bool,
    pub avg_latency_ms: Option<f64>,
    pub min_latency_ms: Option<f64>,
    pub max_latency_ms: Option<f64>,
    pub packets_sent: u8,
    pub packets_received: u8,
    pub raw_output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpsResponse {
    pub success: bool,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObsidianNoteItem {
    pub rel_path: String,
    pub title: String,
    pub size_bytes: u64,
    pub modified_timestamp: u64,
    pub modified_human: String,
    pub tags: Vec<String>,
    pub word_count: usize,
    pub preview_snippet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObsidianTagItem {
    pub name: String,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObsidianVaultSummary {
    pub vault_name: String,
    pub vault_path: String,
    pub total_notes: usize,
    pub total_words: usize,
    pub total_attachments: usize,
    pub total_folders: usize,
    pub disk_size_bytes: u64,
    pub disk_size_human: String,
    pub git_branch: Option<String>,
    pub git_dirty: bool,
    pub git_uncommitted_count: usize,
    pub recent_notes: Vec<ObsidianNoteItem>,
    pub top_tags: Vec<ObsidianTagItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObsidianNoteDetail {
    pub rel_path: String,
    pub title: String,
    pub content: String,
    pub tags: Vec<String>,
    pub modified_human: String,
    pub word_count: usize,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObsidianSearchMatch {
    pub rel_path: String,
    pub title: String,
    pub line_number: usize,
    pub line_content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObsidianSearchResponse {
    pub query: String,
    pub total_matches: usize,
    pub matches: Vec<ObsidianSearchMatch>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickCaptureRequest {
    pub content: String,
    pub target: Option<String>,
    pub tag: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenObsidianRequest {
    pub file_path: Option<String>,
    pub target_app: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateApplyRequest {
    pub download_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateApplyResponse {
    pub success: bool,
    pub message: String,
    pub new_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateRollbackRequest {
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateRollbackResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavePointSnapshot {
    pub commit_hash: String,
    pub short_hash: String,
    pub title: String,
    pub author: String,
    pub created_at: String,
    pub relative_time: String,
    pub is_save_point: bool,
    pub is_head: bool,
    pub changed_files_summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotsListResponse {
    pub project_name: String,
    pub project_path: String,
    pub current_branch: String,
    pub is_dirty: bool,
    pub uncommitted_count: usize,
    pub snapshots: Vec<SavePointSnapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSnapshotRequest {
    pub project_path: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RollbackSnapshotRequest {
    pub project_path: String,
    pub target_commit: String,
    #[serde(default = "default_true")]
    pub create_safety_backup: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotActionResponse {
    pub success: bool,
    pub message: String,
    pub snapshot: Option<SavePointSnapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebArtifactInfo {
    pub port: u16,
    pub url: String,
    pub title: Option<String>,
    pub framework: String,
    pub status_code: Option<u16>,
    pub response_time_ms: Option<f64>,
    pub pid: Option<u32>,
    pub process_name: Option<String>,
    pub is_healthy: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmApiLatency {
    pub provider_id: String,
    pub name: String,
    pub endpoint: String,
    pub is_reachable: bool,
    pub latency_ms: Option<f64>,
    pub status_code: Option<u16>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModelInfo {
    pub name: String,
    pub size_bytes: u64,
    pub vram_bytes: u64,
    pub format: String,
    pub family: String,
    pub parameter_size: String,
    pub quantization_level: String,
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaStatusResponse {
    pub is_running: bool,
    pub version: Option<String>,
    pub total_vram_used_bytes: u64,
    pub loaded_models: Vec<OllamaModelInfo>,
    pub installed_models: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaUnloadRequest {
    pub model_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalAgentInfo {
    pub id: String,
    pub name: String,
    pub category: String,
    pub is_installed: bool,
    pub is_running: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub app_bundle: Option<String>,
    pub icon: String,
    pub description: String,
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum WsEvent {
    TrafficUpdate(TrafficSummary),
    SocketsUpdate(SocketsPayload),
    LatencyUpdate(Vec<LatencyTarget>),
    PacketEvent(CapturedPacket),
    SystemStatsUpdate(SystemStats),
    ProcessesUpdate(Vec<ProcessInfo>),
    DisksUpdate(Vec<DiskInfo>),
    BatteryUpdate(Option<BatteryInfo>),
    DevToolsUpdate(Vec<DevToolInfo>),
}
