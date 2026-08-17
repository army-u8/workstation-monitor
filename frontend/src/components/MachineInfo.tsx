import { For, Show, createSignal, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import {
  copyToClipboard,
  fetchMachineInfoApi,
  machineInfo,
  openAppApi,
} from '../services/store';
import {
  AppBoxIcon,
  ChromeIcon,
  CodeIcon,
  FolderIcon,
  MonitorIcon,
  RefreshIcon,
  SafariIcon,
  TerminalIcon,
} from './Icons';
import { t } from '../i18n';
import type { AppVersionInfo } from '../types';

export const MachineInfo: Component = () => {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [installedOnly, setInstalledOnly] = createSignal(false);
  const [isRefreshing, setIsRefreshing] = createSignal(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchMachineInfoApi();
    setIsRefreshing(false);
  };

  onMount(() => {
    if (!machineInfo()) {
      fetchMachineInfoApi();
    }
  });

  const filteredApps = () => {
    const apps = machineInfo()?.core_apps || [];
    const q = searchQuery().trim().toLowerCase();

    return apps.filter((app) => {
      if (installedOnly() && !app.is_installed) return false;
      if (!q) return true;
      return (
        app.name.toLowerCase().includes(q) ||
        app.category.toLowerCase().includes(q) ||
        app.path.toLowerCase().includes(q) ||
        (app.version && app.version.toLowerCase().includes(q))
      );
    });
  };

  const installedCount = () => (machineInfo()?.core_apps || []).filter((a) => a.is_installed).length;
  const safariApp = () => (machineInfo()?.core_apps || []).find((a) => a.name.toLowerCase().includes('safari'));

  const renderAppIcon = (iconType: string) => {
    switch (iconType) {
      case 'safari':
        return <SafariIcon class="h-4 w-4 text-accent" />;
      case 'chrome':
        return <ChromeIcon class="h-4 w-4 text-status-warning" />;
      case 'edge':
      case 'arc':
      case 'firefox':
      case 'brave':
        return <SafariIcon class="h-4 w-4 text-status-info" />;
      case 'vscode':
      case 'cursor':
      case 'xcode':
        return <CodeIcon class="h-4 w-4 text-accent" />;
      case 'terminal':
      case 'ghostty':
      case 'iterm':
      case 'warp':
        return <TerminalIcon class="h-4 w-4 text-status-info" />;
      case 'finder':
        return <FolderIcon class="h-4 w-4 text-status-success" />;
      default:
        return <AppBoxIcon class="h-4 w-4 text-text-muted" />;
    }
  };

  return (
    <div class="flex flex-col gap-4" aria-label={t().machineInfo.hardwareTitle}>
      {/* 1. Hardware & System Specs Board */}
      <section class="rounded-lg border border-border-default bg-bg-surface p-4 shadow-xs">
        <div class="flex items-center justify-between border-b border-border-subtle pb-3">
          <div class="flex items-center gap-2.5">
            <div class="flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent">
              <MonitorIcon class="h-4 w-4" />
            </div>
            <div>
              <h2 class="text-sm font-bold text-text-primary">{t().machineInfo.hardwareTitle}</h2>
              <p class="text-[11px] text-text-muted">{t().machineInfo.hardwareSubtitle}</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing()}
              aria-busy={isRefreshing()}
              aria-label={t().common.refresh}
              class="flex items-center gap-1.5 rounded border border-border-default bg-bg-subtle px-2.5 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent"
            >
              <RefreshIcon class={`h-3.5 w-3.5 ${isRefreshing() ? 'animate-spin' : ''}`} />
              <span>{t().common.refresh}</span>
            </button>
          </div>
        </div>

        <Show
          when={machineInfo()}
          fallback={<div class="py-6 text-center text-xs text-text-muted mono">{t().common.loading}</div>}
        >
          {(info) => (
            <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 text-xs">
              {/* Chip / CPU */}
              <div class="rounded-md border border-border-subtle bg-bg-input p-3">
                <span class="text-[10.5px] text-text-muted">{t().machineInfo.chip}</span>
                <div class="mt-1 font-bold text-text-primary text-sm truncate">
                  {info().hardware.chip_name}
                </div>
                <div class="mt-0.5 text-[10px] text-text-muted mono">
                  {info().hardware.cpu_cores} {t().machineInfo.cores} ({info().hardware.arch})
                </div>
              </div>

              {/* Memory */}
              <div class="rounded-md border border-border-subtle bg-bg-input p-3">
                <span class="text-[10.5px] text-text-muted">{t().machineInfo.memory}</span>
                <div class="mt-1 font-bold text-text-primary text-sm truncate">
                  {info().hardware.memory_total_human}
                </div>
                <div class="mt-0.5 text-[10px] text-status-success mono font-medium">
                  Apple Silicon Unified
                </div>
              </div>

              {/* macOS Version */}
              <div class="rounded-md border border-border-subtle bg-bg-input p-3">
                <span class="text-[10.5px] text-text-muted">{t().machineInfo.osVersion}</span>
                <div class="mt-1 font-bold text-text-primary text-sm truncate">
                  {info().hardware.os_name} {info().hardware.os_version}
                </div>
                <div class="mt-0.5 text-[10px] text-text-muted mono">
                  Build: {info().hardware.build_version || '24F74'}
                </div>
              </div>

              {/* Hardware Model */}
              <div class="rounded-md border border-border-subtle bg-bg-input p-3">
                <span class="text-[10.5px] text-text-muted">{t().machineInfo.model}</span>
                <div class="mt-1 font-bold text-text-primary text-sm truncate">
                  {info().hardware.model_name}
                </div>
                <div class="mt-0.5 text-[10px] text-text-muted mono">
                  {info().hardware.kernel_version}
                </div>
              </div>

              {/* Default Shell */}
              <div class="rounded-md border border-border-subtle bg-bg-input p-3">
                <span class="text-[10.5px] text-text-muted">{t().machineInfo.shell}</span>
                <div class="mt-1 font-bold text-text-primary text-xs mono truncate">
                  {info().hardware.default_shell}
                </div>
                <div class="mt-0.5 text-[10px] text-text-muted">
                  User: <strong class="text-text-primary">{info().hardware.current_user}</strong>
                </div>
              </div>

              {/* Host & SIP */}
              <div class="rounded-md border border-border-subtle bg-bg-input p-3">
                <span class="text-[10.5px] text-text-muted">{t().machineInfo.sip}</span>
                <div class="mt-1 font-bold text-status-success text-xs mono truncate">
                  {info().hardware.sip_status}
                </div>
                <div class="mt-0.5 text-[10px] text-text-muted mono truncate">
                  Host: {info().hardware.host_name}
                </div>
              </div>

              {/* Spotlight Safari Quick Banner */}
              <Show when={safariApp()}>
                {(safari) => (
                  <div class="col-span-2 rounded-md border border-accent/30 bg-accent/5 p-3 flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                      <div class="flex h-8 w-8 items-center justify-center rounded bg-accent/20 text-accent">
                        <SafariIcon class="h-5 w-5" />
                      </div>
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-text-primary text-xs">Apple Safari</span>
                          <span class="rounded bg-accent/15 px-1.5 py-0.2 mono text-[10px] text-accent font-bold">
                            v{safari().version || '18.5'}
                          </span>
                        </div>
                        <span class="text-[10px] text-text-muted mono">{safari().path}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openAppApi(safari().path, 'finder')}
                      class="rounded bg-accent px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:ring-1 focus-visible:ring-accent"
                    >
                      {t().machineInfo.openApp}
                    </button>
                  </div>
                )}
              </Show>
            </div>
          )}
        </Show>
      </section>

      {/* 2. Core & Default Applications Matrix */}
      <section class="rounded-lg border border-border-default bg-bg-surface p-4 shadow-xs">
        <div class="flex flex-col gap-2.5 border-b border-border-subtle pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-bold text-text-primary">{t().machineInfo.coreAppsTitle}</h2>
              <span class="rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.2 mono text-[10px] text-text-muted">
                {installedCount()} / {(machineInfo()?.core_apps || []).length} {t().machineInfo.installedCount}
              </span>
            </div>
            <p class="text-[11px] text-text-muted mt-0.5">{t().machineInfo.coreAppsSubtitle}</p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            {/* Filter Toggle */}
            <button
              type="button"
              onClick={() => setInstalledOnly(!installedOnly())}
              aria-pressed={installedOnly()}
              class="rounded border px-2.5 py-1 text-[11px] transition-colors focus-visible:ring-1 focus-visible:ring-accent"
              classList={{
                'bg-accent/15 border-accent/40 text-accent font-medium': installedOnly(),
                'bg-bg-input border-border-subtle text-text-muted hover:text-text-primary': !installedOnly(),
              }}
            >
              {installedOnly() ? t().machineInfo.filterInstalled : t().machineInfo.filterAll}
            </button>

            {/* Search Input */}
            <div class="relative flex items-center">
              <input
                type="text"
                aria-label={t().machineInfo.searchPlaceholder}
                placeholder={t().machineInfo.searchPlaceholder}
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                class="w-52 rounded border border-border-default bg-bg-input py-1 pl-2.5 pr-6 text-[11px] text-text-primary placeholder:text-text-muted outline-none transition-all focus:border-border-strong focus-visible:ring-1 focus-visible:ring-accent"
              />
              <Show when={searchQuery()}>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={t().common.cancel}
                  class="absolute right-1.5 text-[10px] text-text-muted hover:text-text-primary"
                >
                  ✕
                </button>
              </Show>
            </div>
          </div>
        </div>

        {/* Applications Grid */}
        <div class="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <For
            each={filteredApps()}
            fallback={
              <div class="col-span-full py-10 text-center text-xs text-text-muted mono">
                {t().common.all} {t().common.status}
              </div>
            }
          >
            {(app: AppVersionInfo) => (
              <div
                class="flex flex-col justify-between rounded-md border p-3 transition-colors"
                classList={{
                  'border-border-subtle bg-bg-input hover:border-border-default': app.is_installed,
                  'border-border-subtle/50 bg-bg-input/40 opacity-60': !app.is_installed,
                }}
              >
                <div>
                  <div class="flex items-start justify-between">
                    <div class="flex items-center gap-2">
                      <div class="flex h-7 w-7 items-center justify-center rounded bg-bg-subtle border border-border-subtle">
                        {renderAppIcon(app.icon_type)}
                      </div>
                      <div class="truncate">
                        <div class="font-bold text-xs text-text-primary truncate" title={app.name}>
                          {app.name}
                        </div>
                        <span class="rounded bg-bg-subtle px-1.5 py-0.2 text-[9.5px] text-text-muted border border-border-subtle">
                          {app.category}
                        </span>
                      </div>
                    </div>

                    {/* Version Badge */}
                    <div>
                      <Show
                        when={app.is_installed && app.version}
                        fallback={
                          <span
                            class="rounded px-1.5 py-0.2 mono text-[9px] font-medium"
                            classList={{
                              'bg-status-success/15 text-status-success': app.is_installed,
                              'bg-bg-subtle text-text-muted border border-border-subtle': !app.is_installed,
                            }}
                          >
                            {app.is_installed ? t().machineInfo.installed : t().machineInfo.notInstalled}
                          </span>
                        }
                      >
                        <span class="rounded bg-status-success/15 px-1.5 py-0.2 mono text-[9.5px] text-status-success font-bold">
                          v{app.version}
                        </span>
                      </Show>
                    </div>
                  </div>

                  {/* App Path */}
                  <button
                    type="button"
                    onClick={() => copyToClipboard(app.path, 'App Path')}
                    class="mt-2.5 mono text-[9.5px] text-text-muted truncate hover:text-accent text-left block w-full focus-visible:ring-1 focus-visible:ring-accent rounded"
                    title={app.path}
                  >
                    {app.path}
                  </button>
                </div>

                {/* Bottom Action */}
                <div class="mt-3 flex items-center justify-between border-t border-border-subtle pt-2 text-[10px]">
                  <span class="text-text-muted mono">
                    {app.is_installed ? 'Ready' : 'Not installed'}
                  </span>

                  <Show when={app.is_installed}>
                    <button
                      type="button"
                      onClick={() => openAppApi(app.path, 'finder')}
                      class="rounded bg-bg-subtle border border-border-subtle px-2 py-0.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors focus-visible:ring-1 focus-visible:ring-accent"
                    >
                      {t().machineInfo.openApp}
                    </button>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>
      </section>
    </div>
  );
};
