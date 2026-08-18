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
  SafariIcon,
  TerminalIcon,
} from './Icons';
import { Badge, Button, Input } from './ui';
import { t } from '../i18n';

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
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing()}
              loading={isRefreshing()}
              aria-label={t().common.refresh}
            >
              <span>{t().common.refresh}</span>
            </Button>
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

                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => openAppApi(safari().path, 'finder')}
                    >
                      {t().machineInfo.openApp}
                    </Button>
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
            <Button
              type="button"
              variant={installedOnly() ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setInstalledOnly(!installedOnly())}
              aria-pressed={installedOnly()}
            >
              {installedOnly() ? t().machineInfo.filterInstalled : t().machineInfo.filterAll}
            </Button>

            {/* Search Input */}
            <div class="relative flex items-center">
              <Input
                type="text"
                aria-label={t().machineInfo.searchPlaceholder}
                placeholder={t().machineInfo.searchPlaceholder}
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                class="w-56 pr-8"
              />
              <Show when={searchQuery()}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchQuery('')}
                  aria-label={t().common.cancel}
                  class="absolute right-1 h-6 w-6"
                >
                  <CloseIcon class="h-3 w-3" />
                </Button>
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
            {(app) => (
              <div
                class="glass-card-subtle flex flex-col justify-between p-3.5 transition-all duration-200 hover:border-border-hover hover:translate-y-[-1px]"
                classList={{
                  'opacity-60 border-border-subtle/50': !app.is_installed,
                }}
              >
                <div>
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-surface border border-border-subtle shrink-0">
                        {renderAppIcon(app.icon_type)}
                      </div>
                      <div class="min-w-0">
                        <h3 class="font-bold text-xs text-text-primary truncate m-0">{app.name}</h3>
                        <span class="text-[10px] text-text-muted block truncate">
                          {app.category}
                        </span>
                      </div>
                    </div>

                    <div class="shrink-0">
                      <Show
                        when={app.is_installed}
                        fallback={
                          <Badge variant="secondary" size="sm">
                            {t().machineInfo.notInstalled}
                          </Badge>
                        }
                      >
                        <Badge variant="success" size="sm">
                          v{app.version}
                        </Badge>
                      </Show>
                    </div>
                  </div>

                  {/* App Path */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(app.path, 'App Path')}
                    class="mt-3 mono text-[10px] text-text-muted hover:text-accent text-left w-full justify-start h-auto py-1 px-2 max-w-full overflow-hidden"
                    title={app.path}
                  >
                    <span class="truncate block w-full">{app.path}</span>
                  </Button>
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
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => openAppApi(app.path, 'finder')}
                    >
                      {t().machineInfo.openApp}
                    </Button>
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
