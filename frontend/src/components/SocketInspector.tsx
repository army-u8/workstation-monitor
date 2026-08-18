import { For, Show, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { Tabs } from '@kobalte/core/tabs';
import { Tooltip } from '@kobalte/core/tooltip';
import { copyToClipboard, killPortApi, openConfirmDialog, sockets } from '../services/store';
import { SocketCategoryFilter, SocketState, SocketTab } from '../constants';
import type { SocketEntry } from '../types';
import { t } from '../i18n';

export const SocketInspector: Component = () => {
  const [activeTab, setActiveTab] = createSignal<SocketTab>(SocketTab.LISTENING);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [categoryFilter, setCategoryFilter] = createSignal<SocketCategoryFilter>(
    SocketCategoryFilter.ALL,
  );

  const isMatchingCategory = (port: number, processName: string) => {
    const filter = categoryFilter();
    if (!filter) return true;

    if (filter === SocketCategoryFilter.WEB) {
      return (
        [80, 443, 8080, 8443, 3000, 5173, 8000, 9527, 9528].includes(port) ||
        processName.toLowerCase().includes('nginx') ||
        processName.toLowerCase().includes('node') ||
        processName.toLowerCase().includes('vite') ||
        processName.toLowerCase().includes('caddy')
      );
    }
    if (filter === SocketCategoryFilter.DB) {
      return (
        [3306, 5432, 6379, 27017, 9200, 9042, 1433].includes(port) ||
        processName.toLowerCase().includes('mysql') ||
        processName.toLowerCase().includes('postgres') ||
        processName.toLowerCase().includes('redis') ||
        processName.toLowerCase().includes('mongo')
      );
    }
    if (filter === SocketCategoryFilter.DEV) {
      return (
        [3000, 3001, 5173, 5174, 8080, 8000, 9527, 9528, 4000].includes(port) ||
        processName.toLowerCase().includes('workstation') ||
        processName.toLowerCase().includes('next') ||
        processName.toLowerCase().includes('rust')
      );
    }
    return true;
  };

  const filteredListeningPorts = () => {
    const list = sockets()?.listening_ports || [];
    const q = searchQuery().trim().toLowerCase();

    return list.filter((item: SocketEntry) => {
      const matchesSearch =
        !q ||
        item.local_port.toString().includes(q) ||
        (item.process_name && item.process_name.toLowerCase().includes(q)) ||
        (item.pid && item.pid.toString().includes(q)) ||
        item.local_ip.toLowerCase().includes(q);

      const matchesCat = isMatchingCategory(item.local_port, item.process_name || '');
      return matchesSearch && matchesCat;
    });
  };

  const filteredActiveConnections = () => {
    const list = sockets()?.active_connections || [];
    const q = searchQuery().trim().toLowerCase();

    return list.filter((item: SocketEntry) => {
      return (
        !q ||
        item.local_port.toString().includes(q) ||
        (item.remote_port && item.remote_port.toString().includes(q)) ||
        (item.process_name && item.process_name.toLowerCase().includes(q)) ||
        (item.pid && item.pid.toString().includes(q)) ||
        (item.remote_ip && item.remote_ip.toLowerCase().includes(q)) ||
        item.state.toLowerCase().includes(q)
      );
    });
  };

  const confirmKillPort = (item: SocketEntry) => {
    openConfirmDialog({
      title: t().confirmDialog.killPortTitle,
      message: t()
        .confirmDialog.killPortWarning.replace('{name}', item.process_name || 'Process')
        .replace('{pid}', item.pid?.toString() || '-')
        .replace('{port}', item.local_port.toString()),
      confirmText: t().confirmDialog.killPortConfirmBtn,
      isDestructive: true,
      onConfirm: async () => {
        await killPortApi(item.local_port);
      },
    });
  };

  return (
    <section
      aria-label={t().sockets.listeningTab}
      class="flex flex-col rounded-lg border border-border-default bg-bg-surface p-3.5"
    >
      {/* Kobalte Tabs Component for Accessible Tab Switching */}
      <Tabs
        value={activeTab()}
        onChange={(val) => setActiveTab(val as SocketTab)}
        class="w-full flex flex-col"
      >
        {/* Controls Toolbar with TabList */}
        <div class="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <Tabs.List
            class="flex rounded-md bg-bg-input p-0.5 border border-border-subtle text-[11px]"
            aria-label="Sockets tab navigation"
          >
            <Tabs.Trigger
              value={SocketTab.LISTENING}
              class="rounded px-2.5 py-0.5 font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-accent"
              classList={{
                'bg-bg-active text-text-primary': activeTab() === SocketTab.LISTENING,
                'text-text-muted hover:text-text-primary': activeTab() !== SocketTab.LISTENING,
              }}
            >
              {t().sockets.listeningTab}
              <Show when={sockets()?.listening_ports?.length}>
                <span class="ml-1.5 mono text-[9.5px] text-text-muted">
                  {sockets()?.listening_ports?.length}
                </span>
              </Show>
            </Tabs.Trigger>

            <Tabs.Trigger
              value={SocketTab.ACTIVE}
              class="rounded px-2.5 py-0.5 font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-accent"
              classList={{
                'bg-bg-active text-text-primary': activeTab() === SocketTab.ACTIVE,
                'text-text-muted hover:text-text-primary': activeTab() !== SocketTab.ACTIVE,
              }}
            >
              {t().sockets.activeTab}
              <Show when={sockets()?.active_connections?.length}>
                <span class="ml-1.5 mono text-[9.5px] text-text-muted">
                  {sockets()?.active_connections?.length}
                </span>
              </Show>
            </Tabs.Trigger>
          </Tabs.List>

          {/* Search Box & Category Filters */}
          <div class="flex flex-wrap items-center gap-2">
            <div class="relative flex items-center">
              <input
                type="text"
                aria-label={t().sockets.searchPlaceholder}
                placeholder={t().sockets.searchPlaceholder}
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                class="w-48 rounded border border-border-default bg-bg-input py-1 pl-2.5 pr-6 text-[11px] text-text-primary placeholder:text-text-muted outline-none transition-all focus:border-border-strong focus-visible:ring-1 focus-visible:ring-accent"
              />
              <Show when={searchQuery()}>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={t().common.cancel}
                  class="absolute right-1.5 text-[10px] text-text-muted hover:text-text-primary"
                >
                  ✕
                </button>
              </Show>
            </div>

            {/* Category Filter Pills (Only on Listening Tab) */}
            <Show when={activeTab() === SocketTab.LISTENING}>
              <div
                class="flex items-center rounded-md border border-border-subtle bg-bg-input p-0.5 text-[10px]"
                role="group"
                aria-label="Category filter"
              >
                <button
                  type="button"
                  onClick={() => setCategoryFilter(SocketCategoryFilter.ALL)}
                  class="rounded px-1.5 py-0.2 transition-colors focus-visible:ring-1 focus-visible:ring-accent"
                  classList={{
                    'bg-bg-active text-text-primary font-medium':
                      categoryFilter() === SocketCategoryFilter.ALL,
                    'text-text-muted hover:text-text-primary':
                      categoryFilter() !== SocketCategoryFilter.ALL,
                  }}
                >
                  {t().sockets.filterAll}
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter(SocketCategoryFilter.WEB)}
                  class="rounded px-1.5 py-0.2 transition-colors focus-visible:ring-1 focus-visible:ring-accent"
                  classList={{
                    'bg-bg-active text-text-primary font-medium':
                      categoryFilter() === SocketCategoryFilter.WEB,
                    'text-text-muted hover:text-text-primary':
                      categoryFilter() !== SocketCategoryFilter.WEB,
                  }}
                >
                  {t().sockets.filterWeb}
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter(SocketCategoryFilter.DB)}
                  class="rounded px-1.5 py-0.2 transition-colors focus-visible:ring-1 focus-visible:ring-accent"
                  classList={{
                    'bg-bg-active text-text-primary font-medium':
                      categoryFilter() === SocketCategoryFilter.DB,
                    'text-text-muted hover:text-text-primary':
                      categoryFilter() !== SocketCategoryFilter.DB,
                  }}
                >
                  {t().sockets.filterDb}
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter(SocketCategoryFilter.DEV)}
                  class="rounded px-1.5 py-0.2 transition-colors focus-visible:ring-1 focus-visible:ring-accent"
                  classList={{
                    'bg-bg-active text-text-primary font-medium':
                      categoryFilter() === SocketCategoryFilter.DEV,
                    'text-text-muted hover:text-text-primary':
                      categoryFilter() !== SocketCategoryFilter.DEV,
                  }}
                >
                  {t().sockets.filterDev}
                </button>
              </div>
            </Show>
          </div>
        </div>

        {/* Tab 1: Listening Ports Table */}
        <Tabs.Content value={SocketTab.LISTENING} class="outline-none">
          <div class="max-h-[460px] overflow-y-auto rounded-md border border-border-subtle bg-bg-input">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="sticky top-0 z-10 border-b border-border-default bg-bg-subtle text-[10.5px] text-text-muted">
                  <th scope="col" class="py-1.5 px-3 font-medium w-16">
                    {t().sockets.thProto}
                  </th>
                  <th scope="col" class="py-1.5 px-3 font-medium w-24">
                    {t().sockets.thLocalPort}
                  </th>
                  <th scope="col" class="py-1.5 px-3 font-medium">
                    {t().sockets.thBindAddr}
                  </th>
                  <th scope="col" class="py-1.5 px-3 font-medium">
                    {t().sockets.thProcess}
                  </th>
                  <th scope="col" class="py-1.5 px-3 font-medium w-20 text-right">
                    {t().sockets.thPid}
                  </th>
                  <th scope="col" class="py-1.5 px-3 font-medium w-20 text-right">
                    {t().common.actions}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle">
                <For
                  each={filteredListeningPorts()}
                  fallback={
                    <tr>
                      <td colspan="6" class="py-8 text-center text-xs text-text-muted font-mono">
                        {t().sockets.empty}
                      </td>
                    </tr>
                  }
                >
                  {(item) => (
                    <tr class="hover:bg-bg-hover transition-colors">
                      <td class="py-1.5 px-3 font-mono">
                        <span class="rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.2 text-[9.5px] text-accent">
                          {item.protocol}
                        </span>
                      </td>

                      {/* Port with Tooltip */}
                      <td class="py-1.5 px-3 font-mono">
                        <Tooltip>
                          <Tooltip.Trigger
                            as="button"
                            type="button"
                            aria-label={`Port ${item.local_port}`}
                            onClick={() => copyToClipboard(item.local_port.toString(), 'Port')}
                            class="font-semibold text-text-primary hover:text-accent outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
                          >
                            :{item.local_port}
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content class="z-50 rounded bg-bg-modal px-2 py-1 text-[10px] text-text-primary shadow-md border border-border-default animate-in fade-in duration-100 font-sans">
                              <span>
                                {t().sockets.copyPortTooltip.replace(
                                  '{port}',
                                  item.local_port.toString(),
                                )}
                              </span>
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip>
                      </td>

                      <td class="py-1.5 px-3 font-mono text-[11px] text-text-muted">
                        {item.local_ip}
                      </td>

                      <td class="py-1.5 px-3 font-medium text-text-primary truncate max-w-[200px]">
                        {item.process_name || (
                          <span class="text-text-muted font-normal italic">
                            {t().sockets.kernel}
                          </span>
                        )}
                      </td>

                      <td class="py-1.5 px-3 font-mono text-right text-text-muted text-[11px]">
                        {item.pid ? (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.pid?.toString() || '', 'PID')}
                            class="hover:text-accent outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
                            title="PID"
                          >
                            {item.pid}
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* Kill Port Action with Secondary Confirmation */}
                      <td class="py-1.5 px-3 text-right">
                        <button
                          type="button"
                          aria-label={`Kill port ${item.local_port}`}
                          onClick={() => confirmKillPort(item)}
                          class="rounded px-2 py-0.5 text-[10px] text-status-danger bg-status-danger/10 hover:bg-status-danger hover:text-white transition-colors focus-visible:ring-1 focus-visible:ring-status-danger font-medium"
                        >
                          {t().devops.portBtn}
                        </button>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Tabs.Content>

        {/* Tab 2: Active Connections Table */}
        <Tabs.Content value={SocketTab.ACTIVE} class="outline-none">
          <div class="max-h-[460px] overflow-y-auto rounded-md border border-border-subtle bg-bg-input">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="sticky top-0 z-10 border-b border-border-default bg-bg-subtle text-[10.5px] text-text-muted">
                  <th scope="col" class="py-1.5 px-3 font-medium w-16">
                    {t().sockets.thProto}
                  </th>
                  <th scope="col" class="py-1.5 px-3 font-medium">
                    {t().sockets.thLocalAddr}
                  </th>
                  <th scope="col" class="py-1.5 px-3 font-medium">
                    {t().sockets.thRemoteAddr}
                  </th>
                  <th scope="col" class="py-1.5 px-3 font-medium w-24">
                    {t().sockets.thState}
                  </th>
                  <th scope="col" class="py-1.5 px-3 font-medium">
                    {t().sockets.thProcess}
                  </th>
                  <th scope="col" class="py-1.5 px-3 font-medium w-20 text-right">
                    {t().sockets.thPid}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle">
                <For
                  each={filteredActiveConnections()}
                  fallback={
                    <tr>
                      <td colspan="6" class="py-8 text-center text-xs text-text-muted font-mono">
                        {t().sockets.empty}
                      </td>
                    </tr>
                  }
                >
                  {(item) => {
                    const remote =
                      item.remote_ip && item.remote_port
                        ? `${item.remote_ip}:${item.remote_port}`
                        : '-';
                    return (
                      <tr class="hover:bg-bg-hover transition-colors">
                        <td class="py-1.5 px-3 font-mono">
                          <span class="rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.2 text-[9.5px] text-accent">
                            {item.protocol}
                          </span>
                        </td>

                        <td class="py-1.5 px-3 font-mono text-[11px] text-text-primary">
                          {item.local_ip}:{item.local_port}
                        </td>

                        <td class="py-1.5 px-3 font-mono text-[11px] text-text-muted">{remote}</td>

                        <td class="py-1.5 px-3 font-mono">
                          <span
                            class="rounded px-1.5 py-0.2 text-[9px] font-medium"
                            classList={{
                              'bg-status-success-bg text-status-success':
                                item.state === SocketState.ESTABLISHED,
                              'bg-status-warning-bg text-status-warning':
                                item.state === SocketState.TIME_WAIT ||
                                item.state === SocketState.CLOSE_WAIT,
                              'bg-bg-subtle text-text-muted':
                                item.state !== SocketState.ESTABLISHED &&
                                item.state !== SocketState.TIME_WAIT &&
                                item.state !== SocketState.CLOSE_WAIT,
                            }}
                          >
                            {item.state}
                          </span>
                        </td>

                        <td class="py-1.5 px-3 font-medium text-text-primary truncate max-w-[200px]">
                          {item.process_name || '-'}
                        </td>

                        <td class="py-1.5 px-3 font-mono text-right text-text-muted text-[11px]">
                          {item.pid ? (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(item.pid?.toString() || '', 'PID')}
                              class="hover:text-accent outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
                              title="PID"
                            >
                              {item.pid}
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            </table>
          </div>
        </Tabs.Content>
      </Tabs>
    </section>
  );
};
