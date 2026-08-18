import { For } from 'solid-js';
import type { Component } from 'solid-js';
import { latencyHistory, latencyList } from '../services/store';
import { t } from '../i18n';

export const LatencyMatrix: Component = () => {
  const renderSparkline = (history: number[], strokeColor: string) => {
    if (!history || history.length < 2) {
      return <div class="h-3 w-10" />;
    }
    const max = Math.max(...history, 10);
    const min = Math.min(...history, 0);
    const range = max - min || 1;
    const w = 40;
    const h = 12;
    const step = w / (history.length - 1);

    const points = history
      .map((val, i) => {
        const x = i * step;
        const y = h - ((val - min) / range) * (h - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <svg class="h-3 w-10" viewBox={`0 0 ${w} ${h}`}>
        <polyline
          fill="none"
          stroke={strokeColor}
          stroke-width="1.3"
          stroke-linecap="round"
          stroke-linejoin="round"
          points={points}
        />
      </svg>
    );
  };

  return (
    <section class="flex flex-col rounded-lg border border-border-default bg-bg-surface p-3.5">
      <div class="mb-2.5 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <h2 class="text-xs font-semibold text-text-primary">{t().latency.title}</h2>
          <span class="text-[10px] text-text-muted mono">{t().latency.probes}</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <For
          each={latencyList()}
          fallback={
            <div class="col-span-full py-6 text-center text-xs text-text-muted font-mono">
              {t().latency.probing}
            </div>
          }
        >
          {(target) => {
            const history = () => latencyHistory[target.host] || [];
            const isAlive = target.is_alive && target.latency_ms !== null;

            let strokeColor = '#f87171';
            let valColor = 'text-status-danger';
            let valText = t().latency.timeout;

            if (isAlive) {
              const ms = target.latency_ms!;
              if (ms < 50) {
                strokeColor = '#10b981';
                valColor = 'text-status-success';
              } else if (ms < 150) {
                strokeColor = '#0284c7';
                valColor = 'text-accent';
              } else {
                strokeColor = '#d97706';
                valColor = 'text-status-warning';
              }
              valText = `${ms.toFixed(0)} ms`;
            }

            return (
              <div class="flex flex-col justify-between rounded border border-border-subtle bg-bg-input p-2 transition-colors hover:border-border-default">
                <div class="flex items-start justify-between">
                  <div class="truncate">
                    <div class="text-[11px] font-medium text-text-primary truncate">
                      {target.name}
                    </div>
                    <div class="mono text-[9px] text-text-muted">
                      {target.host}:{target.port}
                    </div>
                  </div>
                </div>

                <div class="mt-2 flex items-end justify-between">
                  <span class={`mono text-sm font-semibold leading-none ${valColor}`}>
                    {valText}
                  </span>
                  {renderSparkline(history(), strokeColor)}
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </section>
  );
};
