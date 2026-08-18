import { For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { BoltIcon } from './Icons';
import { Badge } from './ui';
import { battery, disks, formatTotalBytes } from '../services/store';
import { t } from '../i18n';

export const DisksHardware: Component = () => {
  return (
    <div class="flex flex-col gap-4">
      {/* Battery & Power Card */}
      <Show when={battery()}>
        <section class="glass-card flex flex-col p-4 shadow-xs">
          <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full bg-status-success animate-pulse-dot" />
              <h2 class="text-xs font-bold text-text-primary m-0">{t().disks.batteryTitle}</h2>
              <Badge variant="secondary" size="sm">
                pmset
              </Badge>
            </div>
            <Badge variant="success" size="sm">
              {battery()?.is_charging ? t().disks.acCharging : t().disks.batteryPower}
            </Badge>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div class="glass-card-subtle flex flex-col justify-between p-3">
              <span class="text-[10.5px] font-bold text-text-muted">{t().disks.batteryPct}</span>
              <div class="mt-1 flex items-baseline gap-1">
                <span class="mono text-2xl font-bold text-text-primary">
                  {battery()?.percentage}%
                </span>
                <Show when={battery()?.is_charging}>
                  <BoltIcon class="h-4 w-4 text-status-success inline" />
                </Show>
              </div>
              <div class="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle border border-border-subtle">
                <div
                  class="h-full bg-linear-to-r from-teal-400 to-status-success transition-all duration-300 rounded-full"
                  style={{ width: `${battery()?.percentage || 0}%` }}
                />
              </div>
            </div>

            <div class="glass-card-subtle flex flex-col justify-between p-3">
              <span class="text-[10.5px] font-bold text-text-muted">{t().disks.powerState}</span>
              <div class="mt-1 mono text-sm font-bold text-text-primary">{battery()?.state}</div>
              <span class="text-[10px] text-text-muted mt-2">{t().disks.policyReady}</span>
            </div>

            <div class="glass-card-subtle flex flex-col justify-between p-3">
              <span class="text-[10.5px] font-bold text-text-muted">
                {t().disks.estimatedRemaining}
              </span>
              <div class="mt-1 mono text-sm font-bold text-text-primary">
                {battery()?.time_remaining || t().disks.calculating}
              </div>
              <span class="text-[10px] text-text-muted mt-2">{t().disks.estHours}</span>
            </div>
          </div>
        </section>
      </Show>

      {/* Disks & APFS Storage Section */}
      <section class="glass-card flex flex-col p-4 shadow-xs">
        <div class="mb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-accent animate-pulse-dot" />
            <h2 class="text-xs font-bold text-text-primary m-0">{t().disks.disksTitle}</h2>
            <span class="text-[10px] font-mono text-text-muted bg-bg-subtle px-1.8 py-0.2 rounded border border-border-subtle">
              {disks().length} {t().disks.volumesCount}
            </span>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <For
            each={disks()}
            fallback={
              <div class="col-span-full py-10 text-center text-xs text-text-muted font-mono">
                {t().disks.scanning}
              </div>
            }
          >
            {(disk) => {
              const usedPct = disk.used_percent;
              let barColor = 'bg-accent';
              let textColor = 'text-accent';
              if (usedPct >= 90) {
                barColor = 'bg-status-danger';
                textColor = 'text-status-danger';
              } else if (usedPct >= 75) {
                barColor = 'bg-status-warning';
                textColor = 'text-status-warning';
              }

              return (
                <div class="glass-card-subtle flex flex-col justify-between p-3.5 transition-all duration-200 hover:border-border-hover">
                  <div>
                    <div class="flex items-start justify-between">
                      <div class="font-bold text-text-primary truncate text-xs" title={disk.name}>
                        {disk.name}
                      </div>
                      <span class="rounded bg-bg-surface border border-border-subtle px-2 py-0.5 mono text-[9.5px] font-bold text-text-secondary uppercase">
                        {disk.file_system}
                      </span>
                    </div>
                    <div
                      class="mono text-[10px] text-text-muted mt-0.5 truncate"
                      title={disk.mount_point}
                    >
                      {disk.mount_point}
                    </div>
                  </div>

                  <div class="mt-3.5 flex flex-col gap-1.5">
                    <div class="flex items-baseline justify-between text-[11px]">
                      <span class="text-text-muted font-medium">{t().disks.used}</span>
                      <span class={`mono font-bold ${textColor}`}>{usedPct.toFixed(1)}%</span>
                    </div>

                    <div class="h-2 w-full overflow-hidden rounded-full bg-bg-subtle border border-border-subtle/80">
                      <div
                        class={`h-full ${barColor} transition-all duration-300 rounded-full`}
                        style={{ width: `${Math.min(usedPct, 100)}%` }}
                      />
                    </div>

                    <div class="mt-1 flex justify-between text-[10px] text-text-muted mono">
                      <span>
                        {t().disks.remainingAvailable}: {formatTotalBytes(disk.available_bytes)}
                      </span>
                      <span>{formatTotalBytes(disk.total_bytes)}</span>
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </section>
    </div>
  );
};
