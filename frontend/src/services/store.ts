import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import {
  ApiEndpoint,
  CONTENT_TYPES,
  DEFAULT_PING_COUNT,
  HTTP_METHODS,
  MAX_LATENCY_HISTORY,
  MAX_PACKET_HISTORY,
  NavSectionId,
  PacketProtocolFilter,
  SocketCategoryFilter,
  SocketTab,
  StorageKey,
  ThemeMode,
  TOAST_DURATION_MS,
  ToastType,
  WS_RECONNECT_INTERVAL_MS,
  WsConnectionStatus,
  WsEventType,
} from '../constants';
import type {
  BatteryInfo,
  CapturedPacket,
  CleanerItem,
  ConfirmModalConfig,
  DevToolInfo,
  DiskInfo,
  GitAccountSummary,
  GitProjectInfo,
  HostEntry,
  LatencyTarget,
  MachineInfoSummary,
  ObsidianNoteDetail,
  ObsidianSearchResponse,
  ObsidianVaultSummary,
  OpenObsidianPayload,
  OpsResponse,
  PingResponse,
  ProcessInfo,
  QuickCapturePayload,
  SocketsPayload,
  SpeedTestResult,
  SystemStats,
  TrafficSummary,
  WsEvent,
} from '../types';
import { t } from '../i18n';

export type NavSection = NavSectionId;

const getInitialTheme = (): ThemeMode => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(StorageKey.THEME);
    if (saved === ThemeMode.DARK || saved === ThemeMode.LIGHT) {
      return saved as ThemeMode;
    }
  }
  return ThemeMode.DARK;
};

export const [theme, setThemeState] = createSignal<ThemeMode>(getInitialTheme());

export function setTheme(next: ThemeMode) {
  setThemeState(next);
  if (typeof window !== 'undefined') {
    localStorage.setItem(StorageKey.THEME, next);
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.classList.toggle('dark', next === ThemeMode.DARK);
    document.documentElement.classList.toggle('light', next === ThemeMode.LIGHT);
  }
}

export function toggleTheme() {
  setTheme(theme() === ThemeMode.DARK ? ThemeMode.LIGHT : ThemeMode.DARK);
}

// Immediately apply initial theme
if (typeof window !== 'undefined') {
  const initial = getInitialTheme();
  document.documentElement.setAttribute('data-theme', initial);
  document.documentElement.classList.toggle('dark', initial === ThemeMode.DARK);
  document.documentElement.classList.toggle('light', initial === ThemeMode.LIGHT);
}

export const [stats, setStats] = createSignal<SystemStats | null>(null);
export const [traffic, setTraffic] = createSignal<TrafficSummary | null>(null);
export const [sockets, setSockets] = createSignal<SocketsPayload | null>(null);
export const [latencyList, setLatencyList] = createSignal<LatencyTarget[]>([]);
export const [packets, setPackets] = createSignal<CapturedPacket[]>([]);
export const [processes, setProcesses] = createSignal<ProcessInfo[]>([]);
export const [disks, setDisks] = createSignal<DiskInfo[]>([]);
export const [battery, setBattery] = createSignal<BatteryInfo | null>(null);
export const [devTools, setDevTools] = createSignal<DevToolInfo[]>([]);

// New Features State
export const [machineInfo, setMachineInfo] = createSignal<MachineInfoSummary | null>(null);
export const [cleanerItems, setCleanerItems] = createSignal<CleanerItem[]>([]);
export const [gitProjects, setGitProjects] = createSignal<GitProjectInfo[]>([]);
export const [gitAccount, setGitAccount] = createSignal<GitAccountSummary | null>(null);
export const [hostsList, setHostsList] = createSignal<HostEntry[]>([]);
export const [speedTestResult, setSpeedTestResult] = createSignal<SpeedTestResult | null>(null);
export const [obsidianSummary, setObsidianSummary] = createSignal<ObsidianVaultSummary | null>(null);

export const [activeSection, setActiveSection] = createSignal<NavSectionId>(NavSectionId.OVERVIEW);
export const [isSidebarOpen, setIsSidebarOpen] = createSignal(false);

export const [wsStatus, setWsStatus] = createSignal<WsConnectionStatus>(WsConnectionStatus.CONNECTING);
export const wsStatusText = () => {
  const s = wsStatus();
  if (s === WsConnectionStatus.ONLINE) return t().common.connected;
  if (s === WsConnectionStatus.CONNECTING) return t().common.connecting;
  return t().common.disconnected;
};

export const [isSnifferPaused, setIsSnifferPaused] = createSignal(false);
export const [packetFilter, setPacketFilter] = createSignal<PacketProtocolFilter>(PacketProtocolFilter.ALL);
export const [quickFilter, setQuickFilter] = createSignal<SocketCategoryFilter>(SocketCategoryFilter.ALL);
export const [searchQuery, setSearchQuery] = createSignal('');
export const [currentTab, setCurrentTab] = createSignal<SocketTab>(SocketTab.LISTENING);
export const [toasts, setToasts] = createSignal<Array<{ id: number; message: string; type?: ToastType }>>([]);
export const [confirmModal, setConfirmModal] = createSignal<ConfirmModalConfig | null>(null);

export function openConfirmDialog(config: Omit<ConfirmModalConfig, 'isOpen'>) {
  setConfirmModal({
    ...config,
    isOpen: true,
  });
}

export function closeConfirmDialog() {
  const current = confirmModal();
  if (current?.onCancel) {
    current.onCancel();
  }
  setConfirmModal(null);
}

// Latency sparkline history (last 8 points per host)
export const [latencyHistory, setLatencyHistory] = createStore<Record<string, number[]>>({});

let toastIdSeq = 1;
export function showToast(message: string, type: ToastType = ToastType.INFO) {
  const id = toastIdSeq++;
  setToasts((prev) => [...prev, { id, message, type }]);
  setTimeout(() => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, TOAST_DURATION_MS);
}

export function copyToClipboard(text: string, label = 'Content') {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      showToast(`✓ ${t().common.copied} ${label}: ${text}`, ToastType.SUCCESS);
    })
    .catch(() => {
      showToast(t().common.copyFailed, ToastType.ERROR);
    });
}

export function formatSpeed(bytesPerSec: number): { num: string; unit: string } {
  if (bytesPerSec >= 1024 * 1024 * 1024) {
    return { num: (bytesPerSec / (1024 * 1024 * 1024)).toFixed(2), unit: 'GB/s' };
  }
  if (bytesPerSec >= 1024 * 1024) {
    return { num: (bytesPerSec / (1024 * 1024)).toFixed(2), unit: 'MB/s' };
  }
  if (bytesPerSec >= 1024) {
    return { num: (bytesPerSec / 1024).toFixed(1), unit: 'KB/s' };
  }
  return { num: (bytesPerSec || 0).toFixed(0), unit: 'B/s' };
}

export function formatTotalBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${bytes || 0} B`;
}

export function formatUptime(secs: number): string {
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const minutes = Math.floor((secs % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${secs % 60}s`;
}

// ----------------------------------------------------
// REST API Actions
// ----------------------------------------------------

export async function fetchMachineInfoApi(): Promise<void> {
  try {
    const res = await fetch(ApiEndpoint.MACHINE_INFO);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: MachineInfoSummary = await res.json();
    setMachineInfo(data);
  } catch (err: any) {
    console.error('Fetch machine info failed:', err);
  }
}

export async function scanCleanerApi(): Promise<void> {
  try {
    const res = await fetch(ApiEndpoint.CLEANER_SCAN);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setCleanerItems(data);
  } catch (err: any) {
    console.error('Scan cleaner failed:', err);
  }
}

export async function cleanCacheApi(id: string): Promise<void> {
  try {
    const res = await fetch(ApiEndpoint.CLEANER_CLEAN, {
      method: HTTP_METHODS.POST,
      headers: { 'Content-Type': CONTENT_TYPES.JSON },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: OpsResponse = await res.json();
    if (json.success) {
      showToast(json.message, ToastType.SUCCESS);
      await scanCleanerApi();
    } else {
      showToast(json.message, ToastType.ERROR);
    }
  } catch (err: any) {
    showToast(err.message, ToastType.ERROR);
  }
}

export async function scanGitProjectsApi(): Promise<void> {
  try {
    const res = await fetch(ApiEndpoint.GIT_PROJECTS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setGitProjects(data);
  } catch (err: any) {
    console.error('Scan git projects failed:', err);
  }
}

export async function fetchGitAccountApi(): Promise<void> {
  try {
    const res = await fetch(ApiEndpoint.GIT_ACCOUNT);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: GitAccountSummary = await res.json();
    setGitAccount(data);
  } catch (err: any) {
    console.error('Fetch git account failed:', err);
  }
}

export async function fetchHostsApi(): Promise<void> {
  try {
    const res = await fetch(ApiEndpoint.HOSTS_GET);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setHostsList(data);
  } catch (err: any) {
    console.error('Fetch hosts failed:', err);
  }
}

export async function runSpeedTestApi(): Promise<void> {
  try {
    const res = await fetch(ApiEndpoint.SPEEDTEST, {
      method: HTTP_METHODS.POST,
      headers: { 'Content-Type': CONTENT_TYPES.JSON },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: SpeedTestResult = await res.json();
    setSpeedTestResult(data);
    showToast(`✓ Speedtest: ${data.download_mbps.toFixed(1)} Mbps`, ToastType.SUCCESS);
  } catch (err: any) {
    showToast(`Speedtest error: ${err.message}`, ToastType.ERROR);
  }
}

export async function openAppApi(path: string, app: 'code' | 'cursor' | 'terminal' | 'finder' = 'finder'): Promise<void> {
  try {
    const res = await fetch(ApiEndpoint.OPEN_APP, {
      method: HTTP_METHODS.POST,
      headers: { 'Content-Type': CONTENT_TYPES.JSON },
      body: JSON.stringify({ path, app }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: OpsResponse = await res.json();
    if (json.success) {
      showToast(json.message, ToastType.SUCCESS);
    } else {
      showToast(json.message, ToastType.ERROR);
    }
  } catch (err: any) {
    showToast(`Launch failed: ${err.message}`, ToastType.ERROR);
  }
}

// ----------------------------------------------------
// Obsidian Knowledge Base APIs
// ----------------------------------------------------

export async function fetchObsidianVaultApi(): Promise<void> {
  try {
    const res = await fetch(ApiEndpoint.OBSIDIAN_VAULT);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: ObsidianVaultSummary = await res.json();
    setObsidianSummary(data);
  } catch (err: any) {
    console.error('Fetch obsidian vault failed:', err);
  }
}

export async function fetchObsidianNoteApi(path: string): Promise<ObsidianNoteDetail | null> {
  try {
    const url = `${ApiEndpoint.OBSIDIAN_NOTE}?path=${encodeURIComponent(path)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: ObsidianNoteDetail = await res.json();
    return data;
  } catch (err: any) {
    showToast(`Read note failed: ${err.message}`, ToastType.ERROR);
    return null;
  }
}

export async function searchObsidianApi(query: string): Promise<ObsidianSearchResponse | null> {
  try {
    const res = await fetch(ApiEndpoint.OBSIDIAN_SEARCH, {
      method: HTTP_METHODS.POST,
      headers: { 'Content-Type': CONTENT_TYPES.JSON },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: ObsidianSearchResponse = await res.json();
    return data;
  } catch (err: any) {
    showToast(`Search failed: ${err.message}`, ToastType.ERROR);
    return null;
  }
}

export async function quickCaptureObsidianApi(payload: QuickCapturePayload): Promise<boolean> {
  try {
    const res = await fetch(ApiEndpoint.OBSIDIAN_QUICK_CAPTURE, {
      method: HTTP_METHODS.POST,
      headers: { 'Content-Type': CONTENT_TYPES.JSON },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: OpsResponse = await res.json();
    if (json.success) {
      showToast(`✓ ${json.message}`, ToastType.SUCCESS);
      // Refresh vault summary in background
      fetchObsidianVaultApi();
      return true;
    } else {
      showToast(json.message, ToastType.ERROR);
      return false;
    }
  } catch (err: any) {
    showToast(`Quick capture failed: ${err.message}`, ToastType.ERROR);
    return false;
  }
}

export async function openObsidianApi(payload: OpenObsidianPayload): Promise<void> {
  try {
    const res = await fetch(ApiEndpoint.OBSIDIAN_OPEN, {
      method: HTTP_METHODS.POST,
      headers: { 'Content-Type': CONTENT_TYPES.JSON },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: OpsResponse = await res.json();
    if (json.success) {
      showToast(json.message, ToastType.SUCCESS);
    } else {
      showToast(json.message, ToastType.ERROR);
    }
  } catch (err: any) {
    showToast(`Open failed: ${err.message}`, ToastType.ERROR);
  }
}

export async function killProcessApi(pid: number): Promise<void> {
  try {
    const res = await fetch(ApiEndpoint.PROCESS_KILL, {
      method: HTTP_METHODS.POST,
      headers: { 'Content-Type': CONTENT_TYPES.JSON },
      body: JSON.stringify({ pid }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: OpsResponse = await res.json();
    if (json.success) {
      showToast(json.message, ToastType.SUCCESS);
      setProcesses((prev) => prev.filter((p) => p.pid !== pid));
    } else {
      showToast(json.message, ToastType.ERROR);
    }
  } catch (err: any) {
    showToast(err.message, ToastType.ERROR);
  }
}

export async function killPortApi(port: number): Promise<void> {
  try {
    const res = await fetch(ApiEndpoint.PORT_KILL, {
      method: HTTP_METHODS.POST,
      headers: { 'Content-Type': CONTENT_TYPES.JSON },
      body: JSON.stringify({ port }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: OpsResponse = await res.json();
    if (json.success) {
      showToast(json.message, ToastType.SUCCESS);
    } else {
      showToast(json.message, ToastType.ERROR);
    }
  } catch (err: any) {
    showToast(err.message, ToastType.ERROR);
  }
}

export async function flushDnsApi(): Promise<void> {
  try {
    const res = await fetch(ApiEndpoint.FLUSH_DNS, {
      method: HTTP_METHODS.POST,
      headers: { 'Content-Type': CONTENT_TYPES.JSON },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: OpsResponse = await res.json();
    if (json.success) {
      showToast(json.message, ToastType.SUCCESS);
    } else {
      showToast(json.message, ToastType.ERROR);
    }
  } catch (err: any) {
    showToast(err.message, ToastType.ERROR);
  }
}

export async function pingHostApi(host: string, count = DEFAULT_PING_COUNT): Promise<PingResponse | null> {
  try {
    const res = await fetch(ApiEndpoint.PING, {
      method: HTTP_METHODS.POST,
      headers: { 'Content-Type': CONTENT_TYPES.JSON },
      body: JSON.stringify({ host, count }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: PingResponse = await res.json();
    return json;
  } catch (err: any) {
    showToast(err.message, ToastType.ERROR);
    return null;
  }
}

// ----------------------------------------------------
// WebSocket Realtime Data Stream Connection
// ----------------------------------------------------

let socket: WebSocket | null = null;
let reconnectTimer: any = null;

export function initWebSocket() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  setWsStatus(WsConnectionStatus.CONNECTING);

  const loc = window.location;
  const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = loc.port === '9528' ? `${loc.hostname}:9527` : loc.host;
  const wsUrl = `${protocol}//${host}${ApiEndpoint.WS}`;

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setWsStatus(WsConnectionStatus.ONLINE);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    socket.onmessage = (event) => {
      try {
        const ev: WsEvent = JSON.parse(event.data);
        handleWsEvent(ev);
      } catch (err) {
        console.error('Failed to parse WS JSON message:', err);
      }
    };

    socket.onclose = () => {
      setWsStatus(WsConnectionStatus.OFFLINE);
      scheduleReconnect();
    };

    socket.onerror = () => {
      setWsStatus(WsConnectionStatus.OFFLINE);
      socket?.close();
    };
  } catch (err) {
    console.error('WebSocket creation error:', err);
    setWsStatus(WsConnectionStatus.OFFLINE);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    initWebSocket();
  }, WS_RECONNECT_INTERVAL_MS);
}

function handleWsEvent(ev: WsEvent) {
  switch (ev.type) {
    case WsEventType.SYSTEM_STATS_UPDATE:
      setStats(ev.data as SystemStats);
      break;

    case WsEventType.TRAFFIC_UPDATE:
      setTraffic(ev.data as TrafficSummary);
      break;

    case WsEventType.SOCKETS_UPDATE:
      setSockets(ev.data as SocketsPayload);
      break;

    case WsEventType.LATENCY_UPDATE: {
      const targets = ev.data as LatencyTarget[];
      setLatencyList(targets);

      // Record sparkline history
      for (const t of targets) {
        if (t.latency_ms !== null && t.latency_ms !== undefined) {
          const prev = latencyHistory[t.host] || [];
          const updated = [...prev, t.latency_ms].slice(-MAX_LATENCY_HISTORY);
          setLatencyHistory(t.host, updated);
        }
      }
      break;
    }

    case WsEventType.PACKET_EVENT: {
      if (!isSnifferPaused()) {
        const pkt = ev.data as CapturedPacket;
        setPackets((prev) => [pkt, ...prev.slice(0, MAX_PACKET_HISTORY - 1)]);
      }
      break;
    }

    case WsEventType.PROCESSES_UPDATE:
      setProcesses(ev.data as ProcessInfo[]);
      break;

    case WsEventType.DISKS_UPDATE:
      setDisks(ev.data as DiskInfo[]);
      break;

    case WsEventType.BATTERY_UPDATE:
      setBattery(ev.data as BatteryInfo);
      break;

    case WsEventType.DEV_TOOLS_UPDATE:
      setDevTools(ev.data as DevToolInfo[]);
      break;

    default:
      break;
  }
}
