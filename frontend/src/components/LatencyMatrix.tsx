import { For } from 'solid-js';
import type { Component } from 'solid-js';
import { latencyHistory, latencyList } from '../services/store';
import { t } from '../i18n';

export const LatencyMatrix: Component = () => {
  const renderSparkline = (history: number[], strokeColor: string) => {
    if (!history || history.length < 2) {
      return <div class="h-3.5 w-11" />;
    }
    const max = Math.max(...history, 10);
    const min = Math.min(...history, 0);
    const range = max - min || 1;
    const w = 44;
    const h = 14;
    const step = w / (history.length - 1);

    const points = history
      .map((val, i) => {
        const x = i * step;
        const y = h - ((val - min) / range) * (h - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <svg class="h-3.5 w-11" viewBox={`0 0 ${w} ${h}`}>
        <polyline
          fill="none"
          stroke={strokeColor}
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          points={points}
        />
      </svg>
    );
  };

  return (
    <section class="glass-card flex flex-col p-4 shadow-xs">
      <div class="mb-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-accent animate-pulse-dot" />
          <h2 class="text-xs font-bold text-text-primary m-0">{t().latency.title}</h2>
          <span class="text-[10px] font-semibold text-text-muted mono bg-bg-subtle px-1.8 py-0.2 rounded border border-border-subtle">
            {t().latency.probes}
          </span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <For
          each={latencyList()}
          fallback={
            <div class="col-span-full py-8 text-center text-xs text-text-muted font-mono">
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
                strokeColor = '#38bdf8';
                valColor = 'text-accent';
              } else {
                strokeColor = '#fbbf24';
                valColor = 'text-status-warning';
              }
              valText = `${ms.toFixed(0)} ms`;
            }

            return (
              <div class="glass-card-subtle flex flex-col justify-between p-2.5 transition-all duration-200 hover:border-border-hover">
                <div class="flex items-start justify-between">
                  <div class="truncate">
                    <div class="text-xs font-bold text-text-primary truncate">{target.name}</div>
                    <div class="mono text-[9.5px] text-text-muted mt-0.5">
                      {target.host}:{target.port}
                    </div>
                  </div>
                </div>

                <div class="mt-2.5 flex items-end justify-between">
                  <span
                    class={`mono text-sm font-bold leading-none tabular-nums tracking-tight ${valColor}`}
                  >
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
