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
    <div class="flex flex-col gap-3" aria-label={t().cleaner.title}>
      {/* Header Banner */}
      <section class="flex flex-col justify-between rounded-lg border border-border-default bg-bg-surface p-3.5 sm:flex-row sm:items-center">
        <div>
          <h2 class="text-xs font-semibold text-text-primary">{t().cleaner.title}</h2>
          <p class="mt-0.5 text-[11px] text-text-muted">
            {t().cleaner.totalReclaimable}:{' '}
            <strong class="mono text-status-success">{formatTotalReclaimable()}</strong>
          </p>
        </div>

        <div class="mt-2.5 flex items-center gap-2 sm:mt-0">
          <button
            type="button"
            onClick={handleScan}
            disabled={isScanning()}
            aria-busy={isScanning()}
            aria-label={t().cleaner.scanBtn}
            class="flex items-center justify-center gap-1.5 rounded border border-border-default bg-bg-subtle px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent"
          >
            <RefreshIcon class={`h-3.5 w-3.5 ${isScanning() ? 'animate-spin' : ''}`} />
            <span>{isScanning() ? t().cleaner.scanning : t().cleaner.scanBtn}</span>
          </button>

          <Show when={cleanerItems().some((i) => i.is_cleanable)}>
            <button
              type="button"
              onClick={handleCleanAll}
              disabled={isScanning() || cleaningId() !== null}
              aria-label={t().confirmDialog.cleanConfirmBtn}
              class="flex items-center justify-center gap-1.5 rounded bg-status-danger px-3 py-1.5 text-xs font-medium text-white shadow-xs transition-colors hover:bg-status-danger/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-status-danger"
            >
              <TrashIcon class="h-3.5 w-3.5" />
              <span>{t().confirmDialog.cleanConfirmBtn}</span>
            </button>
          </Show>
        </div>
      </section>

      {/* Cleaner Items Cards Grid */}
      <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <For
          each={cleanerItems()}
          fallback={
            <div class="col-span-full py-12 text-center text-xs text-text-muted font-mono">
              <Show when={isScanning()} fallback={t().cleaner.empty}>
                {t().cleaner.scanning}
              </Show>
            </div>
          }
        >
          {(item) => {
            const isTargetCleaning = () => cleaningId() === item.id;

            return (
              <div class="flex flex-col justify-between rounded-lg border border-border-subtle bg-bg-input p-3 transition-colors hover:border-border-default">
                <div>
                  <div class="flex items-start justify-between">
                    <div>
                      <div class="text-xs font-semibold text-text-primary">{item.name}</div>
                      <span class="rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.2 mono text-[9px] text-text-muted mt-1 inline-block">
                        {item.category}
                      </span>
                    </div>

                    <div class="text-right">
                      <span class="mono text-sm font-bold text-text-primary">
                        {item.size_human}
                      </span>
                    </div>
                  </div>

                  <Show when={item.path}>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(item.path || '', 'Cache Path')}
                      class="mt-2 mono text-[9px] text-text-muted truncate hover:text-accent text-left block w-full focus-visible:ring-1 focus-visible:ring-accent rounded"
                      title={item.path || ''}
                      aria-label={item.path || ''}
                    >
                      {item.path}
                    </button>
                  </Show>
                </div>

                <div class="mt-3 flex justify-end border-t border-border-subtle pt-2">
                  <button
                    type="button"
                    onClick={() => handleCleanItem(item)}
                    disabled={!item.is_cleanable || isTargetCleaning()}
                    aria-busy={isTargetCleaning()}
                    aria-label={`${t().cleaner.cleanBtn} ${item.name}`}
                    class="flex items-center gap-1.5 rounded bg-status-danger/10 px-2.5 py-1 text-[11px] font-medium text-status-danger hover:bg-status-danger hover:text-white transition-colors disabled:opacity-30 focus-visible:ring-1 focus-visible:ring-status-danger"
                  >
                    <TrashIcon class="h-3 w-3" />
                    <span>{isTargetCleaning() ? t().cleaner.cleaning : t().cleaner.cleanBtn}</span>
                  </button>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};
