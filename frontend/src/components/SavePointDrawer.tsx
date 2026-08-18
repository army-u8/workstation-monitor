import { For, Show, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import {
  activeSnapshotPath,
  closeSnapshotDrawer,
  createSnapshotApi,
  isCreatingSnapshot,
  isLoadingSnapshots,
  isRollingBackSnapshot,
  isSnapshotDrawerOpen,
  openConfirmDialog,
  rollbackSnapshotApi,
  snapshotsData,
} from '../services/store';
import { t } from '../i18n';
import type { SavePointSnapshot } from '../types';

export const SavePointDrawer: Component = () => {
  const [newTitle, setNewTitle] = createSignal('');

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    const path = activeSnapshotPath();
    if (!path) return;
    const title = newTitle().trim();
    const success = await createSnapshotApi(path, title);
    if (success) {
      setNewTitle('');
    }
  };

  const handleRollback = (snap: SavePointSnapshot) => {
    const path = activeSnapshotPath();
    if (!path || snap.is_head) return;

    openConfirmDialog({
      title: t().snapshots.confirmRollbackTitle,
      message: t()
        .snapshots.confirmRollbackWarning.replace('{hash}', snap.short_hash)
        .replace('{title}', snap.title),
      confirmText: t().snapshots.confirmRollbackBtn,
      isDestructive: true,
      onConfirm: async () => {
        await rollbackSnapshotApi(path, snap.commit_hash, true);
      },
    });
  };

  return (
    <Show when={isSnapshotDrawerOpen()}>
      <div class="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <div
          onClick={closeSnapshotDrawer}
          class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        />

        {/* Drawer Panel */}
        <div class="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-border-default bg-bg-surface shadow-2xl animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div class="flex items-center justify-between border-b border-border-default px-5 py-4 bg-bg-surface/95 backdrop-blur-xs">
            <div class="flex items-center gap-3">
              <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent text-lg">
                ⏳
              </span>
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="text-sm font-bold text-text-primary m-0">
                    {snapshotsData()?.project_name || t().snapshots.drawerTitle}
                  </h2>
                  <Show when={snapshotsData()}>
                    {(data) => (
                      <span class="rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.2 mono text-[10px] text-text-muted">
                        🌿 {data().current_branch}
                      </span>
                    )}
                  </Show>
                </div>
                <p class="text-xs text-text-muted m-0 mt-0.5">{t().snapshots.drawerSubtitle}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeSnapshotDrawer}
              class="rounded-lg p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary transition-colors"
              aria-label={t().common.cancel}
            >
              ✕
            </button>
          </div>

          {/* Body Content */}
          <div class="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Uncommitted Warning Sentinel */}
            <Show when={snapshotsData()?.is_dirty}>
              <div class="rounded-lg border border-status-warning/40 bg-status-warning/10 p-3 flex items-center justify-between">
                <div class="flex items-center gap-2 text-xs text-status-warning font-medium">
                  <span>⚠️</span>
                  <span>
                    {t().snapshots.uncommittedNotice.replace(
                      '{count}',
                      (snapshotsData()?.uncommitted_count || 0).toString(),
                    )}
                  </span>
                </div>
                <span class="text-[11px] text-text-muted">{t().snapshots.recommendTip}</span>
              </div>
            </Show>

            {/* Quick Save Card */}
            <div class="rounded-xl border border-accent/40 bg-accent/5 p-4 shadow-2xs">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="text-base">📸</span>
                  <h3 class="text-xs font-bold text-text-primary m-0">
                    {t().snapshots.recordTitle}
                  </h3>
                </div>
                <span class="text-[10px] text-text-muted">{t().snapshots.backupNotice}</span>
              </div>
              <p class="text-xs text-text-muted mb-3">{t().snapshots.recordDesc}</p>

              <form onSubmit={handleCreate} class="flex gap-2">
                <input
                  type="text"
                  placeholder={t().snapshots.recordPlaceholder}
                  value={newTitle()}
                  onInput={(e) => setNewTitle(e.currentTarget.value)}
                  class="flex-1 rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-primary placeholder:text-text-muted outline-hidden focus:border-accent focus-visible:ring-1 focus-visible:ring-accent"
                />
                <button
                  type="submit"
                  disabled={isCreatingSnapshot()}
                  class="shrink-0 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white shadow-xs hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
                >
                  {isCreatingSnapshot() ? t().snapshots.recording : t().snapshots.recordBtn}
                </button>
              </form>
            </div>

            {/* Timeline Section */}
            <div>
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-xs font-semibold text-text-primary m-0 flex items-center gap-1.5">
                  <span>{t().snapshots.timelineTitle}</span>
                  <Show when={snapshotsData()?.snapshots.length}>
                    <span class="rounded-full bg-bg-subtle px-2 py-0.2 mono text-[10px] text-text-muted">
                      {snapshotsData()?.snapshots.length}
                    </span>
                  </Show>
                </h3>
              </div>

              {/* Timeline Container */}
              <Show
                when={!isLoadingSnapshots()}
                fallback={
                  <div class="py-12 text-center text-xs text-text-muted font-mono animate-pulse">
                    {t().snapshots.timelineLoading}
                  </div>
                }
              >
                <div class="relative border-l-2 border-border-subtle ml-3.5 space-y-4 pl-5">
                  <For
                    each={snapshotsData()?.snapshots || []}
                    fallback={
                      <div class="py-8 text-center text-xs text-text-muted">
                        {t().snapshots.emptySnapshots}
                      </div>
                    }
                  >
                    {(snap) => (
                      <div
                        class="relative rounded-lg border p-3 transition-all"
                        classList={{
                          'border-accent/60 bg-accent/5 shadow-xs': snap.is_head,
                          'border-border-default bg-bg-surface hover:border-border-hover':
                            !snap.is_head,
                        }}
                      >
                        {/* Timeline Node Icon */}
                        <span
                          class="absolute -left-[27px] top-3.5 flex h-4 w-4 items-center justify-center rounded-full border-2 bg-bg-surface text-[9px]"
                          classList={{
                            'border-accent text-accent ring-2 ring-accent/30': snap.is_head,
                            'border-status-success text-status-success':
                              !snap.is_head && snap.is_save_point,
                            'border-border-subtle text-text-muted':
                              !snap.is_head && !snap.is_save_point,
                          }}
                        >
                          {snap.is_head ? '●' : snap.is_save_point ? '📸' : '○'}
                        </span>

                        <div class="flex items-start justify-between gap-2">
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                              <Show
                                when={snap.is_save_point}
                                fallback={
                                  <span class="rounded bg-bg-subtle px-1.5 py-0.2 text-[9.5px] mono text-text-muted">
                                    {t().snapshots.normalCommit}
                                  </span>
                                }
                              >
                                <span class="rounded bg-status-success/15 px-1.5 py-0.2 text-[9.5px] font-semibold text-status-success">
                                  {t().snapshots.savePointTag}
                                </span>
                              </Show>

                              <Show when={snap.is_head}>
                                <span class="rounded bg-accent px-1.5 py-0.2 text-[9.5px] font-bold text-white uppercase tracking-wider">
                                  {t().snapshots.currentHead}
                                </span>
                              </Show>

                              <span class="mono text-[10px] text-text-muted">
                                #{snap.short_hash}
                              </span>
                            </div>

                            <h4
                              class="text-xs font-semibold text-text-primary mt-1.5 mb-1 leading-snug break-words"
                              title={snap.title}
                            >
                              {snap.title}
                            </h4>

                            <div class="flex items-center gap-3 text-[10.5px] text-text-muted">
                              <span>⏱️ {snap.relative_time}</span>
                              <span>👤 {snap.author}</span>
                            </div>
                          </div>

                          {/* Rollback Action Button */}
                          <Show when={!snap.is_head}>
                            <button
                              type="button"
                              onClick={() => handleRollback(snap)}
                              disabled={isRollingBackSnapshot()}
                              class="shrink-0 rounded-lg border border-border-default bg-bg-subtle px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-status-warning/15 hover:border-status-warning/50 hover:text-status-warning active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-accent"
                              title={t().snapshots.rollbackPointTip}
                            >
                              {isRollingBackSnapshot()
                                ? t().snapshots.rollingBack
                                : t().snapshots.rollbackBtn}
                            </button>
                          </Show>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};
export default SavePointDrawer;
