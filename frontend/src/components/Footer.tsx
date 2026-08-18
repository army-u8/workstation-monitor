import type { Component } from 'solid-js';
import { stats } from '../services/store';
import { t } from '../i18n';

export const Footer: Component = () => {
  const osDisplay = () => {
    const raw = stats()?.os_name || 'macOS';
    if (raw.toLowerCase() === 'darwin') return 'macOS Darwin';
    return raw;
  };

  return (
    <footer class="h-7 shrink-0 flex w-full items-center justify-between border-t border-border-default bg-bg-surface px-4 text-[10px] text-text-muted select-none">
      <div class="flex items-center gap-1.5">
        <span>
          {t().common.workstation} {t().common.console}
        </span>
        <span class="text-text-muted">/</span>
        <span class="text-text-secondary">{osDisplay()}</span>
      </div>
      <div class="flex items-center gap-1.5 mono">
        <span>
          {t().common.cpu}: {(stats()?.cpu_usage || 0).toFixed(0)}%
        </span>
        <span class="text-text-muted">/</span>
        <span>
          {t().common.memory}: {(stats()?.memory_percent || 0).toFixed(0)}%
        </span>
      </div>
    </footer>
  );
};
