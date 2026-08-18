import { Show, For, createMemo, createSignal, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import {
  applyUpdateApi,
  fetchUpdateCheckApi,
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
import {
  BoltIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  PackageIcon,
  RefreshIcon,
  RocketIcon,
} from './Icons';
import { Badge, Button } from './ui';
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
        {/* Modal Window */}
        <div class="relative w-full max-w-lg rounded-2xl border border-border-default bg-bg-modal p-6 shadow-2xl transition-all z-10">
          {/* Header */}
          <div class="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div class="flex items-center gap-2.5">
              <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent border border-accent/20">
                <RocketIcon class="h-4.5 w-4.5" />
              </span>
              <div>
                <h3 class="text-sm font-bold text-text-primary m-0">{t().update.modalTitle}</h3>
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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleClose}
                aria-label={t().update.dismissBtn}
              >
                <CloseIcon class="h-4 w-4" />
              </Button>
            </Show>
          </div>

          {/* Navigation Tabs */}
          <div class="flex items-center gap-2 mt-3 border-b border-border-subtle pb-2">
            <Button
              type="button"
              variant={activeTab() === 'upgrade' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('upgrade')}
            >
              {t().update.tabUpgrade}
            </Button>
            <Button
              type="button"
              variant={activeTab() === 'history' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setActiveTab('history');
                fetchVersionBackupsApi();
              }}
            >
              <span>{t().update.tabHistory}</span>
              <Show when={versionBackups().length > 0}>
                <span class="rounded-full bg-bg-surface px-1.5 py-0.2 text-[10px] mono font-bold text-accent border border-border-subtle ml-1">
                  {versionBackups().length}
                </span>
              </Show>
            </Button>
          </div>

          {/* TAB 1: UPGRADE OR ALREADY LATEST */}
          <Show when={activeTab() === 'upgrade'}>
            <Show
              when={info()?.has_update}
              fallback={
                /* ALREADY LATEST VERSION VIEW */
                <div class="my-3.5 space-y-3">
                  <div class="rounded-xl border border-status-success/30 bg-status-success/5 p-4 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-status-success/15 text-status-success">
                        <CheckIcon class="h-6 w-6" />
                      </span>
                      <div>
                        <div class="flex items-center gap-2">
                          <h4 class="text-xs font-bold text-text-primary m-0">
                            {t().update.latestBadge}
                          </h4>
                          <Badge variant="success">v{info()?.current_version}</Badge>
                        </div>
                        <p class="text-xs text-text-muted m-0 mt-0.5">
                          {t().update.latestSubtitle}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => fetchUpdateCheckApi(true)}
                      disabled={isCheckingUpdate()}
                      loading={isCheckingUpdate()}
                    >
                      <RefreshIcon
                        class="h-3.5 w-3.5"
                        classList={{ 'animate-spin': isCheckingUpdate() }}
                      />
                      <span>
                        {isCheckingUpdate() ? t().update.rechecking : t().update.recheckBtn}
                      </span>
                    </Button>
                  </div>

                  {/* Release Notes for Current Version */}
                  <Show when={info()?.release_notes}>
                    <div class="space-y-1.5">
                      <div class="text-xs font-semibold text-text-secondary flex items-center justify-between">
                        <span>{t().update.currentVersionNotes}</span>
                      </div>
                      <div class="max-h-48 overflow-y-auto rounded-lg border border-border-subtle bg-bg-base/80 p-3 text-xs text-text-secondary leading-relaxed font-mono whitespace-pre-wrap selection:bg-accent/30">
                        {info()?.release_notes}
                      </div>
                    </div>
                  </Show>
                </div>
              }
            >
              {/* NEW VERSION AVAILABLE VIEW */}
              <div class="my-3.5">
                {/* Version Comparison Card */}
                <div class="rounded-lg border border-border-subtle bg-bg-subtle/70 p-3.5 mb-3">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <div class="flex flex-col">
                        <span class="text-[10px] text-text-muted">{t().update.currentVersion}</span>
                        <span class="font-mono text-xs font-semibold text-text-secondary">
                          v{info()?.current_version}
                        </span>
                      </div>

                      <span class="text-text-muted font-bold text-xs px-1">→</span>

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
                        <span class="rounded bg-bg-surface px-2 py-0.5 border border-border-subtle flex items-center gap-1">
                          <PackageIcon class="h-3 w-3" />
                          <span>{formattedSize()}</span>
                        </span>
                      </Show>
                      <Show when={formattedDate()}>
                        <span class="rounded bg-bg-surface px-2 py-0.5 border border-border-subtle flex items-center gap-1">
                          <ClockIcon class="h-3 w-3" />
                          <span>{formattedDate()}</span>
                        </span>
                      </Show>
                    </div>
                  </div>
                </div>

                {/* Accelerator Channel Badge */}
                <div class="mb-3 flex items-center justify-between px-3 py-2 rounded-md bg-accent/10 border border-accent/20 text-xs text-accent">
                  <span class="flex items-center gap-1.5 font-medium">
                    <BoltIcon class="h-3.5 w-3.5" />
                    <span>{t().update.dualFeedBadge}</span>
                  </span>
                  <span class="text-[10px] font-mono opacity-80">
                    {navigator.platform || 'macOS'}
                  </span>
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
              </div>
            </Show>
          </Show>

          {/* TAB 2: VERSION ROLLBACK HISTORY */}
          <Show when={activeTab() === 'history'}>
            <div class="my-3.5 space-y-2">
              <div class="flex items-center justify-between text-xs text-text-muted">
                <span>{t().update.historyTitle}</span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => fetchVersionBackupsApi()}
                  disabled={isLoadingBackups()}
                  loading={isLoadingBackups()}
                >
                  {isLoadingBackups() ? t().update.refreshingBackups : t().update.refreshBackups}
                </Button>
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
                          <span class="text-[10px] text-text-muted mt-0.5 font-mono flex items-center gap-1">
                            <ClockIcon class="h-3 w-3" />
                            <span>{backup.created_at}</span>
                          </span>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRollback(backup.version)}
                          disabled={isApplyingUpdate()}
                        >
                          {t().update.rollbackBtn}
                        </Button>
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
                <Button type="button" variant="outline" onClick={handleClose}>
                  {info()?.has_update ? t().update.dismissBtn : t().update.closeBtn}
                </Button>

                <Show when={info()?.has_update && activeTab() === 'upgrade'}>
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleApplyUpdate}
                    disabled={isCheckingUpdate() || isApplyingUpdate()}
                    loading={isApplyingUpdate()}
                  >
                    <RocketIcon class="h-4 w-4" />
                    <span>{t().update.updateNowBtn}</span>
                  </Button>
                </Show>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};
