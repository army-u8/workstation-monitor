import { For, Show, createSignal, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { copyToClipboard, fetchHostsApi, hostsList, pingHostApi } from '../services/store';
import { CloseIcon, RefreshIcon } from './Icons';
import { Button, Input } from './ui';
import { t } from '../i18n';

export const HostsManager: Component = () => {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [isReloading, setIsReloading] = createSignal(false);
  const [pingingDomain, setPingingDomain] = createSignal<string | null>(null);

  const handleReload = async () => {
    setIsReloading(true);
    await fetchHostsApi();
    setIsReloading(false);
  };

  onMount(() => {
    if (hostsList().length === 0) {
      handleReload();
    }
  });

  const handleTestPing = async (domain: string) => {
    setPingingDomain(domain);
    await pingHostApi(domain, 2);
    setPingingDomain(null);
  };

  const filteredHosts = () => {
    const list = hostsList();
    const q = searchQuery().trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (h) =>
        h.ip.toLowerCase().includes(q) ||
        h.domain.toLowerCase().includes(q) ||
        h.line_number.toString().includes(q),
    );
  };

  return (
    <div class="flex flex-col gap-4" aria-label={t().hosts.title}>
      {/* Header with Search and Reload */}
      <section class="glass-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div>
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-accent animate-pulse-dot" />
            <h2 class="text-xs font-bold text-text-primary m-0">{t().hosts.title}</h2>
          </div>
          <span class="mono text-[10.5px] text-text-muted mt-0.5 block">
            /etc/hosts · {hostsList().length} {t().hosts.totalEntries}
          </span>
        </div>

        <div class="flex items-center gap-2.5">
          {/* Search box */}
          <div class="relative flex items-center">
            <Input
              type="text"
              aria-label={t().hosts.searchPlaceholder}
              placeholder={t().hosts.searchPlaceholder}
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="w-60 pr-7"
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

          <Button
            type="button"
            variant="default"
            onClick={handleReload}
            disabled={isReloading()}
            loading={isReloading()}
            aria-label={t().hosts.reload}
          >
            <RefreshIcon class={`h-3.5 w-3.5 ${isReloading() ? 'animate-spin' : ''}`} />
            <span>{isReloading() ? t().common.loading : t().hosts.reload}</span>
          </Button>
        </div>
      </section>

      {/* Hosts Table */}
      <div class="max-h-[580px] overflow-y-auto rounded-lg border border-border-subtle bg-bg-base/60">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="sticky top-0 z-10 border-b border-border-default bg-bg-subtle/90 text-[10.5px] font-bold text-text-muted uppercase tracking-wider backdrop-blur-xs">
              <th scope="col" class="py-2.5 px-3.5 w-16 text-center">
                {t().hosts.thLine}
              </th>
              <th scope="col" class="py-2.5 px-3.5 w-40">
                {t().hosts.thIp}
              </th>
              <th scope="col" class="py-2.5 px-3.5">
                {t().hosts.thDomain}
              </th>
              <th scope="col" class="py-2.5 px-3.5 text-right w-36">
                {t().gitRadar.thActions}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle font-mono text-[11px]">
            <For
              each={filteredHosts()}
              fallback={
                <tr>
                  <td colspan={4} class="py-12 text-center text-text-muted font-sans text-xs">
                    {t().hosts.empty}
                  </td>
                </tr>
              }
            >
              {(host) => (
                <tr class="hover:bg-bg-subtle/50 transition-colors group">
                  <td class="py-2 px-3.5 text-center text-text-muted text-[10px]">
                    #{host.line_number}
                  </td>
                  <td class="py-2 px-3.5">
                    <span class="rounded bg-bg-surface px-1.8 py-0.5 text-accent font-bold border border-border-subtle">
                      {host.ip}
                    </span>
                  </td>
                  <td class="py-2 px-3.5 text-text-primary font-semibold">{host.domain}</td>
                  <td class="py-2 px-3.5 text-right whitespace-nowrap">
                    <div class="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleTestPing(host.domain)}
                        disabled={pingingDomain() === host.domain}
                        loading={pingingDomain() === host.domain}
                      >
                        {pingingDomain() === host.domain ? '...' : t().devops.pingBtn}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => copyToClipboard(`${host.ip} ${host.domain}`, 'Host mapping')}
                      >
                        {t().devops.copy}
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  );
};
