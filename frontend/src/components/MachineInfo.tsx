import { For, Show, createSignal, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { copyToClipboard, fetchMachineInfoApi, machineInfo, openAppApi } from '../services/store';
import {
  AppBoxIcon,
  CheckIcon,
  ChromeIcon,
  CloseIcon,
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

  const installedCount = () =>
    (machineInfo()?.core_apps || []).filter((a) => a.is_installed).length;
  const safariApp = () =>
    (machineInfo()?.core_apps || []).find((a) => a.name.toLowerCase().includes('safari'));

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
      <section class="glass-card p-4 shadow-xs">
        <div class="flex items-center justify-between border-b border-border-subtle pb-3">
          <div class="flex items-center gap-2.5">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent border border-accent/20">
              <MonitorIcon class="h-4 w-4" />
            </div>
            <div>
              <h2 class="text-sm font-bold text-text-primary m-0">
                {t().machineInfo.hardwareTitle}
              </h2>
              <p class="text-[11px] text-text-muted mt-0.5">{t().machineInfo.hardwareSubtitle}</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing()}
              aria-busy={isRefreshing()}
              aria-label={t().common.refresh}
              class="flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary transition-all hover:bg-bg-hover hover:border-border-hover disabled:opacity-50"
            >
              <RefreshIcon class={`h-3.5 w-3.5 ${isRefreshing() ? 'animate-spin' : ''}`} />
              <span>{t().common.refresh}</span>
            </button>
          </div>
        </div>

        <Show
          when={machineInfo()}
          fallback={
            <div class="py-10 text-center text-xs text-text-muted mono">{t().common.loading}</div>
          }
        >
          {(info) => (
            <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 text-xs">
              {/* Chip / CPU */}
              <div class="glass-card-subtle p-3">
                <span class="text-[10px] text-text-muted font-bold block">
                  {t().machineInfo.chip}
                </span>
                <span
                  class="font-bold text-text-primary text-xs mt-1 block truncate"
                  title={info().hardware.chip_name}
                >
                  {info().hardware.chip_name}
                </span>
                <span class="mono text-[10px] text-accent mt-1 block">
                  {info().hardware.cpu_cores} {t().machineInfo.cores} ({info().hardware.arch})
                </span>
              </div>

              {/* Memory */}
              <div class="glass-card-subtle p-3">
                <span class="text-[10px] text-text-muted font-bold block">
                  {t().machineInfo.memory}
                </span>
                <span class="font-bold text-text-primary text-sm mt-1 block mono">
                  {info().hardware.memory_total_human}
                </span>
                <span class="mono text-[10px] text-status-success mt-1 block font-semibold">
                  Unified Memory
                </span>
              </div>

              {/* macOS Version */}
              <div class="glass-card-subtle p-3">
                <span class="text-[10px] text-text-muted font-bold block">
                  {t().machineInfo.osVersion}
                </span>
                <span
                  class="font-bold text-text-primary text-xs mt-1 block truncate"
                  title={`${info().hardware.os_name} ${info().hardware.os_version}`}
                >
                  {info().hardware.os_name} {info().hardware.os_version}
                </span>
                <span
                  class="mono text-[10px] text-text-muted mt-1 block truncate"
                  title={`Build: ${info().hardware.build_version}`}
                >
                  Build: {info().hardware.build_version || '24F74'}
                </span>
              </div>

              {/* Hardware Model */}
              <div class="glass-card-subtle p-3">
                <span class="text-[10px] text-text-muted font-bold block">
                  {t().machineInfo.model}
                </span>
                <span
                  class="font-bold text-text-primary text-xs mt-1 block truncate"
                  title={info().hardware.model_name}
                >
                  {info().hardware.model_name}
                </span>
                <span
                  class="mono text-[10px] text-text-muted mt-1 block truncate"
                  title={info().hardware.kernel_version}
                >
                  {info().hardware.kernel_version}
                </span>
              </div>

              {/* Default Shell */}
              <div class="glass-card-subtle p-3">
                <span class="text-[10px] text-text-muted font-bold block">
                  {t().machineInfo.shell}
                </span>
                <span
                  class="font-bold text-text-primary text-xs mono mt-1 block truncate"
                  title={info().hardware.default_shell}
                >
                  {info().hardware.default_shell}
                </span>
                <span class="text-[10px] text-text-muted mt-1 block">
                  User: <strong class="text-text-primary">{info().hardware.current_user}</strong>
                </span>
              </div>

              {/* Host & SIP */}
              <div class="glass-card-subtle p-3">
                <span class="text-[10px] text-text-muted font-bold block">
                  {t().machineInfo.sip}
                </span>
                <span class="font-bold text-status-success text-xs mono mt-1 block truncate">
                  {info().hardware.sip_status}
                </span>
                <span
                  class="mono text-[10px] text-text-muted mt-1 block truncate"
                  title={`Host: ${info().hardware.host_name}`}
                >
                  Host: {info().hardware.host_name}
                </span>
              </div>

              {/* Spotlight Safari Quick Banner */}
              <Show when={safariApp()}>
                {(safari) => (
                  <div class="col-span-2 glass-card-subtle p-3 flex items-center justify-between border-accent/30 bg-accent/5">
                    <div class="flex items-center gap-2.5">
                      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent border border-accent/25">
                        <SafariIcon class="h-5 w-5" />
                      </div>
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-text-primary text-xs">Apple Safari</span>
                          <span class="rounded bg-accent/15 px-1.8 py-0.2 mono text-[10px] text-accent font-bold">
                            v{safari().version || '18.5'}
                          </span>
                        </div>
                        <span class="text-[10px] text-text-muted mono">{safari().path}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openAppApi(safari().path, 'finder')}
                      class="rounded-lg bg-accent px-3 py-1 text-xs font-bold text-white transition-all hover:brightness-110 active:scale-95 shadow-2xs"
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
      <section class="glass-card p-4 shadow-xs">
        <div class="flex flex-col gap-2.5 border-b border-border-subtle pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-accent animate-pulse-dot" />
              <h2 class="text-sm font-bold text-text-primary m-0">
                {t().machineInfo.coreAppsTitle}
              </h2>
              <span class="rounded-md bg-bg-subtle border border-border-subtle px-2 py-0.5 mono text-[10px] font-bold text-text-muted">
                {installedCount()} / {(machineInfo()?.core_apps || []).length}{' '}
                {t().machineInfo.installedCount}
              </span>
            </div>
            <p class="text-[11px] text-text-muted mt-1">{t().machineInfo.coreAppsSubtitle}</p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            {/* Filter Toggle */}
            <button
              type="button"
              onClick={() => setInstalledOnly(!installedOnly())}
              aria-pressed={installedOnly()}
              class="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all focus-visible:ring-1 focus-visible:ring-accent"
              classList={{
                'bg-accent text-white border-accent shadow-2xs': installedOnly(),
                'bg-bg-surface border-border-default text-text-muted hover:text-text-primary':
                  !installedOnly(),
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
                class="w-56 rounded-lg border border-border-default bg-bg-surface py-1.5 pl-3 pr-6 text-xs text-text-primary placeholder:text-text-muted outline-none transition-all focus:border-accent focus-visible:ring-1 focus-visible:ring-accent"
              />
              <Show when={searchQuery()}>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={t().common.cancel}
                  class="absolute right-2 text-text-muted hover:text-text-primary p-0.5"
                >
                  <CloseIcon class="h-3 w-3" />
                </button>
              </Show>
            </div>
          </div>
        </div>

        {/* Applications Grid */}
        <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <For
            each={filteredApps()}
            fallback={
              <div class="col-span-full py-12 text-center text-xs text-text-muted mono">
                {t().common.all} {t().common.status}
              </div>
            }
          >
            {(app: AppVersionInfo) => (
              <div
                class="glass-card-subtle flex flex-col justify-between p-3.5 transition-all duration-200"
                classList={{
                  'hover:border-border-hover hover:translate-y-[-1px]': app.is_installed,
                  'opacity-50 grayscale': !app.is_installed,
                }}
              >
                <div>
                  <div class="flex items-start justify-between">
                    <div class="flex items-center gap-2.5">
                      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-surface border border-border-subtle shadow-2xs">
                        {renderAppIcon(app.icon_type)}
                      </div>
                      <div class="truncate">
                        <div class="font-bold text-xs text-text-primary truncate" title={app.name}>
                          {app.name}
                        </div>
                        <span class="rounded bg-bg-surface px-1.8 py-0.2 text-[9.5px] font-semibold text-text-muted border border-border-subtle">
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
                            class="rounded-md px-2 py-0.5 mono text-[9.5px] font-bold"
                            classList={{
                              'bg-status-success/15 text-status-success border border-status-success/30':
                                app.is_installed,
                              'bg-bg-surface text-text-muted border border-border-subtle':
                                !app.is_installed,
                            }}
                          >
                            {app.is_installed
                              ? t().machineInfo.installed
                              : t().machineInfo.notInstalled}
                          </span>
                        }
                      >
                        <span class="rounded-md bg-status-success/15 border border-status-success/30 px-2 py-0.5 mono text-[9.5px] text-status-success font-bold">
                          v{app.version}
                        </span>
                      </Show>
                    </div>
                  </div>

                  {/* App Path */}
                  <button
                    type="button"
                    onClick={() => copyToClipboard(app.path, 'App Path')}
                    class="mt-3 mono text-[10px] text-text-muted truncate hover:text-accent text-left block w-full focus-visible:ring-1 focus-visible:ring-accent rounded px-1.5 py-0.5 bg-bg-base/60 border border-border-subtle/50"
                    title={app.path}
                  >
                    {app.path}
                  </button>
                </div>

                {/* Bottom Action */}
                <div class="mt-3.5 flex items-center justify-between border-t border-border-subtle pt-2.5 text-[10.5px]">
                  <span class="text-text-muted mono font-semibold flex items-center gap-1">
                    <Show
                      when={app.is_installed}
                      fallback={
                        <>
                          <CloseIcon class="h-3 w-3 text-status-danger" />
                          <span>Not installed</span>
                        </>
                      }
                    >
                      <CheckIcon class="h-3 w-3 text-status-success" />
                      <span>Ready</span>
                    </Show>
                  </span>

                  <Show when={app.is_installed}>
                    <button
                      type="button"
                      onClick={() => openAppApi(app.path, 'finder')}
                      class="rounded-md bg-bg-surface border border-border-default px-2.5 py-1 text-xs font-semibold text-text-secondary hover:text-text-primary hover:border-border-hover transition-all"
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
