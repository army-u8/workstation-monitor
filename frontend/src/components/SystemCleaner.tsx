import { For, Show, createSignal, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import {
  cleanCacheApi,
  cleanerItems,
  copyToClipboard,
  openConfirmDialog,
  scanCleanerApi,
} from '../services/store';
import type { CleanerItem } from '../types';
import { RefreshIcon, TrashIcon } from './Icons';
import { t } from '../i18n';

export const SystemCleaner: Component = () => {
  const [isScanning, setIsScanning] = createSignal(false);
  const [cleaningId, setCleaningId] = createSignal<string | null>(null);

  const handleScan = async () => {
    setIsScanning(true);
    await scanCleanerApi();
    setIsScanning(false);
  };

  const handleCleanItem = (item: CleanerItem) => {
    openConfirmDialog({
      title: t().confirmDialog.cleanTitle,
      message: t()
        .confirmDialog.cleanWarning.replace('{count}', '1')
        .replace('{size}', item.size_human),
      confirmText: t().confirmDialog.cleanConfirmBtn,
      isDestructive: true,
      onConfirm: async () => {
        setCleaningId(item.id);
        await cleanCacheApi(item.id);
        setCleaningId(null);
      },
    });
  };

  const handleCleanAll = () => {
    const cleanable = cleanerItems().filter((i) => i.is_cleanable);
    if (!cleanable.length) return;

    openConfirmDialog({
      title: t().confirmDialog.cleanTitle,
      message: t()
        .confirmDialog.cleanWarning.replace('{count}', cleanable.length.toString())
        .replace('{size}', formatTotalReclaimable()),
      confirmText: t().confirmDialog.cleanConfirmBtn,
      isDestructive: true,
      onConfirm: async () => {
        for (const item of cleanable) {
          setCleaningId(item.id);
          await cleanCacheApi(item.id);
        }
        setCleaningId(null);
        await scanCleanerApi();
      },
    });
  };

  onMount(() => {
    if (cleanerItems().length === 0) {
      handleScan();
    }
  });

  const totalReclaimableBytes = () => {
    return cleanerItems().reduce((acc, item) => acc + item.size_bytes, 0);
  };

  const formatTotalReclaimable = () => {
    const bytes = totalReclaimableBytes();
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div class="flex flex-col gap-4" aria-label={t().cleaner.title}>
      {/* Header Banner */}
      <section class="glass-card flex flex-col justify-between p-4 sm:flex-row sm:items-center shadow-xs">
        <div>
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-status-warning animate-pulse-dot" />
            <h2 class="text-xs font-bold text-text-primary m-0">{t().cleaner.title}</h2>
          </div>
          <p class="mt-1 text-xs text-text-muted">
            {t().cleaner.totalReclaimable}:{' '}
            <strong class="mono text-status-success font-bold text-sm ml-1">
              {formatTotalReclaimable()}
            </strong>
          </p>
        </div>

        <div class="mt-3 flex items-center gap-2 sm:mt-0">
          <button
            type="button"
            onClick={handleScan}
            disabled={isScanning()}
            aria-busy={isScanning()}
            aria-label={t().cleaner.scanBtn}
            class="flex items-center justify-center gap-1.5 rounded-lg border border-border-default bg-bg-surface px-3 py-1.8 text-xs font-semibold text-text-primary transition-all hover:bg-bg-hover hover:border-border-hover disabled:opacity-50"
          >
            <RefreshIcon class={`h-3.5 w-3.5 ${isScanning() ? 'animate-spin' : ''}`} />
            <span>{isScanning() ? t().cleaner.scanning : t().cleaner.scanBtn}</span>
          </button>

          <button
            type="button"
            onClick={handleCleanAll}
            disabled={isScanning() || totalReclaimableBytes() === 0}
            class="flex items-center justify-center gap-1.5 rounded-lg bg-status-danger px-3.5 py-1.8 text-xs font-bold text-white shadow-2xs hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
          >
            <TrashIcon class="h-3.5 w-3.5" />
            <span>{t().cleaner.cleanBtn}</span>
          </button>
        </div>
      </section>

      {/* Cleaner Items Grid */}
      <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        <For
          each={cleanerItems()}
          fallback={
            <div class="col-span-full py-12 text-center text-xs text-text-muted font-mono glass-card">
              {t().cleaner.empty}
            </div>
          }
        >
          {(item) => (
            <div
              class="glass-card flex flex-col justify-between p-3.5 transition-all duration-200 hover:border-border-hover"
              classList={{
                'border-status-warning/30 bg-status-warning/5': item.size_bytes > 100 * 1024 * 1024,
              }}
            >
              <div>
                <div class="flex items-start justify-between">
                  <div class="truncate">
                    <span
                      class="font-bold text-xs text-text-primary truncate block"
                      title={item.name}
                    >
                      {item.name}
                    </span>
                    <span
                      class="mono text-[10px] text-text-muted mt-0.5 block truncate"
                      title={item.path || ''}
                    >
                      {item.path || '-'}
                    </span>
                  </div>
                  <span class="rounded bg-bg-surface border border-border-subtle px-2 py-0.5 mono text-[9.5px] font-bold text-text-secondary uppercase shrink-0">
                    {item.category}
                  </span>
                </div>

                <div class="mt-3 flex items-baseline gap-2">
                  <span class="mono text-2xl font-bold text-text-primary tabular-nums">
                    {item.size_human}
                  </span>
                </div>
              </div>

              <div class="mt-3 pt-2.5 border-t border-border-subtle flex items-center justify-between">
                <Show when={item.path}>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(item.path || '', 'Path')}
                    class="rounded border border-border-default bg-bg-surface px-1.8 py-0.5 text-[10px] text-text-muted hover:text-text-primary transition-all"
                  >
                    {t().devops.copy}
                  </button>
                </Show>

                <button
                  type="button"
                  onClick={() => handleCleanItem(item)}
                  disabled={!item.is_cleanable || cleaningId() === item.id}
                  class="rounded-lg border border-status-danger/30 bg-status-danger/10 px-2.5 py-1 text-[10.5px] font-bold text-status-danger hover:bg-status-danger hover:text-white transition-all disabled:opacity-40"
                >
                  {cleaningId() === item.id ? '...' : t().cleaner.cleanBtn}
                </button>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
