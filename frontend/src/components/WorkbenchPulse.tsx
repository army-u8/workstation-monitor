import { For, Show, createMemo, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import {
  AlertWarningIcon,
  BoltIcon,
  CheckIcon,
  CodeIcon,
  ExternalLinkIcon,
  FolderIcon,
  GitIcon,
  HistoryIcon,
  MonitorIcon,
  RefreshIcon,
  RobotIcon,
  ServerIcon,
  ShieldIcon,
  TerminalIcon,
} from './Icons';
import { Badge, Button } from './ui';
import {
  battery,
  devTools,
  disks,
  fetchMachineInfoApi,
  fetchWebArtifactsApi,
  freeArtifactPortApi,
  gitProjects,
  isLoadingArtifacts,
  machineInfo,
  openAppApi,
  openSnapshotDrawer,
  scanGitProjectsApi,
  stats,
  webArtifacts,
  wsStatus,
  wsStatusText,
} from '../services/store';
import { RoutePath, WsConnectionStatus } from '../constants';
import { t } from '../i18n';
import { rankWorkbenchProjects, summarizeWorkbenchServices } from '../utils/workbench';

const formatPercent = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${Math.round(value)}%`
    : t().overviewWorkbench.unavailable;

const formatCommitTime = (value: string) => {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(timestamp);
};

export const WorkbenchPulse: Component = () => {
  const [isRefreshing, setIsRefreshing] = createSignal(false);
  const [lastRefreshAt, setLastRefreshAt] = createSignal<number | null>(null);

  const visibleProjects = createMemo(() => rankWorkbenchProjects(gitProjects()));
  const projectDirtyCount = createMemo(
    () => gitProjects().filter((project) => project.is_dirty).length,
  );
  const projectSyncCount = createMemo(
    () => gitProjects().filter((project) => project.ahead > 0 || project.behind > 0).length,
  );
  const serviceSummary = createMemo(() => summarizeWorkbenchServices(webArtifacts()));
  const visibleServices = createMemo(() => webArtifacts().slice(0, 4));
  const primaryDisk = createMemo(() => disks().find((disk) => !disk.is_removable) || disks()[0]);
  const readyTools = createMemo(() => devTools().filter((tool) => tool.is_installed).length);

  const refreshWorkbench = async () => {
    if (isRefreshing()) return;
    setIsRefreshing(true);
    try {
      await Promise.all([scanGitProjectsApi(), fetchWebArtifactsApi(), fetchMachineInfoApi()]);
      setLastRefreshAt(Date.now());
    } finally {
      setIsRefreshing(false);
    }
  };

  const openService = (url: string) => {
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
  };

  const refreshLabel = () =>
    isRefreshing() ? t().overviewWorkbench.refreshing : t().overviewWorkbench.refreshAll;

  return (
    <section class="flex flex-col gap-3" aria-labelledby="workbench-pulse-title">
      <div class="glass-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
            <MonitorIcon class="h-5 w-5" />
          </div>
          <div>
            <h2 id="workbench-pulse-title" class="m-0 text-sm font-bold text-text-primary">
              {t().overviewWorkbench.title}
            </h2>
            <p class="m-0 mt-1 text-xs text-text-muted">{t().overviewWorkbench.subtitle}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Show when={lastRefreshAt()}>
            <span class="hidden text-[10px] text-text-muted sm:inline">
              {t().overviewWorkbench.lastSync} {new Date(lastRefreshAt() || 0).toLocaleTimeString()}
            </span>
          </Show>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refreshWorkbench}
            disabled={isRefreshing()}
            loading={isRefreshing()}
            aria-label={refreshLabel()}
          >
            <RefreshIcon class="h-3.5 w-3.5" classList={{ 'animate-spin': isRefreshing() }} />
            {refreshLabel()}
          </Button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <section
          class="hud-box flex min-h-72 flex-col p-4"
          aria-labelledby="workbench-projects-title"
        >
          <div class="flex items-start justify-between gap-3 border-b border-border-subtle pb-3">
            <div class="flex min-w-0 items-start gap-2.5">
              <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
                <GitIcon class="h-4 w-4" />
              </div>
              <div class="min-w-0">
                <h3
                  id="workbench-projects-title"
                  class="m-0 truncate text-xs font-bold text-text-primary"
                >
                  {t().overviewWorkbench.projectsTitle}
                </h3>
                <p class="m-0 mt-0.5 truncate text-[10px] text-text-muted">
                  {t().overviewWorkbench.projectsSubtitle}
                </p>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-1.5">
              <Badge variant="secondary" size="sm" class="mono">
                {gitProjects().length} {t().overviewWorkbench.projectsCount}
              </Badge>
              <Show when={projectDirtyCount() > 0}>
                <Badge variant="warning" size="sm" class="mono">
                  {projectDirtyCount()} {t().overviewWorkbench.dirtyCount}
                </Badge>
              </Show>
            </div>
          </div>

          <Show
            when={visibleProjects().length > 0}
            fallback={
              <div class="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
                <FolderIcon class="h-7 w-7 text-text-muted" />
                <p class="m-0 text-xs font-medium text-text-secondary">
                  {t().overviewWorkbench.noProjects}
                </p>
                <p class="m-0 text-[10px] text-text-muted">{t().overviewWorkbench.projectsHint}</p>
              </div>
            }
          >
            <div class="mt-3 flex flex-col gap-1.5">
              <For each={visibleProjects()}>
                {(project) => (
                  <div class="group flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-subtle/45 px-2.5 py-2 transition-colors hover:border-accent/30 hover:bg-bg-subtle">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5">
                        <span
                          class="truncate text-[11px] font-semibold text-text-primary"
                          title={project.path}
                        >
                          {project.name}
                        </span>
                        <Show when={project.is_dirty}>
                          <AlertWarningIcon class="h-3 w-3 shrink-0 text-status-warning" />
                        </Show>
                      </div>
                      <div class="mt-0.5 flex items-center gap-2 truncate text-[9.5px] text-text-muted">
                        <span class="mono truncate">{project.branch}</span>
                        <span class="truncate">{formatCommitTime(project.last_commit_time)}</span>
                        <Show when={project.ahead > 0 || project.behind > 0}>
                          <span class="text-status-info">
                            {t()
                              .overviewWorkbench.aheadBehind.replace(
                                '{ahead}',
                                project.ahead.toString(),
                              )
                              .replace('{behind}', project.behind.toString())}
                          </span>
                        </Show>
                      </div>
                    </div>
                    <div class="hidden shrink-0 items-center gap-0.5 sm:flex">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openAppApi(project.path, 'code')}
                        aria-label={`${t().overviewWorkbench.openCode}: ${project.name}`}
                        title={t().overviewWorkbench.openCode}
                      >
                        <CodeIcon class="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openAppApi(project.path, 'terminal')}
                        aria-label={`${t().overviewWorkbench.openTerminal}: ${project.name}`}
                        title={t().overviewWorkbench.openTerminal}
                      >
                        <TerminalIcon class="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openSnapshotDrawer(project.path)}
                        aria-label={`${t().overviewWorkbench.openSnapshots}: ${project.name}`}
                        title={t().overviewWorkbench.openSnapshots}
                      >
                        <HistoryIcon class="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <div class="mt-3 flex items-center justify-between border-t border-border-subtle pt-2.5">
            <span class="text-[10px] text-text-muted">
              {projectSyncCount()} {t().overviewWorkbench.syncCount}
            </span>
            <A
              href={RoutePath.GIT_RADAR}
              class="text-[10px] font-semibold text-accent hover:underline"
            >
              {t().overviewWorkbench.viewProjects}
            </A>
          </div>
        </section>

        <section
          class="hud-box flex min-h-72 flex-col p-4"
          aria-labelledby="workbench-services-title"
        >
          <div class="flex items-start justify-between gap-3 border-b border-border-subtle pb-3">
            <div class="flex min-w-0 items-start gap-2.5">
              <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-status-info/25 bg-status-info/10 text-status-info">
                <ServerIcon class="h-4 w-4" />
              </div>
              <div class="min-w-0">
                <h3
                  id="workbench-services-title"
                  class="m-0 truncate text-xs font-bold text-text-primary"
                >
                  {t().overviewWorkbench.servicesTitle}
                </h3>
                <p class="m-0 mt-0.5 truncate text-[10px] text-text-muted">
                  {t().overviewWorkbench.servicesSubtitle}
                </p>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-1.5">
              <Badge variant="secondary" size="sm" class="mono">
                {serviceSummary().total} {t().overviewWorkbench.servicesCount}
              </Badge>
              <Show when={serviceSummary().healthy > 0}>
                <Badge variant="success" size="sm" class="mono">
                  {serviceSummary().healthy} {t().overviewWorkbench.healthyCount}
                </Badge>
              </Show>
            </div>
          </div>

          <Show
            when={visibleServices().length > 0}
            fallback={
              <div class="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
                <BoltIcon class="h-7 w-7 text-text-muted" />
                <p class="m-0 text-xs font-medium text-text-secondary">
                  {t().overviewWorkbench.noServices}
                </p>
                <p class="m-0 text-[10px] text-text-muted">{t().overviewWorkbench.servicesHint}</p>
              </div>
            }
          >
            <div class="mt-3 flex flex-col gap-1.5">
              <For each={visibleServices()}>
                {(service) => (
                  <div class="group flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-subtle/45 px-2.5 py-2 transition-colors hover:border-status-info/30 hover:bg-bg-subtle">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5">
                        <span class="truncate text-[11px] font-semibold text-text-primary">
                          {service.title || service.framework}
                        </span>
                        <Badge variant={service.is_healthy ? 'success' : 'warning'} size="sm">
                          {service.is_healthy
                            ? t().overviewWorkbench.healthy
                            : t().overviewWorkbench.degraded}
                        </Badge>
                      </div>
                      <div class="mt-0.5 flex items-center gap-2 truncate text-[9.5px] text-text-muted">
                        <span class="mono">:{service.port}</span>
                        <span class="truncate">{service.framework}</span>
                        <Show when={typeof service.response_time_ms === 'number'}>
                          <span class="mono text-status-info">
                            {t().overviewWorkbench.responseTime.replace(
                              '{ms}',
                              Math.round(service.response_time_ms || 0).toString(),
                            )}
                          </span>
                        </Show>
                      </div>
                    </div>
                    <div class="hidden shrink-0 items-center gap-0.5 sm:flex">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openService(service.url)}
                        aria-label={`${t().overviewWorkbench.openService}: ${service.url}`}
                        title={t().overviewWorkbench.openService}
                      >
                        <ExternalLinkIcon class="h-3.5 w-3.5" />
                      </Button>
                      <Show when={!service.is_healthy}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            freeArtifactPortApi(
                              service.port,
                              service.process_name || undefined,
                              service.pid || undefined,
                            )
                          }
                          aria-label={`${t().overviewWorkbench.freePort}: ${service.port}`}
                          title={t().overviewWorkbench.freePort}
                        >
                          <ShieldIcon class="h-3.5 w-3.5" />
                        </Button>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <div class="mt-3 flex items-center justify-between border-t border-border-subtle pt-2.5">
            <span class="text-[10px] text-text-muted">
              {serviceSummary().degraded} {t().overviewWorkbench.degradedCount}
              <Show when={serviceSummary().total > 0}>
                <span class="ml-2">
                  {t().overviewWorkbench.averageLatency.replace(
                    '{ms}',
                    serviceSummary().averageLatency.toString(),
                  )}
                </span>
              </Show>
            </span>
            <A
              href={RoutePath.ARTIFACTS}
              class="text-[10px] font-semibold text-accent hover:underline"
            >
              {t().overviewWorkbench.viewServices}
            </A>
          </div>
        </section>
      </div>

      <div class="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <section class="hud-box p-4 lg:col-span-2" aria-labelledby="workbench-health-title">
          <div class="flex items-start gap-2.5 border-b border-border-subtle pb-3">
            <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-status-success/25 bg-status-success/10 text-status-success">
              <CheckIcon class="h-4 w-4" />
            </div>
            <div>
              <h3 id="workbench-health-title" class="m-0 text-xs font-bold text-text-primary">
                {t().overviewWorkbench.healthTitle}
              </h3>
              <p class="m-0 mt-0.5 text-[10px] text-text-muted">
                {t().overviewWorkbench.healthSubtitle}
              </p>
            </div>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div class="rounded-lg border border-border-subtle bg-bg-subtle/45 p-2.5">
              <span class="text-[9.5px] text-text-muted">{t().overviewWorkbench.websocket}</span>
              <div class="mt-1 flex items-center gap-1.5">
                <span
                  class={`h-2 w-2 rounded-full ${wsStatus() === WsConnectionStatus.ONLINE ? 'bg-status-success' : 'bg-status-warning'}`}
                />
                <span class="text-[11px] font-semibold text-text-primary">{wsStatusText()}</span>
              </div>
            </div>
            <div class="rounded-lg border border-border-subtle bg-bg-subtle/45 p-2.5">
              <span class="text-[9.5px] text-text-muted">{t().overviewWorkbench.cpuUsage}</span>
              <div class="mt-1 mono text-sm font-bold text-text-primary">
                {formatPercent(stats()?.cpu_usage)}
              </div>
            </div>
            <div class="rounded-lg border border-border-subtle bg-bg-subtle/45 p-2.5">
              <span class="text-[9.5px] text-text-muted">{t().overviewWorkbench.memoryUsage}</span>
              <div class="mt-1 mono text-sm font-bold text-text-primary">
                {formatPercent(stats()?.memory_percent)}
              </div>
            </div>
            <div class="rounded-lg border border-border-subtle bg-bg-subtle/45 p-2.5">
              <span class="text-[9.5px] text-text-muted">{t().overviewWorkbench.diskUsage}</span>
              <div class="mt-1 mono text-sm font-bold text-text-primary">
                {formatPercent(primaryDisk()?.used_percent)}
              </div>
            </div>
            <div class="rounded-lg border border-border-subtle bg-bg-subtle/45 p-2.5">
              <span class="text-[9.5px] text-text-muted">{t().overviewWorkbench.battery}</span>
              <div class="mt-1 text-sm font-bold text-text-primary">
                {battery()
                  ? `${Math.round(battery()?.percentage || 0)}%`
                  : t().overviewWorkbench.unavailable}
                <Show when={battery()?.is_charging}>
                  <span class="ml-1 text-[9px] font-medium text-status-success">
                    {t().overviewWorkbench.charging}
                  </span>
                </Show>
              </div>
            </div>
            <div class="rounded-lg border border-border-subtle bg-bg-subtle/45 p-2.5">
              <span class="text-[9.5px] text-text-muted">{t().overviewWorkbench.toolsReady}</span>
              <div class="mt-1 mono text-sm font-bold text-text-primary">
                {machineInfo()
                  ? `${readyTools()}/${devTools().length || 0}`
                  : t().overviewWorkbench.unavailable}
              </div>
            </div>
          </div>
        </section>

        <section class="hud-box p-4" aria-labelledby="workbench-actions-title">
          <div class="flex items-start gap-2.5 border-b border-border-subtle pb-3">
            <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-status-info/25 bg-status-info/10 text-status-info">
              <RobotIcon class="h-4 w-4" />
            </div>
            <div>
              <h3 id="workbench-actions-title" class="m-0 text-xs font-bold text-text-primary">
                {t().overviewWorkbench.quickActionsTitle}
              </h3>
              <p class="m-0 mt-0.5 text-[10px] text-text-muted">
                {t().overviewWorkbench.quickActionsSubtitle}
              </p>
            </div>
          </div>
          <div class="mt-3 grid grid-cols-1 gap-1.5">
            <A
              href={RoutePath.AI_RADAR}
              class="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-subtle/45 px-2.5 py-2 text-[11px] font-semibold text-text-secondary transition-colors hover:border-accent/30 hover:bg-bg-subtle hover:text-accent"
            >
              <RobotIcon class="h-3.5 w-3.5" />
              {t().overviewWorkbench.aiRadar}
            </A>
            <A
              href={RoutePath.DEVTOOLS}
              class="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-subtle/45 px-2.5 py-2 text-[11px] font-semibold text-text-secondary transition-colors hover:border-accent/30 hover:bg-bg-subtle hover:text-accent"
            >
              <TerminalIcon class="h-3.5 w-3.5" />
              {t().overviewWorkbench.devTools}
            </A>
            <A
              href={RoutePath.OPS}
              class="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-subtle/45 px-2.5 py-2 text-[11px] font-semibold text-text-secondary transition-colors hover:border-accent/30 hover:bg-bg-subtle hover:text-accent"
            >
              <ShieldIcon class="h-3.5 w-3.5" />
              {t().overviewWorkbench.ops}
            </A>
          </div>
        </section>
      </div>

      <Show when={isLoadingArtifacts()}>
        <span class="sr-only">{t().overviewWorkbench.refreshing}</span>
      </Show>
    </section>
  );
};
