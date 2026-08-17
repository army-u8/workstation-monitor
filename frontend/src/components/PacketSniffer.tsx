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
} from '../services/store';
import { PacketProtocolFilter, ToastType } from '../constants';
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
    if (p.includes('dns')) return 'text-purple-500 bg-purple-500/10';
    if (p.includes('tls') || p.includes('https')) return 'text-status-warning bg-status-warning-bg';
    if (p.includes('http')) return 'text-status-success bg-status-success-bg';
    if (p.includes('udp')) return 'text-accent bg-accent-subtle';
    if (p.includes('icmp')) return 'text-status-danger bg-status-danger-bg';
    return 'text-text-secondary bg-bg-subtle';
  };

  return (
    <section aria-label={t().sniffer.title} class="flex flex-col rounded-lg border border-border-default bg-bg-surface p-3.5">
      {/* Header & Controls */}
      <div class="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <h2 class="text-xs font-semibold text-text-primary">{t().sniffer.title}</h2>
          <span class="text-[10px] text-text-muted mono">/dev/bpf</span>
        </div>

        <div class="flex items-center gap-1.5">
          <select
            aria-label={t().sniffer.filterAll}
            value={packetFilter()}
            onChange={(e) => setPacketFilter(e.currentTarget.value as PacketProtocolFilter)}
            class="rounded border border-border-default bg-bg-input px-2 py-0.5 text-[10px] text-text-secondary outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <option value={PacketProtocolFilter.ALL}>{t().sniffer.filterAll}</option>
            <option value={PacketProtocolFilter.TCP}>{t().sniffer.filterTcp}</option>
            <option value={PacketProtocolFilter.TLS}>{t().sniffer.filterTls}</option>
            <option value={PacketProtocolFilter.UDP}>{t().sniffer.filterUdp}</option>
            <option value={PacketProtocolFilter.DNS}>{t().sniffer.filterDns}</option>
            <option value={PacketProtocolFilter.ICMP}>{t().sniffer.filterIcmp}</option>
          </select>

          <button
            type="button"
            onClick={togglePause}
            aria-pressed={isSnifferPaused()}
            aria-label={isSnifferPaused() ? t().sniffer.resume : t().sniffer.pause}
            class="rounded border border-border-default bg-bg-input px-2 py-0.5 text-[10px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary focus-visible:ring-1 focus-visible:ring-accent"
          >
            <span>{isSnifferPaused() ? t().sniffer.resume : t().sniffer.pause}</span>
          </button>

          <button
            type="button"
            onClick={clearStream}
            aria-label={t().sniffer.clear}
            class="rounded px-2 py-0.5 text-[10px] text-text-muted hover:text-text-primary focus-visible:ring-1 focus-visible:ring-accent"
          >
            {t().sniffer.clear}
          </button>
        </div>
      </div>

      {/* Permission tip if unprivileged with SolidJS Show */}
      <Show when={!stats()?.sniffer_active && stats()?.sniffer_error}>
        <div class="mb-2 rounded border border-status-warning/20 bg-status-warning-bg p-2 text-[10px] text-status-warning font-mono" role="alert">
          {t().sniffer.sudoTip}
        </div>
      </Show>

      {/* Terminal table stream */}
      <div class="overflow-hidden rounded-md border border-border-subtle bg-bg-input font-mono text-[9.5px]" role="log" aria-live="polite">
        {/* Table Header */}
        <div class="grid grid-cols-[50px_60px_110px_14px_110px_35px_1fr] border-b border-border-default bg-bg-subtle px-2 py-1 font-sans text-[9px] font-medium text-text-muted">
          <span>{t().sniffer.thTime}</span>
          <span>{t().sniffer.thProto}</span>
          <span>{t().sniffer.thSrc}</span>
          <span aria-hidden="true" />
          <span>{t().sniffer.thDst}</span>
          <span>{t().sniffer.thSize}</span>
          <span>{t().sniffer.thSummary}</span>
        </div>

        {/* Table Body */}
        <div class="max-h-[200px] overflow-y-auto divide-y divide-border-subtle">
          <For
            each={filteredPackets()}
            fallback={
              <div class="py-6 text-center text-xs text-text-muted font-sans">
                {t().sniffer.waiting}
              </div>
            }
          >
            {(p) => {
              const timeStr = new Date(p.timestamp).toTimeString().split(' ')[0];
              const src = p.src_port ? `${p.src_ip}:${p.src_port}` : p.src_ip;
              const dst = p.dst_port ? `${p.dst_ip}:${p.dst_port}` : p.dst_ip;

              return (
                <div class="grid grid-cols-[50px_60px_110px_14px_110px_35px_1fr] items-center px-2 py-0.5 hover:bg-bg-hover">
                  <span class="text-text-muted">{timeStr}</span>
                  <span>
                    <span class={`rounded px-1 py-0.2 text-[8.5px] font-medium ${getProtoBadge(p.protocol)}`}>
                      {p.protocol}
                    </span>
                  </span>
                  <span class="truncate text-text-secondary" title={src}>{src}</span>
                  <span class="text-text-muted" aria-hidden="true">→</span>
                  <span class="truncate text-text-secondary" title={dst}>{dst}</span>
                  <span class="text-text-muted">{p.length}B</span>
                  <span class="truncate text-text-primary" title={p.info}>{p.info}</span>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </section>
  );
};
