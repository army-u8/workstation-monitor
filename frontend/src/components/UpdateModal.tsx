import { Show, For, createMemo, createSignal, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import {
  applyUpdateApi,
  fetchVersionBackupsApi,
  isApplyingUpdate,
  isCheckingUpdate,
  isLoadingBackups,
  isUpdateModalOpen,
  rollbackUpdateApi,
  setIsUpdateModalOpen,
  updateInfo,
  updateProgressPayload,
  updateStep,
  versionBackups,
} from '../services/store';
import { t } from '../i18n';

export const UpdateModal: Component = () => {
  const [activeTab, setActiveTab] = createSignal<'upgrade' | 'history'>('upgrade');
  const info = () => updateInfo();

  onMount(() => {
    fetchVersionBackupsApi();
  });

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

  const handleRollback = async (version: string) => {
    const confirmed = window.confirm(t().update.rollbackConfirmMsg.replace('{version}', version));
    if (confirmed) {
      await rollbackUpdateApi(version);
    }
  };

  const getStepText = () => {
    const s = updateStep();
    const payload = updateProgressPayload()?.payload;
    if (payload?.step) return payload.step;
    const dict = t().update;
    if (s === 'downloading') return dict.stepDownloading;
    if (s === 'installing') return dict.stepInstalling;
    if (s === 'restarting') return dict.stepRestarting;
    if (s === 'reconnecting') return dict.stepReconnecting;
    return dict.checking;
  };

  const downloadPercent = () => {
    const p = updateProgressPayload()?.payload?.percent;
    if (typeof p === 'number') return p;
    const s = updateStep();
    if (s === 'downloading') return 45;
    if (s === 'installing') return 75;
    if (s === 'restarting') return 90;
    if (s === 'reconnecting') return 100;
    return 15;
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
          class="relative w-full max-w-xl overflow-hidden rounded-xl border border-border-default bg-bg-surface p-6 shadow-2xl transition-all"
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
                    : t().update.alreadyLatest.replace(
                        '{version}',
                        (info()?.current_version || '').replace(/^v/, ''),
                      )}
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

          {/* Navigation Tabs */}
          <div class="flex items-center gap-2 mt-3 border-b border-border-subtle pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('upgrade')}
              class={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                activeTab() === 'upgrade'
                  ? 'bg-accent text-white shadow-xs'
                  : 'bg-bg-subtle text-text-muted hover:text-text-primary'
              }`}
            >
              {t().update.tabUpgrade}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('history');
                fetchVersionBackupsApi();
              }}
              class={`px-3 py-1 text-xs rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                activeTab() === 'history'
                  ? 'bg-accent text-white shadow-xs'
                  : 'bg-bg-subtle text-text-muted hover:text-text-primary'
              }`}
            >
              <span>{t().update.tabHistory}</span>
              <Show when={versionBackups().length > 0}>
                <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                  {versionBackups().length}
                </span>
              </Show>
            </button>
          </div>

          {/* TAB 1: UPGRADE */}
          <Show when={activeTab() === 'upgrade'}>
            {/* Version Comparison Card */}
            <div class="my-3.5 rounded-lg border border-border-subtle bg-bg-subtle/70 p-3.5">
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

            {/* Accelerator Channel Badge */}
            <div class="mb-3 flex items-center justify-between px-3 py-2 rounded-md bg-accent/10 border border-accent/20 text-xs text-accent">
              <span class="flex items-center gap-1.5 font-medium">
                <span>⚡</span>
                <span>{t().update.dualFeedBadge}</span>
              </span>
              <span class="text-[10px] font-mono opacity-80">{navigator.platform || 'macOS'}</span>
            </div>

            {/* Release Notes Preview */}
            <div class="mb-4 space-y-1.5">
              <div class="text-xs font-semibold text-text-secondary flex items-center justify-between">
                <span>{t().update.releaseNotes}</span>
                <Show when={info()?.asset_name}>
                  <span class="text-[10px] font-mono text-text-muted truncate max-w-[240px]">
                    {info()?.asset_name}
                  </span>
                </Show>
              </div>
              <div class="max-h-44 overflow-y-auto rounded-lg border border-border-subtle bg-bg-base/80 p-3 text-xs text-text-secondary leading-relaxed font-mono whitespace-pre-wrap selection:bg-accent/30">
                {info()?.release_notes || 'No release notes.'}
              </div>
            </div>

            {/* Live Updating Progress View */}
            <Show when={isApplyingUpdate()}>
              <div class="mb-4 rounded-lg border border-accent/30 bg-accent/5 p-4 animate-pulse">
                <div class="flex items-center justify-between text-xs text-accent font-semibold mb-2">
                  <span>{getStepText()}</span>
                  <span class="font-mono">{downloadPercent()}%</span>
                </div>
                <div class="h-2 w-full rounded-full bg-bg-subtle overflow-hidden">
                  <div
                    class="h-full bg-accent transition-all duration-300 rounded-full"
                    style={{ width: `${downloadPercent()}%` }}
                  />
                </div>
              </div>
            </Show>
          </Show>

          {/* TAB 2: VERSION ROLLBACK HISTORY */}
          <Show when={activeTab() === 'history'}>
            <div class="my-3.5 space-y-2">
              <div class="flex items-center justify-between text-xs text-text-muted">
                <span>{t().update.historyTitle}</span>
                <button
                  type="button"
                  onClick={() => fetchVersionBackupsApi()}
                  disabled={isLoadingBackups()}
                  class="text-[11px] text-accent hover:underline"
                >
                  {isLoadingBackups() ? t().update.refreshingBackups : t().update.refreshBackups}
                </button>
              </div>

              <div class="max-h-60 overflow-y-auto space-y-2">
                <Show
                  when={versionBackups().length > 0}
                  fallback={
                    <div class="p-8 text-center text-xs text-text-muted border border-dashed border-border-subtle rounded-lg">
                      {t().update.historyEmpty}
                    </div>
                  }
                >
                  <For each={versionBackups()}>
                    {(backup) => (
                      <div class="flex items-center justify-between p-3 rounded-lg border border-border-subtle bg-bg-subtle/60 hover:bg-bg-subtle transition-colors">
                        <div class="flex flex-col">
                          <div class="flex items-center gap-2">
                            <span class="font-mono text-xs font-bold text-text-primary">
                              v{backup.version}
                            </span>
                            <span class="text-[10px] font-mono text-text-muted bg-bg-surface px-1.5 py-0.5 rounded border border-border-subtle">
                              {(backup.size_bytes / (1024 * 1024)).toFixed(1)} MB
                            </span>
                          </div>
                          <span class="text-[10px] text-text-muted mt-0.5 font-mono">
                            🗓️ {backup.created_at}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRollback(backup.version)}
                          disabled={isApplyingUpdate()}
                          class="px-2.5 py-1 text-xs font-medium rounded-md border border-border-subtle bg-bg-surface hover:bg-status-warning/15 hover:border-status-warning/30 hover:text-status-warning transition-colors"
                        >
                          {t().update.rollbackBtn}
                        </button>
                      </div>
                    )}
                  </For>
                </Show>
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

                <Show when={info()?.has_update && activeTab() === 'upgrade'}>
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
