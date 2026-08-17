/**
 * Global Constants & Type-Safe Object Maps for Workstation Mission Control
 * Uses `as const` POJO maps compatible with modern `erasableSyntaxOnly` / TypeScript 5.8+
 */

export const Locale = {
  ZH: 'zh',
  EN: 'en',
} as const;
export type Locale = (typeof Locale)[keyof typeof Locale];

export const ThemeMode = {
  SYSTEM: 'system',
  DARK: 'dark',
  LIGHT: 'light',
} as const;
export type ThemeMode = (typeof ThemeMode)[keyof typeof ThemeMode];

export const StorageKey = {
  THEME: 'wm_theme',
  LOCALE: 'wm_locale',
  GIT_LAYOUT: 'wm_git_layout',
} as const;
export type StorageKey = (typeof StorageKey)[keyof typeof StorageKey];

export const NavSectionId = {
  OVERVIEW: 'overview',
  TRAFFIC: 'traffic',
  SOCKETS: 'sockets',
  LATENCY: 'latency',
  SNIFFER: 'sniffer',
  MACHINE_INFO: 'machine_info',
  PROCESSES: 'processes',
  DISKS: 'disks',
  CLEANER: 'cleaner',
  GIT_RADAR: 'git_radar',
  OBSIDIAN: 'obsidian',
  HOSTS: 'hosts',
  SPEEDTEST: 'speedtest',
  DEVTOOLS: 'devtools',
  OPS: 'ops',
} as const;
export type NavSectionId = (typeof NavSectionId)[keyof typeof NavSectionId];

export const RoutePath = {
  OVERVIEW: '/overview',
  TRAFFIC: '/traffic',
  SOCKETS: '/sockets',
  LATENCY: '/latency',
  SNIFFER: '/sniffer',
  SPEEDTEST: '/speedtest',
  MACHINE_INFO: '/machine-info',
  PROCESSES: '/processes',
  DISKS: '/disks',
  CLEANER: '/cleaner',
  GIT_RADAR: '/git-radar',
  OBSIDIAN: '/obsidian',
  HOSTS: '/hosts',
  DEVTOOLS: '/devtools',
  OPS: '/ops',
} as const;
export type RoutePath = (typeof RoutePath)[keyof typeof RoutePath];

export const sectionToPathMap: Record<NavSectionId, RoutePath> = {
  [NavSectionId.OVERVIEW]: RoutePath.OVERVIEW,
  [NavSectionId.TRAFFIC]: RoutePath.TRAFFIC,
  [NavSectionId.SOCKETS]: RoutePath.SOCKETS,
  [NavSectionId.LATENCY]: RoutePath.LATENCY,
  [NavSectionId.SNIFFER]: RoutePath.SNIFFER,
  [NavSectionId.SPEEDTEST]: RoutePath.SPEEDTEST,
  [NavSectionId.MACHINE_INFO]: RoutePath.MACHINE_INFO,
  [NavSectionId.PROCESSES]: RoutePath.PROCESSES,
  [NavSectionId.DISKS]: RoutePath.DISKS,
  [NavSectionId.CLEANER]: RoutePath.CLEANER,
  [NavSectionId.GIT_RADAR]: RoutePath.GIT_RADAR,
  [NavSectionId.OBSIDIAN]: RoutePath.OBSIDIAN,
  [NavSectionId.HOSTS]: RoutePath.HOSTS,
  [NavSectionId.DEVTOOLS]: RoutePath.DEVTOOLS,
  [NavSectionId.OPS]: RoutePath.OPS,
};

export const pathToSectionMap: Record<string, NavSectionId> = {
  [RoutePath.OVERVIEW]: NavSectionId.OVERVIEW,
  [RoutePath.TRAFFIC]: NavSectionId.TRAFFIC,
  [RoutePath.SOCKETS]: NavSectionId.SOCKETS,
  [RoutePath.LATENCY]: NavSectionId.LATENCY,
  [RoutePath.SNIFFER]: NavSectionId.SNIFFER,
  [RoutePath.SPEEDTEST]: NavSectionId.SPEEDTEST,
  [RoutePath.MACHINE_INFO]: NavSectionId.MACHINE_INFO,
  [RoutePath.PROCESSES]: NavSectionId.PROCESSES,
  [RoutePath.DISKS]: NavSectionId.DISKS,
  [RoutePath.CLEANER]: NavSectionId.CLEANER,
  [RoutePath.GIT_RADAR]: NavSectionId.GIT_RADAR,
  [RoutePath.OBSIDIAN]: NavSectionId.OBSIDIAN,
  [RoutePath.HOSTS]: NavSectionId.HOSTS,
  [RoutePath.DEVTOOLS]: NavSectionId.DEVTOOLS,
  [RoutePath.OPS]: NavSectionId.OPS,
  '/git_radar': NavSectionId.GIT_RADAR,
  '/machine_info': NavSectionId.MACHINE_INFO,
  '/': NavSectionId.OVERVIEW,
};

export const GitRepoLayoutMode = {
  GRID: 'grid',
  TABLE: 'table',
  COMPACT: 'compact',
} as const;
export type GitRepoLayoutMode = (typeof GitRepoLayoutMode)[keyof typeof GitRepoLayoutMode];

export const GitRepoSortBy = {
  RECENT: 'recent',
  NAME: 'name',
  DIRTY: 'dirty',
} as const;
export type GitRepoSortBy = (typeof GitRepoSortBy)[keyof typeof GitRepoSortBy];

export const SocketTab = {
  LISTENING: 'listening',
  ACTIVE: 'active',
} as const;
export type SocketTab = (typeof SocketTab)[keyof typeof SocketTab];

export const SocketCategoryFilter = {
  ALL: '',
  WEB: 'web',
  DB: 'db',
  DEV: 'dev',
} as const;
export type SocketCategoryFilter = (typeof SocketCategoryFilter)[keyof typeof SocketCategoryFilter];

export const PacketProtocolFilter = {
  ALL: 'ALL',
  TCP: 'TCP',
  TLS: 'TLS/HTTPS',
  UDP: 'UDP',
  DNS: 'DNS',
  ICMP: 'ICMP',
} as const;
export type PacketProtocolFilter = (typeof PacketProtocolFilter)[keyof typeof PacketProtocolFilter];

export const ProcessSortBy = {
  CPU: 'cpu',
  MEM: 'mem',
} as const;
export type ProcessSortBy = (typeof ProcessSortBy)[keyof typeof ProcessSortBy];

export const WsConnectionStatus = {
  CONNECTING: 'connecting',
  ONLINE: 'online',
  OFFLINE: 'offline',
} as const;
export type WsConnectionStatus = (typeof WsConnectionStatus)[keyof typeof WsConnectionStatus];

export const ToastType = {
  INFO: 'info',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;
export type ToastType = (typeof ToastType)[keyof typeof ToastType];

export const ApiEndpoint = {
  PROCESS_KILL: '/api/process/kill',
  PORT_KILL: '/api/port/kill',
  FLUSH_DNS: '/api/tools/flush-dns',
  PING: '/api/tools/ping',
  STATUS: '/api/status',
  WS: '/ws',
  MACHINE_INFO: '/api/system/machine-info',
  CLEANER_SCAN: '/api/cleaner/scan',
  CLEANER_CLEAN: '/api/cleaner/clean',
  GIT_PROJECTS: '/api/git/projects',
  GIT_ACCOUNT: '/api/git/account',
  HOSTS_GET: '/api/hosts/get',
  SPEEDTEST: '/api/tools/speedtest',
  OPEN_APP: '/api/tools/open-app',
  OBSIDIAN_VAULT: '/api/obsidian/vault',
  OBSIDIAN_NOTE: '/api/obsidian/note',
  OBSIDIAN_SEARCH: '/api/obsidian/search',
  OBSIDIAN_QUICK_CAPTURE: '/api/obsidian/quick-capture',
  OBSIDIAN_OPEN: '/api/obsidian/open',
  UPDATE_CHECK: '/api/system/update/check',
  UPDATE_APPLY: '/api/system/update/apply',
  SNAPSHOTS_LIST: '/api/projects/snapshots',
  SNAPSHOTS_CREATE: '/api/projects/snapshots/create',
  SNAPSHOTS_ROLLBACK: '/api/projects/snapshots/rollback',
} as const;
export type ApiEndpoint = (typeof ApiEndpoint)[keyof typeof ApiEndpoint];

export const WsEventType = {
  TRAFFIC_UPDATE: 'TrafficUpdate',
  SOCKETS_UPDATE: 'SocketsUpdate',
  LATENCY_UPDATE: 'LatencyUpdate',
  PACKET_EVENT: 'PacketEvent',
  SYSTEM_STATS_UPDATE: 'SystemStatsUpdate',
  PROCESSES_UPDATE: 'ProcessesUpdate',
  DISKS_UPDATE: 'DisksUpdate',
  BATTERY_UPDATE: 'BatteryUpdate',
  DEV_TOOLS_UPDATE: 'DevToolsUpdate',
} as const;
export type WsEventType = (typeof WsEventType)[keyof typeof WsEventType];

export const ProtocolType = {
  TCP: 'TCP',
  UDP: 'UDP',
} as const;
export type ProtocolType = (typeof ProtocolType)[keyof typeof ProtocolType];

export const SocketState = {
  LISTEN: 'LISTEN',
  ESTABLISHED: 'ESTABLISHED',
  TIME_WAIT: 'TIME_WAIT',
  CLOSE_WAIT: 'CLOSE_WAIT',
  SYN_SENT: 'SYN_SENT',
  SYN_RECV: 'SYN_RECV',
  FIN_WAIT1: 'FIN_WAIT_1',
  FIN_WAIT2: 'FIN_WAIT_2',
  CLOSED: 'CLOSED',
} as const;
export type SocketState = (typeof SocketState)[keyof typeof SocketState];

export const HTTP_METHODS = {
  POST: 'POST',
  GET: 'GET',
} as const;

export const CONTENT_TYPES = {
  JSON: 'application/json',
} as const;

export const DEFAULT_PROBE_HOST = '1.1.1.1';
export const DEFAULT_PING_COUNT = 4;
export const MAX_PACKET_HISTORY = 150;
export const MAX_LATENCY_HISTORY = 8;
export const TOAST_DURATION_MS = 2600;
export const WS_RECONNECT_INTERVAL_MS = 2000;
