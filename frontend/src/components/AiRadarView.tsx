import { For, Show, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import {
  fetchLlmLatencyApi,
  fetchOllamaStatusApi,
  formatTotalBytes,
  isTestingLlmLatency,
  isUnloadingOllama,
  llmLatencies,
  ollamaStatus,
  unloadOllamaModelApi,
} from '../services/store';
import { RefreshIcon } from './Icons';
import { t } from '../i18n';
import type { LlmApiLatency, OllamaModelInfo } from '../types';

export const AiRadarView: Component = () => {
  onMount(() => {
    fetchLlmLatencyApi();
    fetchOllamaStatusApi();
  });

  const getProviderIcon = (id: string) => {
    switch (id) {
      case 'deepseek':
        return '🐋';
      case 'claude':
        return '🎭';
      case 'openai':
        return '🧠';
      case 'gemini':
        return '✨';
      case 'openrouter':
        return '🔀';
      case 'siliconflow':
        return '⚡';
      case 'ollama':
        return '🦙';
      default:
        return '🤖';
    }
  };

  const getLatencyBadgeClass = (lat: LlmApiLatency) => {
    if (!lat.is_reachable) {
      return 'bg-status-danger/15 text-status-danger border-status-danger/30';
    }
    const ms = lat.latency_ms || 0;
    if (ms < 300) {
      return 'bg-status-success/15 text-status-success border-status-success/30';
    }
    if (ms < 800) {
      return 'bg-status-warning/15 text-status-warning border-status-warning/30';
    }
    return 'bg-status-warning/20 text-status-warning border-status-warning/40';
  };

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div class="flex items-center gap-2.5">
            <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent text-base border border-accent/20">
              📡
            </span>
            <h1 class="text-base font-bold text-text-primary m-0 tracking-tight">
              {t().aiRadar.title}
            </h1>
          </div>
          <p class="text-xs text-text-muted mt-1 m-0">{t().aiRadar.subtitle}</p>
        </div>

        {/* Action Controls */}
        <div class="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              fetchLlmLatencyApi();
              fetchOllamaStatusApi();
            }}
            disabled={isTestingLlmLatency()}
            class="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.8 text-xs font-semibold text-white shadow-sm hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
          >
            <RefreshIcon
              class="h-3.5 w-3.5"
              classList={{ 'animate-spin': isTestingLlmLatency() }}
            />
            <span>{isTestingLlmLatency() ? t().aiRadar.testing : t().aiRadar.testLatencyBtn}</span>
          </button>
        </div>
      </div>

      {/* Section 1: Global LLM API Latency Diagnostic Grid */}
      <div>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-xs font-bold uppercase tracking-wider text-text-muted m-0 flex items-center gap-2">
            <span>{t().aiRadar.latencySection}</span>
            <span class="rounded bg-bg-subtle/80 px-1.5 py-0.2 text-[10px] text-text-muted mono border border-border-subtle">
              {t().aiRadar.probesCount.replace('{count}', llmLatencies().length.toString())}
            </span>
          </h2>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <For
            each={llmLatencies()}
            fallback={
              <div class="col-span-full py-12 text-center text-xs text-text-muted font-mono animate-pulse">
                {t().aiRadar.probingGlobal}
              </div>
            }
          >
            {(item: LlmApiLatency) => (
              <div
                class="glass-card flex flex-col justify-between p-3.5 transition-all duration-200 hover:border-border-hover hover:translate-y-[-1px]"
                classList={{
                  'border-status-danger/40 bg-status-danger/5': !item.is_reachable,
                }}
              >
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <span class="text-xl">{getProviderIcon(item.provider_id)}</span>
                      <div>
                        <h3
                          class="text-xs font-bold text-text-primary m-0 truncate"
                          title={item.name}
                        >
                          {item.name}
                        </h3>
                        <span class="text-[10px] text-text-muted mono truncate block max-w-[130px]">
                          {item.provider_id}
                        </span>
                      </div>
                    </div>

                    {/* Latency / Reachability Badge */}
                    <span
                      class="rounded-full border px-2 py-0.5 text-[10px] font-bold mono tabular-nums"
                      classList={{
                        [getLatencyBadgeClass(item)]: true,
                      }}
                    >
                      {item.is_reachable
                        ? `⚡ ${item.latency_ms} ms`
                        : `✕ ${t().aiRadar.unreachable}`}
                    </span>
                  </div>

                  {/* Endpoint & Status Detail */}
                  <div class="rounded-lg bg-bg-subtle/70 p-2 text-[10.5px] border border-border-subtle mt-2 space-y-1">
                    <div class="flex items-center justify-between text-text-muted mono truncate">
                      <span>{t().aiRadar.routeStatus}</span>
                      <span
                        class="font-medium"
                        classList={{
                          'text-status-success': item.is_reachable,
                          'text-status-danger': !item.is_reachable,
                        }}
                      >
                        {item.is_reachable
                          ? item.status_code
                            ? `HTTP ${item.status_code}`
                            : '200 OK'
                          : t().aiRadar.offlineTimeout}
                      </span>
                    </div>

                    <Show when={item.error_message}>
                      <div
                        class="text-[10px] text-status-danger leading-tight truncate"
                        title={item.error_message || ''}
                      >
                        ⚠️ {item.error_message}
                      </div>
                    </Show>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Section 2: Local Ollama Model & Memory Controller */}
      <div class="glass-card p-5">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border-subtle pb-4 mb-4">
          <div class="flex items-center gap-2.5">
            <span class="text-2xl">🦙</span>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-sm font-bold text-text-primary m-0">{t().aiRadar.ollamaSection}</h2>
                <Show
                  when={ollamaStatus()?.is_running}
                  fallback={
                    <span class="rounded bg-status-warning/15 px-2 py-0.5 text-[10px] font-semibold text-status-warning">
                      {t().aiRadar.ollamaOffline}
                    </span>
                  }
                >
                  <span class="rounded bg-status-success/15 px-2 py-0.5 text-[10px] font-semibold text-status-success flex items-center gap-1">
                    <span class="h-1.5 w-1.5 rounded-full bg-status-success animate-pulse" />
                    <span>
                      {t().aiRadar.ollamaRunning}{' '}
                      {ollamaStatus()?.version ? `(v${ollamaStatus()?.version})` : ''}
                    </span>
                  </span>
                </Show>
              </div>
              <p class="text-xs text-text-muted m-0 mt-0.5">{t().aiRadar.ollamaDesc}</p>
            </div>
          </div>

          <Show when={ollamaStatus()?.is_running}>
            <div class="flex items-center gap-3">
              <div class="rounded-lg bg-bg-subtle border border-border-subtle px-3 py-1.5 text-right">
                <div class="text-[10px] text-text-muted">{t().aiRadar.totalVramUsage}</div>
                <div class="mono text-xs font-bold text-accent tabular-nums">
                  {formatTotalBytes(ollamaStatus()?.total_vram_used_bytes || 0)}
                </div>
              </div>
            </div>
          </Show>
        </div>

        {/* Model Cards */}
        <Show
          when={ollamaStatus()?.is_running}
          fallback={
            <div class="py-8 text-center text-xs text-text-muted">
              {t().aiRadar.ollamaNotRunning}
            </div>
          }
        >
          <Show
            when={(ollamaStatus()?.loaded_models?.length || 0) > 0}
            fallback={
              <div class="py-8 text-center text-xs text-text-muted">
                {t().aiRadar.ollamaEmptyLoaded}
              </div>
            }
          >
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <For each={ollamaStatus()?.loaded_models}>
                {(model: OllamaModelInfo) => (
                  <div class="glass-card-subtle p-3.5 flex flex-col justify-between">
                    <div>
                      <div class="flex items-center justify-between mb-2">
                        <span
                          class="font-mono text-xs font-bold text-text-primary truncate"
                          title={model.name}
                        >
                          {model.name}
                        </span>
                        <span class="rounded bg-accent/15 px-1.5 py-0.2 text-[10px] font-mono text-accent">
                          {model.parameter_size || 'LLM'}
                        </span>
                      </div>

                      <div class="space-y-1 text-[11px] text-text-muted font-mono mb-3">
                        <div class="flex justify-between">
                          <span>{t().aiRadar.quantizationLabel}</span>
                          <span class="text-text-secondary">
                            {model.quantization_level || 'Native'}
                          </span>
                        </div>
                        <div class="flex justify-between">
                          <span>{t().aiRadar.vramUsageLabel}</span>
                          <span class="text-text-secondary font-bold text-accent tabular-nums">
                            {formatTotalBytes(model.vram_bytes || model.size_bytes)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => unloadOllamaModelApi(model.name)}
                      disabled={isUnloadingOllama()}
                      class="w-full rounded-md border border-status-danger/30 bg-status-danger/10 py-1.5 text-center text-xs font-medium text-status-danger hover:bg-status-danger/20 transition-colors"
                    >
                      {t().aiRadar.unloadBtn}
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
};
