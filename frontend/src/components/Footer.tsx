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
    <footer class="h-7 shrink-0 flex w-full items-center justify-between border-t border-border-default/70 bg-bg-surface/90 backdrop-blur-xs px-4 text-[10px] text-text-muted select-none">
      <div class="flex items-center gap-2">
        <span class="font-bold text-text-secondary">
          {t().common.workstation} {t().common.console}
        </span>
        <span class="text-text-muted/40 font-mono">/</span>
        <span class="text-text-muted font-medium">{osDisplay()}</span>
      </div>
      <div class="flex items-center gap-2 mono text-[10.5px]">
        <span class="font-medium">
          {t().common.cpu}:{' '}
          <strong class="text-text-primary font-bold">
            {(stats()?.cpu_usage || 0).toFixed(0)}%
          </strong>
        </span>
        <span class="text-text-muted/40">/</span>
        <span class="font-medium">
          {t().common.memory}:{' '}
          <strong class="text-text-primary font-bold">
            {(stats()?.memory_percent || 0).toFixed(0)}%
          </strong>
        </span>
      </div>
    </footer>
  );
};
