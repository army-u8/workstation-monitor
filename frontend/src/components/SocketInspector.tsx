import { For, Show, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { Tabs } from '@kobalte/core/tabs';
import { copyToClipboard, killPortApi, openConfirmDialog, sockets } from '../services/store';
import { CloseIcon } from './Icons';
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
    <section aria-label={t().sockets.listeningTab} class="glass-card flex flex-col p-4 shadow-xs">
      {/* Kobalte Tabs Component for Accessible Tab Switching */}
      <Tabs
        value={activeTab()}
        onChange={(val) => setActiveTab(val as SocketTab)}
        class="w-full flex flex-col"
      >
        {/* Controls Toolbar with TabList */}
        <div class="mb-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs.List
            class="flex rounded-lg bg-bg-base/80 p-1 border border-border-subtle text-[11px] shadow-2xs"
            aria-label="Sockets tab navigation"
          >
            <Tabs.Trigger
              value={SocketTab.LISTENING}
              class="rounded-md px-3 py-1 font-bold transition-all outline-none focus-visible:ring-1 focus-visible:ring-accent"
              classList={{
                'bg-bg-active text-text-primary shadow-2xs': activeTab() === SocketTab.LISTENING,
                'text-text-muted hover:text-text-primary': activeTab() !== SocketTab.LISTENING,
              }}
            >
              {t().sockets.listeningTab}
              <Show when={sockets()?.listening_ports?.length}>
                <span class="ml-1.5 mono text-[10px] font-bold text-accent">
                  {sockets()?.listening_ports?.length}
                </span>
              </Show>
            </Tabs.Trigger>

            <Tabs.Trigger
              value={SocketTab.ACTIVE}
              class="rounded-md px-3 py-1 font-bold transition-all outline-none focus-visible:ring-1 focus-visible:ring-accent"
              classList={{
                'bg-bg-active text-text-primary shadow-2xs': activeTab() === SocketTab.ACTIVE,
                'text-text-muted hover:text-text-primary': activeTab() !== SocketTab.ACTIVE,
              }}
            >
              {t().sockets.activeTab}
              <Show when={sockets()?.active_connections?.length}>
                <span class="ml-1.5 mono text-[10px] font-bold text-teal-400">
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
                class="w-52 rounded-lg border border-border-default bg-bg-surface px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none transition-all focus:border-accent focus-visible:ring-1 focus-visible:ring-accent"
              />
              <Show when={searchQuery()}>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={t().common.cancel}
                  class="absolute right-2 text-text-muted hover:text-text-primary p-0.5"
                >
                  <CloseIcon class="h-3 w-3" />
                </button>
              </Show>
            </div>

            {/* Category Filter Pills (Only on Listening Tab) */}
            <Show when={activeTab() === SocketTab.LISTENING}>
              <div
                class="flex items-center rounded-lg border border-border-subtle bg-bg-base/80 p-0.5 text-[10.5px]"
                role="group"
                aria-label="Category filter"
              >
                <button
                  type="button"
                  onClick={() => setCategoryFilter(SocketCategoryFilter.ALL)}
                  class="rounded-md px-2 py-0.8 transition-all focus-visible:ring-1 focus-visible:ring-accent"
                  classList={{
                    'bg-accent text-white font-bold shadow-2xs':
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
                  class="rounded-md px-2 py-0.8 transition-all focus-visible:ring-1 focus-visible:ring-accent"
                  classList={{
                    'bg-accent text-white font-bold shadow-2xs':
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
                  class="rounded-md px-2 py-0.8 transition-all focus-visible:ring-1 focus-visible:ring-accent"
                  classList={{
                    'bg-accent text-white font-bold shadow-2xs':
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
                  class="rounded-md px-2 py-0.8 transition-all focus-visible:ring-1 focus-visible:ring-accent"
                  classList={{
                    'bg-accent text-white font-bold shadow-2xs':
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
          <div class="max-h-[480px] overflow-y-auto rounded-lg border border-border-subtle bg-bg-base/60">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="sticky top-0 z-10 border-b border-border-default bg-bg-subtle/90 text-[10.5px] font-bold text-text-muted uppercase tracking-wider backdrop-blur-xs">
                  <th scope="col" class="py-2 px-3.5 w-16">
                    {t().sockets.thProto}
                  </th>
                  <th scope="col" class="py-2 px-3.5 w-24">
                    {t().sockets.thLocalPort}
                  </th>
                  <th scope="col" class="py-2 px-3.5">
                    {t().sockets.thBindAddr}
                  </th>
                  <th scope="col" class="py-2 px-3.5">
                    {t().sockets.thProcess}
                  </th>
                  <th scope="col" class="py-2 px-3.5 text-right w-24">
                    {t().processes.thAction}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle font-mono text-[11px]">
                <For
                  each={filteredListeningPorts()}
                  fallback={
                    <tr>
                      <td colspan={5} class="py-10 text-center text-text-muted font-sans text-xs">
                        {t().sockets.empty}
                      </td>
                    </tr>
                  }
                >
                  {(item: SocketEntry) => (
                    <tr class="hover:bg-bg-subtle/50 transition-colors group">
                      <td class="py-2 px-3.5">
                        <span class="rounded bg-bg-surface px-1.8 py-0.5 text-[10px] font-bold text-text-secondary border border-border-subtle uppercase">
                          {item.protocol}
                        </span>
                      </td>
                      <td class="py-2 px-3.5 font-bold text-accent">:{item.local_port}</td>
                      <td
                        class="py-2 px-3.5 text-text-secondary truncate max-w-[160px]"
                        title={item.local_ip}
                      >
                        {item.local_ip}
                      </td>
                      <td class="py-2 px-3.5 truncate max-w-[200px]">
                        <div class="flex items-center gap-1.5 truncate">
                          <span class="font-bold text-text-primary truncate">
                            {item.process_name || '-'}
                          </span>
                          <Show when={item.pid}>
                            <span class="text-text-muted text-[10px]">({item.pid})</span>
                          </Show>
                        </div>
                      </td>
                      <td class="py-2 px-3.5 text-right whitespace-nowrap">
                        <div class="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.local_port.toString(), 'Port')}
                            class="rounded border border-border-default bg-bg-surface px-2 py-0.5 text-[10px] text-text-muted hover:text-text-primary transition-all"
                            title={t().devops.copy}
                          >
                            {t().devops.copy}
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmKillPort(item)}
                            class="rounded border border-status-danger/30 bg-status-danger/10 px-2 py-0.5 text-[10px] font-bold text-status-danger hover:bg-status-danger hover:text-white transition-all"
                          >
                            {t().confirmDialog.killPortConfirmBtn}
                          </button>
                        </div>
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
          <div class="max-h-[480px] overflow-y-auto rounded-lg border border-border-subtle bg-bg-base/60">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="sticky top-0 z-10 border-b border-border-default bg-bg-subtle/90 text-[10.5px] font-bold text-text-muted uppercase tracking-wider backdrop-blur-xs">
                  <th scope="col" class="py-2 px-3.5 w-16">
                    {t().sockets.thProto}
                  </th>
                  <th scope="col" class="py-2 px-3.5">
                    {t().sockets.thLocalAddr}
                  </th>
                  <th scope="col" class="py-2 px-3.5">
                    {t().sockets.thRemoteAddr}
                  </th>
                  <th scope="col" class="py-2 px-3.5 w-24">
                    {t().sockets.thState}
                  </th>
                  <th scope="col" class="py-2 px-3.5">
                    {t().sockets.thProcess}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle font-mono text-[11px]">
                <For
                  each={filteredActiveConnections()}
                  fallback={
                    <tr>
                      <td colspan={5} class="py-10 text-center text-text-muted font-sans text-xs">
                        {t().sockets.empty}
                      </td>
                    </tr>
                  }
                >
                  {(item: SocketEntry) => (
                    <tr class="hover:bg-bg-subtle/50 transition-colors group">
                      <td class="py-2 px-3.5">
                        <span class="rounded bg-bg-surface px-1.8 py-0.5 text-[10px] font-bold text-text-secondary border border-border-subtle uppercase">
                          {item.protocol}
                        </span>
                      </td>
                      <td class="py-2 px-3.5 text-text-primary truncate max-w-[150px]">
                        {item.local_ip}:{item.local_port}
                      </td>
                      <td class="py-2 px-3.5 text-text-secondary truncate max-w-[180px]">
                        {item.remote_ip ? `${item.remote_ip}:${item.remote_port}` : '-'}
                      </td>
                      <td class="py-2 px-3.5">
                        <span
                          class="rounded px-1.8 py-0.5 text-[9.5px] font-bold uppercase"
                          classList={{
                            'bg-status-success/15 text-status-success border border-status-success/30':
                              item.state === SocketState.ESTABLISHED,
                            'bg-status-warning/15 text-status-warning border border-status-warning/30':
                              item.state === SocketState.TIME_WAIT ||
                              item.state === SocketState.CLOSE_WAIT,
                            'bg-bg-surface text-text-muted border border-border-subtle':
                              item.state !== SocketState.ESTABLISHED &&
                              item.state !== SocketState.TIME_WAIT &&
                              item.state !== SocketState.CLOSE_WAIT,
                          }}
                        >
                          {item.state}
                        </span>
                      </td>
                      <td class="py-2 px-3.5 truncate max-w-[180px]">
                        <div class="flex items-center gap-1.5 truncate">
                          <span class="font-bold text-text-primary truncate">
                            {item.process_name || '-'}
                          </span>
                          <Show when={item.pid}>
                            <span class="text-text-muted text-[10px]">({item.pid})</span>
                          </Show>
                        </div>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Tabs.Content>
      </Tabs>
    </section>
  );
};
