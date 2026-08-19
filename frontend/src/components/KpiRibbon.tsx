import type { Component } from 'solid-js';
import { formatSpeed, formatTotalBytes, sockets, traffic } from '../services/store';
import { t } from '../i18n';

export const KpiRibbon: Component = () => {
  const rx = () => formatSpeed(traffic()?.total_rx_speed || 0);
  const tx = () => formatSpeed(traffic()?.total_tx_speed || 0);
  const listeningCount = () => sockets()?.listening_ports?.length || 0;
  const activeCount = () => sockets()?.active_connections?.length || 0;

  return (
    <section class="hud-box grid grid-cols-1 divide-y sm:divide-y-0 sm:grid-cols-2 lg:grid-cols-4 sm:divide-x divide-border-default bg-bg-surface/90 shadow-lg">
      {/* 01: RX Telemetry */}
      <div class="p-3.5 flex flex-col justify-between relative overflow-hidden group">
        <div class="flex items-center justify-between text-[10.5px]">
          <div class="flex items-center gap-2">
            <span class="h-1.5 w-1.5 rounded-full bg-status-success shadow-[0_0_8px_rgba(0,255,157,0.8)] animate-pulse-dot" />
            <span class="hud-tag text-status-success">{t().kpi.rxSpeed}</span>
          </div>
          <span class="mono text-[9.5px] font-semibold text-text-muted bg-bg-base/80 px-1.5 py-0.2 rounded border border-border-subtle tabular-nums">
            {formatTotalBytes(traffic()?.total_rx_bytes || 0)}
          </span>
        </div>
        <div class="mt-2.5 flex items-baseline gap-2">
          <span class="mono text-2xl lg:text-3xl font-extrabold text-status-success leading-none tabular-nums tracking-tight">
            {rx().num}
          </span>
          <span class="mono text-[10.5px] font-bold text-status-success/70 uppercase tracking-wider">
            {rx().unit}
          </span>
        </div>
      </div>

      {/* 02: TX Telemetry */}
      <div class="p-3.5 flex flex-col justify-between relative overflow-hidden group">
        <div class="flex items-center justify-between text-[10.5px]">
          <div class="flex items-center gap-2">
            <span class="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(0,240,255,0.8)] animate-pulse-dot" />
            <span class="hud-tag text-accent">{t().kpi.txSpeed}</span>
          </div>
          <span class="mono text-[9.5px] font-semibold text-text-muted bg-bg-base/80 px-1.5 py-0.2 rounded border border-border-subtle tabular-nums">
            {formatTotalBytes(traffic()?.total_tx_bytes || 0)}
          </span>
        </div>
        <div class="mt-2.5 flex items-baseline gap-2">
          <span class="mono text-2xl lg:text-3xl font-extrabold text-accent leading-none tabular-nums tracking-tight">
            {tx().num}
          </span>
          <span class="mono text-[10.5px] font-bold text-accent/70 uppercase tracking-wider">
            {tx().unit}
          </span>
        </div>
      </div>

      {/* 03: Listening Ports */}
      <div class="p-3.5 flex flex-col justify-between relative overflow-hidden group">
        <div class="flex items-center justify-between text-[10.5px]">
          <div class="flex items-center gap-2">
            <span class="h-1.5 w-1.5 rounded-full bg-sky-400" />
            <span class="hud-tag text-text-secondary">{t().kpi.listeningPorts}</span>
          </div>
          <span class="mono text-[9.5px] font-semibold text-text-muted bg-bg-base/80 px-1.5 py-0.2 rounded border border-border-subtle uppercase">
            {t().kpi.tcpUdp}
          </span>
        </div>
        <div class="mt-2.5 flex items-baseline gap-2">
          <span class="mono text-2xl lg:text-3xl font-extrabold text-text-primary leading-none tabular-nums tracking-tight">
            {listeningCount()}
          </span>
          <span class="hud-tag text-[9.5px] text-text-muted">{t().kpi.openCount}</span>
        </div>
      </div>

      {/* 04: Active Connections */}
      <div class="p-3.5 flex flex-col justify-between relative overflow-hidden group">
        <div class="flex items-center justify-between text-[10.5px]">
          <div class="flex items-center gap-2">
            <span class="h-1.5 w-1.5 rounded-full bg-teal-400" />
            <span class="hud-tag text-text-secondary">{t().kpi.activeConnections}</span>
          </div>
          <span class="mono text-[9.5px] font-semibold text-text-muted bg-bg-base/80 px-1.5 py-0.2 rounded border border-border-subtle uppercase">
            {t().kpi.estab}
          </span>
        </div>
        <div class="mt-2.5 flex items-baseline gap-2">
          <span class="mono text-2xl lg:text-3xl font-extrabold text-text-primary leading-none tabular-nums tracking-tight">
            {activeCount()}
          </span>
          <span class="hud-tag text-[9.5px] text-text-muted">{t().kpi.activeCount}</span>
        </div>
      </div>
    </section>
  );
};
