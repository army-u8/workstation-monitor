export interface InterfaceTraffic {
  name: string;
  rx_bytes: number;
  tx_bytes: number;
  rx_speed: number;
  tx_speed: number;
  total_rx: number;
  total_tx: number;
}

export interface TrafficSummary {
  total_rx_speed: number;
  total_tx_speed: number;
  total_rx_bytes: number;
  total_tx_bytes: number;
  interfaces: InterfaceTraffic[];
  timestamp: number;
}

export interface SocketEntry {
  protocol: string;
  local_ip: string;
  local_port: number;
  remote_ip: string | null;
  remote_port: number | null;
  state: string;
  pid: number | null;
  process_name: string | null;
}

export interface SocketsPayload {
  listening_ports: SocketEntry[];
  active_connections: SocketEntry[];
  timestamp: number;
}

export interface LatencyTarget {
  name: string;
  host: string;
  port: number;
  latency_ms: number | null;
  is_alive: boolean;
  last_checked: number;
}

export interface CapturedPacket {
  id: number;
  timestamp: number;
  protocol: string;
  src_ip: string;
  src_port: number | null;
  dst_ip: string;
  dst_port: number | null;
  length: number;
  info: string;
}

export interface SystemStats {
  cpu_usage: number;
  memory_used: number;
  memory_total: number;
  memory_percent: number;
  uptime_secs: number;
  os_name: string;
  host_name: string;
  sniffer_active: boolean;
  sniffer_device: string | null;
  sniffer_error: string | null;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_usage: number;
  memory_bytes: number;
  memory_percent: number;
  disk_read_bytes: number;
  disk_written_bytes: number;
  status: string;
}

export interface DiskInfo {
  name: string;
  mount_point: string;
  total_bytes: number;
  available_bytes: number;
  used_bytes: number;
  used_percent: number;
  file_system: string;
  is_removable: boolean;
}

export interface BatteryInfo {
  percentage: number;
  is_charging: boolean;
  state: string;
  time_remaining: string | null;
}

export interface DevToolInfo {
  name: string;
  category: string;
  version: string | null;
  path: string | null;
  is_installed: boolean;
}

export interface CleanerItem {
  id: string;
  name: string;
  category: string;
  path: string | null;
  size_bytes: number;
  size_human: string;
  is_cleanable: boolean;
}

export interface GitProjectInfo {
  name: string;
  path: string;
  branch: string;
  is_dirty: boolean;
  uncommitted_count: number;
  ahead: number;
  behind: number;
  last_commit_msg: string;
  last_commit_author: string;
  last_commit_time: string;
}

export interface GitIdentityInfo {
  user_name: string | null;
  user_email: string | null;
  signing_key: string | null;
  editor: string | null;
  default_branch: string | null;
  credential_helper: string | null;
  config_path: string;
}

export interface GitHubAccountInfo {
  username: string | null;
  host: string;
  git_protocol: string;
  is_authenticated: boolean;
  status_text: string;
}

export interface GitAccountSummary {
  git: GitIdentityInfo;
  github: GitHubAccountInfo | null;
}

export interface AppVersionInfo {
  name: string;
  bundle_id: string | null;
  category: string;
  version: string | null;
  is_installed: boolean;
  path: string;
  icon_type: string;
}

export interface MachineHardwareInfo {
  model_name: string;
  chip_name: string;
  cpu_cores: number;
  memory_total_human: string;
  memory_total_bytes: number;
  arch: string;
  os_name: string;
  os_version: string;
  build_version: string;
  kernel_version: string;
  default_shell: string;
  sip_status: string;
  host_name: string;
  current_user: string;
}

export interface MachineInfoSummary {
  hardware: MachineHardwareInfo;
  core_apps: AppVersionInfo[];
}

export interface HostEntry {
  ip: string;
  domain: string;
  is_enabled: boolean;
  line_number: number;
}

export interface SpeedTestResult {
  download_mbps: number;
  duration_secs: number;
  bytes_downloaded: number;
  server: string;
}

export interface PingResponse {
  host: string;
  is_alive: boolean;
  avg_latency_ms: number | null;
  min_latency_ms: number | null;
  max_latency_ms: number | null;
  packets_sent: number;
  packets_received: number;
  raw_output: string;
}

export interface OpsResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface ConfirmModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export interface ObsidianNoteItem {
  rel_path: string;
  title: string;
  size_bytes: number;
  modified_timestamp: number;
  modified_human: string;
  tags: string[];
  word_count: number;
  preview_snippet: string;
}

export interface ObsidianTagItem {
  name: string;
  count: number;
}

export interface ObsidianVaultSummary {
  vault_name: string;
  vault_path: string;
  total_notes: number;
  total_words: number;
  total_attachments: number;
  total_folders: number;
  disk_size_bytes: number;
  disk_size_human: string;
  git_branch: string | null;
  git_dirty: boolean;
  git_uncommitted_count: number;
  recent_notes: ObsidianNoteItem[];
  top_tags: ObsidianTagItem[];
}

export interface ObsidianNoteDetail {
  rel_path: string;
  title: string;
  content: string;
  tags: string[];
  modified_human: string;
  word_count: number;
  size_bytes: number;
}

export interface ObsidianSearchMatch {
  rel_path: string;
  title: string;
  line_number: number;
  line_content: string;
}

export interface ObsidianSearchResponse {
  query: string;
  total_matches: number;
  matches: ObsidianSearchMatch[];
}

export interface QuickCapturePayload {
  content: string;
  target?: string;
  tag?: string;
}

export interface OpenObsidianPayload {
  file_path?: string;
  target_app?: 'obsidian' | 'finder' | 'code' | 'terminal';
}

export interface UpdateCheckResponse {
  has_update: boolean;
  current_version: string;
  latest_version: string;
  release_notes: string;
  download_url: string | null;
  asset_name: string | null;
  asset_size_bytes: number | null;
  published_at: string | null;
  error_msg: string | null;
}

export interface UpdateApplyRequest {
  download_url?: string | null;
}

export interface UpdateApplyResponse {
  success: boolean;
  message: string;
  new_version?: string | null;
}

export interface SavePointSnapshot {
  commit_hash: string;
  short_hash: string;
  title: string;
  author: string;
  created_at: string;
  relative_time: string;
  is_save_point: boolean;
  is_head: boolean;
  changed_files_summary?: string | null;
}

export interface SnapshotsListResponse {
  project_name: string;
  project_path: string;
  current_branch: string;
  is_dirty: boolean;
  uncommitted_count: number;
  snapshots: SavePointSnapshot[];
}

export interface SnapshotActionResponse {
  success: boolean;
  message: string;
  snapshot?: SavePointSnapshot | null;
}

export type WsEvent =
  | { type: 'TrafficUpdate'; data: TrafficSummary }
  | { type: 'SocketsUpdate'; data: SocketsPayload }
  | { type: 'LatencyUpdate'; data: LatencyTarget[] }
  | { type: 'PacketEvent'; data: CapturedPacket }
  | { type: 'SystemStatsUpdate'; data: SystemStats }
  | { type: 'ProcessesUpdate'; data: ProcessInfo[] }
  | { type: 'DisksUpdate'; data: DiskInfo[] }
  | { type: 'BatteryUpdate'; data: BatteryInfo | null }
  | { type: 'DevToolsUpdate'; data: DevToolInfo[] };



