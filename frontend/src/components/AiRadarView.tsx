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
    <div class="space-y-8">
      {/* Header */}
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div class="flex items-center gap-2">
            <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent text-base">
              📡
            </span>
            <h1 class="text-base font-bold text-text-primary m-0">
              {t().aiRadar.title}
            </h1>
          </div>
          <p class="text-xs text-text-muted mt-1 m-0">
            {t().aiRadar.subtitle}
          </p>
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
            class="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white shadow-xs hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
          >
            <RefreshIcon class="h-3.5 w-3.5" classList={{ 'animate-spin': isTestingLlmLatency() }} />
            <span>{isTestingLlmLatency() ? t().aiRadar.testing : t().aiRadar.testLatencyBtn}</span>
          </button>
        </div>
      </div>

      {/* Section 1: Global LLM API Latency Diagnostic Grid */}
      <div>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-xs font-bold uppercase tracking-wider text-text-muted m-0 flex items-center gap-2">
            <span>{t().aiRadar.latencySection}</span>
            <span class="rounded bg-bg-subtle px-1.5 py-0.2 text-[10px] text-text-muted mono">
              {llmLatencies().length} 探针
            </span>
          </h2>
        </div>

        <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <For
            each={llmLatencies()}
            fallback={
              <div class="col-span-full py-12 text-center text-xs text-text-muted font-mono animate-pulse">
                正在向全球 AI API 节点发起网络连通性探测...
              </div>
            }
          >
            {(item: LlmApiLatency) => (
              <div
                class="flex flex-col justify-between rounded-xl border bg-bg-surface p-4 shadow-xs transition-all hover:border-border-hover"
                classList={{
                  'border-border-default': item.is_reachable,
                  'border-status-danger/40 bg-status-danger/5': !item.is_reachable,
                }}
              >
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <span class="text-xl">{getProviderIcon(item.provider_id)}</span>
                      <div>
                        <h3 class="text-xs font-bold text-text-primary m-0 truncate" title={item.name}>
                          {item.name}
                        </h3>
                        <span class="text-[10px] text-text-muted mono truncate block max-w-[140px]">
                          {item.provider_id}
                        </span>
                      </div>
                    </div>

                    {/* Latency / Reachability Badge */}
                    <span
                      class="rounded-full border px-2 py-0.5 text-[10.5px] font-bold mono"
                      classList={{
                        [getLatencyBadgeClass(item)]: true,
                      }}
                    >
                      {item.is_reachable ? `⚡ ${item.latency_ms} ms` : '✕ 无法直连'}
                    </span>
                  </div>

                  {/* Endpoint & Status Detail */}
                  <div class="rounded-lg bg-bg-subtle/70 p-2 text-[10.5px] border border-border-subtle mt-2 space-y-1">
                    <div class="flex items-center justify-between text-text-muted mono truncate">
                      <span>路由状态:</span>
                      <span class="font-medium" classList={{ 'text-status-success': item.is_reachable, 'text-status-danger': !item.is_reachable }}>
                        {item.is_reachable ? (item.status_code ? `HTTP ${item.status_code}` : '200 OK') : '离线 / 超时'}
                      </span>
                    </div>

                    <Show when={item.error_message}>
                      <div class="text-[10px] text-status-danger leading-tight truncate" title={item.error_message || ''}>
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
      <div class="rounded-2xl border border-border-default bg-bg-surface p-5 shadow-xs">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border-subtle pb-4 mb-4">
          <div class="flex items-center gap-2.5">
            <span class="text-2xl">🦙</span>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-sm font-bold text-text-primary m-0">
                  {t().aiRadar.ollamaSection}
                </h2>
                <Show
                  when={ollamaStatus()?.is_running}
                  fallback={
                    <span class="rounded bg-status-warning/15 px-2 py-0.5 text-[10px] font-semibold text-status-warning">
                      未启动
                    </span>
                  }
                >
                  <span class="rounded bg-status-success/15 px-2 py-0.5 text-[10px] font-semibold text-status-success flex items-center gap-1">
                    <span class="h-1.5 w-1.5 rounded-full bg-status-success animate-pulse" />
                    <span>运行中 {ollamaStatus()?.version ? `(v${ollamaStatus()?.version})` : ''}</span>
                  </span>
                </Show>
              </div>
              <p class="text-xs text-text-muted m-0 mt-0.5">
                监控本地大模型对 Apple Silicon 统一内存 / GPU 显存的占用，支持一键卸载释放。
              </p>
            </div>
          </div>

          <Show when={ollamaStatus()?.is_running}>
            <div class="flex items-center gap-3">
              <div class="rounded-lg bg-bg-subtle border border-border-subtle px-3 py-1.5 text-right">
                <span class="text-[10.5px] text-text-muted block">{t().aiRadar.vramUsage}</span>
                <span class="text-sm font-bold text-accent mono">
                  {formatTotalBytes(ollamaStatus()?.total_vram_used_bytes || 0)}
                </span>
              </div>
            </div>
          </Show>
        </div>

        {/* Content Area */}
        <Show
          when={ollamaStatus()?.is_running}
          fallback={
            <div class="py-8 text-center text-xs text-text-muted">
              <p class="mb-2">⚠️ {t().aiRadar.ollamaNotRunning}</p>
              <p class="text-[11px] mono text-text-muted">在终端运行 <code class="rounded bg-bg-subtle px-1.5 py-0.5 text-text-primary">ollama serve</code> 即可唤醒本地大模型引擎。</p>
            </div>
          }
        >
          {/* Loaded Models List */}
          <div>
            <h3 class="text-xs font-semibold text-text-secondary mb-3 flex items-center gap-1.5">
              <span>{t().aiRadar.loadedModels}</span>
              <span class="rounded bg-bg-subtle px-1.5 py-0.2 mono text-[10px] text-text-muted">
                {ollamaStatus()?.loaded_models.length || 0}
              </span>
            </h3>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <For
                each={ollamaStatus()?.loaded_models || []}
                fallback={
                  <div class="col-span-full rounded-xl border border-dashed border-border-subtle p-6 text-center text-xs text-text-muted">
                    当前显存中没有活跃运行的大模型，显存已处于空载节能状态。
                  </div>
                }
              >
                {(model: OllamaModelInfo) => (
                  <div class="flex flex-col justify-between rounded-xl border border-accent/30 bg-accent/5 p-4 shadow-2xs">
                    <div>
                      <div class="flex items-start justify-between mb-2">
                        <div class="truncate">
                          <h4 class="text-xs font-bold text-text-primary truncate m-0" title={model.name}>
                            {model.name}
                          </h4>
                          <span class="text-[10px] text-text-muted mono">
                            {model.family} · {model.parameter_size}
                          </span>
                        </div>
                        <span class="rounded bg-accent/20 px-1.5 py-0.2 text-[10px] font-bold text-accent mono shrink-0">
                          {formatTotalBytes(model.vram_bytes)}
                        </span>
                      </div>

                      <div class="rounded-lg bg-bg-surface/80 p-2 text-[10.5px] border border-border-subtle space-y-1 mb-3">
                        <div class="flex items-center justify-between text-text-muted">
                          <span>{t().aiRadar.quantization}:</span>
                          <span class="mono font-medium text-text-primary">{model.quantization_level}</span>
                        </div>
                        <div class="flex items-center justify-between text-text-muted">
                          <span>{t().aiRadar.format}:</span>
                          <span class="mono font-medium text-text-primary">{model.format}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => unloadOllamaModelApi(model.name)}
                      disabled={isUnloadingOllama()}
                      class="w-full rounded-lg bg-status-danger/15 border border-status-danger/30 py-1.5 text-xs font-semibold text-status-danger hover:bg-status-danger hover:text-white transition-all active:scale-95 disabled:opacity-50"
                      title="从显存中卸载此模型以释放 Unified Memory"
                    >
                      {isUnloadingOllama() ? t().aiRadar.unloading : `💥 ${t().aiRadar.unloadBtn}`}
                    </button>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};
export default AiRadarView;
