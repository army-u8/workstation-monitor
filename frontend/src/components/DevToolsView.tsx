import { For, Show, createMemo, createSignal, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import {
  copyToClipboard,
  devTools,
  envVarsData,
  fetchEnvVarsApi,
  isLoadingEnvVars,
} from '../services/store';
import { t } from '../i18n';
import { DevToolsIcon, RefreshIcon } from './Icons';
import type { EnvVarEntry, PathEntry } from '../types';

export const DevToolsView: Component = () => {
  const [activeTab, setActiveTab] = createSignal<'tools' | 'path' | 'env'>('tools');
  const [searchEnv, setSearchEnv] = createSignal('');
  const [selectedCategory, setSelectedCategory] = createSignal<string>('ALL');
  const [revealedSecrets, setRevealedSecrets] = createSignal<Record<string, boolean>>({});

  onMount(() => {
    fetchEnvVarsApi();
  });

  const tools = () => devTools();

  const installedCount = createMemo(() => {
    return tools().filter((d) => d.is_installed).length;
  });

  const toggleSecretReveal = (name: string) => {
    setRevealedSecrets((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const maskSecretValue = (val: string) => {
    if (val.length <= 8) return '••••••••';
    return `${val.slice(0, 4)}••••••••${val.slice(-4)}`;
  };

  const filteredEnvVars = () => {
    const list = envVarsData()?.env_vars || [];
    const q = searchEnv().trim().toLowerCase();
    const cat = selectedCategory();

    return list.filter((item: EnvVarEntry) => {
      if (cat !== 'ALL' && item.category !== cat) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  };

  const categories = () => {
    const list = envVarsData()?.env_vars || [];
    const cats = new Set<string>();
    list.forEach((item) => cats.add(item.category));
    return ['ALL', ...Array.from(cats)];
  };

  return (
    <div class="flex flex-col gap-5" aria-label={t().sidebar.navDevtools}>
      {/* Header Banner */}
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-default bg-bg-surface p-4 shadow-xs">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent text-xl">
            <DevToolsIcon class="h-5 w-5" />
          </span>
          <div>
            <h1 class="text-base font-bold text-text-primary m-0">
              {t().devops.toolchainTitle}
            </h1>
            <p class="text-xs text-text-muted m-0 mt-0.5">
              macOS 本机开发环境、编译器、运行时、$PATH 链路与环境变量全景检测
            </p>
          </div>
        </div>

        {/* Action & Stats */}
        <div class="flex items-center gap-3">
          <Show when={envVarsData()?.proxy_configured}>
            <span class="inline-flex items-center gap-1.5 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-1 text-xs font-semibold text-status-warning">
              <span>🌐 终端代理已配置</span>
            </span>
          </Show>

          <button
            type="button"
            onClick={() => fetchEnvVarsApi()}
            disabled={isLoadingEnvVars()}
            class="flex items-center gap-1.5 rounded-lg bg-bg-subtle border border-border-default px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-hover active:scale-95 disabled:opacity-50 transition-all"
          >
            <RefreshIcon class="h-3.5 w-3.5" classList={{ 'animate-spin': isLoadingEnvVars() }} />
            <span>{t().envVars.refreshBtn}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div class="flex items-center gap-2 border-b border-border-subtle pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('tools')}
          class="flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all"
          classList={{
            'bg-accent text-white shadow-2xs': activeTab() === 'tools',
            'bg-bg-surface text-text-muted hover:text-text-primary border border-border-default': activeTab() !== 'tools',
          }}
        >
          <span>🛠️ 工具链与运行时</span>
          <span
            class="rounded-full px-1.5 py-0.2 text-[10.5px] mono"
            classList={{
              'bg-white/20 text-white': activeTab() === 'tools',
              'bg-bg-subtle text-text-muted': activeTab() !== 'tools',
            }}
          >
            {installedCount()}/{tools().length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('path')}
          class="flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all"
          classList={{
            'bg-accent text-white shadow-2xs': activeTab() === 'path',
            'bg-bg-surface text-text-muted hover:text-text-primary border border-border-default': activeTab() !== 'path',
          }}
        >
          <span>🛣️ $PATH 链路拆解</span>
          <span
            class="rounded-full px-1.5 py-0.2 text-[10.5px] mono"
            classList={{
              'bg-white/20 text-white': activeTab() === 'path',
              'bg-bg-subtle text-text-muted': activeTab() !== 'path',
            }}
          >
            {envVarsData()?.path_entries.length || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('env')}
          class="flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all"
          classList={{
            'bg-accent text-white shadow-2xs': activeTab() === 'env',
            'bg-bg-surface text-text-muted hover:text-text-primary border border-border-default': activeTab() !== 'env',
          }}
        >
          <span>📋 环境变量检索器</span>
          <span
            class="rounded-full px-1.5 py-0.2 text-[10.5px] mono"
            classList={{
              'bg-white/20 text-white': activeTab() === 'env',
              'bg-bg-subtle text-text-muted': activeTab() !== 'env',
            }}
          >
            {envVarsData()?.env_vars.length || 0}
          </span>
        </button>
      </div>

      {/* TAB 1: Toolchains & Runtimes Matrix */}
      <Show when={activeTab() === 'tools'}>
        <section class="rounded-xl border border-border-default bg-bg-surface p-4 shadow-xs">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <For
              each={tools()}
              fallback={
                <div class="col-span-full py-12 text-center text-xs text-text-muted font-mono">
                  {t().devops.scanningTools}
                </div>
              }
            >
              {(tool) => (
                <div
                  class="flex flex-col justify-between rounded-xl border p-3.5 transition-all hover:border-border-hover"
                  classList={{
                    'border-border-default bg-bg-input/60 shadow-2xs': tool.is_installed,
                    'border-border-subtle/50 bg-bg-subtle/20 opacity-55': !tool.is_installed,
                  }}
                >
                  <div>
                    <div class="flex items-center justify-between">
                      <span class="font-semibold text-xs text-text-primary truncate">
                        {tool.name}
                      </span>
                      <span
                        class="h-2 w-2 rounded-full shrink-0"
                        classList={{
                          'bg-status-success shadow-xs shadow-status-success/50': tool.is_installed,
                          'bg-text-muted': !tool.is_installed,
                        }}
                        title={tool.is_installed ? 'Installed & Ready' : 'Not Found'}
                      />
                    </div>

                    <div class="mt-2">
                      <Show
                        when={tool.is_installed}
                        fallback={
                          <span class="text-[11px] text-text-muted italic">
                            {t().common.absent}
                          </span>
                        }
                      >
                        <span
                          class="mono text-xs font-semibold text-accent block truncate"
                          title={tool.version || ''}
                        >
                          {tool.version || t().common.ready}
                        </span>
                      </Show>
                    </div>
                  </div>

                  <div class="mt-3 pt-2 border-t border-border-subtle/50">
                    <Show
                      when={tool.path}
                      fallback={
                        <span class="text-[10px] text-text-muted font-mono">PATH: -</span>
                      }
                    >
                      <button
                        type="button"
                        onClick={() => copyToClipboard(tool.path || '', 'Tool Path')}
                        class="mono text-[10px] text-text-muted truncate hover:text-accent text-left block w-full focus-visible:ring-1 focus-visible:ring-accent rounded transition-colors"
                        title={`点击复制: ${tool.path}`}
                      >
                        📁 {tool.path}
                      </button>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </section>
      </Show>

      {/* TAB 2: $PATH Resolution Chain */}
      <Show when={activeTab() === 'path'}>
        <section class="rounded-xl border border-border-default bg-bg-surface p-5 shadow-xs space-y-4">
          <div>
            <h2 class="text-sm font-bold text-text-primary m-0">
              {t().envVars.pathTitle}
            </h2>
            <p class="text-xs text-text-muted m-0 mt-0.5">
              {t().envVars.pathSubtitle}
            </p>
          </div>

          <div class="space-y-2">
            <For
              each={envVarsData()?.path_entries || []}
              fallback={
                <div class="py-8 text-center text-xs text-text-muted">正在加载 PATH 目录...</div>
              }
            >
              {(entry: PathEntry) => (
                <div
                  class="flex items-center justify-between gap-3 rounded-lg border p-2.5 transition-colors hover:border-border-hover"
                  classList={{
                    'border-border-default bg-bg-subtle/40': entry.exists,
                    'border-status-warning/40 bg-status-warning/5': !entry.exists,
                  }}
                >
                  <div class="flex items-center gap-3 truncate">
                    <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent/15 text-[10px] font-bold text-accent mono">
                      #{entry.index}
                    </span>
                    <span
                      class="mono text-xs font-medium truncate"
                      classList={{
                        'text-text-primary': entry.exists,
                        'text-status-warning line-through opacity-75': !entry.exists,
                      }}
                      title={entry.path}
                    >
                      {entry.path}
                    </span>
                  </div>

                  <div class="flex items-center gap-2 shrink-0">
                    <span
                      class="rounded-full px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1"
                      classList={{
                        'bg-status-success/15 text-status-success': entry.exists,
                        'bg-status-warning/15 text-status-warning': !entry.exists,
                      }}
                    >
                      <span
                        class="h-1.5 w-1.5 rounded-full"
                        classList={{
                          'bg-status-success': entry.exists,
                          'bg-status-warning': !entry.exists,
                        }}
                      />
                      <span>{entry.exists ? t().envVars.pathExists : t().envVars.pathMissing}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(entry.path, 'PATH Entry')}
                      class="rounded border border-border-default bg-bg-surface px-2 py-1 text-[10.5px] text-text-muted hover:text-accent hover:border-accent transition-colors"
                      title="复制此路径"
                    >
                      📋
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </section>
      </Show>

      {/* TAB 3: Environment Variables Browser */}
      <Show when={activeTab() === 'env'}>
        <section class="rounded-xl border border-border-default bg-bg-surface p-5 shadow-xs space-y-4">
          {/* Top Controls: Search & Category Filter */}
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              type="text"
              placeholder={t().envVars.searchPlaceholder}
              value={searchEnv()}
              onInput={(e) => setSearchEnv(e.currentTarget.value)}
              class="w-full max-w-md rounded-lg border border-border-default bg-bg-subtle/50 px-3 py-2 text-xs text-text-primary placeholder:text-text-muted outline-hidden focus:border-accent focus-visible:ring-1 focus-visible:ring-accent"
            />

            <div class="flex flex-wrap items-center gap-1.5">
              <For each={categories()}>
                {(cat) => (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    class="rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors"
                    classList={{
                      'bg-accent text-white font-semibold': selectedCategory() === cat,
                      'bg-bg-subtle text-text-muted hover:text-text-primary border border-border-subtle': selectedCategory() !== cat,
                    }}
                  >
                    {cat === 'ALL' ? '全部' : cat}
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Table / List of Variables */}
          <div class="overflow-x-auto rounded-lg border border-border-default">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="border-b border-border-default bg-bg-subtle/70 text-text-muted font-semibold">
                  <th class="p-2.5 w-1/4">变量名 (KEY)</th>
                  <th class="p-2.5 w-1/6">分类</th>
                  <th class="p-2.5 w-1/2">变量值 (VALUE)</th>
                  <th class="p-2.5 text-right w-16">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle font-mono">
                <For
                  each={filteredEnvVars()}
                  fallback={
                    <tr>
                      <td colspan="4" class="p-8 text-center text-text-muted">
                        未匹配到符合条件的环境变量。
                      </td>
                    </tr>
                  }
                >
                  {(item: EnvVarEntry) => {
                    const isRevealed = () => revealedSecrets()[item.name];

                    return (
                      <tr class="hover:bg-bg-hover/50 transition-colors">
                        <td class="p-2.5 font-bold text-accent break-all select-all">
                          {item.name}
                        </td>
                        <td class="p-2.5 text-[11px] text-text-muted">
                          <span class="rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.5 text-[10px] text-text-secondary">
                            {item.category}
                          </span>
                        </td>
                        <td class="p-2.5 text-text-primary break-all">
                          <Show
                            when={item.is_secret && !isRevealed()}
                            fallback={
                              <span class="select-all">{item.value}</span>
                            }
                          >
                            <span class="text-text-muted font-sans italic">
                              🔒 {maskSecretValue(item.value)}
                            </span>
                          </Show>
                        </td>
                        <td class="p-2.5 text-right">
                          <div class="flex items-center justify-end gap-1.5">
                            <Show when={item.is_secret}>
                              <button
                                type="button"
                                onClick={() => toggleSecretReveal(item.name)}
                                class="rounded p-1 text-text-muted hover:text-accent transition-colors"
                                title={isRevealed() ? t().envVars.hideSecret : t().envVars.showSecret}
                              >
                                {isRevealed() ? '👁️' : '🔒'}
                              </button>
                            </Show>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(item.value, item.name)}
                              class="rounded p-1 text-text-muted hover:text-accent transition-colors"
                              title="复制变量值"
                            >
                              📋
                            </button>
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
      </Show>
    </div>
  );
};
export default DevToolsView;
