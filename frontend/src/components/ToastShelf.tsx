import { For } from 'solid-js';
import type { Component } from 'solid-js';
import { toasts } from '../services/store';
import { ToastType } from '../constants';

export const ToastShelf: Component = () => {
  return (
    <div class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      <For each={toasts()}>
        {(toast) => {
          let badgeColor = 'bg-accent shadow-[0_0_8px_rgba(56,189,248,0.8)]';
          let borderClass = 'border-border-default';
          if (toast.type === ToastType.SUCCESS) {
            badgeColor = 'bg-status-success shadow-[0_0_8px_rgba(52,211,153,0.8)]';
            borderClass = 'border-status-success/30';
          }
          if (toast.type === ToastType.ERROR) {
            badgeColor = 'bg-status-danger shadow-[0_0_8px_rgba(248,113,113,0.8)]';
            borderClass = 'border-status-danger/30';
          }

          return (
            <div
              class={`pointer-events-auto flex items-center gap-2.5 rounded-lg border ${borderClass} bg-bg-modal/95 px-3.5 py-2 text-xs font-semibold text-text-primary shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150`}
            >
              <span class={`h-2 w-2 rounded-full ${badgeColor} animate-pulse-dot`} />
              <span class="font-mono text-[11.5px]">{toast.message}</span>
            </div>
          );
        }}
      </For>
    </div>
  );
};
