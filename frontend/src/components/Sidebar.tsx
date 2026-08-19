import { For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import {
  ActivityIcon,
  AppBoxIcon,
  BoltIcon,
  CleanerIcon,
  CloseIcon,
  DevToolsIcon,
  DiskIcon,
  GitIcon,
  HostsIcon,
  LatencyIcon,
  MonitorIcon,
  ObsidianIcon,
  OpsIcon,
  OverviewIcon,
  ProcessIcon,
  RobotIcon,
  SnifferIcon,
  SocketsIcon,
  SpeedIcon,
} from './Icons';
import {
  battery,
  cleanerItems,
  devTools,
  disks,
  gitProjects,
  hostsList,
  isSidebarOpen,
  latencyList,
  machineInfo,
  obsidianSummary,
  packets,
  processes,
  setIsSidebarOpen,
  sockets,
  speedTestResult,
  stats,
  traffic,
  webArtifacts,
  wsStatus,
  wsStatusText,
} from '../services/store';
import { Badge, Button } from './ui';
import { NavSectionId, RoutePath, WsConnectionStatus, sectionToPathMap } from '../constants';
import { t } from '../i18n';

interface BadgeData {
  text: string | number;
  isWarning?: boolean;
  isSuccess?: boolean;
}

interface NavItem {
  id: NavSectionId;
  icon: Component<{ class?: string }>;
  label: () => string;
  badge?: () => BadgeData | string | number | null;
}

interface NavGroup {
  category: () => string;
  items: NavItem[];
}

export const Sidebar: Component = () => {
  const location = useLocation();

  const groups: NavGroup[] = [
    {
      category: () => t().sidebar.groupOverview,
      items: [
        {
          id: NavSectionId.OVERVIEW,
          icon: OverviewIcon,
          label: () => t().sidebar.navOverview,
        },
      ],
    },
    {
      category: () => t().sidebar.groupNetwork,
      items: [
        {
          id: NavSectionId.TRAFFIC,
          icon: ActivityIcon,
          label: () => t().sidebar.navTraffic,
          badge: () => {
            const count = traffic()?.interfaces?.length;
            return count ? count : null;
          },
        },
        {
          id: NavSectionId.SOCKETS,
          icon: SocketsIcon,
          label: () => t().sidebar.navSockets,
          badge: () => {
            const len = sockets()?.listening_ports?.length;
            return len !== undefined ? len : null;
          },
        },
        {
          id: NavSectionId.LATENCY,
          icon: LatencyIcon,
          label: () => t().sidebar.navLatency,
          badge: () => (latencyList().length ? latencyList().length : null),
        },
        {
          id: NavSectionId.SNIFFER,
          icon: SnifferIcon,
          label: () => t().sidebar.navSniffer,
          badge: () => (packets().length ? packets().length : null),
        },
        {
          id: NavSectionId.SPEEDTEST,
          icon: SpeedIcon,
          label: () => t().sidebar.navSpeedtest,
          badge: () => {
            const res = speedTestResult();
            return res ? `${res.download_mbps.toFixed(0)}M` : null;
          },
        },
      ],
    },
    {
      category: () => t().sidebar.groupSystem,
      items: [
        {
          id: NavSectionId.MACHINE_INFO,
          icon: MonitorIcon,
          label: () => t().sidebar.navMachineInfo,
          badge: () => {
            const info = machineInfo();
            return info?.core_apps
              ? `${info.core_apps.filter((a) => a.is_installed).length}`
              : null;
          },
        },
        {
          id: NavSectionId.PROCESSES,
          icon: ProcessIcon,
          label: () => t().sidebar.navProcesses,
          badge: () => (processes().length ? processes().length : null),
        },
        {
          id: NavSectionId.DISKS,
          icon: DiskIcon,
          label: () => t().sidebar.navDisks,
          badge: () => (disks().length ? disks().length : null),
        },
        {
          id: NavSectionId.CLEANER,
          icon: CleanerIcon,
          label: () => t().sidebar.navCleaner,
          badge: () => (cleanerItems().length ? cleanerItems().length : null),
        },
      ],
    },
    {
      category: () => t().sidebar.groupWorkspace,
      items: [
        {
          id: NavSectionId.GIT_RADAR,
          icon: GitIcon,
          label: () => t().sidebar.navGitRadar,
          badge: () => {
            const list = gitProjects();
            if (!list.length) return null;
            const dirty = list.filter((p) => p.is_dirty).length;
            if (dirty > 0) {
              return {
                text: `${dirty} dirty`,
                isWarning: true,
              };
            }
            return list.length;
          },
        },
        {
          id: NavSectionId.OBSIDIAN,
          icon: ObsidianIcon,
          label: () => t().sidebar.navObsidian,
          badge: () => {
            const summary = obsidianSummary();
            if (!summary) return null;
            if (summary.git_dirty) {
              return {
                text: `${summary.git_uncommitted_count} dirty`,
                isWarning: true,
              };
            }
            return summary.total_notes;
          },
        },
        {
          id: NavSectionId.ARTIFACTS,
          icon: AppBoxIcon,
          label: () => t().sidebar.navArtifacts,
          badge: () => (webArtifacts().length ? webArtifacts().length : null),
        },
        {
          id: NavSectionId.HOSTS,
          icon: HostsIcon,
          label: () => t().sidebar.navHosts,
          badge: () => (hostsList().length ? hostsList().length : null),
        },
      ],
    },
    {
      category: () => t().sidebar.groupDevops,
      items: [
        {
          id: NavSectionId.AI_RADAR,
          icon: RobotIcon,
          label: () => t().sidebar.navAiRadar,
        },
        {
          id: NavSectionId.DEVTOOLS,
          icon: DevToolsIcon,
          label: () => t().sidebar.navDevtools,
          badge: () => {
            const list = devTools();
            if (!list.length) return null;
            const ready = list.filter((d) => d.is_installed).length;
            return `${ready}/${list.length}`;
          },
        },
        {
          id: NavSectionId.OPS,
          icon: OpsIcon,
          label: () => t().sidebar.navOps,
        },
      ],
    },
  ];

  const renderBadge = (item: NavItem) => {
    if (!item.badge) return null;
    const b = item.badge();
    if (b === null || b === undefined || b === '') return null;

    if (typeof b === 'object') {
      let variant: 'warning' | 'success' | 'secondary' = 'secondary';
      if (b.isWarning) variant = 'warning';
      else if (b.isSuccess) variant = 'success';

      return (
        <Badge variant={variant} class="ml-auto mono">
          {b.text}
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" class="ml-auto mono">
        {b}
      </Badge>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      <Show when={isSidebarOpen()}>
        <button
          type="button"
          aria-label={t().common.closeSidebar}
          onClick={() => setIsSidebarOpen(false)}
          class="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        />
      </Show>

      {/* Main Sidebar: Fixed height, fixed width, independent scroll */}
      <aside
        class="fixed top-0 bottom-0 left-0 z-50 flex h-screen w-60 shrink-0 flex-col border-r border-border-default bg-bg-sidebar/95 backdrop-blur-md transition-transform duration-200 ease-in-out md:static md:z-0 md:translate-x-0 select-none overflow-hidden"
        classList={{
          'translate-x-0': isSidebarOpen(),
          '-translate-x-full': !isSidebarOpen(),
        }}
      >
        {/* Brand Header */}
        <div class="flex h-13 shrink-0 items-center justify-between border-b border-border-default/60 px-4">
          <A
            href={RoutePath.OVERVIEW}
            onClick={() => setIsSidebarOpen(false)}
            class="flex items-center gap-2.5 group hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-accent rounded-lg"
          >
            <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 border border-accent/25 text-accent font-mono text-xs font-bold transition-all group-hover:bg-accent group-hover:text-white">
              ⌘
            </div>
            <div class="flex flex-col">
              <span class="text-xs font-bold tracking-tight text-text-primary group-hover:text-accent transition-colors">
                {t().common.workstation}
              </span>
              <span class="text-[9.5px] text-text-muted font-medium">
                {t().sidebar.brandSubtitle}
              </span>
            </div>
          </A>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(false)}
            aria-label={t().common.closeSidebar}
            class="md:hidden h-6 w-6"
          >
            <CloseIcon class="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation Categories and Items */}
        <nav
          class="flex-1 overflow-y-auto px-2.5 py-3 space-y-3 min-h-0"
          aria-label="Sidebar Navigation"
        >
          <For each={groups}>
            {(group) => (
              <div class="space-y-0.5">
                <div class="px-2.5 pt-1.5 pb-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-accent/60 flex items-center gap-1.5">
                  <span class="text-[8px] text-accent/40">//</span>
                  <span>{group.category()}</span>
                </div>
                <div class="space-y-0.5">
                  <For each={group.items}>
                    {(item) => {
                      const path = sectionToPathMap[item.id] || RoutePath.OVERVIEW;
                      const isActive = () => location.pathname === path;
                      const Icon = item.icon;

                      return (
                        <A
                          href={path}
                          onClick={() => setIsSidebarOpen(false)}
                          activeClass="border-l-2 border-accent bg-accent/15 text-accent font-bold shadow-[inset_0_0_10px_rgba(0,240,255,0.15)]"
                          inactiveClass="border-l-2 border-transparent text-text-secondary hover:bg-bg-hover/80 hover:text-text-primary"
                          class="group flex w-full items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-xs transition-all focus-visible:ring-1 focus-visible:ring-accent font-mono"
                        >
                          <Icon
                            class={`h-3.8 w-3.8 shrink-0 transition-colors ${
                              isActive()
                                ? 'text-accent'
                                : 'text-text-muted group-hover:text-text-primary'
                            }`}
                          />
                          <span class="truncate tracking-tight">{item.label()}</span>
                          {renderBadge(item)}
                        </A>
                      );
                    }}
                  </For>
                </div>
              </div>
            )}
          </For>
        </nav>

        {/* System Real-time Vitals Footer */}
        <div class="shrink-0 border-t border-border-default/60 p-3 bg-bg-surface/40 backdrop-blur-xs">
          <div class="flex items-center justify-between text-[10.5px] text-text-muted mb-2 px-0.5">
            <span class="font-semibold tracking-tight text-text-secondary text-[11px]">
              {t().common.vitalsSummary}
            </span>
            <div class="flex items-center gap-1.5">
              <span
                class="flex h-1.5 w-1.5 rounded-full"
                classList={{
                  'bg-status-success shadow-[0_0_6px_rgba(52,211,153,0.7)]':
                    wsStatus() === WsConnectionStatus.ONLINE,
                  'bg-status-warning animate-pulse': wsStatus() === WsConnectionStatus.CONNECTING,
                  'bg-status-danger': wsStatus() === WsConnectionStatus.OFFLINE,
                }}
                title={wsStatusText()}
              />
              <span class="font-mono text-[9.5px] text-text-muted">
                {wsStatus() === WsConnectionStatus.ONLINE ? t().common.live : wsStatusText()}
              </span>
            </div>
          </div>

          <div class="space-y-2">
            {/* CPU Metric */}
            <div class="space-y-1">
              <div class="flex justify-between text-[10px] text-text-secondary">
                <span>{t().common.cpu}</span>
                <span class="mono tabular-nums text-text-primary font-semibold">
                  {stats()?.cpu_usage?.toFixed(1) || '0.0'}%
                </span>
              </div>
              <div class="h-1 w-full rounded-full bg-bg-subtle overflow-hidden">
                <div
                  class="h-full bg-accent transition-all duration-300 rounded-full"
                  style={{ width: `${Math.min(stats()?.cpu_usage || 0, 100)}%` }}
                />
              </div>
            </div>

            {/* Memory Metric */}
            <div class="space-y-1">
              <div class="flex justify-between text-[10px] text-text-secondary">
                <span>{t().common.memory}</span>
                <span class="mono tabular-nums text-text-primary font-semibold">
                  {stats()?.memory_percent?.toFixed(1) || '0.0'}%
                </span>
              </div>
              <div class="h-1 w-full rounded-full bg-bg-subtle overflow-hidden">
                <div
                  class="h-full bg-status-success transition-all duration-300 rounded-full"
                  style={{ width: `${Math.min(stats()?.memory_percent || 0, 100)}%` }}
                />
              </div>
            </div>

            {/* Battery Indicator if present */}
            <Show when={battery()}>
              {(bat) => (
                <div class="flex items-center justify-between text-[10px] text-text-muted pt-1.5 border-t border-border-subtle/60">
                  <span>{t().common.batteryTooltip}</span>
                  <span
                    class="mono font-semibold tabular-nums"
                    classList={{
                      'text-status-success': bat().percentage > 20,
                      'text-status-warning': bat().percentage <= 20,
                    }}
                  >
                    {bat().percentage}%
                    <Show when={bat().is_charging}>
                      <BoltIcon class="inline h-3 w-3 text-status-success ml-0.5" />
                    </Show>
                  </span>
                </div>
              )}
            </Show>
          </div>
        </div>
      </aside>
    </>
  );
};
