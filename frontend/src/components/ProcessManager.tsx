import { For, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { copyToClipboard, killProcessApi, openConfirmDialog, processes } from '../services/store';
import { ProcessSortBy } from '../constants';
import { Button, Input } from './ui';
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
      message: t()
        .confirmDialog.killProcessWarning.replace('{name}', proc.name)
        .replace('{pid}', proc.pid.toString()),
      confirmText: t().confirmDialog.killProcessConfirmBtn,
      isDestructive: true,
      onConfirm: async () => {
        await killProcessApi(proc.pid);
      },
    });
  };

  return (
    <section aria-label={t().processes.title} class="glass-card flex flex-col p-4 shadow-xs">
      {/* Header & Controls */}
      <div class="mb-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-accent animate-pulse-dot" />
          <h2 class="text-xs font-bold text-text-primary m-0">{t().processes.title}</h2>
          <span class="text-[10px] font-mono text-text-muted bg-bg-subtle px-1.8 py-0.2 rounded border border-border-subtle">
            {t().processes.top50}
          </span>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <Input
            type="text"
            placeholder={t().processes.searchPlaceholder}
            value={filterQuery()}
            onInput={(e) => setFilterQuery(e.currentTarget.value)}
            aria-label={t().processes.searchPlaceholder}
            class="h-7.5 w-52"
          />

          {/* Sort Toggles */}
          <div
            class="flex items-center rounded-lg border border-border-subtle bg-bg-base/80 p-0.5"
            role="group"
            aria-label={t().processes.sortControlsLabel}
          >
            <Button
              type="button"
              variant={sortBy() === ProcessSortBy.CPU ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSortBy(ProcessSortBy.CPU)}
              aria-pressed={sortBy() === ProcessSortBy.CPU}
              class="font-mono text-[10.5px]"
            >
              {t().processes.sortByCpu}
            </Button>
            <Button
              type="button"
              variant={sortBy() === ProcessSortBy.MEM ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSortBy(ProcessSortBy.MEM)}
              aria-pressed={sortBy() === ProcessSortBy.MEM}
              class="font-mono text-[10.5px]"
            >
              {t().processes.sortByMem}
            </Button>
          </div>
        </div>
      </div>

      {/* Process Table */}
      <div class="max-h-[520px] overflow-y-auto rounded-lg border border-border-subtle bg-bg-base/60">
        <table class="w-full text-left text-xs border-collapse" aria-label={t().processes.listLabel}>
          <thead>
            <tr class="sticky top-0 z-10 border-b border-border-default bg-bg-subtle/90 text-[10.5px] font-bold text-text-muted uppercase tracking-wider backdrop-blur-xs">
              <th scope="col" class="py-2 px-3.5 w-16">
                PID
              </th>
              <th scope="col" class="py-2 px-3.5">
                {t().processes.thName}
              </th>
              <th scope="col" class="py-2 px-3.5 w-36">
                CPU %
              </th>
              <th scope="col" class="py-2 px-3.5 w-28">
                {t().processes.thMem}
              </th>
              <th scope="col" class="py-2 px-3.5 w-32 hidden md:table-cell">
                {t().processes.thDiskIo}
              </th>
              <th scope="col" class="py-2 px-3.5 text-right w-24">
                {t().processes.thAction}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle font-mono text-[11px]">
            <For
              each={filteredProcesses()}
              fallback={
                <tr>
                  <td colspan={6} class="py-10 text-center text-text-muted font-sans text-xs">
                    {t().processes.empty}
                  </td>
                </tr>
              }
            >
              {(proc) => {
                const cpu = proc.cpu_usage;
                let cpuColor = 'text-status-success';
                let barColor = 'bg-status-success';
                if (cpu >= 80) {
                  cpuColor = 'text-status-danger';
                  barColor = 'bg-status-danger';
                } else if (cpu >= 40) {
                  cpuColor = 'text-status-warning';
                  barColor = 'bg-status-warning';
                } else if (cpu >= 15) {
                  cpuColor = 'text-accent';
                  barColor = 'bg-accent';
                }

                return (
                  <tr class="hover:bg-bg-subtle/50 transition-colors group">
                    <td class="py-2 px-3.5 text-text-muted font-mono">{proc.pid}</td>
                    <td class="py-2 px-3.5 truncate max-w-[240px]">
                      <span class="font-bold text-text-primary truncate block" title={proc.name}>
                        {proc.name}
                      </span>
                    </td>
                    <td class="py-2 px-3.5">
                      <div class="flex items-center gap-2">
                        <span class={`font-bold tabular-nums w-12 shrink-0 ${cpuColor}`}>
                          {cpu.toFixed(1)}%
                        </span>
                        <div class="h-1.5 w-16 rounded-full bg-bg-subtle overflow-hidden border border-border-subtle/60 shrink-0">
                          <div
                            class={`h-full ${barColor} transition-all duration-300 rounded-full`}
                            style={{ width: `${Math.min(cpu, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td class="py-2 px-3.5 text-text-secondary font-medium tabular-nums">
                      {formatMem(proc.memory_bytes)}
                    </td>
                    <td class="py-2 px-3.5 text-text-muted text-[10px] hidden md:table-cell tabular-nums">
                      R: {formatIO(proc.disk_read_bytes)} / W: {formatIO(proc.disk_written_bytes)}
                    </td>
                    <td class="py-2 px-3.5 text-right whitespace-nowrap">
                      <div class="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(proc.pid.toString(), 'PID')}
                          title={t().devops.copy}
                        >
                          {t().devops.copy}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => confirmKill(proc)}
                        >
                          {t().processes.killBtn}
                        </Button>
                      </div>
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
