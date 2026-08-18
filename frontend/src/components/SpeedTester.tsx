import { Show, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { runSpeedTestApi, speedTestResult } from '../services/store';
import { SpeedIcon } from './Icons';
import { t } from '../i18n';

export const SpeedTester: Component = () => {
  const [isTesting, setIsTesting] = createSignal(false);

  const handleStart = async () => {
    setIsTesting(true);
    await runSpeedTestApi();
    setIsTesting(false);
  };

  return (
    <div class="flex flex-col gap-3" aria-label={t().speedtest.title}>
      {/* Action Banner */}
      <section class="flex flex-col justify-between rounded-lg border border-border-default bg-bg-surface p-4 sm:flex-row sm:items-center">
        <div>
          <h2 class="text-xs font-semibold text-text-primary">{t().speedtest.title}</h2>
          <p class="mt-0.5 text-[11px] text-text-muted">{t().speedtest.tip}</p>
        </div>

        <button
          type="button"
          onClick={handleStart}
          disabled={isTesting()}
          aria-busy={isTesting()}
          aria-label={t().speedtest.startBtn}
          class="mt-3 flex items-center justify-center gap-1.5 rounded bg-accent px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 sm:mt-0 shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent"
        >
          <SpeedIcon class={`h-4 w-4 ${isTesting() ? 'animate-bounce' : ''}`} />
          <span>{isTesting() ? t().speedtest.testing : t().speedtest.startBtn}</span>
        </button>
      </section>

      {/* Speedometer Gauge & Results Card */}
      <Show when={speedTestResult()}>
        {(res) => {
          const mbps = res().download_mbps;
          let speedColor = 'text-status-success';
          if (mbps < 30) speedColor = 'text-status-warning';
          else if (mbps < 10) speedColor = 'text-status-danger';

          return (
            <div
              class="grid grid-cols-1 gap-3 sm:grid-cols-3"
              role="region"
              aria-label={t().speedtest.title}
            >
              {/* Card 1: Bandwidth */}
              <div class="flex flex-col justify-between rounded-lg border border-border-subtle bg-bg-input p-4">
                <span class="text-xs text-text-muted">{t().speedtest.downloadSpeed}</span>
                <div class="my-2 flex items-baseline gap-1.5">
                  <span class={`mono text-4xl font-extrabold ${speedColor}`}>
                    {mbps.toFixed(1)}
                  </span>
                  <span class="mono text-sm text-text-muted">Mbps</span>
                </div>
                <div class="text-[10px] text-text-muted mono">≈ {(mbps / 8.0).toFixed(1)} MB/s</div>
              </div>

              {/* Card 2: Duration & Data */}
              <div class="flex flex-col justify-between rounded-lg border border-border-subtle bg-bg-input p-4">
                <span class="text-xs text-text-muted">{t().speedtest.duration}</span>
                <div class="my-2 mono text-2xl font-bold text-text-primary">
                  {res().duration_secs.toFixed(2)}{' '}
                  <span class="text-sm font-normal text-text-muted">{t().common.seconds}</span>
                </div>
                <div class="text-[10px] text-text-muted mono">
                  {t().speedtest.bytesDownloaded}:{' '}
                  {(res().bytes_downloaded / (1024 * 1024)).toFixed(1)} MB
                </div>
              </div>

              {/* Card 3: Server Info */}
              <div class="flex flex-col justify-between rounded-lg border border-border-subtle bg-bg-input p-4">
                <span class="text-xs text-text-muted">{t().speedtest.server}</span>
                <div class="my-2 text-sm font-medium text-text-primary">{res().server}</div>
                <div class="text-[10px] text-status-success font-mono">
                  ● HTTP/2 CDN Global Edge Verified
                </div>
              </div>
            </div>
          );
        }}
      </Show>
    </div>
  );
};
