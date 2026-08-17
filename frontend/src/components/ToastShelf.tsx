import { For } from 'solid-js';
import type { Component } from 'solid-js';
import { toasts } from '../services/store';
import { ToastType } from '../constants';

export const ToastShelf: Component = () => {
  return (
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-1.5 pointer-events-none">
      <For each={toasts()}>
        {(toast) => {
          let badgeColor = 'bg-accent';
          if (toast.type === ToastType.SUCCESS) badgeColor = 'bg-status-success';
          if (toast.type === ToastType.ERROR) badgeColor = 'bg-status-danger';

          return (
            <div class="pointer-events-auto flex items-center gap-2 rounded-md border border-border-default bg-bg-modal/95 px-3 py-1.5 text-xs text-text-primary shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150">
              <span class={`h-1.5 w-1.5 rounded-full ${badgeColor}`} />
              <span class="font-mono text-[11px]">{toast.message}</span>
            </div>
          );
        }}
      </For>
    </div>
  );
};
