import { For, Show, createMemo } from 'solid-js';
import type { Component } from 'solid-js';
import { copyToClipboard, devTools } from '../services/store';
import { t } from '../i18n';
import { DevToolsIcon } from './Icons';

export const DevToolsView: Component = () => {
  const tools = () => devTools();

  const installedCount = createMemo(() => {
    return tools().filter((d) => d.is_installed).length;
  });

  return (
    <div class="flex flex-col gap-3.5" aria-label={t().sidebar.navDevtools}>
      {/* Header Banner */}
      <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-default bg-bg-surface p-4">
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent text-xl">
            <DevToolsIcon class="h-5 w-5" />
          </span>
          <div>
            <h2 class="text-sm font-semibold text-text-primary m-0">
              {t().devops.toolchainTitle}
            </h2>
            <p class="text-xs text-text-muted m-0 mt-0.5">
              macOS 本机开发环境、编译器、运行时与 CLI 工具链就绪状态检测
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <span class="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-subtle px-3 py-1 text-xs font-mono text-text-secondary">
            <span class="h-2 w-2 rounded-full bg-status-success" />
            <span>
              {installedCount()} / {tools().length} {t().devops.readyCount}
            </span>
          </span>
        </div>
      </div>

      {/* Grid of Tools */}
      <section class="rounded-lg border border-border-default bg-bg-surface p-4">
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
                class="flex flex-col justify-between rounded-lg border p-3 transition-all hover:border-border-hover"
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
    </div>
  );
};
export default DevToolsView;
