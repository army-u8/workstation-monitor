import { Show, createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import {
  applyUpdateApi,
  isApplyingUpdate,
  isCheckingUpdate,
  isUpdateModalOpen,
  setIsUpdateModalOpen,
  updateInfo,
  updateStep,
} from '../services/store';
import { t } from '../i18n';

export const UpdateModal: Component = () => {
  const info = () => updateInfo();

  const formattedSize = createMemo(() => {
    const bytes = info()?.asset_size_bytes;
    if (!bytes) return null;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  });

  const formattedDate = createMemo(() => {
    const pub = info()?.published_at;
    if (!pub) return null;
    try {
      const d = new Date(pub);
      return d.toLocaleDateString();
    } catch {
      return pub;
    }
  });

  const handleClose = () => {
    if (isApplyingUpdate()) return; // Prevent closing while hot-updating
    setIsUpdateModalOpen(false);
  };

  const handleApplyUpdate = async () => {
    await applyUpdateApi();
  };

  const getStepText = () => {
    const s = updateStep();
    const dict = t().update;
    if (s === 'downloading') return dict.stepDownloading;
    if (s === 'installing') return dict.stepInstalling;
    if (s === 'restarting') return dict.stepRestarting;
    if (s === 'reconnecting') return dict.stepReconnecting;
    return dict.checking;
  };

  return (
    <Show when={isUpdateModalOpen() && info()}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <div
          class="relative w-full max-w-lg overflow-hidden rounded-xl border border-border-default bg-bg-surface p-6 shadow-2xl transition-all"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div class="flex items-center justify-between border-b border-border-subtle pb-4">
            <div class="flex items-center gap-2.5">
              <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent text-lg">
                🚀
              </span>
              <div>
                <h3 class="text-base font-semibold text-text-primary m-0">
                  {t().update.modalTitle}
                </h3>
                <p class="text-xs text-text-muted m-0">
                  {info()?.has_update
                    ? t().update.newVersionAvailable
                    : t().update.alreadyLatest.replace('{version}', (info()?.current_version || '').replace(/^v/, ''))}
                </p>
              </div>
            </div>

            <Show when={!isApplyingUpdate()}>
              <button
                type="button"
                onClick={handleClose}
                class="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-subtle text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                aria-label={t().update.dismissBtn}
              >
                ✕
              </button>
            </Show>
          </div>

          {/* Version Comparison Card */}
          <div class="my-4 rounded-lg border border-border-subtle bg-bg-subtle/70 p-3.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="flex flex-col">
                  <span class="text-[10px] text-text-muted">{t().update.currentVersion}</span>
                  <span class="font-mono text-xs font-semibold text-text-secondary">
                    v{info()?.current_version}
                  </span>
                </div>

                <span class="text-text-muted font-bold text-sm px-1">➔</span>

                <div class="flex flex-col">
                  <span class="text-[10px] text-text-muted">{t().update.latestVersion}</span>
                  <span class="inline-flex items-center gap-1 font-mono text-xs font-bold text-status-success bg-status-success/15 px-2 py-0.5 rounded">
                    {info()?.latest_version}
                  </span>
                </div>
              </div>

              {/* Meta details */}
              <div class="flex items-center gap-2 text-[10px] font-mono text-text-muted">
                <Show when={formattedSize()}>
                  <span class="rounded bg-bg-surface px-2 py-0.5 border border-border-subtle">
                    📦 {formattedSize()}
                  </span>
                </Show>
                <Show when={formattedDate()}>
                  <span class="rounded bg-bg-surface px-2 py-0.5 border border-border-subtle">
                    🗓️ {formattedDate()}
                  </span>
                </Show>
              </div>
            </div>
          </div>

          {/* Release Notes Preview */}
          <div class="mb-4 space-y-1.5">
            <div class="text-xs font-semibold text-text-secondary flex items-center justify-between">
              <span>{t().update.releaseNotes}</span>
              <Show when={info()?.asset_name}>
                <span class="text-[10px] font-mono text-text-muted truncate max-w-[200px]">
                  {info()?.asset_name}
                </span>
              </Show>
            </div>
            <div class="max-h-48 overflow-y-auto rounded-lg border border-border-subtle bg-bg-base/80 p-3 text-xs text-text-secondary leading-relaxed font-mono whitespace-pre-wrap selection:bg-accent/30">
              {info()?.release_notes || 'No release notes.'}
            </div>
          </div>

          {/* Live Updating Progress View */}
          <Show when={isApplyingUpdate()}>
            <div class="mb-4 rounded-lg border border-accent/30 bg-accent/5 p-4 animate-pulse">
              <div class="flex items-center justify-between text-xs text-accent font-semibold mb-2">
                <span>{getStepText()}</span>
                <span class="font-mono">
                  {updateStep() === 'downloading'
                    ? '1/4'
                    : updateStep() === 'installing'
                    ? '2/4'
                    : updateStep() === 'restarting'
                    ? '3/4'
                    : '4/4'}
                </span>
              </div>
              <div class="h-1.5 w-full rounded-full bg-bg-subtle overflow-hidden">
                <div
                  class="h-full bg-accent transition-all duration-500 rounded-full"
                  style={{
                    width:
                      updateStep() === 'downloading'
                        ? '30%'
                        : updateStep() === 'installing'
                        ? '65%'
                        : updateStep() === 'restarting'
                        ? '85%'
                        : '100%',
                  }}
                />
              </div>
            </div>
          </Show>

          {/* Footer Actions */}
          <div class="flex items-center justify-between pt-3 border-t border-border-subtle">
            <a
              href="https://github.com/army-u8/workstation-monitor/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              class="text-[11px] text-text-muted hover:text-accent underline transition-colors"
            >
              {t().update.downloadManual} ↗
            </a>

            <div class="flex items-center gap-2">
              <Show when={!isApplyingUpdate()}>
                <button
                  type="button"
                  onClick={handleClose}
                  class="rounded-lg border border-border-default bg-bg-subtle px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
                >
                  {t().update.dismissBtn}
                </button>

                <Show when={info()?.has_update}>
                  <button
                    type="button"
                    onClick={handleApplyUpdate}
                    disabled={isCheckingUpdate() || isApplyingUpdate()}
                    class="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:brightness-110 active:scale-95 transition-all"
                  >
                    <span>🚀</span>
                    <span>{t().update.updateNowBtn}</span>
                  </button>
                </Show>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};
