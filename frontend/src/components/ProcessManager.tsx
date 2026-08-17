import { For, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { Tooltip } from '@kobalte/core/tooltip';
import { copyToClipboard, killProcessApi, openConfirmDialog, processes } from '../services/store';
import { ProcessSortBy } from '../constants';
import type { ProcessInfo } from '../types';
import { t } from '../i18n';

export const ProcessManager: Component = () => {
  const [filterQuery, setFilterQuery] = createSignal('');
  const [sortBy, setSortBy] = createSignal<ProcessSortBy>(ProcessSortBy.CPU);

  const formatMem = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatIO = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    if (bytes >= 1024) {
      return (bytes / 1024).toFixed(0) + ' KB';
    }
    return bytes + ' B';
  };

  const filteredProcesses = () => {
    const list = [...processes()];
    const q = filterQuery().trim().toLowerCase();

    const filtered = q
      ? list.filter((p) => p.name.toLowerCase().includes(q) || p.pid.toString().includes(q))
      : list;

    if (sortBy() === ProcessSortBy.CPU) {
      return filtered.sort((a, b) => b.cpu_usage - a.cpu_usage);
    } else {
      return filtered.sort((a, b) => b.memory_bytes - a.memory_bytes);
    }
  };

  const confirmKill = (proc: ProcessInfo) => {
    openConfirmDialog({
      title: t().confirmDialog.killProcessTitle,
      message: t().confirmDialog.killProcessWarning
        .replace('{name}', proc.name)
        .replace('{pid}', proc.pid.toString()),
      confirmText: t().confirmDialog.killProcessConfirmBtn,
      isDestructive: true,
      onConfirm: async () => {
        await killProcessApi(proc.pid);
      },
    });
  };

  return (
    <section aria-label={t().processes.title} class="flex flex-col rounded-lg border border-border-default bg-bg-surface p-3.5">
      {/* Header & Controls */}
      <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-2">
          <h2 class="text-xs font-semibold text-text-primary">{t().processes.title}</h2>
          <span class="text-[10px] text-text-muted mono">{t().processes.top50}</span>
        </div>

        <div class="flex items-center gap-2">
          {/* Search Box */}
          <input
            type="text"
            placeholder={t().processes.searchPlaceholder}
            value={filterQuery()}
            onInput={(e) => setFilterQuery(e.currentTarget.value)}
            aria-label={t().processes.searchPlaceholder}
            class="h-7 w-48 rounded border border-border-default bg-bg-input px-2 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
          />

          {/* Sort Toggles */}
          <div class="flex items-center rounded border border-border-default bg-bg-subtle p-0.5" role="group" aria-label="Sort Processes">
            <button
              type="button"
              onClick={() => setSortBy(ProcessSortBy.CPU)}
              aria-pressed={sortBy() === ProcessSortBy.CPU}
              class="rounded px-2 py-0.5 text-[10px] transition-colors focus-visible:ring-1 focus-visible:ring-accent"
              classList={{
                'bg-bg-active text-text-primary font-semibold shadow-xs': sortBy() === ProcessSortBy.CPU,
                'text-text-muted hover:text-text-primary': sortBy() !== ProcessSortBy.CPU,
              }}
            >
              {t().processes.sortByCpu}
            </button>
            <button
              type="button"
              onClick={() => setSortBy(ProcessSortBy.MEM)}
              aria-pressed={sortBy() === ProcessSortBy.MEM}
              class="rounded px-2 py-0.5 text-[10px] transition-colors focus-visible:ring-1 focus-visible:ring-accent"
              classList={{
                'bg-bg-active text-text-primary font-semibold shadow-xs': sortBy() === ProcessSortBy.MEM,
                'text-text-muted hover:text-text-primary': sortBy() !== ProcessSortBy.MEM,
              }}
            >
              {t().processes.sortByMem}
            </button>
          </div>
        </div>
      </div>

      {/* Process Table */}
      <div class="overflow-x-auto rounded border border-border-subtle">
        <table class="w-full text-left text-xs" aria-label="Process List">
          <thead>
            <tr class="border-b border-border-subtle bg-bg-subtle/50 text-[10px] uppercase tracking-wider text-text-muted">
              <th class="py-2 px-3 font-medium">{t().processes.thPid}</th>
              <th class="py-2 px-3 font-medium">{t().processes.thName}</th>
              <th class="py-2 px-3 font-medium">{t().processes.thCpu}</th>
              <th class="py-2 px-3 font-medium">{t().processes.thMem}</th>
              <th class="py-2 px-3 font-medium">{t().processes.thDiskIo}</th>
              <th class="py-2 px-3 font-medium text-center">{t().processes.thStatus}</th>
              <th class="py-2 px-3 font-medium text-right">{t().common.actions}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle/60">
            <For
              each={filteredProcesses()}
              fallback={
                <tr>
                  <td colspan="7" class="py-8 text-center text-xs text-text-muted font-mono">
                    {t().processes.empty}
                  </td>
                </tr>
              }
            >
              {(proc) => {
                const cpu = proc.cpu_usage;

                return (
                  <tr class="hover:bg-bg-hover/40 transition-colors group">
                    {/* PID */}
                    <td class="py-1.5 px-3 mono text-[11px] text-text-muted">
                      <Tooltip>
                        <Tooltip.Trigger
                          type="button"
                          onClick={() => copyToClipboard(proc.pid.toString(), 'PID')}
                          class="hover:text-accent focus-visible:ring-1 focus-visible:ring-accent rounded transition-colors"
                          aria-label={`Copy PID ${proc.pid}`}
                        >
                          {proc.pid}
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content class="rounded bg-bg-modal px-2 py-1 text-[10px] text-text-primary border border-border-default shadow-lg">
                            Copy PID
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip>
                    </td>

                    {/* Process Name */}
                    <td class="py-1.5 px-3 max-w-[200px] sm:max-w-[280px]">
                      <div class="flex items-center gap-1.5">
                        <span class="font-medium text-text-primary truncate" title={proc.name}>
                          {proc.name}
                        </span>
                      </div>
                    </td>

                    {/* CPU Usage & Progress */}
                    <td class="py-1.5 px-3">
                      <div class="flex items-center gap-2">
                        <div class="w-12 h-1.5 rounded-full bg-bg-subtle overflow-hidden">
                          <div
                            class="h-full transition-all duration-300 rounded-full"
                            classList={{
                              'bg-status-danger': cpu > 80,
                              'bg-status-warning': cpu <= 80 && cpu > 30,
                              'bg-accent': cpu <= 30,
                            }}
                            style={{
                              width: `${Math.min(cpu, 100)}%`,
                            }}
                          />
                        </div>
                        <span class="mono text-[11px] text-text-secondary">
                          {cpu.toFixed(1)}%
                        </span>
                      </div>
                    </td>

                    {/* Memory */}
                    <td class="py-1.5 px-3">
                      <div class="flex items-baseline gap-1">
                        <span class="mono text-[11px] text-text-primary">
                          {formatMem(proc.memory_bytes)}
                        </span>
                        <span class="mono text-[9px] text-text-muted">
                          {proc.memory_percent.toFixed(0)}%
                        </span>
                      </div>
                    </td>

                    {/* Disk I/O */}
                    <td class="py-1.5 px-3 font-mono text-[9.5px] text-text-muted">
                      <span>↓{formatIO(proc.disk_read_bytes)} ↑{formatIO(proc.disk_written_bytes)}</span>
                    </td>

                    {/* Status */}
                    <td class="py-1.5 px-3 text-center">
                      <span class="text-[9.5px] text-text-muted font-mono">
                        {proc.status}
                      </span>
                    </td>

                    {/* Actions with Secondary Confirmation */}
                    <td class="py-1.5 px-3 text-right">
                      <button
                        type="button"
                        aria-label={`${t().processes.killBtn} ${proc.name} (PID: ${proc.pid})`}
                        onClick={() => confirmKill(proc)}
                        class="rounded px-2 py-0.5 text-[10px] text-status-danger bg-status-danger/10 hover:bg-status-danger hover:text-white transition-colors focus-visible:ring-1 focus-visible:ring-status-danger font-medium"
                      >
                        {t().processes.killBtn}
                      </button>
                    </td>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
      </div>
    </section>
  );
};
