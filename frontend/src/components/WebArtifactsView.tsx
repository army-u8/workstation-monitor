import { For, Show, createSignal, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import {
  copyToClipboard,
  fetchWebArtifactsApi,
  freeArtifactPortApi,
  isLoadingArtifacts,
  webArtifacts,
} from '../services/store';
import { RefreshIcon } from './Icons';
import { t } from '../i18n';
import type { WebArtifactInfo } from '../types';

export const WebArtifactsView: Component = () => {
  const [filterQuery, setFilterQuery] = createSignal('');

  onMount(() => {
    fetchWebArtifactsApi();
  });

  const filteredArtifacts = () => {
    const list = webArtifacts();
    const q = filterQuery().trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (a) =>
        a.port.toString().includes(q) ||
        (a.title && a.title.toLowerCase().includes(q)) ||
        a.framework.toLowerCase().includes(q) ||
        (a.process_name && a.process_name.toLowerCase().includes(q)),
    );
  };

  const healthyCount = () => webArtifacts().filter((a) => a.is_healthy).length;

  const handleOpenBrowser = (url: string) => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div class="space-y-6">
      {/* Header & Metric Summary */}
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div class="flex items-center gap-2.5">
            <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent text-base border border-accent/20">
              🖼️
            </span>
            <h1 class="text-base font-bold text-text-primary m-0 tracking-tight">
              {t().artifacts.title}
            </h1>
          </div>
          <p class="text-xs text-text-muted mt-1 m-0">{t().artifacts.subtitle}</p>
        </div>

        {/* Quick Actions & KPIs */}
        <div class="flex items-center gap-3">
          <div class="glass-card flex items-center gap-2.5 px-3 py-1.5 text-xs">
            <div class="flex items-center gap-1.5">
              <span class="text-text-muted">{t().artifacts.runningPorts}:</span>
              <span class="font-bold text-text-primary mono tabular-nums">
                {webArtifacts().length}
              </span>
            </div>
            <span class="text-border-default/80">|</span>
            <div class="flex items-center gap-1.5">
              <span class="text-text-muted">{t().artifacts.healthyServices}:</span>
              <span class="font-bold text-status-success mono tabular-nums">{healthyCount()}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchWebArtifactsApi()}
            disabled={isLoadingArtifacts()}
            class="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.8 text-xs font-semibold text-white shadow-sm hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
          >
            <RefreshIcon class="h-3.5 w-3.5" classList={{ 'animate-spin': isLoadingArtifacts() }} />
            <span>{isLoadingArtifacts() ? t().artifacts.scanning : t().artifacts.refreshBtn}</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div class="flex items-center gap-2">
        <input
          type="text"
          placeholder="检索端口 (如 3000, 5173)、页面标题或技术框架 (Next.js, Vite)..."
          value={filterQuery()}
          onInput={(e) => setFilterQuery(e.currentTarget.value)}
          class="w-full max-w-md rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-primary placeholder:text-text-muted outline-hidden focus:border-accent focus-visible:ring-1 focus-visible:ring-accent transition-colors"
        />
        <Show when={filterQuery()}>
          <button
            type="button"
            onClick={() => setFilterQuery('')}
            class="text-xs text-text-muted hover:text-text-primary px-2 py-1"
          >
            清除
          </button>
        </Show>
      </div>

      {/* Gallery Grid */}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <For
          each={filteredArtifacts()}
          fallback={
            <div class="col-span-full rounded-2xl border border-dashed border-border-default bg-bg-surface/50 p-12 text-center">
              <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-subtle text-2xl shadow-inner mb-4">
                🌐
              </div>
              <h3 class="text-sm font-semibold text-text-primary mb-1">{t().artifacts.empty}</h3>
              <p class="text-xs text-text-muted max-w-md mx-auto mb-4">
                支持自动探测 Next.js、Vite、React、Vue3、Nuxt、Astro、FastAPI、Flask 以及本地 Ollama
                等常见端口服务。
              </p>
              <button
                type="button"
                onClick={() => fetchWebArtifactsApi()}
                class="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-subtle px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition-colors"
              >
                <RefreshIcon class="h-3 w-3" />
                <span>重新扫描</span>
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
                    title={artifact.title || `Local Service :${artifact.port}`}
                  >
                    {artifact.title || `本地服务 :${artifact.port}`}
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
                    <span class="text-text-muted">进程 / PID:</span>
                    <span class="mono font-medium text-text-primary truncate max-w-[150px] tabular-nums">
                      {artifact.process_name || 'unknown'}
                      {artifact.pid ? ` (${artifact.pid})` : ''}
                    </span>
                  </div>

                  <Show
                    when={
                      artifact.response_time_ms !== null && artifact.response_time_ms !== undefined
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
                  title={`释放端口 :${artifact.port}`}
                >
                  {t().artifacts.freePort}
                </button>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
