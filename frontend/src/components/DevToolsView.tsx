import { For, Show, createMemo, createSignal, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import {
  copyToClipboard,
  devTools,
  envVarsData,
  fetchEnvVarsApi,
  isLoadingEnvVars,
} from '../services/store';
import {
  BrainIcon,
  CopyIcon,
  DevToolsIcon,
  EyeClosedIcon,
  EyeOpenIcon,
  KeyIcon,
  NoteIcon,
  RefreshIcon,
  RobotIcon,
  SearchIcon,
  ServerIcon,
  TargetIcon,
} from './Icons';
import { Badge, Button, Input } from './ui';
import { t } from '../i18n';
import type { DetectedApiKey, EnvVarEntry } from '../types';

interface KnownApiKeyDef {
  key: string;
  name: string;
  provider: string;
  category: 'ai' | 'cloud';
  docsUrl?: string;
}

const KNOWN_API_KEYS: KnownApiKeyDef[] = [
  // AI & LLM
  {
    key: 'OPENAI_API_KEY',
    name: 'OpenAI API Key',
    provider: 'OpenAI (GPT-4o / o3)',
    category: 'ai',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    key: 'ANTHROPIC_API_KEY',
    name: 'Anthropic Claude Key',
    provider: 'Anthropic (Claude 3.5 / 3.7)',
    category: 'ai',
    docsUrl: 'https://console.anthropic.com/',
  },
  {
    key: 'DEEPSEEK_API_KEY',
    name: 'DeepSeek API Key',
    provider: 'DeepSeek (V3 / R1)',
    category: 'ai',
    docsUrl: 'https://platform.deepseek.com/',
  },
  {
    key: 'GEMINI_API_KEY',
    name: 'Google Gemini Key',
    provider: 'Google AI Studio',
    category: 'ai',
    docsUrl: 'https://aistudio.google.com/',
  },
  {
    key: 'GROQ_API_KEY',
    name: 'Groq LPU Key',
    provider: 'Groq Cloud',
    category: 'ai',
    docsUrl: 'https://console.groq.com/',
  },
  {
    key: 'OPENROUTER_API_KEY',
    name: 'OpenRouter Key',
    provider: 'OpenRouter Aggregator',
    category: 'ai',
    docsUrl: 'https://openrouter.ai/keys',
  },
  {
    key: 'SILICONFLOW_API_KEY',
    name: 'SiliconFlow Key',
    provider: 'SiliconFlow Cloud',
    category: 'ai',
    docsUrl: 'https://cloud.siliconflow.cn/',
  },
  {
    key: 'MISTRAL_API_KEY',
    name: 'Mistral AI Key',
    provider: 'Mistral Platform',
    category: 'ai',
    docsUrl: 'https://console.mistral.ai/',
  },
  {
    key: 'MOONSHOT_API_KEY',
    name: 'Moonshot (Kimi) Key',
    provider: 'Moonshot AI / Kimi',
    category: 'ai',
    docsUrl: 'https://platform.moonshot.cn/',
  },
  {
    key: 'ZHIPU_API_KEY',
    name: 'Zhipu GLM Key',
    provider: 'Zhipu AI / GLM',
    category: 'ai',
    docsUrl: 'https://open.bigmodel.cn/',
  },
  {
    key: 'ELEVENLABS_API_KEY',
    name: 'ElevenLabs Voice Key',
    provider: 'ElevenLabs AI Voice',
    category: 'ai',
    docsUrl: 'https://elevenlabs.io/',
  },
  {
    key: 'HF_TOKEN',
    name: 'HuggingFace Token',
    provider: 'HuggingFace Hub',
    category: 'ai',
    docsUrl: 'https://huggingface.co/settings/tokens',
  },
  {
    key: 'TAVILY_API_KEY',
    name: 'Tavily Search Key',
    provider: 'Tavily AI Search',
    category: 'ai',
    docsUrl: 'https://tavily.com/',
  },
  {
    key: 'PERPLEXITY_API_KEY',
    name: 'Perplexity Key',
    provider: 'Perplexity AI',
    category: 'ai',
    docsUrl: 'https://www.perplexity.ai/settings/api',
  },
  {
    key: 'COHERE_API_KEY',
    name: 'Cohere API Key',
    provider: 'Cohere Platform',
    category: 'ai',
    docsUrl: 'https://dashboard.cohere.com/api-keys',
  },
  {
    key: 'OLLAMA_HOST',
    name: 'Ollama Host Endpoint',
    provider: 'Local Ollama Daemon',
    category: 'ai',
    docsUrl: 'https://ollama.com/',
  },

  // Cloud & DevOps & SaaS
  {
    key: 'GITHUB_TOKEN',
    name: 'GitHub Personal Token',
    provider: 'GitHub / Actions',
    category: 'cloud',
    docsUrl: 'https://github.com/settings/tokens',
  },
  {
    key: 'AWS_ACCESS_KEY_ID',
    name: 'AWS Access Key ID',
    provider: 'Amazon Web Services',
    category: 'cloud',
    docsUrl: 'https://console.aws.amazon.com/',
  },
  {
    key: 'AWS_SECRET_ACCESS_KEY',
    name: 'AWS Secret Access Key',
    provider: 'Amazon Web Services',
    category: 'cloud',
    docsUrl: 'https://console.aws.amazon.com/',
  },
  {
    key: 'CLOUDFLARE_API_TOKEN',
    name: 'Cloudflare API Token',
    provider: 'Cloudflare Workers / CDN',
    category: 'cloud',
    docsUrl: 'https://dash.cloudflare.com/profile/api-tokens',
  },
  {
    key: 'VERCEL_TOKEN',
    name: 'Vercel Token',
    provider: 'Vercel Platform',
    category: 'cloud',
    docsUrl: 'https://vercel.com/account/tokens',
  },
  {
    key: 'SUPABASE_KEY',
    name: 'Supabase Key',
    provider: 'Supabase BaaS',
    category: 'cloud',
    docsUrl: 'https://supabase.com/',
  },
  {
    key: 'STRIPE_SECRET_KEY',
    name: 'Stripe Secret Key',
    provider: 'Stripe Payments',
    category: 'cloud',
    docsUrl: 'https://dashboard.stripe.com/apikeys',
  },
  {
    key: 'SENTRY_AUTH_TOKEN',
    name: 'Sentry Auth Token',
    provider: 'Sentry Monitoring',
    category: 'cloud',
    docsUrl: 'https://sentry.io/settings/auth-tokens/',
  },
  {
    key: 'RESEND_API_KEY',
    name: 'Resend API Key',
    provider: 'Resend Email API',
    category: 'cloud',
    docsUrl: 'https://resend.com/api-keys',
  },
];

export const DevToolsView: Component = () => {
  const [activeTab, setActiveTab] = createSignal<'tools' | 'api_keys' | 'path' | 'env'>('tools');
  const [searchEnv, setSearchEnv] = createSignal('');
  const [searchKeys, setSearchKeys] = createSignal('');
  const [selectedKeyCategory, setSelectedKeyCategory] = createSignal<
    'ALL' | 'ai' | 'cloud' | 'saas' | 'custom'
  >('ALL');
  const [showCatalog, setShowCatalog] = createSignal(false);
  const [selectedCategory, setSelectedCategory] = createSignal<string>('ALL');
  const [revealedSecrets, setRevealedSecrets] = createSignal<Record<string, boolean>>({});

  onMount(() => {
    fetchEnvVarsApi();
  });

  const tools = () => devTools();

  const installedCount = createMemo(() => {
    return tools().filter((d) => d.is_installed).length;
  });

  // Map variable names to values for rapid lookup
  const envMap = createMemo(() => {
    const map: Record<string, string> = {};
    const list = envVarsData()?.env_vars || [];
    for (const item of list) {
      map[item.name] = item.value;
    }
    return map;
  });

  // Detected API Keys from backend deep scanner
  const detectedKeys = createMemo(() => {
    return envVarsData()?.detected_api_keys || [];
  });

  const filteredDetectedKeys = createMemo(() => {
    const list = detectedKeys();
    const q = searchKeys().trim().toLowerCase();
    const cat = selectedKeyCategory();

    return list.filter((item: DetectedApiKey) => {
      if (cat !== 'ALL' && item.category !== cat) return false;
      if (!q) return true;
      return (
        item.key.toLowerCase().includes(q) ||
        item.provider.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q)
      );
    });
  });

  const toggleSecretReveal = (name: string) => {
    setRevealedSecrets((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const maskSecretValue = (val: string) => {
    if (!val) return '';
    if (val.length <= 8) return '••••••••';
    return `${val.slice(0, 4)}••••••••${val.slice(-4)}`;
  };

  // Known API keys with detection state for reference catalog
  const enrichedKnownKeys = createMemo(() => {
    const map = envMap();
    const q = searchKeys().trim().toLowerCase();

    return KNOWN_API_KEYS.map((def) => {
      const val = map[def.key];
      const isConfigured = Boolean(val && val.trim() !== '');
      return {
        ...def,
        value: val || '',
        isConfigured,
      };
    }).filter((item) => {
      if (!q) return true;
      return (
        item.key.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.provider.toLowerCase().includes(q)
      );
    });
  });

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

  const renderKeyIcon = (category: string, provider: string) => {
    const p = (provider || '').toLowerCase();
    if (
      p.includes('openai') ||
      p.includes('anthropic') ||
      p.includes('claude') ||
      p.includes('gemini') ||
      p.includes('deepseek') ||
      p.includes('groq') ||
      p.includes('mistral') ||
      p.includes('cohere')
    ) {
      return <BrainIcon class="h-4 w-4 text-purple-400 shrink-0" />;
    }
    if (
      p.includes('aws') ||
      p.includes('azure') ||
      p.includes('google') ||
      p.includes('cloudflare') ||
      p.includes('vercel') ||
      p.includes('supabase')
    ) {
      return <ServerIcon class="h-4 w-4 text-sky-400 shrink-0" />;
    }
    if (p.includes('github') || p.includes('gitlab') || p.includes('npm')) {
      return <DevToolsIcon class="h-4 w-4 text-emerald-400 shrink-0" />;
    }
    if (category === 'ai') return <RobotIcon class="h-4 w-4 text-accent shrink-0" />;
    if (category === 'cloud') return <ServerIcon class="h-4 w-4 text-sky-400 shrink-0" />;
    return <KeyIcon class="h-4 w-4 text-accent shrink-0" />;
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
            <p class="text-xs text-text-muted m-0 mt-0.5">{t().devops.toolchainSubtitle}</p>
          </div>
        </div>

        {/* Action & Stats */}
        <div class="flex items-center gap-2.5">
          <Show when={envVarsData()?.proxy_configured}>
            <Badge variant="warning">{t().devops.proxyConfigured}</Badge>
          </Show>

          <Button
            type="button"
            variant="default"
            onClick={() => fetchEnvVarsApi()}
            disabled={isLoadingEnvVars()}
            loading={isLoadingEnvVars()}
          >
            <RefreshIcon class="h-3.5 w-3.5" classList={{ 'animate-spin': isLoadingEnvVars() }} />
            <span>{t().envVars.refreshBtn}</span>
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div class="flex items-center gap-2 border-b border-border-subtle pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('tools')}
          class="flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shrink-0"
          classList={{
            'bg-accent text-white shadow-xs': activeTab() === 'tools',
            'bg-bg-surface text-text-muted hover:text-text-primary border border-border-default':
              activeTab() !== 'tools',
          }}
        >
          <span>{t().devops.tabToolchains}</span>
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

        {/* TAB 2: API Keys Radar */}
        <button
          type="button"
          onClick={() => setActiveTab('api_keys')}
          class="flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shrink-0"
          classList={{
            'bg-accent text-white shadow-xs': activeTab() === 'api_keys',
            'bg-bg-surface text-text-muted hover:text-text-primary border border-border-default':
              activeTab() !== 'api_keys',
          }}
        >
          <span>{t().devops.tabApiKeys}</span>
          <span
            class="rounded-full px-1.5 py-0.2 text-[10px] mono tabular-nums"
            classList={{
              'bg-white/20 text-white': activeTab() === 'api_keys',
              'bg-status-success/15 text-status-success border border-status-success/30 font-bold':
                activeTab() !== 'api_keys' && detectedKeys().length > 0,
              'bg-bg-subtle text-text-muted':
                activeTab() !== 'api_keys' && detectedKeys().length === 0,
            }}
          >
            {detectedKeys().length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('path')}
          class="flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shrink-0"
          classList={{
            'bg-accent text-white shadow-xs': activeTab() === 'path',
            'bg-bg-surface text-text-muted hover:text-text-primary border border-border-default':
              activeTab() !== 'path',
          }}
        >
          <span>{t().devops.tabPath}</span>
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
          class="flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shrink-0"
          classList={{
            'bg-accent text-white shadow-xs': activeTab() === 'env',
            'bg-bg-surface text-text-muted hover:text-text-primary border border-border-default':
              activeTab() !== 'env',
          }}
        >
          <span>{t().devops.tabEnv}</span>
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
                      />
                    </div>

                    <div class="mt-2 text-[11px] mono">
                      <span class="text-text-muted">{t().devops.category}: </span>
                      <span class="text-text-secondary">{tool.category}</span>
                    </div>

                    <div class="mt-1 text-[11px] mono">
                      <span class="text-text-muted">{t().devops.versionLabel}: </span>
                      <span class="text-accent font-medium">
                        {tool.version || t().devops.notInstalled}
                      </span>
                    </div>
                  </div>

                  <div class="mt-3 pt-2.5 border-t border-border-subtle flex items-center justify-between">
                    <span
                      class="text-[10px] mono text-text-muted truncate max-w-[120px]"
                      title={tool.path || ''}
                    >
                      {tool.path || '-'}
                    </span>
                    <Show when={tool.path}>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(tool.path || '', tool.name)}
                        class="rounded border border-border-default bg-bg-surface px-1.5 py-0.5 text-[9.5px] text-text-muted hover:text-text-primary transition-colors shrink-0"
                        title={t().devops.copyPath}
                      >
                        {t().devops.copy}
                      </button>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </section>
      </Show>

      {/* TAB 2: API Keys Radar (AI & Cloud Services) */}
      <Show when={activeTab() === 'api_keys'}>
        <section class="space-y-4">
          {/* Top Overview & Filter Bar */}
          <div class="glass-card flex flex-col md:flex-row md:items-center justify-between gap-3 p-4">
            <div>
              <div class="flex items-center gap-2">
                <TargetIcon class="h-4.5 w-4.5 text-accent" />
                <h3 class="text-xs font-bold text-text-primary m-0">
                  {t().devops.detectedLocalTitle}
                </h3>
                <span class="rounded-full bg-status-success/15 border border-status-success/30 px-2 py-0.2 text-[11px] font-mono font-bold text-status-success">
                  {detectedKeys().length}
                </span>
              </div>
              <p class="text-xs text-text-muted m-0 mt-0.5">{t().devops.detectedLocalSubtitle}</p>
            </div>

            <div class="flex flex-wrap items-center gap-2.5">
              {/* Category Pills */}
              <div class="flex items-center gap-1 bg-bg-surface/80 p-1 rounded-lg border border-border-subtle">
                <button
                  type="button"
                  onClick={() => setSelectedKeyCategory('ALL')}
                  class="rounded px-2.5 py-0.8 text-[10.5px] font-medium transition-all"
                  classList={{
                    'bg-accent text-white shadow-2xs': selectedKeyCategory() === 'ALL',
                    'text-text-muted hover:text-text-primary': selectedKeyCategory() !== 'ALL',
                  }}
                >
                  {t().devops.filterAllCategories}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedKeyCategory('ai')}
                  class="rounded px-2.5 py-0.8 text-[10.5px] font-medium transition-all"
                  classList={{
                    'bg-accent text-white shadow-2xs': selectedKeyCategory() === 'ai',
                    'text-text-muted hover:text-text-primary': selectedKeyCategory() !== 'ai',
                  }}
                >
                  {t().devops.filterAi}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedKeyCategory('cloud')}
                  class="rounded px-2.5 py-0.8 text-[10.5px] font-medium transition-all"
                  classList={{
                    'bg-accent text-white shadow-2xs': selectedKeyCategory() === 'cloud',
                    'text-text-muted hover:text-text-primary': selectedKeyCategory() !== 'cloud',
                  }}
                >
                  {t().devops.filterCloud}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedKeyCategory('saas')}
                  class="rounded px-2.5 py-0.8 text-[10.5px] font-medium transition-all"
                  classList={{
                    'bg-accent text-white shadow-2xs': selectedKeyCategory() === 'saas',
                    'text-text-muted hover:text-text-primary': selectedKeyCategory() !== 'saas',
                  }}
                >
                  {t().devops.filterSaas}
                </button>
              </div>

              {/* Search Box */}
              <Input
                type="text"
                placeholder={t().devops.searchKeysPlaceholder}
                value={searchKeys()}
                onInput={(e) => setSearchKeys(e.currentTarget.value)}
                class="w-full sm:w-48"
              />
            </div>
          </div>

          {/* Hero Section 1: 本机已检测到的真实有效 API 密钥 */}
          <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <For
              each={filteredDetectedKeys()}
              fallback={
                <div class="col-span-full glass-card py-10 text-center text-xs text-text-muted space-y-2">
                  <SearchIcon class="h-7 w-7 text-text-muted mx-auto" />
                  <p class="font-medium text-text-secondary m-0">{t().devops.noDetectedKeys}</p>
                </div>
              }
            >
              {(item: DetectedApiKey) => {
                const isRevealed = () => Boolean(revealedSecrets()[item.key]);
                const displayValue = () => {
                  return isRevealed() ? item.value : maskSecretValue(item.value);
                };

                return (
                  <div class="glass-card flex flex-col justify-between p-3.5 transition-all duration-200 hover:border-border-hover border-status-success/30 bg-status-success/5 shadow-xs">
                    <div>
                      {/* Top: Icon + Name + Source Badge */}
                      <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2 min-w-0">
                          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-bg-surface border border-border-subtle shrink-0">
                            {renderKeyIcon(item.category, item.provider)}
                          </div>
                          <div class="flex flex-col truncate">
                            <span class="font-bold text-xs text-text-primary truncate">
                              {item.provider}
                            </span>
                            <span class="text-[10px] text-text-muted truncate">
                              {item.category.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {/* Source Tag */}
                        <span class="rounded bg-accent/15 border border-accent/25 px-1.8 py-0.2 font-mono text-[9px] font-semibold text-accent shrink-0">
                          {item.source}
                        </span>
                      </div>

                      {/* Variable Name */}
                      <div class="mb-2">
                        <span class="font-mono text-xs font-bold text-accent">{item.key}</span>
                      </div>

                      {/* Masked Value Box */}
                      <div class="rounded bg-bg-base/90 p-2 border border-border-subtle text-[11px] font-mono mb-3 min-h-[34px] flex items-center justify-between">
                        <span
                          class="text-text-secondary truncate max-w-[170px]"
                          classList={{ 'tracking-wider text-text-muted': !isRevealed() }}
                        >
                          {displayValue()}
                        </span>

                        <div class="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleSecretReveal(item.key)}
                            class="text-[10px] text-text-muted hover:text-text-primary px-1"
                            title={isRevealed() ? t().devops.hideSecret : t().devops.showSecret}
                          >
                            <Show
                              when={isRevealed()}
                              fallback={<EyeOpenIcon class="h-3.5 w-3.5" />}
                            >
                              <EyeClosedIcon class="h-3.5 w-3.5" />
                            </Show>
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(item.value, item.key)}
                            class="text-[10px] text-text-muted hover:text-accent px-1"
                            title={t().devops.copy}
                          >
                            <CopyIcon class="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div class="pt-2 border-t border-border-subtle flex items-center justify-between text-[10.5px]">
                      <button
                        type="button"
                        onClick={() => {
                          const exportStr = `export ${item.key}="${item.value}"`;
                          copyToClipboard(exportStr, `export ${item.key}`);
                        }}
                        class="text-text-muted hover:text-accent font-mono text-[10px]"
                      >
                        {t().devops.copyExport} ↗
                      </button>

                      <span class="text-[9.5px] text-text-muted">
                        {t().devops.sourceLabel}: {item.source}
                      </span>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>

          {/* Collapsible Section 2: 常见服务商支持目录与配置指引 */}
          <div class="pt-3">
            <div class="glass-card p-3">
              <button
                type="button"
                onClick={() => setShowCatalog(!showCatalog())}
                class="w-full flex items-center justify-between text-left transition-colors"
              >
                <div class="flex items-center gap-2">
                  <NoteIcon class="h-4 w-4 text-accent" />
                  <span class="text-xs font-bold text-text-secondary">
                    {t().devops.allCatalogTitle}
                  </span>
                  <span class="text-[10.5px] text-text-muted">
                    ({t().devops.providersCount.replace('{count}', String(KNOWN_API_KEYS.length))})
                  </span>
                </div>
                <span class="text-xs text-text-muted">
                  {showCatalog() ? t().devops.collapseCatalog : t().devops.expandCatalog}
                </span>
              </button>

              <Show when={showCatalog()}>
                <div class="mt-4 pt-3 border-t border-border-subtle grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <For each={enrichedKnownKeys()}>
                    {(item) => (
                      <div
                        class="glass-card-subtle flex flex-col justify-between p-3 rounded-lg border border-border-subtle"
                        classList={{
                          'border-status-success/30 bg-status-success/5': item.isConfigured,
                          'opacity-65': !item.isConfigured,
                        }}
                      >
                        <div>
                          <div class="flex items-center justify-between mb-1.5">
                            <div class="flex items-center gap-1.5">
                              {renderKeyIcon(item.category, item.provider || item.name)}
                              <span class="font-bold text-xs text-text-primary">{item.name}</span>
                            </div>

                            <span
                              class="rounded px-1.5 py-0.2 font-mono text-[9px] font-semibold"
                              classList={{
                                'bg-status-success/15 text-status-success': item.isConfigured,
                                'bg-bg-subtle text-text-muted': !item.isConfigured,
                              }}
                            >
                              {item.isConfigured ? t().devops.keyConfigured : t().devops.keyNotSet}
                            </span>
                          </div>

                          <div class="font-mono text-[11px] text-accent mb-1 truncate">
                            {item.key}
                          </div>
                        </div>

                        <div class="mt-2 pt-2 border-t border-border-subtle flex items-center justify-between text-[10px]">
                          <span class="text-text-muted truncate max-w-[120px]">
                            {item.provider}
                          </span>
                          <Show when={item.docsUrl}>
                            <a
                              href={item.docsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              class="text-text-muted hover:text-accent underline"
                            >
                              Console ↗
                            </a>
                          </Show>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>
        </section>
      </Show>

      {/* TAB 3: $PATH Resolution Chain */}
      <Show when={activeTab() === 'path'}>
        <section class="glass-card p-4 space-y-3">
          <div class="flex items-center justify-between border-b border-border-subtle pb-3">
            <div>
              <h3 class="text-xs font-bold text-text-primary m-0">
                {t().devops.tabPath} ({envVarsData()?.path_entries.length || 0})
              </h3>
              <p class="text-xs text-text-muted mt-0.5 m-0">{t().devops.pathPriorityHint}</p>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                copyToClipboard(
                  envVarsData()
                    ?.path_entries.map((p) => p.path)
                    .join(':') || '',
                  '$PATH',
                )
              }
            >
              {t().devops.copy} $PATH
            </Button>
          </div>

          {/* Table */}
          <div class="overflow-x-auto rounded-lg border border-border-subtle">
            <table class="w-full text-left text-xs">
              <thead class="bg-bg-subtle/50 text-[10.5px] uppercase tracking-wider text-text-muted border-b border-border-subtle font-mono">
                <tr>
                  <th class="py-2 px-3 text-center w-12">#</th>
                  <th class="py-2 px-3">{t().devops.tabPath}</th>
                  <th class="py-2 px-3">{t().common.status}</th>
                  <th class="py-2 px-3 text-right">{t().common.actions}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle">
                <For each={envVarsData()?.path_entries}>
                  {(entry) => (
                    <tr class="hover:bg-bg-subtle/30 transition-colors">
                      <td class="py-2 px-3 text-center mono text-text-muted text-[10px]">
                        #{entry.index + 1}
                      </td>
                      <td class="py-2 px-3 mono text-[11px] text-text-primary">
                        <span class="break-all">{entry.path}</span>
                      </td>
                      <td class="py-2 px-3">
                        <span
                          class="rounded px-1.5 py-0.5 text-[9.5px] font-bold"
                          classList={{
                            'bg-status-success/15 text-status-success border border-status-success/30':
                              entry.exists,
                            'bg-status-danger/15 text-status-danger border border-status-danger/30':
                              !entry.exists,
                          }}
                        >
                          {entry.exists ? 'OK' : 'Missing'}
                        </span>
                      </td>
                      <td class="py-2 px-3 text-right whitespace-nowrap">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => copyToClipboard(entry.path, 'Path entry')}
                        >
                          {t().devops.copy}
                        </Button>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </section>
      </Show>

      {/* TAB 4: Environment Variables Browser */}
      <Show when={activeTab() === 'env'}>
        <section class="glass-card p-4 space-y-4">
          {/* Filter Bar */}
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Input
              type="text"
              placeholder={t().devops.searchEnvPlaceholder}
              value={searchEnv()}
              onInput={(e) => setSearchEnv(e.currentTarget.value)}
              class="w-full max-w-md"
            />

            {/* Category Filter Pills */}
            <div class="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              <For each={categories()}>
                {(cat) => (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    class="rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all shrink-0"
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
                  <th class="px-3.5 py-2.5">{t().devops.category}</th>
                  <th class="px-3.5 py-2.5">{t().devops.varName}</th>
                  <th class="px-3.5 py-2.5">{t().devops.varValue}</th>
                  <th class="px-3.5 py-2.5 text-right">{t().devops.action}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle font-mono">
                <For
                  each={filteredEnvVars()}
                  fallback={
                    <tr>
                      <td colspan={4} class="py-8 text-center text-text-muted">
                        {t().devops.noMatchEnv}
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
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => toggleSecretReveal(entry.name)}
                              >
                                {isRevealed() ? t().devops.hideSecret : t().devops.showSecret}
                              </Button>
                            </Show>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => copyToClipboard(entry.value, entry.name)}
                            >
                              {t().devops.copy}
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
      </Show>
    </div>
  );
};
