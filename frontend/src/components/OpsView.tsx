import { Show, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { flushDnsApi, killPortApi, openConfirmDialog, pingHostApi } from '../services/store';
import { DEFAULT_PROBE_HOST } from '../constants';
import type { PingResponse } from '../types';
import { t } from '../i18n';
import { OpsIcon } from './Icons';

export const OpsView: Component = () => {
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
      message: t()
        .confirmDialog.killPortWarning.replace('{name}', 'Process')
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
    <div class="flex flex-col gap-3.5" aria-label={t().sidebar.navOps}>
      {/* Header Banner */}
      <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-default bg-bg-surface p-4">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-status-info/15 text-status-info text-xl">
            <OpsIcon class="h-5 w-5" />
          </span>
          <div>
            <h2 class="text-sm font-semibold text-text-primary m-0">{t().sidebar.navOps}</h2>
            <p class="text-xs text-text-muted m-0 mt-0.5">
              macOS 本机网络诊断、DNS 缓存刷新与端口占用清理快捷运维动作
            </p>
          </div>
        </div>
      </div>

      {/* Ops Action Tools Grid */}
      <section class="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        {/* Tool 1: Flush DNS */}
        <div class="flex flex-col justify-between rounded-lg border border-border-default bg-bg-surface p-4 shadow-2xs">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-base">🌐</span>
              <h3 class="text-xs font-semibold text-text-primary m-0">{t().devops.dnsTitle}</h3>
            </div>
            <p class="mt-2 text-xs text-text-muted leading-relaxed">{t().devops.dnsDesc}</p>
          </div>

          <button
            type="button"
            onClick={handleFlushDns}
            disabled={isFlushingDns()}
            aria-busy={isFlushingDns()}
            aria-label={t().devops.dnsBtn}
            class="mt-4 w-full rounded-lg border border-border-default bg-bg-subtle py-2 text-xs font-medium text-text-secondary transition-all hover:bg-bg-hover hover:text-text-primary active:scale-98 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent"
          >
            {isFlushingDns() ? t().devops.dnsFlushing : t().devops.dnsBtn}
          </button>
        </div>

        {/* Tool 2: Free Port Killer */}
        <div class="flex flex-col justify-between rounded-lg border border-border-default bg-bg-surface p-4 shadow-2xs">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-base">🔌</span>
              <h3 class="text-xs font-semibold text-text-primary m-0">{t().devops.portTitle}</h3>
            </div>
            <p class="mt-2 text-xs text-text-muted leading-relaxed">{t().devops.portDesc}</p>
          </div>

          <form onSubmit={handleFreePort} class="mt-4 flex gap-2" aria-label={t().devops.portTitle}>
            <input
              type="number"
              aria-label={t().devops.portPlaceholder}
              placeholder={t().devops.portPlaceholder}
              value={portInput()}
              onInput={(e) => setPortInput(e.currentTarget.value)}
              min="1"
              max="65535"
              class="w-full rounded-lg border border-border-default bg-bg-input px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-hidden focus:border-accent focus-visible:ring-1 focus-visible:ring-accent font-mono"
            />
            <button
              type="submit"
              disabled={isFreeingPort() || !portInput()}
              aria-busy={isFreeingPort()}
              aria-label={t().devops.portBtn}
              class="shrink-0 rounded-lg bg-status-danger px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:brightness-110 active:scale-95 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-status-danger transition-all"
            >
              {isFreeingPort() ? t().devops.portFreeing : t().devops.portBtn}
            </button>
          </form>
        </div>

        {/* Tool 3: Ping Diagnostic Tool */}
        <div class="flex flex-col justify-between rounded-lg border border-border-default bg-bg-surface p-4 shadow-2xs">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-base">📡</span>
              <h3 class="text-xs font-semibold text-text-primary m-0">{t().devops.pingTitle}</h3>
            </div>
            <p class="mt-2 text-xs text-text-muted leading-relaxed">{t().devops.pingDesc}</p>
          </div>

          <form onSubmit={handlePing} class="mt-4 flex gap-2" aria-label={t().devops.pingTitle}>
            <input
              type="text"
              aria-label={t().devops.pingPlaceholder}
              placeholder={t().devops.pingPlaceholder}
              value={pingHost()}
              onInput={(e) => setPingHost(e.currentTarget.value)}
              class="w-full rounded-lg border border-border-default bg-bg-input px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-hidden focus:border-accent focus-visible:ring-1 focus-visible:ring-accent font-mono"
            />
            <button
              type="submit"
              disabled={isPinging() || !pingHost().trim()}
              aria-busy={isPinging()}
              aria-label={t().devops.pingBtn}
              class="shrink-0 rounded-lg border border-border-default bg-bg-subtle px-3.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary active:scale-95 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent transition-all"
            >
              {isPinging() ? t().devops.pinging : t().devops.pingBtn}
            </button>
          </form>
        </div>
      </section>

      {/* Ping Result Box (if any) */}
      <Show when={pingResult()}>
        {(res) => (
          <div class="rounded-lg border border-border-default bg-bg-surface p-4 animate-in fade-in duration-200 shadow-sm">
            <div class="flex items-center justify-between border-b border-border-subtle pb-3 mb-3">
              <div class="flex items-center gap-2.5">
                <span
                  class="h-2.5 w-2.5 rounded-full"
                  classList={{
                    'bg-status-success shadow-xs shadow-status-success/50': res().is_alive,
                    'bg-status-danger shadow-xs shadow-status-danger/50': !res().is_alive,
                  }}
                />
                <span class="text-xs font-semibold text-text-primary">
                  {t().devops.pingResultTitle}:{' '}
                  <span class="mono text-accent font-bold">{res().host}</span>
                </span>
                <span
                  class="rounded px-2 py-0.5 text-[10px] font-mono font-semibold uppercase"
                  classList={{
                    'bg-status-success/15 text-status-success': res().is_alive,
                    'bg-status-danger/15 text-status-danger': !res().is_alive,
                  }}
                >
                  {res().is_alive ? t().devops.pingResponded : t().devops.pingNoResponse}
                </span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
              <div class="rounded-lg bg-bg-subtle p-3 border border-border-subtle/50">
                <span class="text-[11px] text-text-muted block">{t().devops.avgLatency}</span>
                <span class="mono text-sm font-semibold text-text-primary mt-1 block">
                  {res().avg_latency_ms !== null ? `${res().avg_latency_ms?.toFixed(1)} ms` : '-'}
                </span>
              </div>
              <div class="rounded-lg bg-bg-subtle p-3 border border-border-subtle/50">
                <span class="text-[11px] text-text-muted block">{t().devops.minLatency}</span>
                <span class="mono text-sm font-semibold text-text-primary mt-1 block">
                  {res().min_latency_ms !== null ? `${res().min_latency_ms?.toFixed(1)} ms` : '-'}
                </span>
              </div>
              <div class="rounded-lg bg-bg-subtle p-3 border border-border-subtle/50">
                <span class="text-[11px] text-text-muted block">{t().devops.maxLatency}</span>
                <span class="mono text-sm font-semibold text-text-primary mt-1 block">
                  {res().max_latency_ms !== null ? `${res().max_latency_ms?.toFixed(1)} ms` : '-'}
                </span>
              </div>
              <div class="rounded-lg bg-bg-subtle p-3 border border-border-subtle/50">
                <span class="text-[11px] text-text-muted block">{t().devops.packetsIo}</span>
                <span class="mono text-sm font-semibold text-text-primary mt-1 block">
                  {res().packets_received} / {res().packets_sent}
                </span>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
};
export default OpsView;
