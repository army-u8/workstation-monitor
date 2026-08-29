import { For, Show, createMemo, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { A } from '@solidjs/router';
import {
  AlertWarningIcon,
  BoltIcon,
  CodeIcon,
  ExternalLinkIcon,
  FolderIcon,
  GitIcon,
  HistoryIcon,
  RefreshIcon,
  ServerIcon,
  ShieldIcon,
  TerminalIcon,
} from './Icons';
import { Badge, Button } from './ui';
import {
  fetchMachineInfoApi,
  fetchWebArtifactsApi,
  freeArtifactPortApi,
  gitProjects,
  openAppApi,
  openSnapshotDrawer,
  scanGitProjectsApi,
  webArtifacts,
} from '../services/store';
import { RoutePath } from '../constants';
import { t } from '../i18n';
import { rankWorkbenchProjects, summarizeWorkbenchServices } from '../utils/workbench';

const formatCommitTime = (value: string) => {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(timestamp);
};

export const WorkbenchPulse: Component = () => {
  const [isRefreshing, setIsRefreshing] = createSignal(false);
  const visibleProjects = createMemo(() => rankWorkbenchProjects(gitProjects()));
  const projectDirtyCount = createMemo(
    () => gitProjects().filter((project) => project.is_dirty).length,
  );
  const projectSyncCount = createMemo(
    () => gitProjects().filter((project) => project.ahead > 0 || project.behind > 0).length,
  );
  const serviceSummary = createMemo(() => summarizeWorkbenchServices(webArtifacts()));
  const visibleServices = createMemo(() => webArtifacts().slice(0, 4));

  const refreshWorkbench = async () => {
    if (isRefreshing()) return;
    setIsRefreshing(true);
    try {
      await Promise.all([scanGitProjectsApi(), fetchWebArtifactsApi(), fetchMachineInfoApi()]);
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
    <section class="grid grid-cols-1 gap-3.5 xl:grid-cols-2" aria-labelledby="workbench-pulse-title">
      {/* Left: Active Git Projects */}
      <div
        class="glass-card flex flex-col p-4 bg-bg-surface/90"
        aria-labelledby="workbench-projects-title"
      >
        <div class="flex items-center justify-between border-b border-border-subtle pb-3">
          <div class="flex items-center gap-2.5">
            <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-accent/10 text-accent">
              <GitIcon class="h-4 w-4" />
            </div>
            <div>
              <h3
                id="workbench-projects-title"
                class="m-0 text-xs font-bold text-text-primary tracking-tight"
              >
                {t().overviewWorkbench.projectsTitle}
              </h3>
              <p class="m-0 text-[10px] text-text-muted">
                {t().overviewWorkbench.projectsSubtitle}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={refreshWorkbench}
              disabled={isRefreshing()}
              aria-label={refreshLabel()}
              title={refreshLabel()}
              class="h-6.5 w-6.5 text-text-muted hover:text-accent"
            >
              <RefreshIcon class="h-3.5 w-3.5" classList={{ 'animate-spin': isRefreshing() }} />
            </Button>
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
            <div class="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
              <FolderIcon class="h-6 w-6 text-text-muted" />
              <p class="m-0 text-xs font-medium text-text-secondary">
                {t().overviewWorkbench.noProjects}
              </p>
              <p class="m-0 text-[10px] text-text-muted">{t().overviewWorkbench.projectsHint}</p>
            </div>
          }
        >
          <div class="mt-2.5 flex flex-col gap-1.5 flex-1">
            <For each={visibleProjects().slice(0, 3)}>
              {(project) => (
                <div class="group flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-bg-subtle/50 px-3 py-2 transition-all hover:border-accent/30 hover:bg-bg-subtle">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5">
                      <span
                        class="truncate text-xs font-bold text-text-primary group-hover:text-accent transition-colors"
                        title={project.path}
                      >
                        {project.name}
                      </span>
                      <Show when={project.is_dirty}>
                        <AlertWarningIcon class="h-3 w-3 shrink-0 text-status-warning" />
                      </Show>
                    </div>
                    <div class="mt-0.5 flex items-center gap-2 truncate text-[9.5px] text-text-muted">
                      <span class="mono truncate font-semibold text-accent/80">{project.branch}</span>
                      <span>·</span>
                      <span class="truncate">{formatCommitTime(project.last_commit_time)}</span>
                      <Show when={project.ahead > 0 || project.behind > 0}>
                        <span class="text-status-info font-mono">
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
                  <div class="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openAppApi(project.path, 'code')}
                      aria-label={`${t().overviewWorkbench.openCode}: ${project.name}`}
                      title={t().overviewWorkbench.openCode}
                      class="h-6.5 w-6.5 text-text-muted hover:text-accent"
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
                      class="h-6.5 w-6.5 text-text-muted hover:text-accent"
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
                      class="h-6.5 w-6.5 text-text-muted hover:text-accent"
                    >
                      <HistoryIcon class="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>

        <div class="mt-2.5 flex items-center justify-between border-t border-border-subtle pt-2">
          <span class="text-[10px] text-text-muted font-mono">
            {projectSyncCount()} {t().overviewWorkbench.syncCount}
          </span>
          <A
            href={RoutePath.GIT_RADAR}
            class="text-[10px] font-bold text-accent hover:underline flex items-center gap-1"
          >
            <span>{t().overviewWorkbench.viewProjects}</span>
            <span>→</span>
          </A>
        </div>
      </div>

      {/* Right: Active Local Services */}
      <div
        class="glass-card flex flex-col p-4 bg-bg-surface/90"
        aria-labelledby="workbench-services-title"
      >
        <div class="flex items-center justify-between border-b border-border-subtle pb-3">
          <div class="flex items-center gap-2.5">
            <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-status-info/25 bg-status-info/10 text-status-info">
              <ServerIcon class="h-4 w-4" />
            </div>
            <div>
              <h3
                id="workbench-services-title"
                class="m-0 text-xs font-bold text-text-primary tracking-tight"
              >
                {t().overviewWorkbench.servicesTitle}
              </h3>
              <p class="m-0 text-[10px] text-text-muted">
                {t().overviewWorkbench.servicesSubtitle}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
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
            <div class="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
              <BoltIcon class="h-6 w-6 text-text-muted" />
              <p class="m-0 text-xs font-medium text-text-secondary">
                {t().overviewWorkbench.noServices}
              </p>
              <p class="m-0 text-[10px] text-text-muted">{t().overviewWorkbench.servicesHint}</p>
            </div>
          }
        >
          <div class="mt-2.5 flex flex-col gap-1.5 flex-1">
            <For each={visibleServices().slice(0, 3)}>
              {(service) => (
                <div class="group flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-bg-subtle/50 px-3 py-2 transition-all hover:border-status-info/30 hover:bg-bg-subtle">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="truncate text-xs font-bold text-text-primary group-hover:text-status-info transition-colors">
                        {service.title || service.framework}
                      </span>
                      <Badge variant={service.is_healthy ? 'success' : 'warning'} size="sm">
                        {service.is_healthy
                          ? t().overviewWorkbench.healthy
                          : t().overviewWorkbench.degraded}
                      </Badge>
                    </div>
                    <div class="mt-0.5 flex items-center gap-2 truncate text-[9.5px] text-text-muted font-mono">
                      <span class="font-bold text-accent">:{service.port}</span>
                      <span>·</span>
                      <span class="truncate">{service.framework}</span>
                      <Show when={typeof service.response_time_ms === 'number'}>
                        <span>·</span>
                        <span class="text-status-info">
                          {t().overviewWorkbench.responseTime.replace(
                            '{ms}',
                            Math.round(service.response_time_ms || 0).toString(),
                          )}
                        </span>
                      </Show>
                    </div>
                  </div>
                  <div class="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openService(service.url)}
                      aria-label={`${t().overviewWorkbench.openService}: ${service.url}`}
                      title={t().overviewWorkbench.openService}
                      class="h-6.5 w-6.5 text-text-muted hover:text-status-info"
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
                        class="h-6.5 w-6.5 text-status-danger hover:bg-status-danger/20"
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

        <div class="mt-2.5 flex items-center justify-between border-t border-border-subtle pt-2">
          <span class="text-[10px] text-text-muted font-mono">
            {serviceSummary().degraded} {t().overviewWorkbench.degradedCount}
          </span>
          <A
            href={RoutePath.ARTIFACTS}
            class="text-[10px] font-bold text-accent hover:underline flex items-center gap-1"
          >
            <span>{t().overviewWorkbench.viewServices}</span>
            <span>→</span>
          </A>
        </div>
      </div>
    </section>
  );
};

