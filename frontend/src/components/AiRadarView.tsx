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
import {
  AlertWarningIcon,
  AntennaIcon,
  BoltIcon,
  BrainIcon,
  FlameIcon,
  LayersIntersectIcon,
  RefreshIcon,
  RobotIcon,
  SparklesIcon,
} from './Icons';
import { t } from '../i18n';
import type { LlmApiLatency, OllamaModelInfo } from '../types';

export const AiRadarView: Component = () => {
  onMount(() => {
    fetchLlmLatencyApi();
    fetchOllamaStatusApi();
  });

  const renderProviderIcon = (id: string) => {
    switch (id) {
      case 'deepseek':
        return <LayersIntersectIcon class="h-4 w-4 text-sky-400" />;
      case 'claude':
        return <SparklesIcon class="h-4 w-4 text-amber-400" />;
      case 'openai':
        return <BrainIcon class="h-4 w-4 text-emerald-400" />;
      case 'gemini':
        return <SparklesIcon class="h-4 w-4 text-indigo-400" />;
      case 'openrouter':
        return <FlameIcon class="h-4 w-4 text-rose-400" />;
      case 'siliconflow':
        return <BoltIcon class="h-4 w-4 text-accent" />;
      case 'ollama':
        return <RobotIcon class="h-4 w-4 text-teal-400" />;
      default:
        return <RobotIcon class="h-4 w-4 text-text-muted" />;
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
            <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent border border-accent/20">
              <AntennaIcon class="h-4.5 w-4.5" />
            </span>
            <h1 class="text-base font-bold text-text-primary m-0 tracking-tight">
              {t().aiRadar.title}
            </h1>
          </div>
          <p class="text-xs text-text-muted mt-1 leading-relaxed">{t().aiRadar.subtitle}</p>
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              fetchLlmLatencyApi();
              fetchOllamaStatusApi();
            }}
            disabled={isTestingLlmLatency()}
            aria-busy={isTestingLlmLatency()}
            class="flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-surface px-3 py-1.8 text-xs font-semibold text-text-primary transition-all hover:bg-bg-hover hover:border-border-hover disabled:opacity-50"
          >
            <RefreshIcon class={`h-3.5 w-3.5 ${isTestingLlmLatency() ? 'animate-spin' : ''}`} />
            <span>{isTestingLlmLatency() ? t().aiRadar.testing : t().aiRadar.testLatencyBtn}</span>
          </button>
        </div>
      </div>

      {/* Section 1: Global LLM API Latency Matrix */}
      <div class="glass-card p-5">
        <div class="flex items-center justify-between border-b border-border-subtle pb-3 mb-4">
          <div>
            <h2 class="text-sm font-bold text-text-primary m-0">{t().aiRadar.latencySection}</h2>
            <p class="text-xs text-text-muted mt-0.5">{t().aiRadar.probingGlobal}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="rounded bg-bg-subtle border border-border-subtle px-2 py-0.5 mono text-[10px] text-text-muted">
              {t().aiRadar.probesCount.replace('{count}', llmLatencies().length.toString())}
            </span>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <For
            each={llmLatencies()}
            fallback={
              <div class="col-span-full py-10 text-center text-xs text-text-muted mono">
                {t().common.loading}
              </div>
            }
          >
            {(item) => (
              <div class="glass-card-subtle flex flex-col justify-between p-3.5 transition-all hover:border-border-hover">
                <div>
                  {/* Provider Top Header */}
                  <div class="flex items-center justify-between pb-2 border-b border-border-subtle/60">
                    <div class="flex items-center gap-2">
                      <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-bg-surface border border-border-subtle">
                        {renderProviderIcon(item.provider_id)}
                      </div>
                      <div>
                        <div class="font-bold text-xs text-text-primary">{item.name}</div>
                        <div class="mono text-[9.5px] text-text-muted truncate max-w-[120px]">
                          {item.provider_id}
                        </div>
                      </div>
                    </div>

                    {/* Latency Pill Badge */}
                    <span
                      class="rounded-full border px-2 py-0.5 text-[10px] font-bold mono tabular-nums flex items-center gap-1"
                      classList={{
                        [getLatencyBadgeClass(item)]: true,
                      }}
                    >
                      <Show
                        when={item.is_reachable}
                        fallback={<span>✕ {t().aiRadar.unreachable}</span>}
                      >
                        <BoltIcon class="h-3 w-3" />
                        <span>{item.latency_ms} ms</span>
                      </Show>
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
                        class="text-[10px] text-status-danger leading-tight truncate flex items-center gap-1"
                        title={item.error_message || ''}
                      >
                        <AlertWarningIcon class="h-3 w-3 shrink-0" />
                        <span class="truncate">{item.error_message}</span>
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
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 border border-accent/25 text-accent">
              <RobotIcon class="h-4.5 w-4.5" />
            </div>
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
              <p class="text-xs text-text-muted mt-0.5">{t().aiRadar.ollamaDesc}</p>
            </div>
          </div>
        </div>

        {/* Ollama Loaded Models Sub-Grid */}
        <Show
          when={ollamaStatus()?.is_running}
          fallback={
            <div class="py-10 text-center text-xs text-text-muted">
              <p class="font-medium text-text-secondary">{t().aiRadar.ollamaNotRunning}</p>
            </div>
          }
        >
          <div class="space-y-4">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-text-secondary">{t().aiRadar.loadedModels}</span>
              <span class="mono text-text-muted text-[11px]">
                {t().aiRadar.totalVramUsage}:{' '}
                <strong class="text-text-primary">
                  {formatTotalBytes(ollamaStatus()?.total_vram_used_bytes || 0)}
                </strong>
              </span>
            </div>

            <For
              each={ollamaStatus()?.loaded_models || []}
              fallback={
                <div class="rounded-lg border border-dashed border-border-default bg-bg-surface/50 p-6 text-center text-xs text-text-muted">
                  {t().aiRadar.ollamaEmptyLoaded}
                </div>
              }
            >
              {(model: OllamaModelInfo) => (
                <div class="glass-card-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-xs text-text-primary">{model.name}</span>
                      <span class="rounded bg-accent/15 border border-accent/30 px-1.8 py-0.2 mono text-[10px] text-accent font-bold">
                        {model.parameter_size || 'Unknown'}
                      </span>
                      <span class="rounded bg-bg-subtle border border-border-subtle px-1.8 py-0.2 mono text-[10px] text-text-muted">
                        {model.quantization_level || 'Q4'}
                      </span>
                    </div>

                    <div class="mt-1.5 flex flex-wrap items-center gap-3 text-[10.5px] text-text-muted mono">
                      <span>
                        {t().aiRadar.vramUsage}:{' '}
                        <strong class="text-status-success">
                          {formatTotalBytes(model.vram_bytes)}
                        </strong>
                      </span>
                      <span>
                        {t().aiRadar.vramUsageLabel} {formatTotalBytes(model.size_bytes)}
                      </span>
                      <Show when={model.expires_at}>
                        <span class="text-text-tertiary">
                          {t().aiRadar.expiresAt}: {model.expires_at?.split('T')[1]?.split('.')[0]}
                        </span>
                      </Show>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => unloadOllamaModelApi(model.name)}
                    disabled={isUnloadingOllama()}
                    class="rounded-lg bg-status-danger/15 border border-status-danger/30 px-3 py-1 text-xs font-semibold text-status-danger hover:bg-status-danger hover:text-white transition-all shadow-2xs self-start sm:self-auto disabled:opacity-50"
                  >
                    {isUnloadingOllama() ? t().aiRadar.unloading : t().aiRadar.unloadBtn}
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
};
