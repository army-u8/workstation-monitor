import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { useLocation } from '@solidjs/router';
import {
  fetchUpdateCheckApi,
  formatUptime,
  isCheckingUpdate,
  setIsCommandPaletteOpen,
  setIsSidebarOpen,
  setIsUpdateModalOpen,
  setTheme,
  stats,
  theme,
  updateInfo,
  wsStatus,
} from '../services/store';
import { locale, setLocale, t } from '../i18n';
import {
  Locale,
  NavSectionId,
  ThemeMode,
  WsConnectionStatus,
  pathToSectionMap,
} from '../constants';
import { CommandIcon, CompactIcon, MoonIcon, SunIcon, SystemThemeIcon } from './Icons';
import { Button } from './ui';

export const Header: Component = () => {
  const [timeStr, setTimeStr] = createSignal('00:00:00');
  const location = useLocation();

  onMount(() => {
    const update = () => {
      setTimeStr(new Date().toTimeString().split(' ')[0]);
    };
    update();
    const interval = setInterval(update, 1000);
    onCleanup(() => clearInterval(interval));
  });

  const getSectionTitle = () => {
    const section = pathToSectionMap[location.pathname] || NavSectionId.OVERVIEW;
    const dict = t().header.titles;
    return (dict as any)[section] || t().common.overview;
  };

  const getThemeLabel = () => {
    const mode = theme();
    if (mode === ThemeMode.SYSTEM) return t().common.themeSystem;
    if (mode === ThemeMode.DARK) return t().common.themeDark;
    return t().common.themeLight;
  };

  const getThemeTooltip = () => {
    return t().common.themeToggleTip.replace('{mode}', getThemeLabel());
  };

  return (
    <header class="sticky top-0 z-30 flex h-13 w-full items-center justify-between border-b border-border-default bg-bg-surface/85 px-4 sm:px-5 backdrop-blur-md select-none transition-colors">
      {/* Left: Mobile Toggle & Breadcrumb */}
      <div class="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setIsSidebarOpen(true)}
          aria-label={t().common.openSidebar}
          class="h-7.5 w-7.5 lg:hidden"
        >
          <CompactIcon class="h-4 w-4" />
        </Button>

        <div class="flex items-center gap-2 text-xs">
          <div class="flex items-center gap-1.5 text-text-muted font-medium">
            <span class="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_rgba(56,189,248,0.8)] animate-pulse-dot" />
            <span class="font-mono uppercase text-[10px] tracking-wider font-bold text-accent/80">{t().common.console}</span>
          </div>
          <span class="text-text-muted/40 font-mono">/</span>
          <h1 class="font-bold text-text-primary text-xs m-0 p-0 tracking-tight flex items-center gap-2">
            <span>{getSectionTitle()}</span>
          </h1>
          <span class="hidden rounded-md bg-bg-subtle border border-border-subtle px-2 py-0.5 mono text-[10px] text-text-tertiary sm:inline-block shadow-2xs">
            {stats()?.host_name || 'localhost'}
          </span>
        </div>
      </div>

      {/* Right: Compact Vitals, Theme Switcher & Lang Switcher */}
      <div class="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsCommandPaletteOpen(true)}
          aria-label={t().control.openCommandPalette}
          title={t().control.openCommandPalette}
          class="gap-1.5 h-7 px-2.5 bg-bg-subtle/70 hover:bg-bg-subtle"
        >
          <CommandIcon class="h-3.5 w-3.5 text-accent" />
          <span class="hidden xl:inline font-mono text-[11px]">{t().control.title}</span>
          <kbd class="rounded border border-border-default bg-bg-base px-1.5 py-0.2 text-[9px] font-mono text-text-muted">
            {t().control.shortcut}
          </kbd>
        </Button>

        {/* Theme Select Dropdown */}
        <div class="relative flex items-center rounded-lg border border-border-default bg-bg-subtle/80 px-2 py-1 text-[11px] font-mono text-text-secondary hover:border-border-hover hover:text-text-primary transition-all shadow-2xs">
          <span class="mr-1.5 flex items-center pointer-events-none shrink-0">
            <Show when={theme() === ThemeMode.SYSTEM}>
              <SystemThemeIcon class="h-3.5 w-3.5 text-accent" />
            </Show>
            <Show when={theme() === ThemeMode.DARK}>
              <MoonIcon class="h-3.5 w-3.5 text-accent" />
            </Show>
            <Show when={theme() === ThemeMode.LIGHT}>
              <SunIcon class="h-3.5 w-3.5 text-status-warning" />
            </Show>
          </span>
          <select
            value={theme()}
            onChange={(e) => setTheme(e.currentTarget.value as ThemeMode)}
            aria-label={getThemeTooltip()}
            class="bg-transparent text-text-primary text-[11px] font-mono outline-hidden cursor-pointer"
          >
            <option value={ThemeMode.SYSTEM} class="bg-bg-surface text-text-primary">
              {t().common.themeSystem}
            </option>
            <option value={ThemeMode.DARK} class="bg-bg-surface text-text-primary">
              {t().common.themeDark}
            </option>
            <option value={ThemeMode.LIGHT} class="bg-bg-surface text-text-primary">
              {t().common.themeLight}
            </option>
          </select>
        </div>

        {/* Language Switcher */}
        <div
          class="flex items-center rounded-lg border border-border-default bg-bg-subtle/80 p-0.5 text-[10.5px] font-mono shadow-2xs"
          role="group"
          aria-label={t().common.langToggle}
        >
          <Button
            type="button"
            variant={locale() === Locale.ZH ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setLocale(Locale.ZH)}
            aria-pressed={locale() === Locale.ZH}
            class="h-6 px-2 text-[10.5px]"
          >
            {t().common.langZh}
          </Button>
          <Button
            type="button"
            variant={locale() === Locale.EN ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setLocale(Locale.EN)}
            aria-pressed={locale() === Locale.EN}
            class="h-6 px-2 text-[10.5px]"
          >
            {t().common.langEn}
          </Button>
        </div>

        {/* Update Checker Badge & Trigger */}
        <Button
          type="button"
          variant={updateInfo()?.has_update ? 'outline' : 'secondary'}
          size="sm"
          onClick={() => {
            setIsUpdateModalOpen(true);
            fetchUpdateCheckApi(true);
          }}
          disabled={isCheckingUpdate()}
          loading={isCheckingUpdate()}
          class="font-mono text-[11px]"
          classList={{
            'border-status-success/40 bg-status-success/15 text-status-success font-bold hover:bg-status-success/25':
              Boolean(updateInfo()?.has_update),
          }}
          title={
            updateInfo()?.has_update ? t().update.newVersionAvailable : t().update.checkUpdateBtn
          }
        >
          <Show
            when={updateInfo()?.has_update}
            fallback={
              <span>
                {isCheckingUpdate()
                  ? t().update.checking
                  : `v${updateInfo()?.current_version || '0.2.9'}`}
              </span>
            }
          >
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75" />
              <span class="relative inline-flex rounded-full h-2 w-2 bg-status-success" />
            </span>
            <span>{updateInfo()?.latest_version}</span>
          </Show>
        </Button>

        <div class="h-3.5 w-[1px] bg-border-default" aria-hidden="true" />

        {/* Clock */}
        <div
          class="mono text-[11px] font-semibold text-text-secondary tabular-nums"
          aria-live="off"
        >
          {timeStr()}
        </div>

        <div class="hidden h-3.5 w-[1px] bg-border-default sm:block" aria-hidden="true" />

        {/* Uptime */}
        <div class="hidden items-center gap-1.5 text-[11px] sm:flex bg-bg-subtle/60 border border-border-subtle px-2 py-0.5 rounded-md">
          <span class="text-text-muted font-mono text-[9px] uppercase font-bold tracking-wider">
            UP
          </span>
          <span class="mono text-text-secondary text-[11px] tabular-nums font-medium">
            {formatUptime(stats()?.uptime_secs || 0)}
          </span>
        </div>

        {/* Status indicator dot */}
        <div
          class="flex items-center gap-1.5 rounded-full border border-border-default bg-bg-subtle/90 px-2.5 py-0.8 text-[10px] text-text-secondary shadow-2xs"
          role="status"
          aria-live="polite"
        >
          <span
            class="h-1.8 w-1.8 rounded-full"
            classList={{
              'bg-status-success shadow-[0_0_8px_rgba(52,211,153,0.8)]':
                wsStatus() === WsConnectionStatus.ONLINE,
              'bg-status-warning animate-pulse-dot': wsStatus() === WsConnectionStatus.CONNECTING,
              'bg-status-danger': wsStatus() === WsConnectionStatus.OFFLINE,
            }}
          />
          <span class="hidden sm:inline font-mono text-[9.5px] font-bold">
            {wsStatus() === WsConnectionStatus.ONLINE
              ? t().common.live
              : wsStatus() === WsConnectionStatus.CONNECTING
                ? t().common.sync
                : t().common.offline}
          </span>
        </div>
      </div>
    </header>
  );
};
