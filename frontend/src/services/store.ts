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
  EnvVarsPayload,
  GitAccountSummary,
  GitProjectInfo,
  HostEntry,
  LatencyTarget,
  LlmApiLatency,
  LocalAgentInfo,
  MachineInfoSummary,
  ObsidianNoteDetail,
  ObsidianSearchResponse,
  ObsidianVaultSummary,
  OllamaStatusResponse,
  OpenObsidianPayload,
  OpsResponse,
  PingResponse,
  ProcessInfo,
  QuickCapturePayload,
  SnapshotActionResponse,
  SnapshotsListResponse,
  SocketsPayload,
  SpeedTestResult,
  SystemStats,
  TrafficSummary,
  UpdateApplyResponse,
  UpdateCheckResponse,
  UpdateProgressResponse,
  UpdateRollbackResponse,
  VersionBackupInfo,
  WebArtifactInfo,
  WsEvent,
} from '../types';
import { t } from '../i18n';

export type NavSection = NavSectionId;

const getSystemPreferredTheme = (): 'dark' | 'light' => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
};

const getInitialTheme = (): ThemeMode => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(StorageKey.THEME);
    if (saved === ThemeMode.SYSTEM || saved === ThemeMode.DARK || saved === ThemeMode.LIGHT) {
      return saved as ThemeMode;
    }
  }
  return ThemeMode.SYSTEM;
};

export const [theme, setThemeState] = createSignal<ThemeMode>(getInitialTheme());

export const resolvedTheme = () => {
  const current = theme();
  if (current === ThemeMode.SYSTEM) {
    return getSystemPreferredTheme();
  }
  return current;
};

export function setTheme(next: ThemeMode) {
  setThemeState(next);
  if (typeof window !== 'undefined') {
    localStorage.setItem(StorageKey.THEME, next);
    const effective = next === ThemeMode.SYSTEM ? getSystemPreferredTheme() : next;
    document.documentElement.setAttribute('data-theme', effective);
    document.documentElement.setAttribute('data-theme-mode', next);
    document.documentElement.classList.toggle('dark', effective === 'dark');
    document.documentElement.classList.toggle('light', effective === 'light');
  }
}

export function cycleTheme() {
  const current = theme();
  if (current === ThemeMode.SYSTEM) {
    setTheme(ThemeMode.DARK);
  } else if (current === ThemeMode.DARK) {
    setTheme(ThemeMode.LIGHT);
  } else {
    setTheme(ThemeMode.SYSTEM);
  }
}

export function toggleTheme() {
  cycleTheme();
}

// Immediately apply initial theme & listen for OS system theme changes
if (typeof window !== 'undefined') {
  const initial = getInitialTheme();
  const effective = initial === ThemeMode.SYSTEM ? getSystemPreferredTheme() : initial;
  document.documentElement.setAttribute('data-theme', effective);
  document.documentElement.setAttribute('data-theme-mode', initial);
  document.documentElement.classList.toggle('dark', effective === 'dark');
  document.documentElement.classList.toggle('light', effective === 'light');

  if (window.matchMedia) {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', () => {
      if (theme() === ThemeMode.SYSTEM) {
        setTheme(ThemeMode.SYSTEM);
      }
    });
  }
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
export const [obsidianSummary, setObsidianSummary] = createSignal<ObsidianVaultSummary | null>(
  null,
);

export const [updateInfo, setUpdateInfo] = createSignal<UpdateCheckResponse | null>(null);
export const [isCheckingUpdate, setIsCheckingUpdate] = createSignal(false);
export const [isApplyingUpdate, setIsApplyingUpdate] = createSignal(false);
export const [isUpdateModalOpen, setIsUpdateModalOpen] = createSignal(false);
export const [updateStep, setUpdateStep] = createSignal<
  'idle' | 'downloading' | 'installing' | 'restarting' | 'reconnecting'
>('idle');
export const [updateProgressPayload, setUpdateProgressPayload] =
  createSignal<UpdateProgressResponse | null>(null);
export const [versionBackups, setVersionBackups] = createSignal<VersionBackupInfo[]>([]);
export const [isLoadingBackups, setIsLoadingBackups] = createSignal(false);

// Save Point & Time Machine Signals
export const [activeSnapshotPath, setActiveSnapshotPath] = createSignal<string | null>(null);
export const [isSnapshotDrawerOpen, setIsSnapshotDrawerOpen] = createSignal(false);
export const [snapshotsData, setSnapshotsData] = createSignal<SnapshotsListResponse | null>(null);
export const [isLoadingSnapshots, setIsLoadingSnapshots] = createSignal(false);
export const [isCreatingSnapshot, setIsCreatingSnapshot] = createSignal(false);
export const [isRollingBackSnapshot, setIsRollingBackSnapshot] = createSignal(false);

// Live Web Artifacts Signals
export const [webArtifacts, setWebArtifacts] = createSignal<WebArtifactInfo[]>([]);
export const [isLoadingArtifacts, setIsLoadingArtifacts] = createSignal(false);

// AI & LLM API Radar Signals
export const [llmLatencies, setLlmLatencies] = createSignal<LlmApiLatency[]>([]);
export const [isTestingLlmLatency, setIsTestingLlmLatency] = createSignal(false);
export const [ollamaStatus, setOllamaStatus] = createSignal<OllamaStatusResponse | null>(null);
export const [isLoadingOllamaStatus, setIsLoadingOllamaStatus] = createSignal(false);
export const [isUnloadingOllama, setIsUnloadingOllama] = createSignal(false);

// Local AI Coding Agents Signals
export const [localAgents, setLocalAgents] = createSignal<LocalAgentInfo[]>([]);
export const [isLoadingLocalAgents, setIsLoadingLocalAgents] = createSignal(false);

// Environment Variables Signals
export const [envVarsData, setEnvVarsData] = createSignal<EnvVarsPayload | null>(null);
export const [isLoadingEnvVars, setIsLoadingEnvVars] = createSignal(false);

export const [activeSection, setActiveSection] = createSignal<NavSectionId>(NavSectionId.OVERVIEW);
export const [isSidebarOpen, setIsSidebarOpen] = createSignal(false);

export const [wsStatus, setWsStatus] = createSignal<WsConnectionStatus>(
  WsConnectionStatus.CONNECTING,
);
export const wsStatusText = () => {
  const s = wsStatus();
  if (s === WsConnectionStatus.ONLINE) return t().common.connected;
  if (s === WsConnectionStatus.CONNECTING) return t().common.connecting;
  return t().common.disconnected;
};

export const [isSnifferPaused, setIsSnifferPaused] = createSignal(false);
export const [packetFilter, setPacketFilter] = createSignal<PacketProtocolFilter>(
  PacketProtocolFilter.ALL,
);
export const [quickFilter, setQuickFilter] = createSignal<SocketCategoryFilter>(
  SocketCategoryFilter.ALL,
);
export const [searchQuery, setSearchQuery] = createSignal('');
export const [currentTab, setCurrentTab] = createSignal<SocketTab>(SocketTab.LISTENING);
export const [toasts, setToasts] = createSignal<
  Array<{ id: number; message: string; type?: ToastType }>
>([]);
export const [confirmModal, setConfirmModal] = createSignal<ConfirmModalConfig | null>(null);

export function openConfirmDialog(config: Omit<ConfirmModalConfig, 'isOpen'>) {
  setConfirmModal({
    ...config,
    isOpen: true,
  });
}

export function closeConfirmDialog(invokeCancel = true) {
  const current = confirmModal();
  if (invokeCancel && current?.onCancel) {
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

export function copyToClipboard(text: string, label?: string) {
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (!clipboard?.writeText) {
    showToast(t().common.copyFailed, ToastType.ERROR);
    return;
  }

  const displayLabel = label || t().common.copyLabel;
  clipboard
    .writeText(text)
    .then(() => {
      showToast(`${t().common.copied}: ${displayLabel}`, ToastType.SUCCESS);
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
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }
    setSpeedTestResult(json);
    showToast(`${json.download_mbps.toFixed(1)} Mbps (${json.server})`, ToastType.SUCCESS);
  } catch (err: any) {
    showToast(`${err.message}`, ToastType.ERROR);
  }
}

export async function openAppApi(
  path: string,
  app: 'code' | 'cursor' | 'terminal' | 'finder' = 'finder',
): Promise<void> {
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
      showToast(`${json.message}`, ToastType.SUCCESS);
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

export async function pingHostApi(
  host: string,
  count = DEFAULT_PING_COUNT,
): Promise<PingResponse | null> {
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
// System Auto-Updater API Functions
// ----------------------------------------------------

export async function fetchUpdateCheckApi(silent = false): Promise<UpdateCheckResponse | null> {
  if (isCheckingUpdate()) return updateInfo();
  setIsCheckingUpdate(true);
  try {
    const res = await fetch(ApiEndpoint.UPDATE_CHECK);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: UpdateCheckResponse = await res.json();
    setUpdateInfo(data);
    if (!silent) {
      if (data.has_update) {
        showToast(t().update.updateFound.replace('{version}', data.latest_version), ToastType.INFO);
      } else {
        const ver = (data.current_version || '').replace(/^v/, '');
        showToast(t().update.alreadyLatest.replace('{version}', ver), ToastType.SUCCESS);
      }
    }
    return data;
  } catch (err: any) {
    if (!silent) {
      showToast(err.message || 'Check update failed', ToastType.ERROR);
    }
    return null;
  } finally {
    setIsCheckingUpdate(false);
  }
}

export async function fetchUpdateProgressApi(): Promise<UpdateProgressResponse | null> {
  try {
    const res = await fetch(ApiEndpoint.UPDATE_PROGRESS);
    if (!res.ok) return null;
    const data: UpdateProgressResponse = await res.json();
    setUpdateProgressPayload(data);
    return data;
  } catch {
    return null;
  }
}

export async function fetchVersionBackupsApi(): Promise<VersionBackupInfo[]> {
  setIsLoadingBackups(true);
  try {
    const res = await fetch(ApiEndpoint.UPDATE_HISTORY);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: VersionBackupInfo[] = await res.json();
    setVersionBackups(data);
    return data;
  } catch (err: any) {
    showToast(err.message || 'Failed to load version history', ToastType.ERROR);
    return [];
  } finally {
    setIsLoadingBackups(false);
  }
}

export async function rollbackUpdateApi(version?: string): Promise<boolean> {
  if (isApplyingUpdate()) return false;
  setIsApplyingUpdate(true);
  setUpdateStep('restarting');
  try {
    const res = await fetch(ApiEndpoint.UPDATE_ROLLBACK, {
      method: HTTP_METHODS.POST,
      headers: { 'Content-Type': CONTENT_TYPES.JSON },
      body: JSON.stringify({ version }),
    });
    const data: UpdateRollbackResponse = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Rollback failed');
    }
    showToast(data.message, ToastType.SUCCESS);
    setTimeout(() => {
      setUpdateStep('reconnecting');
      pollForServerRestart();
    }, 1500);
    return true;
  } catch (err: any) {
    setIsApplyingUpdate(false);
    setUpdateStep('idle');
    showToast(err.message || 'Failed to rollback version', ToastType.ERROR);
    return false;
  }
}

export async function applyUpdateApi(downloadUrl?: string | null): Promise<boolean> {
  if (isApplyingUpdate()) return false;
  setIsApplyingUpdate(true);
  setUpdateStep('downloading');

  // Start background progress poller
  const progressPoller = setInterval(async () => {
    if (!isApplyingUpdate()) {
      clearInterval(progressPoller);
      return;
    }
    const prog = await fetchUpdateProgressApi();
    if (prog) {
      if (prog.status === 'Downloading') {
        setUpdateStep('downloading');
      } else if (prog.status === 'Extracting') {
        setUpdateStep('installing');
      } else if (prog.status === 'Restarting') {
        setUpdateStep('restarting');
      }
    }
  }, 400);

  try {
    const res = await fetch(ApiEndpoint.UPDATE_APPLY, {
      method: HTTP_METHODS.POST,
      headers: { 'Content-Type': CONTENT_TYPES.JSON },
      body: JSON.stringify({ download_url: downloadUrl || updateInfo()?.download_url }),
    });

    const data: UpdateApplyResponse = await res.json();
    clearInterval(progressPoller);

    if (res.status === 409) {
      throw new Error('Update is already in progress');
    }

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Update failed');
    }

    setUpdateStep('restarting');
    showToast(data.message, ToastType.SUCCESS);

    // Poll for server relaunch and reload page
    setTimeout(() => {
      setUpdateStep('reconnecting');
      pollForServerRestart();
    }, 1500);

    return true;
  } catch (err: any) {
    clearInterval(progressPoller);
    setIsApplyingUpdate(false);
    setUpdateStep('idle');
    showToast(err.message || 'Failed to apply update', ToastType.ERROR);
    return false;
  }
}

function pollForServerRestart() {
  let attempts = 0;
  const maxAttempts = 45;
  const timer = setInterval(async () => {
    attempts++;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(ApiEndpoint.STATUS, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        clearInterval(timer);
        window.location.reload();
        return;
      }
    } catch {
      // server is still rebooting
    }
    if (attempts >= maxAttempts) {
      clearInterval(timer);
      window.location.reload();
    }
  }, 1000);
}

// ----------------------------------------------------
// Save Point & Time Machine API Functions
// ----------------------------------------------------

export function openSnapshotDrawer(projectPath: string) {
  setActiveSnapshotPath(projectPath);
  setIsSnapshotDrawerOpen(true);
  fetchSnapshotsApi(projectPath);
}

export function closeSnapshotDrawer() {
  setIsSnapshotDrawerOpen(false);
  setActiveSnapshotPath(null);
}

export async function fetchSnapshotsApi(
  projectPath: string,
): Promise<SnapshotsListResponse | null> {
  if (!projectPath) return null;
  setIsLoadingSnapshots(true);
  try {
    const res = await fetch(
      `${ApiEndpoint.SNAPSHOTS_LIST}?path=${encodeURIComponent(projectPath)}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: SnapshotsListResponse = await res.json();
    setSnapshotsData(data);
    return data;
  } catch (err: any) {
    showToast(err.message || 'Failed to fetch snapshots', ToastType.ERROR);
    return null;
  } finally {
    setIsLoadingSnapshots(false);
  }
}

export async function createSnapshotApi(projectPath: string, title: string): Promise<boolean> {
  if (isCreatingSnapshot() || !projectPath) return false;
  setIsCreatingSnapshot(true);
  try {
    const res = await fetch(ApiEndpoint.SNAPSHOTS_CREATE, {
      method: HTTP_METHODS.POST,
      headers: { 'Content-Type': CONTENT_TYPES.JSON },
      body: JSON.stringify({ project_path: projectPath, title }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: SnapshotActionResponse = await res.json();
    if (data.success) {
      showToast(data.message, ToastType.SUCCESS);
      await fetchSnapshotsApi(projectPath);
      scanGitProjectsApi();
      return true;
    } else {
      showToast(data.message || 'Failed to create snapshot', ToastType.ERROR);
      return false;
    }
  } catch (err: any) {
    showToast(err.message || 'Failed to create snapshot', ToastType.ERROR);
    return false;
  } finally {
    setIsCreatingSnapshot(false);
  }
}

export async function rollbackSnapshotApi(
  projectPath: string,
  targetCommit: string,
  createSafetyBackup = true,
): Promise<boolean> {
  if (isRollingBackSnapshot() || !projectPath || !targetCommit) return false;
  setIsRollingBackSnapshot(true);
  try {
    const res = await fetch(ApiEndpoint.SNAPSHOTS_ROLLBACK, {
      method: HTTP_METHODS.POST,
      headers: { 'Content-Type': CONTENT_TYPES.JSON },
      body: JSON.stringify({
        project_path: projectPath,
        target_commit: targetCommit,
        create_safety_backup: createSafetyBackup,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: SnapshotActionResponse = await res.json();
    if (data.success) {
      showToast(data.message, ToastType.SUCCESS);
      await fetchSnapshotsApi(projectPath);
      scanGitProjectsApi();
      return true;
    } else {
      showToast(data.message || 'Rollback failed', ToastType.ERROR);
      return false;
    }
  } catch (err: any) {
    showToast(err.message || 'Rollback failed', ToastType.ERROR);
    return false;
  } finally {
    setIsRollingBackSnapshot(false);
  }
}

// ----------------------------------------------------
// Web Artifacts API Functions
// ----------------------------------------------------

export async function fetchWebArtifactsApi(): Promise<WebArtifactInfo[]> {
  setIsLoadingArtifacts(true);
  try {
    const res = await fetch(ApiEndpoint.WEB_ARTIFACTS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: WebArtifactInfo[] = await res.json();
    setWebArtifacts(data);
    return data;
  } catch (err: any) {
    showToast(err.message || 'Failed to fetch web artifacts', ToastType.ERROR);
    return [];
  } finally {
    setIsLoadingArtifacts(false);
  }
}

export async function freeArtifactPortApi(port: number, processName?: string, pid?: number) {
  openConfirmDialog({
    title: t().artifacts.killConfirmTitle,
    message: t()
      .artifacts.killConfirmWarning.replace('{port}', port.toString())
      .replace('{process}', processName || 'unknown')
      .replace('{pid}', (pid || 0).toString()),
    confirmText: t().artifacts.freePort,
    isDestructive: true,
    onConfirm: async () => {
      await killPortApi(port);
      await fetchWebArtifactsApi();
    },
  });
}

// ----------------------------------------------------
// AI & LLM API Radar Functions
// ----------------------------------------------------

export async function fetchLlmLatencyApi(): Promise<LlmApiLatency[]> {
  setIsTestingLlmLatency(true);
  try {
    const res = await fetch(ApiEndpoint.LLM_LATENCY);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: LlmApiLatency[] = await res.json();
    setLlmLatencies(data);
    return data;
  } catch (err: any) {
    showToast(err.message || 'Failed to probe LLM APIs', ToastType.ERROR);
    return [];
  } finally {
    setIsTestingLlmLatency(false);
  }
}

export async function fetchOllamaStatusApi(): Promise<OllamaStatusResponse | null> {
  setIsLoadingOllamaStatus(true);
  try {
    const res = await fetch(ApiEndpoint.OLLAMA_STATUS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: OllamaStatusResponse = await res.json();
    setOllamaStatus(data);
    return data;
  } catch (err: any) {
    showToast(err.message || 'Failed to fetch Ollama status', ToastType.ERROR);
    return null;
  } finally {
    setIsLoadingOllamaStatus(false);
  }
}

export async function unloadOllamaModelApi(modelName: string): Promise<boolean> {
  if (isUnloadingOllama() || !modelName) return false;
  setIsUnloadingOllama(true);
  try {
    const res = await fetch(ApiEndpoint.OLLAMA_UNLOAD, {
      method: HTTP_METHODS.POST,
      headers: { 'Content-Type': CONTENT_TYPES.JSON },
      body: JSON.stringify({ model_name: modelName }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: { success: boolean; message: string } = await res.json();
    if (data.success) {
      showToast(data.message, ToastType.SUCCESS);
      await fetchOllamaStatusApi();
      return true;
    } else {
      showToast(data.message || 'Failed to unload model', ToastType.ERROR);
      return false;
    }
  } catch (err: any) {
    showToast(err.message || 'Failed to unload model', ToastType.ERROR);
    return false;
  } finally {
    setIsUnloadingOllama(false);
  }
}

export async function fetchLocalAgentsApi(): Promise<LocalAgentInfo[]> {
  setIsLoadingLocalAgents(true);
  try {
    const res = await fetch(ApiEndpoint.AI_AGENTS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: LocalAgentInfo[] = await res.json();
    setLocalAgents(data);
    return data;
  } catch (err: any) {
    showToast(err.message || 'Failed to detect local AI agents', ToastType.ERROR);
    return [];
  } finally {
    setIsLoadingLocalAgents(false);
  }
}

// ----------------------------------------------------
// Environment Variables API Functions
// ----------------------------------------------------

export async function fetchEnvVarsApi(): Promise<EnvVarsPayload | null> {
  setIsLoadingEnvVars(true);
  try {
    const res = await fetch(ApiEndpoint.ENV_VARS);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: EnvVarsPayload = await res.json();
    setEnvVarsData(data);
    return data;
  } catch (err: any) {
    showToast(err.message || 'Failed to fetch environment variables', ToastType.ERROR);
    return null;
  } finally {
    setIsLoadingEnvVars(false);
  }
}

// ----------------------------------------------------
// WebSocket Realtime Data Stream Connection
// ----------------------------------------------------

let socket: WebSocket | null = null;
let reconnectTimer: any = null;

export function buildWebSocketUrl(location: Pick<Location, 'protocol' | 'host'>): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}${ApiEndpoint.WS}`;
}

export function initWebSocket() {
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  setWsStatus(WsConnectionStatus.CONNECTING);

  const wsUrl = buildWebSocketUrl(window.location);

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
