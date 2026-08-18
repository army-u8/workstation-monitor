import type { Component } from 'solid-js';
import { formatSpeed, formatTotalBytes, sockets, traffic } from '../services/store';
import { t } from '../i18n';

export const KpiRibbon: Component = () => {
  const rx = () => formatSpeed(traffic()?.total_rx_speed || 0);
  const tx = () => formatSpeed(traffic()?.total_tx_speed || 0);
  const listeningCount = () => sockets()?.listening_ports?.length || 0;
  const activeCount = () => sockets()?.active_connections?.length || 0;

  return (
    <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* RX Metric */}
      <div class="glass-card flex flex-col justify-between p-4 transition-all duration-200 hover:border-border-hover hover:translate-y-[-1px] group relative overflow-hidden">
        <div class="absolute top-0 right-0 h-16 w-16 bg-status-success/5 rounded-full blur-xl pointer-events-none -mr-4 -mt-4 transition-opacity group-hover:opacity-100 opacity-60" />
        <div class="flex items-center justify-between text-[11px] relative z-10">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-status-success shadow-[0_0_8px_rgba(52,211,153,0.7)] animate-pulse-dot" />
            <span class="text-text-muted font-bold tracking-tight">{t().kpi.rxSpeed}</span>
          </div>
          <span class="mono text-[10px] font-semibold text-text-muted bg-bg-subtle/80 px-2 py-0.5 rounded border border-border-subtle tabular-nums">
            {formatTotalBytes(traffic()?.total_rx_bytes || 0)}
          </span>
        </div>
        <div class="mt-3 flex items-baseline gap-2 relative z-10">
          <span class="mono text-3xl font-bold text-status-success leading-none tabular-nums tracking-tight">
            {rx().num}
          </span>
          <span class="mono text-[11px] font-bold text-text-muted uppercase tracking-wider">
            {rx().unit}
          </span>
        </div>
      </div>

      {/* TX Metric */}
      <div class="glass-card flex flex-col justify-between p-4 transition-all duration-200 hover:border-border-hover hover:translate-y-[-1px] group relative overflow-hidden">
        <div class="absolute top-0 right-0 h-16 w-16 bg-accent/5 rounded-full blur-xl pointer-events-none -mr-4 -mt-4 transition-opacity group-hover:opacity-100 opacity-60" />
        <div class="flex items-center justify-between text-[11px] relative z-10">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_rgba(56,189,248,0.7)] animate-pulse-dot" />
            <span class="text-text-muted font-bold tracking-tight">{t().kpi.txSpeed}</span>
          </div>
          <span class="mono text-[10px] font-semibold text-text-muted bg-bg-subtle/80 px-2 py-0.5 rounded border border-border-subtle tabular-nums">
            {formatTotalBytes(traffic()?.total_tx_bytes || 0)}
          </span>
        </div>
        <div class="mt-3 flex items-baseline gap-2 relative z-10">
          <span class="mono text-3xl font-bold text-accent leading-none tabular-nums tracking-tight">
            {tx().num}
          </span>
          <span class="mono text-[11px] font-bold text-text-muted uppercase tracking-wider">
            {tx().unit}
          </span>
        </div>
      </div>

      {/* Listening Ports */}
      <div class="glass-card flex flex-col justify-between p-4 transition-all duration-200 hover:border-border-hover hover:translate-y-[-1px] group relative overflow-hidden">
        <div class="flex items-center justify-between text-[11px] relative z-10">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-sky-400/80" />
            <span class="text-text-muted font-bold tracking-tight">{t().kpi.listeningPorts}</span>
          </div>
          <span class="mono text-[10px] font-semibold text-text-secondary px-2 py-0.5 rounded bg-bg-subtle/80 border border-border-subtle">
            {t().kpi.tcpUdp}
          </span>
        </div>
        <div class="mt-3 flex items-baseline gap-2 relative z-10">
          <span class="mono text-3xl font-bold text-text-primary leading-none tabular-nums tracking-tight">
            {listeningCount()}
          </span>
          <span class="text-[11px] text-text-muted font-semibold">{t().kpi.openCount}</span>
        </div>
      </div>

      {/* Active Connections */}
      <div class="glass-card flex flex-col justify-between p-4 transition-all duration-200 hover:border-border-hover hover:translate-y-[-1px] group relative overflow-hidden">
        <div class="flex items-center justify-between text-[11px] relative z-10">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-teal-400/80" />
            <span class="text-text-muted font-bold tracking-tight">
              {t().kpi.activeConnections}
            </span>
          </div>
          <span class="mono text-[10px] font-semibold text-text-secondary px-2 py-0.5 rounded bg-bg-subtle/80 border border-border-subtle">
            {t().kpi.estab}
          </span>
        </div>
        <div class="mt-3 flex items-baseline gap-2 relative z-10">
          <span class="mono text-3xl font-bold text-text-primary leading-none tabular-nums tracking-tight">
            {activeCount()}
          </span>
          <span class="text-[11px] text-text-muted font-semibold">{t().kpi.activeCount}</span>
        </div>
      </div>
    </section>
  );
};
