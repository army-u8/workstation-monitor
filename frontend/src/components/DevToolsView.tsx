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
      <div class="glass-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div class="flex items-center gap-3">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent text-lg border border-accent/20">
            <DevToolsIcon class="h-4.5 w-4.5" />
          </span>
          <div>
            <h1 class="text-base font-bold text-text-primary m-0 tracking-tight">
              {t().devops.toolchainTitle}
            </h1>
            <p class="text-xs text-text-muted m-0 mt-0.5">
              macOS 本机开发环境、编译器、运行时、$PATH 链路与环境变量全景检测
            </p>
          </div>
        </div>

        {/* Action & Stats */}
        <div class="flex items-center gap-2.5">
          <Show when={envVarsData()?.proxy_configured}>
            <span class="inline-flex items-center gap-1.5 rounded-lg border border-status-warning/30 bg-status-warning/10 px-2.5 py-1 text-xs font-semibold text-status-warning">
              <span>🌐 终端代理已配置</span>
            </span>
          </Show>

          <button
            type="button"
            onClick={() => fetchEnvVarsApi()}
            disabled={isLoadingEnvVars()}
            class="flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.8 text-xs font-semibold text-white shadow-sm hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
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
            'bg-accent text-white shadow-xs': activeTab() === 'tools',
            'bg-bg-surface text-text-muted hover:text-text-primary border border-border-default':
              activeTab() !== 'tools',
          }}
        >
          <span>🛠️ 工具链与运行时</span>
          <span
            class="rounded-full px-1.5 py-0.2 text-[10px] mono tabular-nums"
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
            'bg-accent text-white shadow-xs': activeTab() === 'path',
            'bg-bg-surface text-text-muted hover:text-text-primary border border-border-default':
              activeTab() !== 'path',
          }}
        >
          <span>🛣️ $PATH 链路拆解</span>
          <span
            class="rounded-full px-1.5 py-0.2 text-[10px] mono tabular-nums"
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
            'bg-accent text-white shadow-xs': activeTab() === 'env',
            'bg-bg-surface text-text-muted hover:text-text-primary border border-border-default':
              activeTab() !== 'env',
          }}
        >
          <span>📋 环境变量检索器</span>
          <span
            class="rounded-full px-1.5 py-0.2 text-[10px] mono tabular-nums"
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
        <section class="glass-card p-4">
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
                  class="glass-card-subtle flex flex-col justify-between p-3.5 transition-all duration-200 hover:border-border-hover hover:translate-y-[-1px]"
                  classList={{
                    'opacity-55 border-border-subtle/50': !tool.is_installed,
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
                          'bg-status-success shadow-[0_0_6px_rgba(52,211,153,0.6)]':
                            tool.is_installed,
                          'bg-text-muted': !tool.is_installed,
                        }}
                        title={tool.is_installed ? 'Installed & Ready' : 'Not Found'}
                      />
                    </div>

                    <div
                      class="mt-2 text-[11px] mono text-text-secondary truncate"
                      title={tool.version || '未检测到安装'}
                    >
                      {tool.version || <span class="text-text-muted">未安装</span>}
                    </div>
                  </div>

                  <Show when={tool.path}>
                    <div class="mt-3 pt-2 border-t border-border-subtle flex items-center justify-between">
                      <span
                        class="text-[10px] text-text-muted mono truncate max-w-[120px]"
                        title={tool.path || ''}
                      >
                        {tool.path}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(tool.path || '', tool.name)}
                        class="text-[10px] text-accent hover:underline shrink-0 ml-1"
                        title="复制路径"
                      >
                        复制
                      </button>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </section>
      </Show>

      {/* TAB 2: $PATH Resolution Chain */}
      <Show when={activeTab() === 'path'}>
        <section class="glass-card p-4 space-y-4">
          <div class="flex items-center justify-between text-xs text-text-muted">
            <span>macOS 终端命令寻址优先级自上而下逐级向下探测：</span>
            <span class="mono tabular-nums">
              共 {envVarsData()?.path_entries.length || 0} 个寻址路径
            </span>
          </div>

          <div class="space-y-2">
            <For each={envVarsData()?.path_entries}>
              {(entry: PathEntry) => (
                <div class="glass-card-subtle flex items-center justify-between p-3 transition-colors hover:bg-bg-subtle">
                  <div class="flex items-center gap-3">
                    <span class="flex h-6 w-6 items-center justify-center rounded-md bg-bg-surface mono text-[10.5px] font-bold text-text-secondary border border-border-subtle tabular-nums">
                      {entry.index + 1}
                    </span>
                    <span class="mono text-xs font-medium text-text-primary">{entry.path}</span>
                  </div>

                  <div class="flex items-center gap-2">
                    <Show
                      when={entry.exists}
                      fallback={
                        <span class="rounded bg-status-danger/15 px-2 py-0.5 text-[10px] font-semibold text-status-danger">
                          目录无效 / 不存在
                        </span>
                      }
                    >
                      <span class="rounded bg-status-success/15 px-2 py-0.5 text-[10px] font-semibold text-status-success">
                        有效目录
                      </span>
                    </Show>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(entry.path, '$PATH Entry')}
                      class="rounded border border-border-default bg-bg-surface px-2 py-0.5 text-[10px] text-text-muted hover:text-text-primary transition-colors"
                    >
                      复制
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
        <section class="glass-card p-4 space-y-4">
          {/* Filter Bar */}
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <input
              type="text"
              placeholder="搜索环境变量名称、值或分类 (如 PATH, HOME, PROXY)..."
              value={searchEnv()}
              onInput={(e) => setSearchEnv(e.currentTarget.value)}
              class="w-full max-w-md rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-primary placeholder:text-text-muted outline-hidden focus:border-accent focus-visible:ring-1 focus-visible:ring-accent transition-colors"
            />

            {/* Category Filter Pills */}
            <div class="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              <For each={categories()}>
                {(cat) => (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    class="rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all"
                    classList={{
                      'bg-accent text-white shadow-2xs': selectedCategory() === cat,
                      'bg-bg-subtle text-text-muted hover:text-text-primary border border-border-subtle':
                        selectedCategory() !== cat,
                    }}
                  >
                    {cat}
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Table */}
          <div class="overflow-x-auto rounded-lg border border-border-subtle">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="border-b border-border-subtle bg-bg-subtle/70 text-[11px] font-bold text-text-muted uppercase">
                  <th class="px-3.5 py-2.5">分类</th>
                  <th class="px-3.5 py-2.5">变量名</th>
                  <th class="px-3.5 py-2.5">变量值</th>
                  <th class="px-3.5 py-2.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle font-mono">
                <For
                  each={filteredEnvVars()}
                  fallback={
                    <tr>
                      <td colspan={4} class="py-8 text-center text-text-muted">
                        无匹配的环境变量记录
                      </td>
                    </tr>
                  }
                >
                  {(entry: EnvVarEntry) => {
                    const isSecret = entry.is_secret;
                    const isRevealed = () => Boolean(revealedSecrets()[entry.name]);
                    const displayValue = () => {
                      if (!isSecret) return entry.value;
                      return isRevealed() ? entry.value : maskSecretValue(entry.value);
                    };

                    return (
                      <tr class="hover:bg-bg-subtle/50 transition-colors">
                        <td class="px-3.5 py-2 whitespace-nowrap">
                          <span class="rounded bg-bg-surface px-1.5 py-0.5 text-[10px] text-text-secondary border border-border-subtle">
                            {entry.category}
                          </span>
                        </td>
                        <td class="px-3.5 py-2 font-bold text-text-primary whitespace-nowrap">
                          {entry.name}
                        </td>
                        <td class="px-3.5 py-2 text-text-secondary break-all max-w-md">
                          <span
                            class={
                              isSecret && !isRevealed() ? 'tracking-widest text-text-muted' : ''
                            }
                          >
                            {displayValue()}
                          </span>
                        </td>
                        <td class="px-3.5 py-2 text-right whitespace-nowrap">
                          <div class="flex items-center justify-end gap-1.5">
                            <Show when={isSecret}>
                              <button
                                type="button"
                                onClick={() => toggleSecretReveal(entry.name)}
                                class="rounded border border-border-default bg-bg-surface px-2 py-0.5 text-[10px] text-text-muted hover:text-text-primary transition-colors"
                              >
                                {isRevealed() ? '🙈 隐藏' : '👁️ 显示'}
                              </button>
                            </Show>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(entry.value, entry.name)}
                              class="rounded border border-border-default bg-bg-surface px-2 py-0.5 text-[10px] text-text-muted hover:text-text-primary transition-colors"
                            >
                              复制
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
