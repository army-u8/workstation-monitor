import { For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import {
  ActivityIcon,
  CleanerIcon,
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
                text: `${list.length} (${dirty}!)`,
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
                text: `${summary.total_notes} (${summary.git_uncommitted_count}!)`,
                isWarning: true,
              };
            }
            return summary.total_notes;
          },
        },
        {
          id: NavSectionId.ARTIFACTS,
          icon: OverviewIcon,
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
          icon: LatencyIcon,
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
      return (
        <span
          class="ml-auto rounded-md px-1.8 py-0.2 mono text-[9px] font-bold transition-colors shadow-2xs"
          classList={{
            'bg-status-warning/20 text-status-warning border border-status-warning/30': b.isWarning,
            'bg-status-success/20 text-status-success border border-status-success/30': b.isSuccess,
            'bg-bg-subtle text-text-muted border border-border-subtle':
              !b.isWarning && !b.isSuccess,
          }}
        >
          {b.text}
        </span>
      );
    }

    return (
      <span class="ml-auto rounded-md bg-bg-subtle/80 border border-border-subtle px-1.8 py-0.2 mono text-[9.5px] font-semibold text-text-muted">
        {b}
      </span>
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
          class="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden"
        />
      </Show>

      {/* Main Sidebar: Fixed height, fixed width, independent scroll */}
      <aside
        class="fixed top-0 bottom-0 left-0 z-50 flex h-screen w-62 shrink-0 flex-col border-r border-border-default bg-bg-sidebar/95 backdrop-blur-md transition-transform duration-200 ease-in-out md:static md:z-0 md:translate-x-0 select-none overflow-hidden"
        classList={{
          'translate-x-0': isSidebarOpen(),
          '-translate-x-full': !isSidebarOpen(),
        }}
      >
        {/* Brand Header with official @solidjs/router <A> */}
        <div class="flex h-13 shrink-0 items-center justify-between border-b border-border-default/70 px-4">
          <A
            href={RoutePath.OVERVIEW}
            onClick={() => setIsSidebarOpen(false)}
            class="flex items-center gap-3 hover:opacity-95 transition-opacity focus-visible:ring-2 focus-visible:ring-accent rounded-lg"
          >
            <div class="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-linear-to-br from-accent to-sky-600 text-white font-mono text-[12px] font-bold shadow-xs border border-white/20">
              ⌘
            </div>
            <div class="flex flex-col">
              <span class="text-xs font-bold tracking-tight text-text-primary">
                {t().common.workstation}
              </span>
              <span class="text-[9.5px] text-text-muted font-semibold tracking-tight">
                {t().sidebar.brandSubtitle}
              </span>
            </div>
          </A>

          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            aria-label={t().common.closeSidebar}
            class="flex h-6.5 w-6.5 items-center justify-center rounded-md text-text-muted hover:text-text-primary md:hidden hover:bg-bg-subtle"
          >
            ✕
          </button>
        </div>

        {/* Navigation Categories and Items */}
        <nav
          class="flex-1 overflow-y-auto px-3 py-3.5 space-y-4 min-h-0"
          aria-label="Sidebar Navigation"
        >
          <For each={groups}>
            {(group) => (
              <div class="space-y-1">
                <div class="px-2.5 py-0.8 text-[9.5px] font-bold uppercase tracking-wider text-text-muted/70 flex items-center gap-1.5">
                  <span class="h-1 w-1 rounded-full bg-border-strong" />
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
                          activeClass="bg-bg-active text-text-primary font-bold border-border-hover/80 shadow-2xs before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r before:bg-accent"
                          inactiveClass="border-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                          class="group relative flex w-full items-center gap-2.5 rounded-lg px-2.8 py-1.8 text-xs font-medium transition-all border focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <Icon
                            class={`h-3.8 w-3.8 shrink-0 transition-colors ${
                              isActive()
                                ? 'text-accent'
                                : 'text-text-muted group-hover:text-text-primary'
                            }`}
                          />
                          <span class="truncate">{item.label()}</span>
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
        <div class="shrink-0 border-t border-border-default/70 p-3 text-xs bg-bg-surface/60 backdrop-blur-xs">
          <div class="flex items-center justify-between text-[10.5px] text-text-muted mb-2.5 px-0.5">
            <span class="font-bold tracking-tight text-text-secondary text-[11px]">
              {t().common.vitalsSummary}
            </span>
            <span
              class="flex h-2 w-2 rounded-full"
              classList={{
                'bg-status-success shadow-[0_0_8px_rgba(52,211,153,0.8)]':
                  wsStatus() === WsConnectionStatus.ONLINE,
                'bg-status-warning animate-pulse': wsStatus() === WsConnectionStatus.CONNECTING,
                'bg-status-danger': wsStatus() === WsConnectionStatus.OFFLINE,
              }}
              title={wsStatusText()}
            />
          </div>

          <div class="space-y-2.5">
            {/* CPU Bar */}
            <div class="space-y-1">
              <div class="flex justify-between text-[10px] text-text-secondary">
                <span class="font-medium">{t().common.cpu}</span>
                <span class="mono tabular-nums text-text-primary font-bold">
                  {stats()?.cpu_usage?.toFixed(1) || '0.0'}%
                </span>
              </div>
              <div class="h-1.5 w-full rounded-full bg-bg-subtle overflow-hidden border border-border-subtle">
                <div
                  class="h-full bg-linear-to-r from-accent to-sky-400 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.min(stats()?.cpu_usage || 0, 100)}%` }}
                />
              </div>
            </div>

            {/* Memory Bar */}
            <div class="space-y-1">
              <div class="flex justify-between text-[10px] text-text-secondary">
                <span class="font-medium">{t().common.memory}</span>
                <span class="mono tabular-nums text-text-primary font-bold">
                  {stats()?.memory_percent?.toFixed(1) || '0.0'}%
                </span>
              </div>
              <div class="h-1.5 w-full rounded-full bg-bg-subtle overflow-hidden border border-border-subtle">
                <div
                  class="h-full bg-linear-to-r from-teal-400 to-status-success transition-all duration-300 rounded-full"
                  style={{ width: `${Math.min(stats()?.memory_percent || 0, 100)}%` }}
                />
              </div>
            </div>

            {/* Battery Indicator if present */}
            <Show when={battery()}>
              {(bat) => (
                <div class="flex items-center justify-between text-[10px] text-text-muted pt-2 border-t border-border-subtle">
                  <span class="font-medium">{t().common.batteryTooltip}</span>
                  <span
                    class="mono font-bold tabular-nums"
                    classList={{
                      'text-status-success': bat().percentage > 20,
                      'text-status-warning': bat().percentage <= 20,
                    }}
                  >
                    {bat().percentage}% {bat().is_charging ? '⚡' : ''}
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
