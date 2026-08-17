import { For, Show, createSignal, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { copyToClipboard, fetchHostsApi, hostsList, pingHostApi } from '../services/store';
import { RefreshIcon } from './Icons';
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
        h.line_number.toString().includes(q)
    );
  };

  return (
    <div class="flex flex-col gap-3" aria-label={t().hosts.title}>
      {/* Header with Search and Reload */}
      <section class="flex flex-col gap-2 rounded-lg border border-border-default bg-bg-surface p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-xs font-semibold text-text-primary">{t().hosts.title}</h2>
          <span class="mono text-[10px] text-text-muted">
            /etc/hosts · {hostsList().length} {t().hosts.totalEntries}
          </span>
        </div>

        <div class="flex items-center gap-2">
          {/* Search box */}
          <div class="relative flex items-center">
            <input
              type="text"
              aria-label={t().hosts.searchPlaceholder}
              placeholder={t().hosts.searchPlaceholder}
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="w-56 rounded border border-border-default bg-bg-input py-1 pl-2.5 pr-6 text-[11px] text-text-primary placeholder:text-text-muted outline-none transition-all focus:border-border-strong focus-visible:ring-1 focus-visible:ring-accent"
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

          <button
            type="button"
            onClick={handleReload}
            disabled={isReloading()}
            aria-busy={isReloading()}
            aria-label={t().hosts.reload}
            class="flex items-center justify-center gap-1.5 rounded border border-border-default bg-bg-subtle px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent"
          >
            <RefreshIcon class={`h-3.5 w-3.5 ${isReloading() ? 'animate-spin' : ''}`} />
            <span>{isReloading() ? t().common.loading : t().hosts.reload}</span>
          </button>
        </div>
      </section>

      {/* Hosts Table */}
      <div class="max-h-[550px] overflow-y-auto rounded-md border border-border-subtle bg-bg-input">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="sticky top-0 z-10 border-b border-border-default bg-bg-subtle text-[10.5px] text-text-muted">
              <th scope="col" class="py-2 px-3 font-medium w-16 text-center">{t().hosts.thLine}</th>
              <th scope="col" class="py-2 px-3 font-medium w-36">{t().hosts.thIp}</th>
              <th scope="col" class="py-2 px-3 font-medium">{t().hosts.thDomain}</th>
              <th scope="col" class="py-2 px-3 font-medium w-24 text-center">{t().hosts.thStatus}</th>
              <th scope="col" class="py-2 px-3 font-medium w-24 text-right">{t().common.actions}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle font-mono text-[11px]">
            <For
              each={filteredHosts()}
              fallback={
                <tr>
                  <td colspan="5" class="py-12 text-center text-xs text-text-muted font-sans">
                    {t().hosts.empty}
                  </td>
                </tr>
              }
            >
              {(entry) => (
                <tr class="hover:bg-bg-hover transition-colors">
                  {/* Line Number */}
                  <td class="py-2 px-3 text-center text-text-muted text-[10px]">
                    #{entry.line_number}
                  </td>

                  {/* IP */}
                  <td class="py-2 px-3">
                    <button
                      type="button"
                      aria-label={`IP: ${entry.ip}`}
                      onClick={() => copyToClipboard(entry.ip, 'IP')}
                      class="font-semibold text-text-primary hover:text-accent focus-visible:ring-1 focus-visible:ring-accent rounded text-left"
                    >
                      {entry.ip}
                    </button>
                  </td>

                  {/* Domain */}
                  <td class="py-2 px-3 text-text-secondary">
                    <button
                      type="button"
                      aria-label={`Domain: ${entry.domain}`}
                      onClick={() => copyToClipboard(entry.domain, 'Domain')}
                      class="hover:text-accent focus-visible:ring-1 focus-visible:ring-accent rounded text-left"
                    >
                      {entry.domain}
                    </button>
                  </td>

                  {/* Status Badge */}
                  <td class="py-2 px-3 text-center">
                    <Show
                      when={entry.is_enabled}
                      fallback={
                        <span class="rounded bg-bg-subtle px-1.5 py-0.2 text-[9.5px] text-text-muted font-sans font-medium">
                          {t().hosts.commented}
                        </span>
                      }
                    >
                      <span class="rounded bg-status-success/10 px-1.5 py-0.2 text-[9.5px] text-status-success font-sans font-medium">
                        {t().hosts.active}
                      </span>
                    </Show>
                  </td>

                  {/* Action */}
                  <td class="py-2 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleTestPing(entry.domain)}
                      disabled={pingingDomain() === entry.domain}
                      aria-label={`Ping ${entry.domain}`}
                      class="rounded bg-bg-subtle border border-border-subtle px-2 py-0.5 text-[10px] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50 focus-visible:ring-1 focus-visible:ring-accent"
                    >
                      {pingingDomain() === entry.domain ? 'Ping...' : 'Ping'}
                    </button>
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
