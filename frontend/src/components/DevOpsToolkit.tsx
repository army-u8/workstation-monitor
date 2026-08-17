import { For, Show, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import {
  copyToClipboard,
  devTools,
  flushDnsApi,
  killPortApi,
  openConfirmDialog,
  pingHostApi,
} from '../services/store';
import { DEFAULT_PROBE_HOST } from '../constants';
import type { PingResponse } from '../types';
import { t } from '../i18n';

export const DevOpsToolkit: Component = () => {
  // Free Port State
  const [portInput, setPortInput] = createSignal('');
  const [isFreeingPort, setIsFreeingPort] = createSignal(false);

  // Flush DNS State
  const [isFlushingDns, setIsFlushingDns] = createSignal(false);

  // Ping Diagnostic State
  const [pingHost, setPingHost] = createSignal(DEFAULT_PROBE_HOST);
  const [isPinging, setIsPinging] = createSignal(false);
  const [pingResult, setPingResult] = createSignal<PingResponse | null>(null);

  const handleFreePort = (e: Event) => {
    e.preventDefault();
    const p = parseInt(portInput(), 10);
    if (!p || isNaN(p) || p <= 0 || p > 65535) return;

    openConfirmDialog({
      title: t().confirmDialog.killPortTitle,
      message: t().confirmDialog.killPortWarning
        .replace('{name}', 'Process')
        .replace('{pid}', '-')
        .replace('{port}', p.toString()),
      confirmText: t().confirmDialog.killPortConfirmBtn,
      isDestructive: true,
      onConfirm: async () => {
        setIsFreeingPort(true);
        await killPortApi(p);
        setIsFreeingPort(false);
      },
    });
  };

  const handleFlushDns = () => {
    openConfirmDialog({
      title: t().confirmDialog.flushDnsTitle,
      message: t().confirmDialog.flushDnsWarning,
      confirmText: t().confirmDialog.flushDnsConfirmBtn,
      isDestructive: false,
      onConfirm: async () => {
        setIsFlushingDns(true);
        await flushDnsApi();
        setIsFlushingDns(false);
      },
    });
  };

  const handlePing = async (e: Event) => {
    e.preventDefault();
    const host = pingHost().trim();
    if (!host) return;
    setIsPinging(true);
    const res = await pingHostApi(host);
    setPingResult(res);
    setIsPinging(false);
  };

  return (
    <div class="flex flex-col gap-3" aria-label={t().sidebar.navOps}>
      {/* Ops Action Tools Grid */}
      <section class="grid grid-cols-1 gap-2.5 lg:grid-cols-3">
        {/* Tool 1: Flush DNS */}
        <div class="flex flex-col justify-between rounded-lg border border-border-default bg-bg-surface p-3">
          <div>
            <h3 class="text-xs font-semibold text-text-primary">{t().devops.dnsTitle}</h3>
            <p class="mt-1 text-[11px] text-text-muted leading-normal">
              {t().devops.dnsDesc}
            </p>
          </div>

          <button
            type="button"
            onClick={handleFlushDns}
            disabled={isFlushingDns()}
            aria-busy={isFlushingDns()}
            aria-label={t().devops.dnsBtn}
            class="mt-3 rounded border border-border-default bg-bg-subtle py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent"
          >
            {isFlushingDns() ? t().devops.dnsFlushing : t().devops.dnsBtn}
          </button>
        </div>

        {/* Tool 2: Free Port Killer */}
        <div class="flex flex-col justify-between rounded-lg border border-border-default bg-bg-surface p-3">
          <div>
            <h3 class="text-xs font-semibold text-text-primary">{t().devops.portTitle}</h3>
            <p class="mt-1 text-[11px] text-text-muted leading-normal">
              {t().devops.portDesc}
            </p>
          </div>

          <form onSubmit={handleFreePort} class="mt-3 flex gap-1.5" aria-label={t().devops.portTitle}>
            <input
              type="number"
              aria-label={t().devops.portPlaceholder}
              placeholder={t().devops.portPlaceholder}
              value={portInput()}
              onInput={(e) => setPortInput(e.currentTarget.value)}
              min="1"
              max="65535"
              class="w-full rounded border border-border-default bg-bg-input px-2.5 py-1 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-border-strong focus-visible:ring-1 focus-visible:ring-accent"
            />
            <button
              type="submit"
              disabled={isFreeingPort() || !portInput()}
              aria-busy={isFreeingPort()}
              aria-label={t().devops.portBtn}
              class="shrink-0 rounded bg-status-danger px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-status-danger"
            >
              {isFreeingPort() ? t().devops.portFreeing : t().devops.portBtn}
            </button>
          </form>
        </div>

        {/* Tool 3: Ping Diagnostic Tool */}
        <div class="flex flex-col justify-between rounded-lg border border-border-default bg-bg-surface p-3">
          <div>
            <h3 class="text-xs font-semibold text-text-primary">{t().devops.pingTitle}</h3>
            <p class="mt-1 text-[11px] text-text-muted leading-normal">
              {t().devops.pingDesc}
            </p>
          </div>

          <form onSubmit={handlePing} class="mt-3 flex gap-1.5" aria-label={t().devops.pingTitle}>
            <input
              type="text"
              aria-label={t().devops.pingPlaceholder}
              placeholder={t().devops.pingPlaceholder}
              value={pingHost()}
              onInput={(e) => setPingHost(e.currentTarget.value)}
              class="w-full rounded border border-border-default bg-bg-input px-2.5 py-1 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-border-strong focus-visible:ring-1 focus-visible:ring-accent"
            />
            <button
              type="submit"
              disabled={isPinging() || !pingHost().trim()}
              aria-busy={isPinging()}
              aria-label={t().devops.pingBtn}
              class="shrink-0 rounded border border-border-default bg-bg-subtle px-3 py-1 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent"
            >
              {isPinging() ? t().devops.pinging : t().devops.pingBtn}
            </button>
          </form>
        </div>
      </section>

      {/* Ping Result Box (if any) */}
      <Show when={pingResult()}>
        {(res) => (
          <div class="rounded-lg border border-border-default bg-bg-surface p-3 animate-in fade-in duration-200">
            <div class="flex items-center justify-between border-b border-border-subtle pb-2 mb-2.5">
              <div class="flex items-center gap-2">
                <span
                  class="h-2 w-2 rounded-full"
                  classList={{
                    'bg-status-success': res().is_alive,
                    'bg-status-danger': !res().is_alive,
                  }}
                />
                <span class="text-xs font-semibold text-text-primary">
                  {t().devops.pingResultTitle}: <span class="mono text-accent">{res().host}</span>
                </span>
                <span
                  class="rounded px-1.5 py-0.2 text-[9px] font-mono uppercase"
                  classList={{
                    'bg-status-success-bg text-status-success': res().is_alive,
                    'bg-status-danger-bg text-status-danger': !res().is_alive,
                  }}
                >
                  {res().is_alive ? t().devops.pingResponded : t().devops.pingNoResponse}
                </span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
              <div class="rounded bg-bg-subtle p-2 border border-border-subtle/50">
                <span class="text-[10px] text-text-muted block">{t().devops.avgLatency}</span>
                <span class="mono font-semibold text-text-primary">
                  {res().avg_latency_ms !== null ? `${res().avg_latency_ms?.toFixed(1)} ms` : '-'}
                </span>
              </div>
              <div class="rounded bg-bg-subtle p-2 border border-border-subtle/50">
                <span class="text-[10px] text-text-muted block">{t().devops.minLatency}</span>
                <span class="mono font-semibold text-text-primary">
                  {res().min_latency_ms !== null ? `${res().min_latency_ms?.toFixed(1)} ms` : '-'}
                </span>
              </div>
              <div class="rounded bg-bg-subtle p-2 border border-border-subtle/50">
                <span class="text-[10px] text-text-muted block">{t().devops.maxLatency}</span>
                <span class="mono font-semibold text-text-primary">
                  {res().max_latency_ms !== null ? `${res().max_latency_ms?.toFixed(1)} ms` : '-'}
                </span>
              </div>
              <div class="rounded bg-bg-subtle p-2 border border-border-subtle/50">
                <span class="text-[10px] text-text-muted block">{t().devops.packetsIo}</span>
                <span class="mono font-semibold text-text-primary">
                  {res().packets_received}/{res().packets_sent}
                </span>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Dev Tools Environment Matrix Section */}
      <section class="rounded-lg border border-border-default bg-bg-surface p-3.5">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <h2 class="text-xs font-semibold text-text-primary">{t().devops.toolchainTitle}</h2>
            <span class="rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.2 mono text-[9.5px] text-text-muted">
              {devTools().filter((d) => d.is_installed).length}/{devTools().length} {t().devops.readyCount}
            </span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <For
            each={devTools()}
            fallback={
              <div class="col-span-full py-8 text-center text-xs text-text-muted font-mono">
                {t().devops.scanningTools}
              </div>
            }
          >
            {(tool) => (
              <div
                class="flex flex-col justify-between rounded-lg border p-2.5 transition-colors"
                classList={{
                  'border-border-default bg-bg-input': tool.is_installed,
                  'border-border-subtle/60 bg-bg-subtle/30 opacity-60': !tool.is_installed,
                }}
              >
                <div class="flex items-start justify-between">
                  <span class="font-medium text-xs text-text-primary truncate">{tool.name}</span>
                  <span
                    class="h-1.5 w-1.5 rounded-full mt-1 shrink-0"
                    classList={{
                      'bg-status-success': tool.is_installed,
                      'bg-text-muted': !tool.is_installed,
                    }}
                  />
                </div>

                <div class="mt-2 text-[10px]">
                  <Show
                    when={tool.is_installed}
                    fallback={<span class="text-text-muted italic">{t().common.absent}</span>}
                  >
                    <span class="mono text-text-secondary truncate block" title={tool.version || ''}>
                      {tool.version || t().common.ready}
                    </span>
                    <Show when={tool.path}>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(tool.path || '', 'Tool Path')}
                        class="mono text-[9px] text-text-muted truncate hover:text-accent text-left block w-full focus-visible:ring-1 focus-visible:ring-accent rounded transition-colors"
                        title={tool.path || ''}
                      >
                        {tool.path}
                      </button>
                    </Show>
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
