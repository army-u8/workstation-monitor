import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { closeConfirmDialog, confirmModal } from '../services/store';
import { AlertWarningIcon } from './Icons';
import { t } from '../i18n';

export const ConfirmModal: Component = () => {
  const [isProcessing, setIsProcessing] = createSignal(false);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!confirmModal()) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeConfirmDialog();
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
  });

  const handleConfirm = async () => {
    const modal = confirmModal();
    if (!modal) return;
    setIsProcessing(true);
    try {
      await modal.onConfirm();
    } finally {
      setIsProcessing(false);
      closeConfirmDialog();
    }
  };

  return (
    <Show when={confirmModal()}>
      {(modal) => (
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeConfirmDialog();
          }}
        >
          <div class="relative w-full max-w-md rounded-xl border border-border-strong bg-bg-modal p-5 shadow-2xl transition-all duration-200 animate-in fade-in zoom-in-95">
            {/* Header with Danger/Warning Icon */}
            <div class="flex items-start gap-3.5">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-base shadow-xs"
                classList={{
                  'bg-status-danger-bg text-status-danger border-status-danger/25':
                    modal().isDestructive !== false,
                  'bg-status-warning-bg text-status-warning border-status-warning/25':
                    modal().isDestructive === false,
                }}
              >
                <Show
                  when={modal().isDestructive !== false}
                  fallback={<AlertWarningIcon class="h-5 w-5" />}
                >
                  <svg
                    class="h-5 w-5 text-status-danger"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </Show>
              </div>

              <div class="flex-1 min-w-0">
                <h2 id="confirm-dialog-title" class="text-sm font-bold text-text-primary">
                  {modal().title}
                </h2>
                <p class="mt-1.5 text-xs leading-relaxed text-text-secondary">{modal().message}</p>
              </div>
            </div>

            {/* Actions Bar */}
            <div class="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
              <button
                type="button"
                onClick={closeConfirmDialog}
                disabled={isProcessing()}
                class="rounded-lg border border-border-default bg-bg-subtle px-3.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
              >
                {modal().cancelText || t().common.cancel}
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={isProcessing()}
                class="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors focus-visible:ring-2 disabled:opacity-50"
                classList={{
                  'bg-status-danger hover:bg-status-danger/90 focus-visible:ring-status-danger':
                    modal().isDestructive !== false,
                  'bg-accent hover:bg-accent-hover focus-visible:ring-accent':
                    modal().isDestructive === false,
                }}
              >
                <Show when={isProcessing()}>
                  <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                </Show>
                <span>{modal().confirmText || t().common.confirm}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};
