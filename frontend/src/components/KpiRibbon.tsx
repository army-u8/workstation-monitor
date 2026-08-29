import { Show, createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import {
  battery,
  formatSpeed,
  formatTotalBytes,
  gitProjects,
  machineInfo,
  sockets,
  stats,
  traffic,
} from '../services/store';
import { BoltIcon } from './Icons';
import { t } from '../i18n';

export const KpiRibbon: Component = () => {
  const rx = () => formatSpeed(traffic()?.total_rx_speed || 0);
  const tx = () => formatSpeed(traffic()?.total_tx_speed || 0);
  const listeningCount = () => sockets()?.listening_ports?.length || 0;
  const dirtyRepoCount = createMemo(() => gitProjects().filter((p) => p.is_dirty).length);

  const cpuPct = () => Math.min(stats()?.cpu_usage || 0, 100);
  const memPct = () => Math.min(stats()?.memory_percent || 0, 100);
  const memUsedGB = () => ((stats()?.memory_used || 0) / (1024 * 1024 * 1024)).toFixed(1);
  const memTotalGB = () => ((stats()?.memory_total || 0) / (1024 * 1024 * 1024)).toFixed(0);

  return (
    <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* 01: RX Download Bandwidth */}
      <div class="glass-card-interactive flex flex-col justify-between p-4 bg-linear-to-br from-bg-surface to-bg-subtle/50 relative overflow-hidden group">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-status-success shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse-dot" />
            <span class="hud-tag text-status-success text-[10.5px]">{t().kpi.rxSpeed}</span>
          </div>
          <span class="mono text-[10px] font-semibold text-text-muted bg-bg-base/80 px-2 py-0.5 rounded border border-border-subtle tabular-nums">
            {formatTotalBytes(traffic()?.total_rx_bytes || 0)}
          </span>
        </div>
        <div class="my-3 flex items-baseline gap-2">
          <span class="mono text-3xl font-extrabold text-status-success leading-none tabular-nums tracking-tight">
            {rx().num}
          </span>
          <span class="mono text-xs font-bold text-status-success/80 uppercase tracking-wider">
            {rx().unit}
          </span>
        </div>
        <div class="flex items-center justify-between text-[10px] text-text-muted pt-2 border-t border-border-subtle">
          <span class="font-mono">{traffic()?.interfaces?.length || 1} {t().traffic.devices}</span>
          <span class="text-status-success/90 font-mono font-semibold">↓ {t().common.live}</span>
        </div>
      </div>

      {/* 02: TX Upload Bandwidth */}
      <div class="glass-card-interactive flex flex-col justify-between p-4 bg-linear-to-br from-bg-surface to-bg-subtle/50 relative overflow-hidden group">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_rgba(56,189,248,0.9)] animate-pulse-dot" />
            <span class="hud-tag text-accent text-[10.5px]">{t().kpi.txSpeed}</span>
          </div>
          <span class="mono text-[10px] font-semibold text-text-muted bg-bg-base/80 px-2 py-0.5 rounded border border-border-subtle tabular-nums">
            {formatTotalBytes(traffic()?.total_tx_bytes || 0)}
          </span>
        </div>
        <div class="my-3 flex items-baseline gap-2">
          <span class="mono text-3xl font-extrabold text-accent leading-none tabular-nums tracking-tight">
            {tx().num}
          </span>
          <span class="mono text-xs font-bold text-accent/80 uppercase tracking-wider">
            {tx().unit}
          </span>
        </div>
        <div class="flex items-center justify-between text-[10px] text-text-muted pt-2 border-t border-border-subtle">
          <span class="font-mono">{listeningCount()} {t().kpi.listeningPorts}</span>
          <span class="text-accent/90 font-mono font-semibold">↑ {t().kpi.activeCount}</span>
        </div>
      </div>

      {/* 03: CPU & Hardware Load */}
      <div class="glass-card-interactive flex flex-col justify-between p-4 bg-linear-to-br from-bg-surface to-bg-subtle/50 relative overflow-hidden group">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]" />
            <span class="hud-tag text-text-primary text-[10.5px]">{t().common.cpu}</span>
          </div>
          <span class="mono text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/25">
            {machineInfo()?.hardware?.chip_name || t().common.workstation}
          </span>
        </div>
        <div class="my-2.5 flex items-baseline justify-between">
          <div class="flex items-baseline gap-1">
            <span class="mono text-3xl font-extrabold text-text-primary leading-none tabular-nums tracking-tight">
              {cpuPct().toFixed(0)}
            </span>
            <span class="mono text-xs font-bold text-text-muted">%</span>
          </div>
          <div class="h-2 w-28 rounded-full bg-bg-subtle overflow-hidden border border-border-subtle">
            <div
              class="h-full bg-linear-to-r from-accent to-sky-400 rounded-full transition-all duration-300"
              style={{ width: `${cpuPct()}%` }}
            />
          </div>
        </div>
        <div class="flex items-center justify-between text-[10px] text-text-muted pt-2 border-t border-border-subtle font-mono">
          <span>{stats()?.host_name || 'localhost'}</span>
          <Show when={battery()}>
            {(bat) => (
              <span class="flex items-center gap-1 font-bold text-text-secondary">
                {bat().percentage}%
                <Show when={bat().is_charging}>
                  <BoltIcon class="h-3 w-3 text-status-success" />
                </Show>
              </span>
            )}
          </Show>
        </div>
      </div>

      {/* 04: Memory & Workspace Status */}
      <div class="glass-card-interactive flex flex-col justify-between p-4 bg-linear-to-br from-bg-surface to-bg-subtle/50 relative overflow-hidden group">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.7)]" />
            <span class="hud-tag text-text-primary text-[10.5px]">{t().common.memory}</span>
          </div>
          <span class="mono text-[10px] font-bold text-text-secondary bg-bg-base/80 px-2 py-0.5 rounded border border-border-subtle">
            {memUsedGB()} / {memTotalGB()}
          </span>
        </div>
        <div class="my-2.5 flex items-baseline justify-between">
          <div class="flex items-baseline gap-1">
            <span class="mono text-3xl font-extrabold text-text-primary leading-none tabular-nums tracking-tight">
              {memPct().toFixed(0)}
            </span>
            <span class="mono text-xs font-bold text-text-muted">%</span>
          </div>
          <div class="h-2 w-28 rounded-full bg-bg-subtle overflow-hidden border border-border-subtle">
            <div
              class="h-full bg-linear-to-r from-teal-400 to-status-success rounded-full transition-all duration-300"
              style={{ width: `${memPct()}%` }}
            />
          </div>
        </div>
        <div class="flex items-center justify-between text-[10px] text-text-muted pt-2 border-t border-border-subtle font-mono">
          <span>{gitProjects().length} {t().overviewWorkbench.projectsCount}</span>
          <Show
            when={dirtyRepoCount() > 0}
            fallback={<span class="text-status-success font-semibold">{t().overviewWorkbench.clean}</span>}
          >
            <span class="text-status-warning font-bold">● {dirtyRepoCount()} {t().gitRadar.dirtyShort}</span>
          </Show>
        </div>
      </div>
    </section>
  );
};

