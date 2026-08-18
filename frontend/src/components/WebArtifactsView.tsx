import { For, Match, Show, Switch, createMemo, createSignal, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import {
  copyToClipboard,
  fetchWebArtifactsApi,
  freeArtifactPortApi,
  isLoadingArtifacts,
  webArtifacts,
} from '../services/store';
import { CompactIcon, GridIcon, ListIcon, RefreshIcon } from './Icons';
import { ArtifactsLayoutMode, ArtifactsSortBy, StorageKey } from '../constants';
import { t } from '../i18n';
import type { WebArtifactInfo } from '../types';

const getInitialLayout = (): ArtifactsLayoutMode => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(StorageKey.ARTIFACTS_LAYOUT);
    if (
      saved === ArtifactsLayoutMode.GRID ||
      saved === ArtifactsLayoutMode.TABLE ||
      saved === ArtifactsLayoutMode.COMPACT
    ) {
      return saved as ArtifactsLayoutMode;
    }
  }
  return ArtifactsLayoutMode.GRID;
};

export const WebArtifactsView: Component = () => {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [layoutMode, setLayoutModeState] = createSignal<ArtifactsLayoutMode>(getInitialLayout());
  const [sortBy, setSortBy] = createSignal<ArtifactsSortBy>(ArtifactsSortBy.PORT);
  const [statusFilter, setStatusFilter] = createSignal<'all' | 'healthy' | 'degraded'>('all');

  const setLayoutMode = (mode: ArtifactsLayoutMode) => {
    setLayoutModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(StorageKey.ARTIFACTS_LAYOUT, mode);
    }
  };

  onMount(() => {
    fetchWebArtifactsApi();
  });

  const healthyCount = createMemo(() => webArtifacts().filter((a) => a.is_healthy).length);
  const degradedCount = createMemo(() => webArtifacts().filter((a) => !a.is_healthy).length);

  const avgLatency = createMemo(() => {
    const items = webArtifacts().filter((a) => typeof a.response_time_ms === 'number');
    if (!items.length) return 0;
    const sum = items.reduce((acc, a) => acc + (a.response_time_ms || 0), 0);
    return Math.round(sum / items.length);
  });

  const frameworkTags = createMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of webArtifacts()) {
      counts[a.framework] = (counts[a.framework] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  });

  const filteredAndSortedArtifacts = () => {
    let list = [...webArtifacts()];
    const q = searchQuery().trim().toLowerCase();

    // 1. Keyword search
    if (q) {
      list = list.filter(
        (a) =>
          a.port.toString().includes(q) ||
          (a.title && a.title.toLowerCase().includes(q)) ||
          a.framework.toLowerCase().includes(q) ||
          (a.process_name && a.process_name.toLowerCase().includes(q)) ||
          a.url.toLowerCase().includes(q),
      );
    }

    // 2. Status filter
    const status = statusFilter();
    if (status === 'healthy') {
      list = list.filter((a) => a.is_healthy);
    } else if (status === 'degraded') {
      list = list.filter((a) => !a.is_healthy);
    }

    // 3. Sorting
    const sort = sortBy();
    if (sort === ArtifactsSortBy.PORT) {
      list.sort((a, b) => a.port - b.port);
    } else if (sort === ArtifactsSortBy.LATENCY) {
      list.sort((a, b) => (a.response_time_ms || 9999) - (b.response_time_ms || 9999));
    } else if (sort === ArtifactsSortBy.FRAMEWORK) {
      list.sort((a, b) => a.framework.localeCompare(b.framework));
    }

    return list;
  };

  const handleOpenBrowser = (url: string) => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div class="flex flex-col gap-3" aria-label={t().artifacts.title}>
      {/* 1. Top Overview Metric Summary Cards (Mirrors GitRadar dual-card layout) */}
      <section class="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Left Card: Web Services Overview */}
        <div class="flex flex-col justify-between rounded-lg border border-border-default bg-bg-surface p-3.5 shadow-xs">
          <div>
            <div class="flex items-center justify-between pb-2 border-b border-border-subtle">
              <div class="flex items-center gap-2">
                <div class="flex h-6 w-6 items-center justify-center rounded bg-accent/15 text-accent text-sm">
                  🖼️
                </div>
                <h3 class="text-xs font-bold text-text-primary">
                  {t().artifacts.overviewCardTitle}
                </h3>
              </div>

              <span class="mono text-[10px] text-text-muted">
                {webArtifacts().length} {t().artifacts.runningPorts}
              </span>
            </div>

            <div class="mt-2.5 grid grid-cols-3 gap-2 text-xs">
              <div>
                <span class="text-[10px] text-text-muted">{t().artifacts.kpiTotalPorts}</span>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span class="font-bold text-text-primary text-xs mono tabular-nums">
                    {webArtifacts().length}
                  </span>
                </div>
              </div>

              <div>
                <span class="text-[10px] text-text-muted">{t().artifacts.kpiHealthy}</span>
                <div class="mt-0.5">
                  <span class="rounded bg-status-success/15 border border-status-success/30 px-1.5 py-0.2 mono text-[10px] text-status-success font-semibold tabular-nums">
                    {healthyCount()}
                  </span>
                </div>
              </div>

              <div>
                <span class="text-[10px] text-text-muted">{t().artifacts.kpiAvgLatency}</span>
                <div class="mt-0.5">
                  <span class="mono text-xs font-semibold text-text-secondary tabular-nums">
                    {avgLatency()} ms
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Framework Tags Flow */}
          <div class="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border-subtle pt-2 text-[10px]">
            <span class="text-text-muted">{t().artifacts.framework}:</span>
            <Show
              when={frameworkTags().length > 0}
              fallback={<span class="mono text-text-muted text-[9.5px]">None active</span>}
            >
              <For each={frameworkTags().slice(0, 5)}>
                {([name, count]) => (
                  <span class="rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.2 mono text-[9.5px] text-text-secondary">
                    {name} <span class="text-accent font-semibold">({count})</span>
                  </span>
                )}
              </For>
            </Show>
          </div>
        </div>

        {/* Right Card: Port Sniffer & Quick Diagnostics */}
        <div class="flex flex-col justify-between rounded-lg border border-border-default bg-bg-surface p-3.5 shadow-xs">
          <div>
            <div class="flex items-center justify-between pb-2 border-b border-border-subtle">
              <div class="flex items-center gap-2">
                <div class="flex h-6 w-6 items-center justify-center rounded bg-status-info/15 text-status-info text-xs">
                  ⚡
                </div>
                <h3 class="text-xs font-bold text-text-primary">{t().artifacts.title}</h3>
              </div>

              <button
                type="button"
                onClick={() => fetchWebArtifactsApi()}
                disabled={isLoadingArtifacts()}
                class="mono text-[10px] text-accent hover:underline flex items-center gap-1"
              >
                <RefreshIcon class="h-3 w-3" classList={{ 'animate-spin': isLoadingArtifacts() }} />
                <span>
                  {isLoadingArtifacts() ? t().artifacts.scanning : t().artifacts.refreshBtn}
                </span>
              </button>
            </div>

            <p class="mt-2 text-xs text-text-muted leading-relaxed line-clamp-2 m-0">
              {t().artifacts.subtitle}
            </p>
          </div>

          <div class="mt-2.5 flex items-center justify-between border-t border-border-subtle pt-2 text-[10px]">
            <span class="text-text-muted">{t().artifacts.status}:</span>
            <span
              class="mono rounded px-1.5 py-0.2 font-medium text-[9.5px]"
              classList={{
                'bg-status-success/15 text-status-success': degradedCount() === 0,
                'bg-status-warning/15 text-status-warning': degradedCount() > 0,
              }}
            >
              {degradedCount() === 0
                ? `${healthyCount()} Online`
                : `${degradedCount()} Degraded / Down`}
            </span>
          </div>
        </div>
      </section>

      {/* 2. Controls Toolbar (Identical structure and buttons as GitRadar) */}
      <section class="flex flex-col gap-2.5 rounded-lg border border-border-default bg-bg-surface p-3.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Section Title, Count & Status Filter */}
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-2">
            <h2 class="text-xs font-semibold text-text-primary">{t().artifacts.title}</h2>
            <span class="mono text-[10px] text-text-muted">
              {webArtifacts().length} {t().artifacts.runningPorts}
            </span>
          </div>

          {/* Quick Status Filter Toggles */}
          <div class="flex items-center rounded border border-border-subtle bg-bg-input p-0.5 text-[10.5px]">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              aria-pressed={statusFilter() === 'all'}
              class="rounded px-2 py-0.5 transition-colors"
              classList={{
                'bg-bg-active text-text-primary font-medium': statusFilter() === 'all',
                'text-text-muted hover:text-text-primary': statusFilter() !== 'all',
              }}
            >
              {t().artifacts.filterAll}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('healthy')}
              aria-pressed={statusFilter() === 'healthy'}
              class="rounded px-2 py-0.5 transition-colors"
              classList={{
                'bg-bg-active text-status-success font-medium': statusFilter() === 'healthy',
                'text-text-muted hover:text-text-primary': statusFilter() !== 'healthy',
              }}
            >
              {t().artifacts.filterHealthy}
            </button>
            <Show when={degradedCount() > 0}>
              <button
                type="button"
                onClick={() => setStatusFilter('degraded')}
                aria-pressed={statusFilter() === 'degraded'}
                class="rounded px-2 py-0.5 transition-colors"
                classList={{
                  'bg-bg-active text-status-warning font-medium': statusFilter() === 'degraded',
                  'text-text-muted hover:text-text-primary': statusFilter() !== 'degraded',
                }}
              >
                {t().artifacts.filterDegraded} ({degradedCount()})
              </button>
            </Show>
          </div>
        </div>

        {/* Right: Search, Sort Switcher, Layout Switcher & Refresh */}
        <div class="flex flex-wrap items-center gap-2">
          {/* Sort Switcher */}
          <div class="flex items-center rounded border border-border-subtle bg-bg-input p-0.5 text-[10.5px]">
            <button
              type="button"
              onClick={() => setSortBy(ArtifactsSortBy.PORT)}
              aria-pressed={sortBy() === ArtifactsSortBy.PORT}
              class="rounded px-2 py-0.5 transition-colors"
              classList={{
                'bg-bg-active text-text-primary font-medium': sortBy() === ArtifactsSortBy.PORT,
                'text-text-muted hover:text-text-primary': sortBy() !== ArtifactsSortBy.PORT,
              }}
            >
              {t().artifacts.sortPort}
            </button>
            <button
              type="button"
              onClick={() => setSortBy(ArtifactsSortBy.LATENCY)}
              aria-pressed={sortBy() === ArtifactsSortBy.LATENCY}
              class="rounded px-2 py-0.5 transition-colors"
              classList={{
                'bg-bg-active text-text-primary font-medium': sortBy() === ArtifactsSortBy.LATENCY,
                'text-text-muted hover:text-text-primary': sortBy() !== ArtifactsSortBy.LATENCY,
              }}
            >
              {t().artifacts.sortLatency}
            </button>
            <button
              type="button"
              onClick={() => setSortBy(ArtifactsSortBy.FRAMEWORK)}
              aria-pressed={sortBy() === ArtifactsSortBy.FRAMEWORK}
              class="rounded px-2 py-0.5 transition-colors"
              classList={{
                'bg-bg-active text-text-primary font-medium':
                  sortBy() === ArtifactsSortBy.FRAMEWORK,
                'text-text-muted hover:text-text-primary': sortBy() !== ArtifactsSortBy.FRAMEWORK,
              }}
            >
              {t().artifacts.sortFramework}
            </button>
          </div>

          {/* Layout Mode Switcher */}
          <div
            class="flex items-center rounded border border-border-subtle bg-bg-input p-0.5"
            role="group"
            aria-label="Layout mode"
          >
            <button
              type="button"
              onClick={() => setLayoutMode(ArtifactsLayoutMode.GRID)}
              aria-label="Grid layout"
              aria-pressed={layoutMode() === ArtifactsLayoutMode.GRID}
              class="rounded p-1 transition-colors"
              classList={{
                'bg-bg-active text-accent': layoutMode() === ArtifactsLayoutMode.GRID,
                'text-text-muted hover:text-text-primary':
                  layoutMode() !== ArtifactsLayoutMode.GRID,
              }}
              title="Grid View"
            >
              <GridIcon class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode(ArtifactsLayoutMode.TABLE)}
              aria-label="Table layout"
              aria-pressed={layoutMode() === ArtifactsLayoutMode.TABLE}
              class="rounded p-1 transition-colors"
              classList={{
                'bg-bg-active text-accent': layoutMode() === ArtifactsLayoutMode.TABLE,
                'text-text-muted hover:text-text-primary':
                  layoutMode() !== ArtifactsLayoutMode.TABLE,
              }}
              title="Table View"
            >
              <ListIcon class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode(ArtifactsLayoutMode.COMPACT)}
              aria-label="Compact layout"
              aria-pressed={layoutMode() === ArtifactsLayoutMode.COMPACT}
              class="rounded p-1 transition-colors"
              classList={{
                'bg-bg-active text-accent': layoutMode() === ArtifactsLayoutMode.COMPACT,
                'text-text-muted hover:text-text-primary':
                  layoutMode() !== ArtifactsLayoutMode.COMPACT,
              }}
              title="Compact View"
            >
              <CompactIcon class="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Search Box */}
          <div class="relative min-w-[160px] sm:w-48">
            <input
              type="text"
              placeholder={t().artifacts.searchPlaceholder}
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="w-full rounded border border-border-subtle bg-bg-input px-2.5 py-1 text-xs text-text-primary placeholder:text-text-muted outline-hidden focus:border-accent"
            />
            <Show when={searchQuery()}>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text-primary"
                aria-label={t().artifacts.clearSearch}
              >
                ✕
              </button>
            </Show>
          </div>

          {/* Refresh Action */}
          <button
            type="button"
            onClick={() => fetchWebArtifactsApi()}
            disabled={isLoadingArtifacts()}
            class="flex items-center gap-1 rounded bg-bg-input border border-border-subtle px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50"
            title={t().artifacts.refreshBtn}
          >
            <RefreshIcon class="h-3.5 w-3.5" classList={{ 'animate-spin': isLoadingArtifacts() }} />
            <span class="hidden sm:inline">
              {isLoadingArtifacts() ? t().artifacts.scanning : t().artifacts.refreshBtn}
            </span>
          </button>
        </div>
      </section>

      {/* 3. Multi-Layout Artifacts Container */}
      <Switch>
        {/* ======================================================== */}
        {/* 1. GRID / CARD LAYOUT MODE                               */}
        {/* ======================================================== */}
        <Match when={layoutMode() === ArtifactsLayoutMode.GRID}>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <For
              each={filteredAndSortedArtifacts()}
              fallback={
                <div class="col-span-full rounded-2xl border border-dashed border-border-default bg-bg-surface/50 p-12 text-center">
                  <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-subtle text-2xl shadow-inner mb-4">
                    🌐
                  </div>
                  <h3 class="text-sm font-semibold text-text-primary mb-1">
                    {t().artifacts.empty}
                  </h3>
                  <p class="text-xs text-text-muted max-w-md mx-auto mb-4">
                    {t().artifacts.emptyGuide}
                  </p>
                  <button
                    type="button"
                    onClick={() => fetchWebArtifactsApi()}
                    class="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-subtle px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition-colors"
                  >
                    <RefreshIcon class="h-3 w-3" />
                    <span>{t().artifacts.refreshBtn}</span>
                  </button>
                </div>
              }
            >
              {(artifact: WebArtifactInfo) => (
                <div class="glass-card group relative flex flex-col justify-between p-4 transition-all duration-200 hover:border-border-hover hover:translate-y-[-1px]">
                  <div>
                    {/* Top Row: Port Badge + Status & Framework */}
                    <div class="flex items-center justify-between mb-2.5">
                      <div class="flex items-center gap-2">
                        <span class="rounded-md bg-accent/15 border border-accent/30 px-2 py-0.5 mono text-xs font-bold text-accent tabular-nums">
                          :{artifact.port}
                        </span>
                        <span class="rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.2 text-[10px] font-medium text-text-secondary">
                          {artifact.framework}
                        </span>
                      </div>

                      <div class="flex items-center gap-1.5">
                        <Show
                          when={artifact.is_healthy}
                          fallback={
                            <span class="rounded-full bg-status-warning/15 px-2 py-0.5 text-[10px] font-semibold text-status-warning flex items-center gap-1">
                              <span class="h-1.5 w-1.5 rounded-full bg-status-warning animate-pulse" />
                              <span>
                                {artifact.status_code ? `HTTP ${artifact.status_code}` : 'Down'}
                              </span>
                            </span>
                          }
                        >
                          <span class="rounded-full bg-status-success/15 px-2 py-0.5 text-[10px] font-semibold text-status-success flex items-center gap-1">
                            <span class="h-1.5 w-1.5 rounded-full bg-status-success" />
                            <span>
                              {artifact.status_code ? `HTTP ${artifact.status_code}` : '200 OK'}
                            </span>
                          </span>
                        </Show>
                      </div>
                    </div>

                    {/* Page Title */}
                    <div class="mb-3">
                      <h3
                        class="text-sm font-bold text-text-primary line-clamp-1 group-hover:text-accent transition-colors m-0"
                        title={
                          artifact.title || `${t().artifacts.localServiceTitle}${artifact.port}`
                        }
                      >
                        {artifact.title || `${t().artifacts.localServiceTitle}${artifact.port}`}
                      </h3>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(artifact.url, 'URL')}
                        class="mt-1 flex items-center gap-1 mono text-[10px] text-text-muted hover:text-accent truncate w-full text-left"
                        title={artifact.url}
                      >
                        <span>🔗 {artifact.url}</span>
                      </button>
                    </div>

                    {/* Metadata Details Grid */}
                    <div class="rounded-lg bg-bg-subtle/70 p-2.5 space-y-1.5 text-[11px] border border-border-subtle mb-4">
                      <div class="flex items-center justify-between">
                        <span class="text-text-muted">{t().artifacts.processPidLabel}</span>
                        <span class="mono font-medium text-text-primary truncate max-w-[150px] tabular-nums">
                          {artifact.process_name || 'unknown'}
                          {artifact.pid ? ` (${artifact.pid})` : ''}
                        </span>
                      </div>

                      <Show
                        when={
                          artifact.response_time_ms !== null &&
                          artifact.response_time_ms !== undefined
                        }
                      >
                        <div class="flex items-center justify-between">
                          <span class="text-text-muted">{t().artifacts.responseTime}:</span>
                          <span class="mono text-status-success font-medium tabular-nums">
                            ⚡ {artifact.response_time_ms} ms
                          </span>
                        </div>
                      </Show>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div class="flex items-center gap-2 pt-2 border-t border-border-subtle">
                    <button
                      type="button"
                      onClick={() => handleOpenBrowser(artifact.url)}
                      class="flex-1 rounded-lg bg-accent/15 border border-accent/30 py-1.5 text-center text-xs font-semibold text-accent hover:bg-accent hover:text-white transition-all shadow-2xs"
                    >
                      {t().artifacts.openBrowser} ↗
                    </button>

                    <button
                      type="button"
                      onClick={() => freeArtifactPortApi(artifact.port)}
                      class="rounded-lg border border-status-danger/30 bg-status-danger/10 px-2.5 py-1.5 text-xs font-medium text-status-danger hover:bg-status-danger/20 transition-colors"
                      title={`${t().artifacts.freePortTitle}${artifact.port}`}
                    >
                      {t().artifacts.freePort}
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Match>

        {/* ======================================================== */}
        {/* 2. TABLE / DETAILED LIST LAYOUT MODE                     */}
        {/* ======================================================== */}
        <Match when={layoutMode() === ArtifactsLayoutMode.TABLE}>
          <div class="max-h-[600px] overflow-y-auto rounded-md border border-border-subtle bg-bg-input">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="sticky top-0 z-10 border-b border-border-default bg-bg-subtle text-[10.5px] text-text-muted">
                  <th scope="col" class="py-2 px-3 font-medium w-36">
                    {t().artifacts.thPort}
                  </th>
                  <th scope="col" class="py-2 px-3 font-medium">
                    {t().artifacts.thTitle}
                  </th>
                  <th scope="col" class="py-2 px-3 font-medium w-36">
                    {t().artifacts.thStatus}
                  </th>
                  <th scope="col" class="py-2 px-3 font-medium w-40">
                    {t().artifacts.thProcess}
                  </th>
                  <th scope="col" class="py-2 px-3 font-medium w-48 text-right">
                    {t().artifacts.thActions}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle text-[11px]">
                <For
                  each={filteredAndSortedArtifacts()}
                  fallback={
                    <tr>
                      <td colspan="5" class="py-12 text-center text-xs text-text-muted font-mono">
                        {t().artifacts.empty}
                      </td>
                    </tr>
                  }
                >
                  {(artifact) => (
                    <tr class="hover:bg-bg-hover transition-colors">
                      {/* Port & Framework */}
                      <td class="py-2.5 px-3">
                        <div class="flex items-center gap-2">
                          <span class="rounded bg-accent/15 border border-accent/30 px-1.5 py-0.2 mono text-xs font-bold text-accent tabular-nums">
                            :{artifact.port}
                          </span>
                          <span class="rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.2 text-[9.5px] font-medium text-text-secondary">
                            {artifact.framework}
                          </span>
                        </div>
                      </td>

                      {/* Title & URL */}
                      <td class="py-2.5 px-3">
                        <div class="flex flex-col">
                          <span
                            class="font-bold text-text-primary line-clamp-1"
                            title={
                              artifact.title || `${t().artifacts.localServiceTitle}${artifact.port}`
                            }
                          >
                            {artifact.title || `${t().artifacts.localServiceTitle}${artifact.port}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(artifact.url, 'URL')}
                            class="mono text-[10px] text-text-muted hover:text-accent truncate text-left mt-0.5 flex items-center gap-1"
                            title={artifact.url}
                          >
                            <span>🔗 {artifact.url}</span>
                          </button>
                        </div>
                      </td>

                      {/* Status & Latency */}
                      <td class="py-2.5 px-3 font-mono text-[10px]">
                        <div class="flex items-center gap-2">
                          <span
                            class="rounded px-1.5 py-0.2 font-semibold text-[9.5px]"
                            classList={{
                              'bg-status-success/15 text-status-success': artifact.is_healthy,
                              'bg-status-warning/15 text-status-warning': !artifact.is_healthy,
                            }}
                          >
                            {artifact.status_code ? `HTTP ${artifact.status_code}` : 'Down'}
                          </span>
                          <Show when={typeof artifact.response_time_ms === 'number'}>
                            <span class="text-status-success tabular-nums">
                              ⚡ {artifact.response_time_ms}ms
                            </span>
                          </Show>
                        </div>
                      </td>

                      {/* Process & PID */}
                      <td class="py-2.5 px-3 font-mono text-[10px] text-text-secondary">
                        <div
                          class="truncate max-w-[150px] tabular-nums"
                          title={`${artifact.process_name || 'unknown'} (PID: ${artifact.pid || '-'})`}
                        >
                          {artifact.process_name || 'unknown'}
                          {artifact.pid ? ` (${artifact.pid})` : ''}
                        </div>
                      </td>

                      {/* Actions */}
                      <td class="py-2.5 px-3 text-right">
                        <div class="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenBrowser(artifact.url)}
                            class="rounded bg-accent/15 border border-accent/30 px-2 py-1 text-xs font-semibold text-accent hover:bg-accent hover:text-white transition-all shadow-2xs"
                          >
                            {t().artifacts.openBrowser} ↗
                          </button>
                          <button
                            type="button"
                            onClick={() => freeArtifactPortApi(artifact.port)}
                            class="rounded border border-status-danger/30 bg-status-danger/10 px-2 py-1 text-xs font-medium text-status-danger hover:bg-status-danger/20 transition-colors"
                            title={`${t().artifacts.freePortTitle}${artifact.port}`}
                          >
                            {t().artifacts.freePort}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Match>

        {/* ======================================================== */}
        {/* 3. COMPACT LIST LAYOUT MODE                              */}
        {/* ======================================================== */}
        <Match when={layoutMode() === ArtifactsLayoutMode.COMPACT}>
          <div class="flex flex-col divide-y divide-border-subtle rounded-md border border-border-subtle bg-bg-input">
            <For
              each={filteredAndSortedArtifacts()}
              fallback={
                <div class="py-12 text-center text-xs text-text-muted font-mono">
                  {t().artifacts.empty}
                </div>
              }
            >
              {(artifact) => (
                <div class="flex items-center justify-between px-3 py-2 hover:bg-bg-hover transition-colors gap-3">
                  {/* Left: Status Dot + Port + Framework + Title */}
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span
                      class="h-2 w-2 rounded-full shrink-0"
                      classList={{
                        'bg-status-success': artifact.is_healthy,
                        'bg-status-warning animate-pulse': !artifact.is_healthy,
                      }}
                      title={artifact.is_healthy ? '200 OK' : 'Degraded'}
                    />

                    <span class="rounded bg-accent/15 border border-accent/30 px-1.5 py-0.2 mono text-xs font-bold text-accent shrink-0 tabular-nums">
                      :{artifact.port}
                    </span>

                    <span class="rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.2 text-[9.5px] font-medium text-text-secondary shrink-0">
                      {artifact.framework}
                    </span>

                    <span
                      class="font-bold text-xs text-text-primary truncate"
                      title={artifact.title || artifact.url}
                    >
                      {artifact.title || `${t().artifacts.localServiceTitle}${artifact.port}`}
                    </span>

                    <Show when={typeof artifact.response_time_ms === 'number'}>
                      <span class="mono text-[9.5px] text-status-success shrink-0 hidden sm:inline tabular-nums">
                        ⚡ {artifact.response_time_ms}ms
                      </span>
                    </Show>
                  </div>

                  {/* Right: Process & Action Buttons */}
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="mono text-[10px] text-text-muted hidden md:inline truncate max-w-[120px] tabular-nums">
                      {artifact.process_name || 'unknown'}
                      {artifact.pid ? ` (${artifact.pid})` : ''}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleOpenBrowser(artifact.url)}
                      class="rounded bg-accent/15 border border-accent/30 px-2 py-0.8 text-xs font-semibold text-accent hover:bg-accent hover:text-white transition-all shadow-2xs"
                    >
                      {t().artifacts.openBrowser} ↗
                    </button>

                    <button
                      type="button"
                      onClick={() => freeArtifactPortApi(artifact.port)}
                      class="rounded border border-status-danger/30 bg-status-danger/10 px-2 py-0.8 text-xs font-medium text-status-danger hover:bg-status-danger/20 transition-colors"
                      title={`${t().artifacts.freePortTitle}${artifact.port}`}
                    >
                      {t().artifacts.freePort}
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Match>
      </Switch>
    </div>
  );
};
