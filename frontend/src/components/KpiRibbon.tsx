import type { Component } from 'solid-js';
import { formatSpeed, formatTotalBytes, sockets, traffic } from '../services/store';
import { t } from '../i18n';

export const KpiRibbon: Component = () => {
  const rx = () => formatSpeed(traffic()?.total_rx_speed || 0);
  const tx = () => formatSpeed(traffic()?.total_tx_speed || 0);
  const listeningCount = () => sockets()?.listening_ports?.length || 0;
  const activeCount = () => sockets()?.active_connections?.length || 0;

  return (
    <section class="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {/* RX Metric */}
      <div class="flex flex-col justify-between rounded-lg border border-border-default bg-bg-surface p-3 transition-colors hover:border-border-hover">
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-text-muted font-medium">{t().kpi.rxSpeed}</span>
          <span class="mono text-[10px] text-text-muted">
            {formatTotalBytes(traffic()?.total_rx_bytes || 0)}
          </span>
        </div>
        <div class="mt-1 flex items-baseline gap-1">
          <span class="mono text-xl font-bold text-status-success leading-none">
            {rx().num}
          </span>
          <span class="mono text-[10px] text-text-muted">{rx().unit}</span>
        </div>
      </div>

      {/* TX Metric */}
      <div class="flex flex-col justify-between rounded-lg border border-border-default bg-bg-surface p-3 transition-colors hover:border-border-hover">
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-text-muted font-medium">{t().kpi.txSpeed}</span>
          <span class="mono text-[10px] text-text-muted">
            {formatTotalBytes(traffic()?.total_tx_bytes || 0)}
          </span>
        </div>
        <div class="mt-1 flex items-baseline gap-1">
          <span class="mono text-xl font-bold text-accent leading-none">
            {tx().num}
          </span>
          <span class="mono text-[10px] text-text-muted">{tx().unit}</span>
        </div>
      </div>

      {/* Listening Ports */}
      <div class="flex flex-col justify-between rounded-lg border border-border-default bg-bg-surface p-3 transition-colors hover:border-border-hover">
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-text-muted font-medium">{t().kpi.listeningPorts}</span>
          <span class="mono text-[10px] text-text-muted">{t().kpi.tcpUdp}</span>
        </div>
        <div class="mt-1 flex items-baseline gap-1">
          <span class="mono text-xl font-bold text-text-primary leading-none">
            {listeningCount()}
          </span>
          <span class="text-[10px] text-text-muted">{t().kpi.openCount}</span>
        </div>
      </div>

      {/* Active Connections */}
      <div class="flex flex-col justify-between rounded-lg border border-border-default bg-bg-surface p-3 transition-colors hover:border-border-hover">
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-text-muted font-medium">{t().kpi.activeConnections}</span>
          <span class="mono text-[10px] text-text-muted">{t().kpi.estab}</span>
        </div>
        <div class="mt-1 flex items-baseline gap-1">
          <span class="mono text-xl font-bold text-text-primary leading-none">
            {activeCount()}
          </span>
          <span class="text-[10px] text-text-muted">{t().kpi.activeCount}</span>
        </div>
      </div>
    </section>
  );
};
