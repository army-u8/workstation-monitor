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
    <div class="flex flex-col gap-4" aria-label={t().sidebar.navOps}>
      {/* Header Banner */}
      <div class="glass-card flex flex-wrap items-center justify-between gap-2 p-4 shadow-xs">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-status-info/15 text-status-info text-xl border border-status-info/25 shadow-2xs">
            <OpsIcon class="h-5 w-5" />
          </span>
          <div>
            <h2 class="text-sm font-bold text-text-primary m-0">{t().sidebar.navOps}</h2>
            <p class="text-xs text-text-muted m-0 mt-0.5">{t().ops.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Ops Action Tools Grid */}
      <section class="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        {/* Tool 1: Flush DNS */}
        <div class="glass-card flex flex-col justify-between p-4 shadow-xs">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-lg">🌐</span>
              <h3 class="text-xs font-bold text-text-primary m-0">{t().devops.dnsTitle}</h3>
            </div>
            <p class="mt-2 text-xs text-text-muted leading-relaxed">{t().devops.dnsDesc}</p>
          </div>

          <button
            type="button"
            onClick={handleFlushDns}
            disabled={isFlushingDns()}
            aria-busy={isFlushingDns()}
            aria-label={t().devops.dnsBtn}
            class="mt-4 w-full rounded-lg border border-border-default bg-bg-surface py-2 text-xs font-bold text-text-primary transition-all hover:bg-bg-hover hover:border-border-hover active:scale-98 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent"
          >
            {isFlushingDns() ? '...' : t().devops.dnsBtn}
          </button>
        </div>

        {/* Tool 2: Force Kill Port */}
        <div class="glass-card flex flex-col justify-between p-4 shadow-xs">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-lg">🔌</span>
              <h3 class="text-xs font-bold text-text-primary m-0">{t().devops.portTitle}</h3>
            </div>
            <p class="mt-2 text-xs text-text-muted leading-relaxed">{t().devops.portDesc}</p>
          </div>

          <form onSubmit={handleFreePort} class="mt-4 flex gap-2">
            <input
              type="number"
              min="1"
              max="65535"
              placeholder="e.g. 3000"
              value={portInput()}
              onInput={(e) => setPortInput(e.currentTarget.value)}
              class="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-1.5 mono text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={isFreeingPort() || !portInput()}
              class="shrink-0 rounded-lg bg-status-danger px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
            >
              {isFreeingPort() ? '...' : t().devops.portBtn}
            </button>
          </form>
        </div>

        {/* Tool 3: Diagnostic Ping */}
        <div class="glass-card flex flex-col justify-between p-4 shadow-xs">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-lg">⚡</span>
              <h3 class="text-xs font-bold text-text-primary m-0">{t().devops.pingTitle}</h3>
            </div>
            <p class="mt-2 text-xs text-text-muted leading-relaxed">{t().devops.pingDesc}</p>
          </div>

          <form onSubmit={handlePing} class="mt-4 flex gap-2">
            <input
              type="text"
              placeholder="1.1.1.1 or google.com"
              value={pingHost()}
              onInput={(e) => setPingHost(e.currentTarget.value)}
              class="w-full rounded-lg border border-border-default bg-bg-surface px-3 py-1.5 mono text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={isPinging() || !pingHost().trim()}
              class="shrink-0 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
            >
              {isPinging() ? '...' : t().devops.pingBtn}
            </button>
          </form>
        </div>
      </section>

      {/* Ping Results Panel */}
      <Show when={pingResult()}>
        {(res) => (
          <div class="glass-card p-4 shadow-xs animate-in fade-in duration-150">
            <div class="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div class="flex items-center gap-2">
                <span
                  class="h-2 w-2 rounded-full"
                  classList={{
                    'bg-status-success shadow-[0_0_8px_rgba(52,211,153,0.8)]': res().is_alive,
                    'bg-status-danger': !res().is_alive,
                  }}
                />
                <h3 class="text-xs font-bold text-text-primary m-0">
                  {res().host} · {res().is_alive ? 'Online' : 'Timeout'}
                </h3>
              </div>
              <Show when={res().avg_latency_ms !== null}>
                <span class="mono text-xs font-bold text-accent">
                  {res().avg_latency_ms?.toFixed(1)} ms
                </span>
              </Show>
            </div>

            <Show when={res().raw_output}>
              <pre class="mt-3 overflow-x-auto rounded-lg bg-bg-base/80 p-3 font-mono text-[10.5px] text-text-secondary leading-relaxed border border-border-subtle">
                {res().raw_output}
              </pre>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
};
