import { For, Show, createMemo, createSignal, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { Badge, Button, Tabs, TabsContent, TabsList, TabsTrigger } from './ui';
import {
  copyToClipboard,
  envVarsData,
  fetchEnvVarsApi,
  fetchLlmLatencyApi,
  fetchLocalAgentsApi,
  fetchOllamaStatusApi,
  formatTotalBytes,
  isLoadingLocalAgents,
  isTestingLlmLatency,
  isUnloadingOllama,
  llmLatencies,
  localAgents,
  ollamaStatus,
  unloadOllamaModelApi,
} from '../services/store';
import {
  AlertWarningIcon,
  AntennaIcon,
  BoltIcon,
  BrainIcon,
  CheckIcon,
  CloseIcon,
  CodeIcon,
  CopyIcon,
  DiskIcon,
  FlameIcon,
  GlobeIcon,
  KeyIcon,
  LayersIntersectIcon,
  RefreshIcon,
  RobotIcon,
  ShieldIcon,
  SparklesIcon,
  TerminalIcon,
} from './Icons';
import { t } from '../i18n';
import type { LlmApiLatency, LocalAgentInfo, OllamaModelInfo } from '../types';

export const AiRadarView: Component = () => {
  const [activeTab, setActiveTab] = createSignal<string>('latency');
  const [copiedRuleId, setCopiedRuleId] = createSignal<string | null>(null);

  onMount(() => {
    fetchLlmLatencyApi();
    fetchOllamaStatusApi();
    fetchEnvVarsApi();
    fetchLocalAgentsApi();
  });

  const refreshAll = () => {
    fetchLlmLatencyApi();
    fetchOllamaStatusApi();
    fetchEnvVarsApi();
    fetchLocalAgentsApi();
  };

  const renderProviderIcon = (id: string) => {
    switch (id) {
      case 'deepseek':
        return <LayersIntersectIcon class="h-4 w-4 text-sky-400" />;
      case 'claude':
      case 'claude_code':
      case 'claude_desktop':
        return <SparklesIcon class="h-4 w-4 text-amber-400" />;
      case 'openai':
      case 'chatgpt_desktop':
        return <BrainIcon class="h-4 w-4 text-emerald-400" />;
      case 'gemini':
        return <SparklesIcon class="h-4 w-4 text-indigo-400" />;
      case 'openrouter':
        return <FlameIcon class="h-4 w-4 text-rose-400" />;
      case 'siliconflow':
        return <BoltIcon class="h-4 w-4 text-accent" />;
      case 'ollama':
        return <RobotIcon class="h-4 w-4 text-teal-400" />;
      case 'cursor':
        return <CodeIcon class="h-4 w-4 text-cyan-400" />;
      case 'windsurf':
        return <BoltIcon class="h-4 w-4 text-teal-300" />;
      case 'antigravity':
        return <AntennaIcon class="h-4 w-4 text-accent" />;
      case 'aider':
        return <TerminalIcon class="h-4 w-4 text-emerald-400" />;
      case 'vscode':
        return <CodeIcon class="h-4 w-4 text-blue-400" />;
      case 'lm_studio':
        return <DiskIcon class="h-4 w-4 text-purple-400" />;
      default:
        return <RobotIcon class="h-4 w-4 text-text-muted" />;
    }
  };

  const getLatencyBadgeClass = (lat: LlmApiLatency) => {
    if (!lat.is_reachable) {
      return 'bg-status-danger/15 text-status-danger border-status-danger/30';
    }
    const ms = lat.latency_ms || 0;
    if (ms < 300) {
      return 'bg-status-success/15 text-status-success border-status-success/30';
    }
    if (ms < 800) {
      return 'bg-status-warning/15 text-status-warning border-status-warning/30';
    }
    return 'bg-status-warning/20 text-status-warning border-status-warning/40';
  };

  // KPI Computations
  const reachableCount = createMemo(() => llmLatencies().filter((l) => l.is_reachable).length);
  const totalProbes = createMemo(() => llmLatencies().length);
  const avgLatency = createMemo(() => {
    const list = llmLatencies().filter((l) => l.is_reachable && l.latency_ms);
    if (!list.length) return 0;
    const sum = list.reduce((acc, curr) => acc + (curr.latency_ms || 0), 0);
    return Math.round(sum / list.length);
  });

  const installedAgentsCount = createMemo(() => localAgents().filter((a) => a.is_installed).length);
  const runningAgentsCount = createMemo(() => localAgents().filter((a) => a.is_running).length);

  const aiKeyVault = createMemo(() => {
    const detected = envVarsData()?.detected_api_keys || [];
    const standardProviders = [
      { key: 'ANTHROPIC_API_KEY', provider: 'Anthropic Claude', defaultIcon: 'claude' },
      { key: 'OPENAI_API_KEY', provider: 'OpenAI (GPT-4o)', defaultIcon: 'openai' },
      { key: 'DEEPSEEK_API_KEY', provider: t().aiRadar.deepseekName, defaultIcon: 'deepseek' },
      { key: 'GEMINI_API_KEY', provider: 'Google Gemini', defaultIcon: 'gemini' },
      { key: 'OPENROUTER_API_KEY', provider: 'OpenRouter', defaultIcon: 'openrouter' },
      {
        key: 'SILICONFLOW_API_KEY',
        provider: t().aiRadar.siliconflowName,
        defaultIcon: 'siliconflow',
      },
    ];

    return standardProviders.map((std) => {
      const match = detected.find(
        (d) =>
          d.key.toUpperCase() === std.key || d.provider.toLowerCase().includes(std.defaultIcon),
      );
      return {
        keyName: std.key,
        providerName: std.provider,
        iconId: std.defaultIcon,
        isConfigured: Boolean(match),
        maskedValue: match?.value || '••••••••••••••••',
        source: match?.source || '-',
      };
    });
  });

  const rulesLibrary = createMemo(() => [
    {
      id: 'fullstack-modern',
      title: t().aiRadar.ruleFullstackTitle,
      tag: 'TypeScript · Tailwind · Solid/React',
      desc: t().aiRadar.ruleFullstackDesc,
      filename: '.cursorrules / CLAUDE.md',
      content: `# Modern Fullstack Architecture Rules
- You are an expert engineer in TypeScript, SolidJS/React, and Tailwind CSS.
- Strictly adhere to type-safety. Never use \`any\`. Define interfaces for all API payloads.
- Use atomic, self-documenting CSS classes with Tailwind. Avoid custom CSS files.
- Preserve all existing code and non-destructive refactoring only.
- Output concise, clean, modular code with helpful inline documentation.`,
    },
    {
      id: 'zero-regression',
      title: t().aiRadar.ruleDefensiveTitle,
      tag: t().aiRadar.ruleDefensiveTag,
      desc: t().aiRadar.ruleDefensiveDesc,
      filename: 'CLAUDE.md / .cursorrules',
      content: `# Defensive & Zero-Regression Coding Standards
- ALWAYS maintain existing comments and unrelated logic intact.
- NEVER delete or truncate working functions unless explicitly requested.
- Explain all changes in clean Chinese markdown before generating code diffs.
- Provide verification commands and ensure 100% build passing before completing tasks.
- Keep module boundaries explicit and isolate critical state mutations.`,
    },
    {
      id: 'rapid-prototype',
      title: t().aiRadar.rulePrototypeTitle,
      tag: t().aiRadar.rulePrototypeTag,
      desc: t().aiRadar.rulePrototypeDesc,
      filename: '.cursorrules',
      content: `# Rapid Prototype MVP Rules
- Keep everything in a single, high-cohesion file where possible for fast iteration.
- Ensure the preview renders immediately with beautiful zero-config layout.
- Use clean state management and avoid over-engineering abstractions.
- Prioritize user feedback and human-first interaction language.`,
    },
  ]);

  const handleCopyRule = (rule: { id: string; title: string; content: string }) => {
    copyToClipboard(rule.content, rule.title);
    setCopiedRuleId(rule.id);
    setTimeout(() => setCopiedRuleId(null), 2000);
  };

  const getAgentCategoryLabel = (category: string) => {
    switch (category) {
      case 'cli_agent':
        return t().aiRadar.agentTypeCli;
      case 'ai_ide':
        return t().aiRadar.agentTypeIde;
      case 'local_engine':
        return t().aiRadar.agentTypeEngine;
      case 'chat_client':
        return t().aiRadar.agentTypeChat;
      default:
        return category;
    }
  };

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div class="flex items-center gap-2.5">
            <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent border border-accent/20">
              <AntennaIcon class="h-4.5 w-4.5" />
            </span>
            <h1 class="text-base font-bold text-text-primary m-0 tracking-tight">
              {t().aiRadar.title}
            </h1>
          </div>
          <p class="text-xs text-text-muted mt-1 leading-relaxed">{t().aiRadar.subtitle}</p>
        </div>

        <div class="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={refreshAll}
            disabled={isTestingLlmLatency() || isLoadingLocalAgents()}
            loading={isTestingLlmLatency() || isLoadingLocalAgents()}
          >
            <RefreshIcon
              class={`h-3.5 w-3.5 ${isTestingLlmLatency() || isLoadingLocalAgents() ? 'animate-spin' : ''}`}
            />
            <span>
              {isTestingLlmLatency() || isLoadingLocalAgents()
                ? t().aiRadar.testing
                : t().aiRadar.testLatencyBtn}
            </span>
          </Button>
        </div>
      </div>

      {/* Top 4 KPI Metrics Dashboard */}
      <div class="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {/* KPI 1: Reachability */}
        <div class="glass-card-subtle p-3.5 flex flex-col justify-between">
          <div class="flex items-center justify-between text-text-muted text-[11px]">
            <span>{t().aiRadar.kpiConnectivity}</span>
            <GlobeIcon class="h-3.5 w-3.5 text-accent" />
          </div>
          <div class="mt-2 flex items-baseline gap-1.5">
            <span class="text-xl font-bold mono text-text-primary">
              {reachableCount()}/{totalProbes()}
            </span>
            <span class="text-[10px] text-text-muted mono">
              ({totalProbes() > 0 ? Math.round((reachableCount() / totalProbes()) * 100) : 0}%)
            </span>
          </div>
        </div>

        {/* KPI 2: Average Latency */}
        <div class="glass-card-subtle p-3.5 flex flex-col justify-between">
          <div class="flex items-center justify-between text-text-muted text-[11px]">
            <span>{t().aiRadar.kpiAvgLatency}</span>
            <BoltIcon class="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div class="mt-2 flex items-baseline gap-1.5">
            <span class="text-xl font-bold mono text-text-primary">{avgLatency()}</span>
            <span class="text-[10px] text-text-muted mono">ms</span>
          </div>
        </div>

        {/* KPI 3: Local AI Agents */}
        <div class="glass-card-subtle p-3.5 flex flex-col justify-between">
          <div class="flex items-center justify-between text-text-muted text-[11px]">
            <span>{t().aiRadar.kpiAgentsCount}</span>
            <RobotIcon class="h-3.5 w-3.5 text-teal-400" />
          </div>
          <div class="mt-2 flex items-baseline gap-1.5">
            <span class="text-xl font-bold mono text-text-primary">
              {installedAgentsCount()}/{localAgents().length}
            </span>
            <Show when={runningAgentsCount() > 0}>
              <span class="text-[10px] text-status-success mono font-semibold">
                ({runningAgentsCount()} {t().aiRadar.agentRunning})
              </span>
            </Show>
          </div>
        </div>

        {/* KPI 4: Configured Keys */}
        <div class="glass-card-subtle p-3.5 flex flex-col justify-between">
          <div class="flex items-center justify-between text-text-muted text-[11px]">
            <span>{t().aiRadar.kpiKeysConfigured}</span>
            <KeyIcon class="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <div class="mt-2 flex items-baseline gap-1.5">
            <span class="text-xl font-bold mono text-text-primary">
              {aiKeyVault().filter((k) => k.isConfigured).length}/{aiKeyVault().length}
            </span>
            <span class="text-[10px] text-status-success mono font-semibold">
              {envVarsData()?.proxy_configured ? 'Proxy OK' : 'Direct'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Tabs Container */}
      <Tabs
        value={activeTab()}
        onValueChange={(details) => setActiveTab(details.value)}
        class="w-full flex flex-col"
      >
        <TabsList class="w-fit mb-4">
          <TabsTrigger value="latency">
            <AntennaIcon class="h-3.5 w-3.5" />
            <span>{t().aiRadar.tabLatency}</span>
            <span class="mono text-[10px] text-accent">({llmLatencies().length})</span>
          </TabsTrigger>

          <TabsTrigger value="agents">
            <RobotIcon class="h-3.5 w-3.5" />
            <span>{t().aiRadar.tabAgents}</span>
            <span class="mono text-[10px] text-teal-400">({installedAgentsCount()})</span>
          </TabsTrigger>

          <TabsTrigger value="ollama">
            <DiskIcon class="h-3.5 w-3.5" />
            <span>{t().aiRadar.tabOllama}</span>
            <Show when={ollamaStatus()?.is_running}>
              <span class="h-1.5 w-1.5 rounded-full bg-status-success" />
            </Show>
          </TabsTrigger>

          <TabsTrigger value="vault">
            <KeyIcon class="h-3.5 w-3.5" />
            <span>{t().aiRadar.tabVault}</span>
            <span class="mono text-[10px] text-indigo-400">
              ({aiKeyVault().filter((k) => k.isConfigured).length})
            </span>
          </TabsTrigger>

          <TabsTrigger value="rules">
            <CodeIcon class="h-3.5 w-3.5" />
            <span>{t().aiRadar.tabRules}</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Global LLM API Latency Matrix */}
        <TabsContent value="latency" class="outline-none space-y-4">
          <div class="glass-card p-5">
            <div class="flex items-center justify-between border-b border-border-subtle pb-3 mb-4">
              <div>
                <h2 class="text-sm font-bold text-text-primary m-0">
                  {t().aiRadar.latencySection}
                </h2>
                <p class="text-xs text-text-muted mt-0.5">{t().aiRadar.probingGlobal}</p>
              </div>
              <span class="rounded bg-bg-subtle border border-border-subtle px-2 py-0.5 mono text-[10px] text-text-muted">
                {t().aiRadar.probesCount.replace('{count}', llmLatencies().length.toString())}
              </span>
            </div>

            <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <For
                each={llmLatencies()}
                fallback={
                  <div class="col-span-full py-10 text-center text-xs text-text-muted mono">
                    {t().common.loading}
                  </div>
                }
              >
                {(item) => (
                  <div class="glass-card-subtle flex flex-col justify-between p-3.5 transition-all hover:border-border-hover">
                    <div>
                      {/* Provider Top Header */}
                      <div class="flex items-center justify-between pb-2 border-b border-border-subtle/60">
                        <div class="flex items-center gap-2">
                          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-bg-surface border border-border-subtle">
                            {renderProviderIcon(item.provider_id)}
                          </div>
                          <div>
                            <div class="font-bold text-xs text-text-primary">{item.name}</div>
                            <div class="mono text-[9.5px] text-text-muted truncate max-w-[110px]">
                              {item.provider_id}
                            </div>
                          </div>
                        </div>

                        {/* Latency Pill Badge */}
                        <span
                          class="rounded-full border px-2 py-0.5 text-[10px] font-bold mono tabular-nums flex items-center gap-1"
                          classList={{
                            [getLatencyBadgeClass(item)]: true,
                          }}
                        >
                          <Show
                            when={item.is_reachable}
                            fallback={
                              <span class="flex items-center gap-0.5">
                                <CloseIcon class="h-3 w-3" />
                                <span>{t().aiRadar.unreachable}</span>
                              </span>
                            }
                          >
                            <BoltIcon class="h-3 w-3" />
                            <span>{item.latency_ms} ms</span>
                          </Show>
                        </span>
                      </div>

                      {/* Endpoint & Status Detail */}
                      <div class="rounded-lg bg-bg-subtle/70 p-2 text-[10.5px] border border-border-subtle mt-2 space-y-1">
                        <div class="flex items-center justify-between text-text-muted mono truncate">
                          <span>{t().aiRadar.routeStatus}</span>
                          <span
                            class="font-medium"
                            classList={{
                              'text-status-success': item.is_reachable,
                              'text-status-danger': !item.is_reachable,
                            }}
                          >
                            {item.is_reachable
                              ? item.status_code
                                ? `HTTP ${item.status_code}`
                                : '200 OK'
                              : t().aiRadar.offlineTimeout}
                          </span>
                        </div>

                        <Show when={item.error_message}>
                          <div
                            class="text-[10px] text-status-danger leading-tight truncate flex items-center gap-1"
                            title={item.error_message || ''}
                          >
                            <AlertWarningIcon class="h-3 w-3 shrink-0" />
                            <span class="truncate">{item.error_message}</span>
                          </div>
                        </Show>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Local AI Coding Agents Probe Matrix */}
        <TabsContent value="agents" class="outline-none space-y-4">
          <div class="glass-card p-5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-4 mb-4">
              <div>
                <h2 class="text-sm font-bold text-text-primary m-0">
                  {t().aiRadar.agentsSectionTitle}
                </h2>
                <p class="text-xs text-text-muted mt-0.5">{t().aiRadar.agentsSectionDesc}</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="rounded bg-bg-subtle border border-border-subtle px-2.5 py-0.8 mono text-[11px] text-text-primary font-semibold">
                  {installedAgentsCount()} / {localAgents().length} {t().aiRadar.agentInstalled}
                </span>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <For
                each={localAgents()}
                fallback={
                  <div class="col-span-full py-10 text-center text-xs text-text-muted mono">
                    {t().common.loading}
                  </div>
                }
              >
                {(agent: LocalAgentInfo) => (
                  <div
                    class="glass-card-subtle flex flex-col justify-between p-4 border transition-all"
                    classList={{
                      'border-accent/40 bg-accent/5': agent.is_running,
                      'border-border-subtle hover:border-border-hover': !agent.is_running,
                      'opacity-60': !agent.is_installed,
                    }}
                  >
                    <div>
                      {/* Agent Header */}
                      <div class="flex items-center justify-between pb-2 border-b border-border-subtle/60">
                        <div class="flex items-center gap-2.5">
                          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-surface border border-border-subtle shrink-0">
                            {renderProviderIcon(agent.icon)}
                          </div>
                          <div>
                            <div class="font-bold text-xs text-text-primary">{agent.name}</div>
                            <span class="rounded bg-bg-subtle px-1.5 py-0.2 mono text-[9.5px] text-text-muted">
                              {getAgentCategoryLabel(agent.category)}
                            </span>
                          </div>
                        </div>

                        {/* Status Badges */}
                        <div class="flex flex-col items-end gap-1">
                          <Show
                            when={agent.is_installed}
                            fallback={
                              <Badge variant="secondary">{t().aiRadar.agentNotInstalled}</Badge>
                            }
                          >
                            <Badge variant="success">
                              {agent.version ? `v${agent.version}` : t().aiRadar.agentInstalled}
                            </Badge>
                          </Show>

                          <Show when={agent.is_running}>
                            <span class="rounded-full px-1.8 py-0.2 text-[9px] font-bold bg-accent/20 text-accent border border-accent/40 flex items-center gap-1 animate-pulse">
                              <span class="h-1 w-1 rounded-full bg-accent" />
                              <span>
                                {t().aiRadar.agentRunning} {agent.pid ? `(PID: ${agent.pid})` : ''}
                              </span>
                            </span>
                          </Show>
                        </div>
                      </div>

                      {/* Description */}
                      <p class="text-xs text-text-muted mt-2.5 mb-3 leading-relaxed">
                        {agent.description}
                      </p>

                      {/* Executable Path */}
                      <Show when={agent.path}>
                        <div class="rounded-lg bg-bg-subtle/80 p-2 text-[10px] font-mono text-text-secondary border border-border-subtle truncate flex items-center justify-between gap-1.5">
                          <span class="truncate" title={agent.path || ''}>
                            {agent.path}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(agent.path || '', agent.name)}
                            class="text-text-muted hover:text-text-primary p-0.5 shrink-0"
                            title={t().aiRadar.copyAgentPath}
                          >
                            <CopyIcon class="h-3 w-3" />
                          </button>
                        </div>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Local Ollama Model & Memory Controller */}
        <TabsContent value="ollama" class="outline-none space-y-4">
          <div class="glass-card p-5">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border-subtle pb-4 mb-4">
              <div class="flex items-center gap-2.5">
                <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 border border-accent/25 text-accent">
                  <RobotIcon class="h-4.5 w-4.5" />
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h2 class="text-sm font-bold text-text-primary m-0">
                      {t().aiRadar.ollamaSection}
                    </h2>
                    <Show
                      when={ollamaStatus()?.is_running}
                      fallback={
                        <span class="rounded bg-status-warning/15 px-2 py-0.5 text-[10px] font-semibold text-status-warning">
                          {t().aiRadar.ollamaOffline}
                        </span>
                      }
                    >
                      <span class="rounded bg-status-success/15 px-2 py-0.5 text-[10px] font-semibold text-status-success flex items-center gap-1">
                        <span class="h-1.5 w-1.5 rounded-full bg-status-success animate-pulse" />
                        <span>
                          {t().aiRadar.ollamaRunning}{' '}
                          {ollamaStatus()?.version ? `(v${ollamaStatus()?.version})` : ''}
                        </span>
                      </span>
                    </Show>
                  </div>
                  <p class="text-xs text-text-muted mt-0.5">{t().aiRadar.ollamaDesc}</p>
                </div>
              </div>
            </div>

            {/* Ollama Loaded Models Sub-Grid */}
            <Show
              when={ollamaStatus()?.is_running}
              fallback={
                <div class="py-10 text-center text-xs text-text-muted space-y-2">
                  <p class="font-medium text-text-secondary">{t().aiRadar.ollamaNotRunning}</p>
                  <p class="mono text-[11px] text-text-muted bg-bg-surface px-3 py-1.5 rounded-md inline-block border border-border-subtle">
                    ollama serve & ollama run deepseek-r1:8b
                  </p>
                </div>
              }
            >
              <div class="space-y-4">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-bold text-text-secondary">{t().aiRadar.loadedModels}</span>
                  <span class="mono text-text-muted text-[11px]">
                    {t().aiRadar.totalVramUsage}:{' '}
                    <strong class="text-text-primary">
                      {formatTotalBytes(ollamaStatus()?.total_vram_used_bytes || 0)}
                    </strong>
                  </span>
                </div>

                <For
                  each={ollamaStatus()?.loaded_models || []}
                  fallback={
                    <div class="rounded-lg border border-dashed border-border-default bg-bg-surface/50 p-6 text-center text-xs text-text-muted">
                      {t().aiRadar.ollamaEmptyLoaded}
                    </div>
                  }
                >
                  {(model: OllamaModelInfo) => (
                    <div class="glass-card-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-xs text-text-primary">{model.name}</span>
                          <span class="rounded bg-accent/15 border border-accent/30 px-1.8 py-0.2 mono text-[10px] text-accent font-bold">
                            {model.parameter_size || 'Unknown'}
                          </span>
                          <span class="rounded bg-bg-subtle border border-border-subtle px-1.8 py-0.2 mono text-[10px] text-text-muted">
                            {model.quantization_level || 'Q4'}
                          </span>
                        </div>

                        <div class="mt-1.5 flex flex-wrap items-center gap-3 text-[10.5px] text-text-muted mono">
                          <span>
                            {t().aiRadar.vramUsage}:{' '}
                            <strong class="text-status-success">
                              {formatTotalBytes(model.vram_bytes)}
                            </strong>
                          </span>
                          <span>
                            {t().aiRadar.vramUsageLabel} {formatTotalBytes(model.size_bytes)}
                          </span>
                          <Show when={model.expires_at}>
                            <span class="text-text-tertiary">
                              {t().aiRadar.expiresAt}:{' '}
                              {model.expires_at?.split('T')[1]?.split('.')[0]}
                            </span>
                          </Show>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => unloadOllamaModelApi(model.name)}
                        disabled={isUnloadingOllama()}
                        loading={isUnloadingOllama()}
                        class="self-start sm:self-auto"
                      >
                        {isUnloadingOllama() ? t().aiRadar.unloading : t().aiRadar.unloadBtn}
                      </Button>
                    </div>
                  )}
                </For>

                {/* Installed Models Library */}
                <Show when={ollamaStatus()?.installed_models?.length}>
                  <div class="mt-6 pt-4 border-t border-border-subtle">
                    <div class="text-xs font-bold text-text-secondary mb-2.5">
                      {t().aiRadar.installedModels} ({ollamaStatus()?.installed_models?.length})
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <For each={ollamaStatus()?.installed_models || []}>
                        {(name) => (
                          <span class="rounded-md border border-border-subtle bg-bg-surface px-2.5 py-1 text-xs mono text-text-primary flex items-center gap-1.5 shadow-2xs">
                            <DiskIcon class="h-3 w-3 text-text-muted" />
                            <span>{name}</span>
                          </span>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </TabsContent>

        {/* Tab 4: API Key Safe Vault */}
        <TabsContent value="vault" class="outline-none space-y-4">
          <div class="glass-card p-5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-4 mb-4">
              <div>
                <h2 class="text-sm font-bold text-text-primary m-0">{t().aiRadar.vaultTitle}</h2>
                <p class="text-xs text-text-muted mt-0.5">{t().aiRadar.vaultDesc}</p>
              </div>
              <div class="flex items-center gap-2">
                <span
                  class="rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold border flex items-center gap-1"
                  classList={{
                    'bg-status-success/15 text-status-success border-status-success/30': Boolean(
                      envVarsData()?.proxy_configured,
                    ),
                    'bg-bg-subtle text-text-muted border-border-subtle':
                      !envVarsData()?.proxy_configured,
                  }}
                >
                  <ShieldIcon class="h-3 w-3" />
                  <span>
                    {envVarsData()?.proxy_configured
                      ? t().aiRadar.proxyActive
                      : t().aiRadar.proxyInactive}
                  </span>
                </span>
              </div>
            </div>

            {/* API Keys Table */}
            <div class="overflow-x-auto rounded-lg border border-border-subtle bg-bg-base/60">
              <table class="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr class="border-b border-border-default bg-bg-subtle/90 text-[10.5px] font-bold text-text-muted uppercase tracking-wider">
                    <th class="py-2.5 px-3.5 w-10">#</th>
                    <th class="py-2.5 px-3.5">{t().aiRadar.keyProvider}</th>
                    <th class="py-2.5 px-3.5">{t().aiRadar.keyStatus}</th>
                    <th class="py-2.5 px-3.5">{t().aiRadar.keyMasked}</th>
                    <th class="py-2.5 px-3.5">{t().aiRadar.keySource}</th>
                    <th class="py-2.5 px-3.5 text-right w-24">{t().aiRadar.keyAction}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border-subtle text-[11px]">
                  <For each={aiKeyVault()}>
                    {(item, idx) => (
                      <tr class="hover:bg-bg-subtle/50 transition-colors group">
                        <td class="py-2.5 px-3.5 text-text-muted text-[10px]">{idx() + 1}</td>
                        <td class="py-2.5 px-3.5 font-bold text-text-primary">
                          <div class="flex items-center gap-2">
                            <div class="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded bg-bg-surface border border-border-subtle">
                              {renderProviderIcon(item.iconId)}
                            </div>
                            <div class="flex flex-col">
                              <span>{item.providerName}</span>
                              <span class="text-[9.5px] text-text-muted font-normal">
                                {item.keyName}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td class="py-2.5 px-3.5">
                          <span
                            class="rounded px-2 py-0.5 text-[10px] font-bold uppercase"
                            classList={{
                              'bg-status-success/15 text-status-success border-status-success/30':
                                item.isConfigured,
                              'bg-bg-surface text-text-muted border border-border-subtle':
                                !item.isConfigured,
                            }}
                          >
                            {item.isConfigured ? t().aiRadar.keyConfigured : t().aiRadar.keyMissing}
                          </span>
                        </td>
                        <td class="py-2.5 px-3.5 text-text-secondary">{item.maskedValue}</td>
                        <td class="py-2.5 px-3.5 text-text-muted text-[10.5px]">{item.source}</td>
                        <td class="py-2.5 px-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                `export ${item.keyName}="sk-your-key-here"`,
                                item.keyName,
                              )
                            }
                            class="rounded border border-border-default bg-bg-surface px-2 py-0.8 text-[10px] text-text-muted hover:text-text-primary transition-all flex items-center gap-1 ml-auto"
                            title={t().aiRadar.copyExport}
                          >
                            <CopyIcon class="h-3 w-3" />
                            <span>{t().devops.copy}</span>
                          </button>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>

            {/* Proxy Environment Summary */}
            <Show when={envVarsData()?.proxy_summary}>
              <div class="mt-4 rounded-lg border border-border-subtle bg-bg-surface/60 p-3 flex items-center justify-between text-xs">
                <div class="flex items-center gap-2">
                  <GlobeIcon class="h-4 w-4 text-accent" />
                  <span class="text-text-muted">{t().aiRadar.proxySectionTitle}:</span>
                  <span class="mono font-semibold text-text-primary">
                    {envVarsData()?.proxy_summary}
                  </span>
                </div>
              </div>
            </Show>
          </div>
        </TabsContent>

        {/* Tab 5: Rules & Prompt Ammo Hub */}
        <TabsContent value="rules" class="outline-none space-y-4">
          <div class="glass-card p-5">
            <div class="border-b border-border-subtle pb-3 mb-4">
              <h2 class="text-sm font-bold text-text-primary m-0">{t().aiRadar.rulesTitle}</h2>
              <p class="text-xs text-text-muted mt-0.5">{t().aiRadar.rulesDesc}</p>
            </div>

            <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <For each={rulesLibrary()}>
                {(rule) => (
                  <div class="glass-card-subtle flex flex-col justify-between p-4 border border-border-subtle hover:border-border-hover transition-all">
                    <div>
                      <div class="flex items-center justify-between mb-2">
                        <span class="rounded bg-accent/15 border border-accent/30 px-2 py-0.5 text-[10px] font-bold text-accent">
                          {rule.tag}
                        </span>
                        <span class="mono text-[10px] text-text-muted">{rule.filename}</span>
                      </div>

                      <h3 class="text-xs font-bold text-text-primary mb-1">{rule.title}</h3>
                      <p class="text-xs text-text-muted mb-3 leading-relaxed">{rule.desc}</p>

                      <pre class="max-h-36 overflow-y-auto rounded-md bg-bg-base/90 p-2.5 text-[10px] font-mono text-text-secondary border border-border-subtle whitespace-pre-wrap">
                        {rule.content}
                      </pre>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleCopyRule(rule)}
                      class="mt-4 w-full"
                    >
                      <Show
                        when={copiedRuleId() === rule.id}
                        fallback={
                          <>
                            <CopyIcon class="h-3.5 w-3.5" />
                            <span>{t().aiRadar.copyRule}</span>
                          </>
                        }
                      >
                        <CheckIcon class="h-3.5 w-3.5 text-status-success" />
                        <span class="text-status-success">{t().aiRadar.ruleCopied}</span>
                      </Show>
                    </Button>
                  </div>
                )}
              </For>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
