import { For, Show, createMemo, createSignal } from 'solid-js';
import type { Component } from 'solid-js';
import { Badge, Button, Input, Tabs, TabsContent, TabsList, TabsTrigger } from './ui';
import { copyToClipboard, killPortApi, openConfirmDialog, sockets } from '../services/store';
import {
  AppBoxIcon,
  ChromeIcon,
  CloseIcon,
  CodeIcon,
  CopyIcon,
  DiskIcon,
  GlobeIcon,
  TerminalIcon,
} from './Icons';
import { SocketCategoryFilter, SocketState, SocketTab } from '../constants';
import type { SocketEntry } from '../types';
import { t } from '../i18n';

export const SocketInspector: Component = () => {
  const [activeTab, setActiveTab] = createSignal<SocketTab>(SocketTab.LISTENING);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [categoryFilter, setCategoryFilter] = createSignal<SocketCategoryFilter>(
    SocketCategoryFilter.ALL,
  );

  const isMatchingCategory = (item: SocketEntry) => {
    const filter = categoryFilter();
    if (!filter) return true;

    if (item.category) {
      if (
        filter === SocketCategoryFilter.WEB &&
        (item.category === 'web' || item.category === 'dev')
      ) {
        return true;
      }
      if (filter === SocketCategoryFilter.DB && item.category === 'db') return true;
      if (filter === SocketCategoryFilter.DEV && item.category === 'dev') return true;
      if (
        filter === SocketCategoryFilter.APP &&
        (item.category === 'app' || item.category === 'browser')
      )
        return true;
    }

    const port = item.local_port;
    const processName = (item.process_name || '').toLowerCase();
    const appName = (item.app_name || '').toLowerCase();

    if (filter === SocketCategoryFilter.WEB) {
      return (
        [80, 443, 8080, 8443, 3000, 5173, 8000, 9527, 9528, 9529, 4173].includes(port) ||
        processName.includes('nginx') ||
        processName.includes('node') ||
        processName.includes('vite') ||
        processName.includes('caddy') ||
        appName.includes('vite') ||
        appName.includes('next')
      );
    }
    if (filter === SocketCategoryFilter.DB) {
      return (
        [3306, 5432, 6379, 27017, 9200, 9042, 1433].includes(port) ||
        processName.includes('mysql') ||
        processName.includes('postgres') ||
        processName.includes('redis') ||
        processName.includes('mongo') ||
        appName.includes('postgres') ||
        appName.includes('redis')
      );
    }
    if (filter === SocketCategoryFilter.DEV) {
      return (
        [3000, 3001, 5173, 5174, 8080, 8000, 9527, 9528, 9529, 4000].includes(port) ||
        processName.includes('workstation') ||
        processName.includes('next') ||
        processName.includes('rust') ||
        processName.includes('cargo') ||
        processName.includes('python')
      );
    }
    if (filter === SocketCategoryFilter.APP) {
      return (
        appName.endsWith('.app') ||
        appName.includes('chrome') ||
        appName.includes('code') ||
        appName.includes('docker') ||
        appName.includes('postman') ||
        appName.includes('wechat') ||
        appName.includes('telegram')
      );
    }
    return true;
  };

  const filteredListeningPorts = createMemo(() => {
    const list = sockets()?.listening_ports || [];
    const q = searchQuery().trim().toLowerCase();

    return list.filter((item: SocketEntry) => {
      const matchesSearch =
        !q ||
        item.local_port.toString().includes(q) ||
        (item.app_name && item.app_name.toLowerCase().includes(q)) ||
        (item.process_name && item.process_name.toLowerCase().includes(q)) ||
        (item.pid && item.pid.toString().includes(q)) ||
        (item.exe_path && item.exe_path.toLowerCase().includes(q)) ||
        item.local_ip.toLowerCase().includes(q);

      const matchesCat = isMatchingCategory(item);
      return matchesSearch && matchesCat;
    });
  });

  const filteredActiveConnections = createMemo(() => {
    const list = sockets()?.active_connections || [];
    const q = searchQuery().trim().toLowerCase();

    return list.filter((item: SocketEntry) => {
      return (
        !q ||
        item.local_port.toString().includes(q) ||
        (item.remote_port && item.remote_port.toString().includes(q)) ||
        (item.app_name && item.app_name.toLowerCase().includes(q)) ||
        (item.process_name && item.process_name.toLowerCase().includes(q)) ||
        (item.pid && item.pid.toString().includes(q)) ||
        (item.exe_path && item.exe_path.toLowerCase().includes(q)) ||
        (item.remote_ip && item.remote_ip.toLowerCase().includes(q)) ||
        item.state.toLowerCase().includes(q)
      );
    });
  });

  const renderAppIcon = (item: SocketEntry) => {
    const cat = item.category || '';
    const name = (item.app_name || item.process_name || '').toLowerCase();

    if (
      cat === 'browser' ||
      name.includes('chrome') ||
      name.includes('safari') ||
      name.includes('firefox')
    ) {
      return <ChromeIcon class="h-3.5 w-3.5 text-amber-400" />;
    }
    if (
      cat === 'db' ||
      name.includes('postgres') ||
      name.includes('mysql') ||
      name.includes('redis') ||
      name.includes('mongo')
    ) {
      return <DiskIcon class="h-3.5 w-3.5 text-teal-400" />;
    }
    if (
      cat === 'web' ||
      name.includes('nginx') ||
      name.includes('caddy') ||
      name.includes('httpd')
    ) {
      return <GlobeIcon class="h-3.5 w-3.5 text-accent" />;
    }
    if (
      cat === 'dev' ||
      name.includes('node') ||
      name.includes('vite') ||
      name.includes('python') ||
      name.includes('cargo') ||
      name.includes('rust')
    ) {
      return <CodeIcon class="h-3.5 w-3.5 text-indigo-400" />;
    }
    if (cat === 'sys' || name.startsWith('com.apple.')) {
      return <TerminalIcon class="h-3.5 w-3.5 text-text-muted" />;
    }
    return <AppBoxIcon class="h-3.5 w-3.5 text-text-secondary" />;
  };

  const confirmKillPort = (item: SocketEntry) => {
    const displayName = item.app_name || item.process_name || 'Process';
    openConfirmDialog({
      title: t().confirmDialog.killPortTitle,
      message: t()
        .confirmDialog.killPortWarning.replace('{name}', displayName)
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
      <Tabs
        value={activeTab()}
        onValueChange={(details) => setActiveTab(details.value as SocketTab)}
        class="w-full flex flex-col"
      >
        {/* Controls Toolbar with TabList */}
        <div class="mb-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList aria-label="Sockets tab navigation">
            <TabsTrigger value={SocketTab.LISTENING}>
              {t().sockets.listeningTab}
              <Show when={sockets()?.listening_ports?.length}>
                <span class="ml-1.5 mono text-[10px] font-bold text-accent">
                  {sockets()?.listening_ports?.length}
                </span>
              </Show>
            </TabsTrigger>

            <TabsTrigger value={SocketTab.ACTIVE}>
              {t().sockets.activeTab}
              <Show when={sockets()?.active_connections?.length}>
                <span class="ml-1.5 mono text-[10px] font-bold text-teal-400">
                  {sockets()?.active_connections?.length}
                </span>
              </Show>
            </TabsTrigger>
          </TabsList>

          {/* Search Box & Category Filters */}
          <div class="flex flex-wrap items-center gap-2">
            <div class="relative flex items-center">
              <Input
                type="text"
                aria-label={t().sockets.searchPlaceholder}
                placeholder={t().sockets.searchPlaceholder}
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                class="w-40 sm:w-48 pr-7"
              />
              <Show when={searchQuery()}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchQuery('')}
                  aria-label={t().common.cancel}
                  class="absolute right-1 h-6 w-6"
                >
                  <CloseIcon class="h-3 w-3" />
                </Button>
              </Show>
            </div>

            {/* Category Filter Pills (Only on Listening Tab) */}
            <Show when={activeTab() === SocketTab.LISTENING}>
              <div
                class="flex items-center rounded-lg border border-border-subtle bg-bg-base/80 p-0.5 text-[10.5px]"
                role="group"
                aria-label="Category filter"
              >
                <Button
                  type="button"
                  variant={categoryFilter() === SocketCategoryFilter.ALL ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCategoryFilter(SocketCategoryFilter.ALL)}
                >
                  {t().sockets.filterAll}
                </Button>
                <Button
                  type="button"
                  variant={categoryFilter() === SocketCategoryFilter.WEB ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCategoryFilter(SocketCategoryFilter.WEB)}
                >
                  {t().sockets.filterWeb}
                </Button>
                <Button
                  type="button"
                  variant={categoryFilter() === SocketCategoryFilter.DB ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCategoryFilter(SocketCategoryFilter.DB)}
                >
                  {t().sockets.filterDb}
                </Button>
                <Button
                  type="button"
                  variant={categoryFilter() === SocketCategoryFilter.DEV ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCategoryFilter(SocketCategoryFilter.DEV)}
                >
                  {t().sockets.filterDev}
                </Button>
                <Button
                  type="button"
                  variant={categoryFilter() === SocketCategoryFilter.APP ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCategoryFilter(SocketCategoryFilter.APP)}
                >
                  {t().sockets.filterApp}
                </Button>
              </div>
            </Show>
          </div>
        </div>

        {/* Tab 1: Listening Ports Table */}
        <TabsContent value={SocketTab.LISTENING} class="outline-none">
          <div class="max-h-[500px] overflow-y-auto rounded-lg border border-border-subtle bg-bg-base/60">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="sticky top-0 z-10 border-b border-border-default bg-bg-subtle/90 text-[10.5px] font-bold text-text-muted uppercase tracking-wider backdrop-blur-xs">
                  <th scope="col" class="py-2.5 px-3.5 w-16">
                    {t().sockets.thProto}
                  </th>
                  <th scope="col" class="py-2.5 px-3.5 w-24">
                    {t().sockets.thLocalPort}
                  </th>
                  <th scope="col" class="py-2.5 px-3.5">
                    {t().sockets.thBindAddr}
                  </th>
                  <th scope="col" class="py-2.5 px-3.5">
                    {t().sockets.thProcess}
                  </th>
                  <th scope="col" class="py-2.5 px-3.5 text-right w-24">
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
                      <td class="py-2.5 px-3.5">
                        <Badge variant="secondary" size="sm" class="uppercase">
                          {item.protocol}
                        </Badge>
                      </td>
                      <td class="py-2.5 px-3.5 font-bold text-accent">:{item.local_port}</td>
                      <td
                        class="py-2.5 px-3.5 text-text-secondary truncate max-w-[160px]"
                        title={item.local_ip}
                      >
                        <span class="text-text-muted text-[10px]">{item.local_ip}</span>
                      </td>
                      <td
                        class="py-2.5 px-3.5 truncate max-w-[260px]"
                        title={item.exe_path || item.process_name || ''}
                      >
                        <div class="flex items-center gap-2">
                          <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-bg-surface border border-border-subtle">
                            {renderAppIcon(item)}
                          </div>
                          <div class="flex flex-col min-w-0 truncate">
                            <span class="font-bold text-xs text-text-primary truncate">
                              {item.app_name || item.process_name || '-'}
                            </span>
                            <div class="flex items-center gap-1.5 text-[9.5px] text-text-muted truncate">
                              <Show
                                when={
                                  item.process_name &&
                                  item.app_name &&
                                  item.process_name !== item.app_name
                                }
                              >
                                <span class="truncate">{item.process_name}</span>
                              </Show>
                              <Show when={item.pid}>
                                <span class="mono opacity-80">PID: {item.pid}</span>
                              </Show>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td class="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <div class="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => copyToClipboard(item.local_port.toString(), 'Port')}
                            title={t().devops.copy}
                          >
                            <CopyIcon class="h-3 w-3" />
                            <span>{t().devops.copy}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => confirmKillPort(item)}
                          >
                            {t().confirmDialog.killPortConfirmBtn}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Tab 2: Active Connections Table */}
        <TabsContent value={SocketTab.ACTIVE} class="outline-none">
          <div class="max-h-[500px] overflow-y-auto rounded-lg border border-border-subtle bg-bg-base/60">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="sticky top-0 z-10 border-b border-border-default bg-bg-subtle/90 text-[10.5px] font-bold text-text-muted uppercase tracking-wider backdrop-blur-xs">
                  <th scope="col" class="py-2.5 px-3.5 w-16">
                    {t().sockets.thProto}
                  </th>
                  <th scope="col" class="py-2.5 px-3.5">
                    {t().sockets.thLocalAddr}
                  </th>
                  <th scope="col" class="py-2.5 px-3.5">
                    {t().sockets.thRemoteAddr}
                  </th>
                  <th scope="col" class="py-2.5 px-3.5 w-24">
                    {t().sockets.thState}
                  </th>
                  <th scope="col" class="py-2.5 px-3.5">
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
                      <td class="py-2.5 px-3.5">
                        <Badge variant="secondary" size="sm" class="uppercase">
                          {item.protocol}
                        </Badge>
                      </td>
                      <td class="py-2.5 px-3.5 text-text-primary truncate max-w-[150px]">
                        {item.local_ip}:{item.local_port}
                      </td>
                      <td class="py-2.5 px-3.5 text-text-secondary truncate max-w-[180px]">
                        <Show
                          when={item.remote_ip}
                          fallback={<span class="text-text-muted">-</span>}
                        >
                          <div class="flex items-center gap-1.5">
                            <span class="truncate font-semibold text-text-primary">
                              {item.remote_ip}:{item.remote_port}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                copyToClipboard(
                                  `${item.remote_ip}:${item.remote_port}`,
                                  'Remote Address',
                                )
                              }
                              class="opacity-0 group-hover:opacity-100 h-5 w-5 p-0"
                              title={t().sockets.copyAddrTooltip.replace(
                                '{addr}',
                                `${item.remote_ip}:${item.remote_port}`,
                              )}
                            >
                              <CopyIcon class="h-3 w-3" />
                            </Button>
                          </div>
                        </Show>
                      </td>
                      <td class="py-2.5 px-3.5">
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
                      <td
                        class="py-2.5 px-3.5 truncate max-w-[240px]"
                        title={item.exe_path || item.process_name || ''}
                      >
                        <div class="flex items-center gap-2">
                          <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-bg-surface border border-border-subtle">
                            {renderAppIcon(item)}
                          </div>
                          <div class="flex flex-col min-w-0 truncate">
                            <span class="font-bold text-xs text-text-primary truncate">
                              {item.app_name || item.process_name || '-'}
                            </span>
                            <div class="flex items-center gap-1.5 text-[9.5px] text-text-muted truncate">
                              <Show
                                when={
                                  item.process_name &&
                                  item.app_name &&
                                  item.process_name !== item.app_name
                                }
                              >
                                <span class="truncate">{item.process_name}</span>
                              </Show>
                              <Show when={item.pid}>
                                <span class="mono opacity-80">PID: {item.pid}</span>
                              </Show>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
};
