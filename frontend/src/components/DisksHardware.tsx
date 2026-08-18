import { For, Show } from 'solid-js';
import type { Component } from 'solid-js';
import { battery, disks, formatTotalBytes } from '../services/store';
import { t } from '../i18n';

export const DisksHardware: Component = () => {
  return (
    <div class="flex flex-col gap-3">
      {/* Battery & Power Card with SolidJS Show */}
      <Show when={battery()}>
        <section class="flex flex-col rounded-lg border border-border-default bg-bg-surface p-3.5">
          <div class="mb-2.5 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <h2 class="text-xs font-semibold text-text-primary">{t().disks.batteryTitle}</h2>
              <span class="text-[10px] text-text-muted mono">pmset</span>
            </div>
            <span class="rounded bg-bg-subtle border border-border-subtle px-2 py-0.5 text-[10px] text-text-secondary font-mono">
              {battery()?.is_charging ? t().disks.acCharging : t().disks.batteryPower}
            </span>
          </div>

          <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div class="flex flex-col justify-between rounded border border-border-subtle bg-bg-input p-2.5">
              <span class="text-[10.5px] text-text-muted">{t().disks.batteryPct}</span>
              <div class="mt-1 flex items-baseline gap-1">
                <span class="mono text-xl font-bold text-text-primary">
                  {battery()?.percentage}%
                </span>
              </div>
              <div class="mt-2 h-1 w-full overflow-hidden rounded-full bg-bg-subtle border border-border-subtle">
                <div
                  class="h-full bg-status-success transition-all duration-300 rounded-full"
                  style={{ width: `${battery()?.percentage || 0}%` }}
                />
              </div>
            </div>

            <div class="flex flex-col justify-between rounded border border-border-subtle bg-bg-input p-2.5">
              <span class="text-[10.5px] text-text-muted">{t().disks.powerState}</span>
              <div class="mt-1 mono text-sm font-semibold text-text-primary">
                {battery()?.state}
              </div>
              <span class="text-[9.5px] text-text-muted">{t().disks.policyReady}</span>
            </div>

            <div class="flex flex-col justify-between rounded border border-border-subtle bg-bg-input p-2.5">
              <span class="text-[10.5px] text-text-muted">{t().disks.estimatedRemaining}</span>
              <div class="mt-1 mono text-sm font-semibold text-text-primary">
                {battery()?.time_remaining || t().disks.calculating}
              </div>
              <span class="text-[9.5px] text-text-muted">{t().disks.estHours}</span>
            </div>
          </div>
        </section>
      </Show>

      {/* Disks & APFS Storage Section */}
      <section class="flex flex-col rounded-lg border border-border-default bg-bg-surface p-3.5">
        <div class="mb-2.5 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h2 class="text-xs font-semibold text-text-primary">{t().disks.disksTitle}</h2>
            <span class="text-[10px] text-text-muted mono">
              {disks().length} {t().disks.volumesCount}
            </span>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <For
            each={disks()}
            fallback={
              <div class="col-span-full py-8 text-center text-xs text-text-muted font-mono">
                {t().disks.scanning}
              </div>
            }
          >
            {(disk) => {
              const usedPct = disk.used_percent;

              return (
                <div class="flex flex-col justify-between rounded border border-border-subtle bg-bg-input p-3 transition-colors hover:border-border-default">
                  <div>
                    <div class="flex items-start justify-between">
                      <div class="font-medium text-text-primary truncate text-xs" title={disk.name}>
                        {disk.name}
                      </div>
                      <span class="rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.2 mono text-[9px] text-text-muted">
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

                  <div class="mt-3 flex flex-col gap-1.5">
                    <div class="flex items-baseline justify-between text-[10.5px]">
                      <span class="text-text-muted">
                        {t().disks.used}{' '}
                        <strong class="text-text-primary">
                          {formatTotalBytes(disk.used_bytes)}
                        </strong>{' '}
                        / {formatTotalBytes(disk.total_bytes)}
                      </span>
                      <span class="mono font-semibold text-text-primary">
                        {usedPct.toFixed(1)}%
                      </span>
                    </div>

                    <div class="h-1 w-full overflow-hidden rounded-full bg-bg-subtle border border-border-subtle">
                      <div
                        class="h-full transition-all duration-300 rounded-full"
                        classList={{
                          'bg-status-danger': usedPct > 90,
                          'bg-status-warning': usedPct <= 90 && usedPct > 75,
                          'bg-accent': usedPct <= 75,
                        }}
                        style={{
                          width: `${Math.min(usedPct, 100)}%`,
                        }}
                      />
                    </div>

                    <div class="flex items-center justify-between text-[10px] text-text-muted pt-1 border-t border-border-subtle">
                      <span>{t().disks.remainingAvailable}</span>
                      <span class="mono text-text-primary font-medium">
                        {formatTotalBytes(disk.available_bytes)}
                      </span>
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
