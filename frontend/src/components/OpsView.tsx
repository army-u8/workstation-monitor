import { Show, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { flushDnsApi, killPortApi, openConfirmDialog, pingHostApi } from '../services/store';
import { DEFAULT_PROBE_HOST } from '../constants';
import { Button, Input } from './ui';
import { t } from '../i18n';
import { BoltIcon, GlobeIcon, OpsIcon, PlugIcon } from './Icons';
import type { PingResponse } from '../types';

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
        .confirmDialog.killPortWarning.replace('{name}', t().common.process)
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
    const res = await pingHostApi(host, 3);
    setPingResult(res);
    setIsPinging(false);
  };

  return (
    <div class="flex flex-col gap-4" aria-label={t().sidebar.navOps}>
      {/* Header Banner */}
      <div class="glass-card flex items-center justify-between p-4 shadow-xs">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 border border-accent/20 text-accent">
            <OpsIcon class="h-5 w-5" />
          </div>
          <div>
            <h2 class="text-base font-bold text-text-primary m-0 tracking-tight">
              {t().sidebar.navOps}
            </h2>
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
              <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 border border-accent/20 text-accent">
                <GlobeIcon class="h-4 w-4" />
              </div>
              <h3 class="text-xs font-bold text-text-primary m-0">{t().devops.dnsTitle}</h3>
            </div>
            <p class="mt-2 text-xs text-text-muted leading-relaxed">{t().devops.dnsDesc}</p>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={handleFlushDns}
            disabled={isFlushingDns()}
            loading={isFlushingDns()}
            aria-label={t().devops.dnsBtn}
            class="mt-4 w-full"
          >
            {isFlushingDns() ? '...' : t().devops.dnsBtn}
          </Button>
        </div>

        {/* Tool 2: Force Kill Port */}
        <div class="glass-card flex flex-col justify-between p-4 shadow-xs">
          <div>
            <div class="flex items-center gap-2">
              <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-status-danger/10 border border-status-danger/20 text-status-danger">
                <PlugIcon class="h-4 w-4" />
              </div>
              <h3 class="text-xs font-bold text-text-primary m-0">{t().devops.portTitle}</h3>
            </div>
            <p class="mt-2 text-xs text-text-muted leading-relaxed">{t().devops.portDesc}</p>
          </div>

          <form onSubmit={handleFreePort} class="mt-4 flex gap-2">
            <Input
              type="number"
              min="1"
              max="65535"
              placeholder={t().devops.portPlaceholder}
              value={portInput()}
              onInput={(e) => setPortInput(e.currentTarget.value)}
              class="w-full mono"
            />
            <Button
              type="submit"
              variant="destructive"
              disabled={isFreeingPort() || !portInput()}
              loading={isFreeingPort()}
            >
              {isFreeingPort() ? '...' : t().devops.portBtn}
            </Button>
          </form>
        </div>

        {/* Tool 3: Diagnostic Ping */}
        <div class="glass-card flex flex-col justify-between p-4 shadow-xs">
          <div>
            <div class="flex items-center gap-2">
              <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 border border-accent/20 text-accent">
                <BoltIcon class="h-4 w-4" />
              </div>
              <h3 class="text-xs font-bold text-text-primary m-0">{t().devops.pingTitle}</h3>
            </div>
            <p class="mt-2 text-xs text-text-muted leading-relaxed">{t().devops.pingDesc}</p>
          </div>

          <form onSubmit={handlePing} class="mt-4 flex gap-2">
            <Input
              type="text"
              placeholder={t().devops.pingPlaceholder}
              value={pingHost()}
              onInput={(e) => setPingHost(e.currentTarget.value)}
              class="w-full mono"
            />
            <Button
              type="submit"
              variant="default"
              disabled={isPinging() || !pingHost().trim()}
              loading={isPinging()}
            >
              {isPinging() ? '...' : t().devops.pingBtn}
            </Button>
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
                  {res().host} ·{' '}
                  {res().is_alive ? t().devops.pingResponded : t().devops.pingNoResponse}
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
