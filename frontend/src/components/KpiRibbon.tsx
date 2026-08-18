import type { Component } from 'solid-js';
import { formatSpeed, formatTotalBytes, sockets, traffic } from '../services/store';
import { t } from '../i18n';

export const KpiRibbon: Component = () => {
  const rx = () => formatSpeed(traffic()?.total_rx_speed || 0);
  const tx = () => formatSpeed(traffic()?.total_tx_speed || 0);
  const listeningCount = () => sockets()?.listening_ports?.length || 0;
  const activeCount = () => sockets()?.active_connections?.length || 0;

  return (
    <section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* RX Metric */}
      <div class="glass-card flex flex-col justify-between p-3.5 transition-all duration-200 hover:border-border-hover hover:translate-y-[-1px]">
        <div class="flex items-center justify-between text-[11px]">
          <div class="flex items-center gap-1.5">
            <span class="h-1.5 w-1.5 rounded-full bg-status-success shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
            <span class="text-text-muted font-medium tracking-tight">{t().kpi.rxSpeed}</span>
          </div>
          <span class="mono text-[10.5px] text-text-muted tabular-nums">
            {formatTotalBytes(traffic()?.total_rx_bytes || 0)}
          </span>
        </div>
        <div class="mt-2 flex items-baseline gap-1.5">
          <span class="mono text-2xl font-bold text-status-success leading-none tabular-nums tracking-tight">
            {rx().num}
          </span>
          <span class="mono text-[10px] font-medium text-text-muted uppercase">{rx().unit}</span>
        </div>
      </div>

      {/* TX Metric */}
      <div class="glass-card flex flex-col justify-between p-3.5 transition-all duration-200 hover:border-border-hover hover:translate-y-[-1px]">
        <div class="flex items-center justify-between text-[11px]">
          <div class="flex items-center gap-1.5">
            <span class="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_rgba(56,189,248,0.5)]" />
            <span class="text-text-muted font-medium tracking-tight">{t().kpi.txSpeed}</span>
          </div>
          <span class="mono text-[10.5px] text-text-muted tabular-nums">
            {formatTotalBytes(traffic()?.total_tx_bytes || 0)}
          </span>
        </div>
        <div class="mt-2 flex items-baseline gap-1.5">
          <span class="mono text-2xl font-bold text-accent leading-none tabular-nums tracking-tight">
            {tx().num}
          </span>
          <span class="mono text-[10px] font-medium text-text-muted uppercase">{tx().unit}</span>
        </div>
      </div>

      {/* Listening Ports */}
      <div class="glass-card flex flex-col justify-between p-3.5 transition-all duration-200 hover:border-border-hover hover:translate-y-[-1px]">
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-text-muted font-medium tracking-tight">{t().kpi.listeningPorts}</span>
          <span class="mono text-[10px] text-text-muted px-1.5 py-0.2 rounded bg-bg-subtle/80 border border-border-subtle">
            {t().kpi.tcpUdp}
          </span>
        </div>
        <div class="mt-2 flex items-baseline gap-1.5">
          <span class="mono text-2xl font-bold text-text-primary leading-none tabular-nums tracking-tight">
            {listeningCount()}
          </span>
          <span class="text-[10px] text-text-muted font-medium">{t().kpi.openCount}</span>
        </div>
      </div>

      {/* Active Connections */}
      <div class="glass-card flex flex-col justify-between p-3.5 transition-all duration-200 hover:border-border-hover hover:translate-y-[-1px]">
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-text-muted font-medium tracking-tight">
            {t().kpi.activeConnections}
          </span>
          <span class="mono text-[10px] text-text-muted px-1.5 py-0.2 rounded bg-bg-subtle/80 border border-border-subtle">
            {t().kpi.estab}
          </span>
        </div>
        <div class="mt-2 flex items-baseline gap-1.5">
          <span class="mono text-2xl font-bold text-text-primary leading-none tabular-nums tracking-tight">
            {activeCount()}
          </span>
          <span class="text-[10px] text-text-muted font-medium">{t().kpi.activeCount}</span>
        </div>
      </div>
    </section>
  );
};
