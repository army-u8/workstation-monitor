import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { useLocation } from '@solidjs/router';
import {
  formatUptime,
  setIsSidebarOpen,
  stats,
  theme,
  toggleTheme,
  wsStatus,
} from '../services/store';
import { locale, setLocale, t } from '../i18n';
import { Locale, NavSectionId, ThemeMode, WsConnectionStatus, pathToSectionMap } from '../constants';
import { MoonIcon, SunIcon } from './Icons';

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

  return (
    <header class="sticky top-0 z-30 flex h-13 w-full items-center justify-between border-b border-border-default bg-bg-surface/90 px-4 sm:px-5 backdrop-blur-md select-none">
      {/* Left: Mobile Toggle & Breadcrumb */}
      <div class="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          aria-label={t().common.openSidebar}
          class="flex h-7 w-7 items-center justify-center rounded border border-border-default bg-bg-subtle text-text-secondary hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
        >
          ☰
        </button>

        <div class="flex items-center gap-2 text-xs">
          <span class="text-text-muted">{t().common.console}</span>
          <span class="text-text-muted">/</span>
          <h1 class="font-semibold text-text-primary text-xs m-0 p-0">{getSectionTitle()}</h1>
          <span class="hidden rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.2 mono text-[9px] text-text-secondary sm:inline-block">
            {stats()?.host_name || 'localhost'}
          </span>
        </div>
      </div>

      {/* Right: Compact Vitals, Theme Switcher & Lang Switcher */}
      <div class="flex items-center gap-2">
        {/* Theme Switcher Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme() === ThemeMode.DARK ? t().common.themeLight : t().common.themeDark}
          class="flex h-7 w-7 items-center justify-center rounded border border-border-default bg-bg-subtle text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors focus-visible:ring-2 focus-visible:ring-accent"
          title={theme() === ThemeMode.DARK ? t().common.themeLight : t().common.themeDark}
        >
          <Show
            when={theme() === ThemeMode.DARK}
            fallback={<MoonIcon class="h-3.5 w-3.5 text-accent" />}
          >
            <SunIcon class="h-3.5 w-3.5 text-status-warning" />
          </Show>
        </button>

        {/* Language Switcher */}
        <div class="flex items-center rounded border border-border-default bg-bg-subtle p-0.5 text-[10px] font-mono" role="group" aria-label={t().common.langToggle}>
          <button
            type="button"
            onClick={() => setLocale(Locale.ZH)}
            aria-pressed={locale() === Locale.ZH}
            class="rounded px-1.5 py-0.5 transition-colors focus-visible:ring-1 focus-visible:ring-accent"
            classList={{
              'bg-bg-active text-text-primary font-semibold shadow-xs': locale() === Locale.ZH,
              'text-text-muted hover:text-text-primary': locale() !== Locale.ZH,
            }}
          >
            中文
          </button>
          <button
            type="button"
            onClick={() => setLocale(Locale.EN)}
            aria-pressed={locale() === Locale.EN}
            class="rounded px-1.5 py-0.5 transition-colors focus-visible:ring-1 focus-visible:ring-accent"
            classList={{
              'bg-bg-active text-text-primary font-semibold shadow-xs': locale() === Locale.EN,
              'text-text-muted hover:text-text-primary': locale() !== Locale.EN,
            }}
          >
            EN
          </button>
        </div>

        <div class="h-3 w-[1px] bg-border-default" aria-hidden="true" />

        {/* Clock */}
        <div class="mono text-[11px] text-text-secondary" aria-live="off">
          {timeStr()}
        </div>

        <div class="hidden h-3 w-[1px] bg-border-default sm:block" aria-hidden="true" />

        {/* Uptime */}
        <div class="hidden items-center gap-1 text-[11px] sm:flex">
          <span class="text-text-muted font-mono text-[9px] uppercase">UP</span>
          <span class="mono text-text-secondary text-[10.5px]">
            {formatUptime(stats()?.uptime_secs || 0)}
          </span>
        </div>

        {/* Status indicator dot */}
        <div class="flex items-center gap-1.5 rounded-full border border-border-default bg-bg-subtle px-2 py-0.5 text-[10px] text-text-secondary" role="status" aria-live="polite">
          <span
            class="h-1.5 w-1.5 rounded-full"
            classList={{
              'bg-status-success': wsStatus() === WsConnectionStatus.ONLINE,
              'bg-status-warning animate-pulse-dot': wsStatus() === WsConnectionStatus.CONNECTING,
              'bg-status-danger': wsStatus() === WsConnectionStatus.OFFLINE,
            }}
          />
          <span class="hidden sm:inline font-mono text-[9px]">
            {wsStatus() === WsConnectionStatus.ONLINE ? t().common.live : wsStatus() === WsConnectionStatus.CONNECTING ? t().common.sync : t().common.offline}
          </span>
        </div>
      </div>
    </header>
  );
};
