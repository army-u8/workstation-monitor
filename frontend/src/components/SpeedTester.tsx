import { Show, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { runSpeedTestApi, speedTestResult } from '../services/store';
import { SpeedIcon } from './Icons';
import { Button } from './ui';
import { t } from '../i18n';
import { getSpeedStatusClass } from '../utils/status';

export const SpeedTester: Component = () => {
  const [isTesting, setIsTesting] = createSignal(false);

  const handleStart = async () => {
    setIsTesting(true);
    await runSpeedTestApi();
    setIsTesting(false);
  };

  return (
    <div class="flex flex-col gap-4" aria-label={t().speedtest.title}>
      {/* Action Banner */}
      <section class="hud-box flex flex-col justify-between p-4 sm:flex-row sm:items-center shadow-lg bg-bg-surface/90">
        <div>
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_rgba(0,240,255,0.8)] animate-pulse-dot" />
            <h2 class="hud-tag text-xs text-text-primary m-0">{t().speedtest.title}</h2>
          </div>
          <p class="mt-1 text-xs text-text-muted">{t().speedtest.tip}</p>
        </div>

        <Button
          type="button"
          variant="default"
          onClick={handleStart}
          disabled={isTesting()}
          loading={isTesting()}
          aria-label={t().speedtest.startBtn}
          class="mt-3 sm:mt-0"
        >
          <SpeedIcon class={`h-4 w-4 ${isTesting() ? 'animate-pulse opacity-80' : ''}`} />
          <span>{isTesting() ? t().speedtest.testing : t().speedtest.startBtn}</span>
        </Button>
      </section>

      {/* Speedometer Gauge & Results Card */}
      <Show when={speedTestResult()}>
        {(res) => {
          const mbps = res().download_mbps;
          const speedColor = getSpeedStatusClass(mbps);

          return (
            <div
              class="grid grid-cols-1 gap-3.5 sm:grid-cols-3"
              role="region"
              aria-label={t().speedtest.title}
            >
              {/* Card 1: Bandwidth */}
              <div class="hud-box flex flex-col justify-between p-4 shadow-md bg-bg-surface/85">
                <span class="text-xs font-bold text-text-muted">{t().speedtest.downloadSpeed}</span>
                <div class="my-3 flex items-baseline gap-2">
                  <span
                    class={`mono text-4xl font-extrabold tracking-tight tabular-nums ${speedColor}`}
                  >
                    {mbps.toFixed(1)}
                  </span>
                  <span class="mono text-sm font-bold text-text-muted">Mbps</span>
                </div>
                <div class="text-[10.5px] text-text-muted mono bg-bg-surface px-2 py-0.8 rounded border border-border-subtle inline-block w-fit">
                  ≈ {(mbps / 8.0).toFixed(1)} MB/s
                </div>
              </div>

              {/* Card 2: Duration & Data */}
              <div class="hud-box flex flex-col justify-between p-4 shadow-md bg-bg-surface/85">
                <span class="hud-tag text-xs text-text-muted">{t().speedtest.duration}</span>
                <div class="my-3 mono text-3xl font-bold text-text-primary tabular-nums">
                  {res().duration_secs.toFixed(2)}{' '}
                  <span class="text-xs font-semibold text-text-muted">{t().common.seconds}</span>
                </div>
                <div class="text-[10.5px] text-text-muted mono">
                  {t().speedtest.bytesDownloaded}:{' '}
                  <strong class="text-text-primary">
                    {(res().bytes_downloaded / (1024 * 1024)).toFixed(1)} MB
                  </strong>
                </div>
              </div>

              {/* Card 3: Server Info */}
              <div class="hud-box flex flex-col justify-between p-4 shadow-md bg-bg-surface/85">
                <span class="hud-tag text-xs text-text-muted">{t().speedtest.server}</span>
                <div class="my-3 text-sm font-bold text-text-primary truncate" title={res().server}>
                  {res().server}
                </div>
                <div class="text-[10px] text-status-success font-mono font-bold flex items-center gap-1.5">
                  <span class="h-1.5 w-1.5 rounded-full bg-status-success shadow-[0_0_6px_rgba(0,255,157,0.8)]" />
                  <span>{t().speedtest.edgeVerified}</span>
                </div>
              </div>
            </div>
          );
        }}
      </Show>
    </div>
  );
};
