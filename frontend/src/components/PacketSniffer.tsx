import { For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import {
  isSnifferPaused,
  packetFilter,
  packets,
  setIsSnifferPaused,
  setPacketFilter,
  setPackets,
  showToast,
  stats,
  traffic,
} from '../services/store';
import { PacketProtocolFilter, ToastType } from '../constants';
import { Button } from './ui';
import { t } from '../i18n';

export const PacketSniffer: Component = () => {
  const filteredPackets = () => {
    const filter = packetFilter();
    const list = packets();
    if (filter === PacketProtocolFilter.ALL) return list;
    return list.filter((p) => p.protocol.toUpperCase().includes(filter.toUpperCase()));
  };

  const togglePause = () => {
    const next = !isSnifferPaused();
    setIsSnifferPaused(next);
    showToast(next ? t().sniffer.pausedToast : t().sniffer.resumedToast, ToastType.INFO);
  };

  const clearStream = () => {
    setPackets([]);
    showToast(t().sniffer.clearedToast, ToastType.SUCCESS);
  };

  const getProtoBadge = (proto: string) => {
    const p = proto.toLowerCase();
    if (p.includes('dns')) return 'text-purple-400 bg-purple-500/15 border border-purple-500/30';
    if (p.includes('tls') || p.includes('https'))
      return 'text-status-warning bg-status-warning-bg border border-status-warning/30';
    if (p.includes('http'))
      return 'text-status-success bg-status-success-bg border border-status-success/30';
    if (p.includes('udp')) return 'text-accent bg-accent-subtle border border-accent/30';
    if (p.includes('icmp'))
      return 'text-status-danger bg-status-danger-bg border border-status-danger/30';
    return 'text-text-secondary bg-bg-subtle border border-border-subtle';
  };

  return (
    <section
      aria-label={t().sniffer.title}
      class="hud-box flex flex-col p-4 shadow-lg bg-bg-surface/90"
    >
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-status-success shadow-[0_0_8px_rgba(0,255,157,0.8)] animate-pulse-dot" />
          <h2 class="hud-tag text-text-primary text-xs m-0">{t().sniffer.title}</h2>
          <span class="mono text-[9.5px] font-semibold text-status-success/80 bg-status-success/10 px-1.5 py-0.2 rounded border border-status-success/25">
            {traffic()?.interfaces?.[0]?.name || 'en0'}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <select
            aria-label={t().sniffer.filterAll}
            value={packetFilter()}
            onChange={(e) => setPacketFilter(e.currentTarget.value as PacketProtocolFilter)}
            class="rounded-lg border border-border-default bg-bg-input px-2.5 py-1 text-[10.5px] font-mono text-text-secondary outline-none focus-visible:ring-1 focus-visible:ring-accent cursor-pointer"
          >
            <option value={PacketProtocolFilter.ALL}>{t().sniffer.filterAll}</option>
            <option value={PacketProtocolFilter.TCP}>{t().sniffer.filterTcp}</option>
            <option value={PacketProtocolFilter.TLS}>{t().sniffer.filterTls}</option>
            <option value={PacketProtocolFilter.UDP}>{t().sniffer.filterUdp}</option>
            <option value={PacketProtocolFilter.DNS}>{t().sniffer.filterDns}</option>
            <option value={PacketProtocolFilter.ICMP}>{t().sniffer.filterIcmp}</option>
          </select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={togglePause}
            aria-pressed={isSnifferPaused()}
            aria-label={isSnifferPaused() ? t().sniffer.resume : t().sniffer.pause}
          >
            <span>{isSnifferPaused() ? t().sniffer.resume : t().sniffer.pause}</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={clearStream}
            aria-label={t().sniffer.clear}
          >
            {t().sniffer.clear}
          </Button>
        </div>
      </div>

      {/* Permission tip if unprivileged */}
      <Show when={!stats()?.sniffer_active && stats()?.sniffer_error}>
        <div
          class="mb-3 rounded-lg border border-status-warning/30 bg-status-warning-bg p-2.5 text-[10.5px] text-status-warning font-mono"
          role="alert"
        >
          {t().sniffer.sudoTip}
        </div>
      </Show>

      {/* Packet Stream List */}
      <div
        class="h-64 overflow-y-auto space-y-1.5 font-mono text-[11px] rounded-lg border border-border-subtle bg-bg-base/80 p-2"
        role="log"
        aria-live="polite"
      >
        <For
          each={filteredPackets()}
          fallback={
            <div class="flex h-full flex-col items-center justify-center text-text-muted">
              <span class="text-xs">{t().sniffer.waiting}</span>
              <span class="text-[10px] text-text-muted/60 mt-0.5">{t().sniffer.sudoTip}</span>
            </div>
          }
        >
          {(pkt) => (
            <div class="flex items-center justify-between gap-2 rounded bg-bg-surface/90 px-2 py-1 transition-colors hover:bg-bg-hover border border-border-subtle/40">
              <div class="flex items-center gap-2 truncate">
                <span class="text-[9.5px] text-text-muted">
                  {new Date(pkt.timestamp).toTimeString().split(' ')[0]}
                </span>
                <span
                  class={`rounded px-1.5 py-0.2 text-[9.5px] font-bold uppercase ${getProtoBadge(pkt.protocol)}`}
                >
                  {pkt.protocol}
                </span>
                <span class="truncate text-text-primary text-[10.5px]">
                  {pkt.src_ip}:{pkt.src_port || '-'} → {pkt.dst_ip}:{pkt.dst_port || '-'}
                </span>
              </div>
              <span class="shrink-0 text-text-muted text-[10px] font-medium">{pkt.length} B</span>
            </div>
          )}
        </For>
      </div>
    </section>
  );
};
