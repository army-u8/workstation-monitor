import { For, Show, createMemo, createSignal, onMount } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { Component } from 'solid-js';
import { Badge, Button, Tabs, TabsContent, TabsList, TabsTrigger } from './ui';
import {
  fetchTokenAnalyticsApi,
  fetchTokenSessionsApi,
  isLoadingTokenAnalytics,
  isRefreshingTokenAnalytics,
  refreshTokenAnalyticsApi,
  setTokenCurrency,
  setTokenTimeRange,
  tokenAnalytics,
  tokenCurrency,
  tokenSessions,
  tokenSummary,
  tokenTimeRange,
} from '../services/store';
import {
  AntennaIcon,
  BoltIcon,
  BrainIcon,
  CalendarStatsIcon,
  ClockIcon,
  CodeIcon,
  CoinsIcon,
  CpuIcon,
  FlameIcon,
  FolderIcon,
  ReceiptIcon,
  RefreshIcon,
  RobotIcon,
  SavingsIcon,
  SearchIcon,
  SparklesIcon,
  TerminalIcon,
  TrendingUpIcon,
} from './Icons';
import { locale, t } from '../i18n';
import type { TokenAgentStats, TokenHeatmapDay, TokenModelStats, TokenProjectStats, TokenTrendPoint } from '../types';

export const TokenAnalyticsView: Component = () => {
  const [activeBreakdownTab, setActiveBreakdownTab] = createSignal<string>('models');
  const [activeTrendRange, setActiveTrendRange] = createSignal<'24h' | '7d' | '30d'>('7d');
  const [sessionSearchQuery, setSessionSearchQuery] = createSignal<string>('');
  const [selectedClientFilter, setSelectedClientFilter] = createSignal<string>('');
  const [hoveredHeatmapDay, setHoveredHeatmapDay] = createSignal<{
    day: TokenHeatmapDay;
    x: number;
    y: number;
  } | null>(null);

  onMount(() => {
    fetchTokenAnalyticsApi();
    fetchTokenSessionsApi(100, 0);
  });

  const handleTimeRangeChange = (range: 'today' | '7d' | '30d' | 'all') => {
    setTokenTimeRange(range);
    fetchTokenAnalyticsApi(range);
  };

  const handleRefresh = () => {
    refreshTokenAnalyticsApi();
  };

  const formatHeatmapDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    });
  };

  const formatTokens = (count: number): string => {
    if (!count || count === 0) return '0';
    if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(2)}B`;
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(2)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
    return count.toLocaleString();
  };

  const formatCost = (usd: number, cny: number): string => {
    if (tokenCurrency() === 'CNY') {
      return `¥${(cny || usd * 7.25).toFixed(2)}`;
    }
    return `$${(usd || 0).toFixed(3)}`;
  };

  const formatTime = (ts: number): string => {
    if (!ts) return '-';
    const date = new Date(ts);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSecondsCountdown = (sec: number): string => {
    if (sec <= 0) return '0m';
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const cleanProjectName = (name?: string | null): string => {
    if (!name) return '-';
    const cleaned = name.trim();
    if (cleaned.startsWith('-Users-') || cleaned.startsWith('/Users/')) {
      const parts = cleaned.split(/[-/]/).filter(Boolean);
      return parts[parts.length - 1] || cleaned;
    }
    return cleaned;
  };

  const renderAgentIcon = (id: string) => {
    switch (id) {
      case 'claude_code':
        return <SparklesIcon class="h-4 w-4 text-amber-500 dark:text-amber-400" />;
      case 'cursor':
        return <CodeIcon class="h-4 w-4 text-cyan-600 dark:text-cyan-400" />;
      case 'windsurf':
        return <BoltIcon class="h-4 w-4 text-teal-600 dark:text-teal-300" />;
      case 'cline':
      case 'roo_code':
        return <RobotIcon class="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case 'antigravity':
        return <AntennaIcon class="h-4 w-4 text-accent" />;
      case 'codex':
      case 'opencode':
        return <BrainIcon class="h-4 w-4 text-sky-600 dark:text-sky-400" />;
      case 'continue':
      case 'aider':
        return <TerminalIcon class="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
      case 'kimi':
        return <FlameIcon class="h-4 w-4 text-rose-500 dark:text-rose-400" />;
      default:
        return <RobotIcon class="h-4 w-4 text-text-muted" />;
    }
  };

  const renderProviderBadge = (provider: string) => {
    const p = provider.toLowerCase();
    let colorClass = 'bg-slate-100 dark:bg-slate-800 text-text-secondary border-border-base';
    if (p.includes('anthropic')) {
      colorClass = 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
    } else if (p.includes('openai')) {
      colorClass = 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20';
    } else if (p.includes('google')) {
      colorClass = 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/20';
    } else if (p.includes('deepseek')) {
      colorClass = 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20';
    } else if (p.includes('ollama') || p.includes('local')) {
      colorClass = 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/20';
    }
    return (
      <span class={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${colorClass}`}>
        {provider}
      </span>
    );
  };

  // Filtered session list
  const filteredSessions = createMemo(() => {
    let list = tokenSessions();
    const query = sessionSearchQuery().trim().toLowerCase();
    const client = selectedClientFilter();

    if (client) {
      list = list.filter((s) => s.client === client);
    }

    if (query) {
      list = list.filter(
        (s) =>
          s.session_id.toLowerCase().includes(query) ||
          (s.project_name && s.project_name.toLowerCase().includes(query)) ||
          s.model.toLowerCase().includes(query) ||
          s.client.toLowerCase().includes(query),
      );
    }

    return list;
  });

  // Organize 365 days into a 7-row GitHub-style calendar grid (52 weeks x 7 days)
  const heatmapGridWeeks = createMemo(() => {
    let rawDays = tokenAnalytics()?.heatmap || [];
    if (!rawDays.length) {
      // Fallback placeholder for 365 days so the calendar grid is never blank on mount
      const today = new Date();
      const placeholder: TokenHeatmapDay[] = [];
      for (let i = 364; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        placeholder.push({
          date: `${y}-${m}-${day}`,
          total_tokens: 0,
          cost_usd: 0,
          cost_cny: 0,
          requests_count: 0,
          level: 0,
        });
      }
      rawDays = placeholder;
    }

    // Group days into columns of 7 days
    const weeks: TokenHeatmapDay[][] = [];
    let currentWeek: TokenHeatmapDay[] = [];

    for (let i = 0; i < rawDays.length; i++) {
      currentWeek.push(rawDays[i]);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }
    return weeks;
  });

  // Calculate month labels above the 52 weeks
  const heatmapMonthLabels = createMemo(() => {
    const weeks = heatmapGridWeeks();
    let lastMonth = -1;
    const currentLocale = locale() === 'zh' ? 'zh-CN' : 'en-US';
    return weeks.map((week) => {
      if (!week.length) return '';
      const firstDay = week[0];
      const [, m] = firstDay.date.split('-').map(Number);
      if (m !== lastMonth) {
        lastMonth = m;
        const dt = new Date(2026, m - 1, 1);
        return dt.toLocaleDateString(currentLocale, { month: 'short' });
      }
      return '';
    });
  });

  // Fallback trend points for cold start
  const generateTrendPlaceholders = (count: number, isHourly: boolean) => {
    const pts: TokenTrendPoint[] = [];
    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
      if (isHourly) {
        const d = new Date(now.getTime() - i * 3600 * 1000);
        pts.push({
          label: `${String(d.getHours()).padStart(2, '0')}:00`,
          timestamp: d.getTime(),
          input_tokens: 0,
          output_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          total_tokens: 0,
          cost_usd: 0,
        });
      } else {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        pts.push({
          label: `${m}/${day}`,
          timestamp: d.getTime(),
          input_tokens: 0,
          output_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          total_tokens: 0,
          cost_usd: 0,
        });
      }
    }
    return pts;
  };

  // Trend data points based on selected sub-range
  const activeTrendPoints = createMemo(() => {
    const data = tokenAnalytics();
    const range = activeTrendRange();
    if (!data) {
      if (range === '24h') return generateTrendPlaceholders(24, true);
      if (range === '30d') return generateTrendPlaceholders(30, false);
      return generateTrendPlaceholders(7, false);
    }
    const points =
      range === '24h'
        ? data.trend_24h || []
        : range === '30d'
          ? data.trend_30d || []
          : data.trend_7d || [];

    if (!points.length) {
      if (range === '24h') return generateTrendPlaceholders(24, true);
      if (range === '30d') return generateTrendPlaceholders(30, false);
      return generateTrendPlaceholders(7, false);
    }
    return points;
  });

  // Calculate max tokens for chart scaling
  const maxTrendTokens = createMemo(() => {
    const points = activeTrendPoints();
    if (!points.length) return 1;
    const maxVal = Math.max(...points.map((p) => p.total_tokens || 0));
    return maxVal > 0 ? maxVal : 1;
  });

  const totalTrendTokens = createMemo(() => {
    return activeTrendPoints().reduce((acc, p) => acc + (p.total_tokens || 0), 0);
  });

  const totalTrendCostUsd = createMemo(() => {
    return activeTrendPoints().reduce((acc, p) => acc + (p.cost_usd || 0), 0);
  });

  // SVG Waveform Path Memo
  const trendSvgPaths = createMemo(() => {
    const points = activeTrendPoints();
    const len = points.length;
    if (len < 2) return { linePath: '', areaPath: '', coords: [] };

    const max = maxTrendTokens();
    const coords = points.map((p, i) => {
      const x = (i / (len - 1)) * 100;
      const ratio = max > 0 ? Math.min((p.total_tokens || 0) / max, 1) : 0;
      // Map 0 -> 90% (bottom baseline), 1 -> 12% (top peak)
      const y = 90 - ratio * 78;
      return { x, y, point: p };
    });

    // Build smooth cubic Bezier curve
    let d = `M ${coords[0].x.toFixed(2)},${coords[0].y.toFixed(2)}`;
    for (let i = 0; i < len - 1; i++) {
      const p0 = coords[i === 0 ? 0 : i - 1];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2 >= len ? len - 1 : i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
    }

    const linePath = d;
    const areaPath = `${d} L 100,100 L 0,100 Z`;
    return { linePath, areaPath, coords };
  });

  return (
    <div class="flex flex-col gap-4">
      {/* 1. Header Toolbar & Filter Controls */}
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-base bg-bg-surface p-4 shadow-sm">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 border border-accent/20 text-accent shadow-inner">
            <CoinsIcon class="h-6 w-6" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-base font-semibold text-text-primary">
                {t().tokenAnalytics.title}
              </h1>
              <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-accent/15 text-accent border border-accent/25">
                {t().tokenAnalytics.aiHubBadge}
              </span>
            </div>
            <p class="text-xs text-text-muted mt-0.5">
              {t().tokenAnalytics.subtitle}
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          {/* Currency Toggle */}
          <div class="flex rounded-lg border border-border-base bg-bg-base p-0.5">
            <button
              onClick={() => setTokenCurrency('USD')}
              class={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                tokenCurrency() === 'USD'
                  ? 'bg-accent text-accent-fg shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {t().tokenAnalytics.currency.usd}
            </button>
            <button
              onClick={() => setTokenCurrency('CNY')}
              class={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                tokenCurrency() === 'CNY'
                  ? 'bg-accent text-accent-fg shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {t().tokenAnalytics.currency.cny}
            </button>
          </div>

          {/* Time Range Filter Buttons */}
          <div class="flex rounded-lg border border-border-base bg-bg-base p-0.5">
            <button
              onClick={() => handleTimeRangeChange('today')}
              class={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                tokenTimeRange() === 'today'
                  ? 'bg-accent text-accent-fg shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {t().tokenAnalytics.timeRange.today}
            </button>
            <button
              onClick={() => handleTimeRangeChange('7d')}
              class={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                tokenTimeRange() === '7d'
                  ? 'bg-accent text-accent-fg shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {t().tokenAnalytics.timeRange.d7}
            </button>
            <button
              onClick={() => handleTimeRangeChange('30d')}
              class={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                tokenTimeRange() === '30d'
                  ? 'bg-accent text-accent-fg shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {t().tokenAnalytics.timeRange.d30}
            </button>
            <button
              onClick={() => handleTimeRangeChange('all')}
              class={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                tokenTimeRange() === 'all'
                  ? 'bg-accent text-accent-fg shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {t().tokenAnalytics.timeRange.all}
            </button>
          </div>

          {/* Rescan Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshingTokenAnalytics() || isLoadingTokenAnalytics()}
            class="flex items-center gap-1.5"
          >
            <RefreshIcon
              class={`h-3.5 w-3.5 ${
                isRefreshingTokenAnalytics() || isLoadingTokenAnalytics()
                  ? 'animate-spin text-accent'
                  : ''
              }`}
            />
            <span>
              {isRefreshingTokenAnalytics()
                ? t().tokenAnalytics.refreshing
                : t().tokenAnalytics.refresh}
            </span>
          </Button>
        </div>
      </div>

      {/* 2. Top KPI Cards Matrix */}
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Tokens */}
        <div class="flex flex-col justify-between rounded-xl border border-border-base bg-bg-surface p-4 shadow-sm">
          <div class="flex items-center justify-between text-text-muted">
            <span class="text-xs font-semibold text-text-secondary">{t().tokenAnalytics.kpi.totalTokens}</span>
            <div class="h-7 w-7 rounded-lg bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <CoinsIcon class="h-4 w-4" />
            </div>
          </div>
          <div class="my-2">
            <div class="text-2xl font-bold tracking-tight text-text-primary font-mono">
              {formatTokens(tokenSummary()?.total_tokens || 0)}
            </div>
            <div class="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span class="rounded px-1.5 py-0.5 font-mono font-medium bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-200/60 dark:border-sky-500/20">
                {t().tokenAnalytics.kpi.inLabel}: {formatTokens(tokenSummary()?.total_input_tokens || 0)}
              </span>
              <span class="rounded px-1.5 py-0.5 font-mono font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20">
                {t().tokenAnalytics.kpi.outLabel}: {formatTokens(tokenSummary()?.total_output_tokens || 0)}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-1 text-[11px] text-text-muted">
            <span>{t().tokenAnalytics.kpi.cacheReadLabel}:</span>
            <span class="font-medium text-text-primary font-mono">
              {formatTokens(tokenSummary()?.total_cache_read_tokens || 0)}
            </span>
          </div>
        </div>

        {/* Card 2: Estimated Spend */}
        <div class="flex flex-col justify-between rounded-xl border border-border-base bg-bg-surface p-4 shadow-sm">
          <div class="flex items-center justify-between text-text-muted">
            <span class="text-xs font-semibold text-text-secondary">{t().tokenAnalytics.kpi.totalCost}</span>
            <div class="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ReceiptIcon class="h-4 w-4" />
            </div>
          </div>
          <div class="my-2">
            <div class="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
              {formatCost(
                tokenSummary()?.total_cost_usd || 0,
                tokenSummary()?.total_cost_cny || 0,
              )}
            </div>
            <div class="mt-1.5 flex items-center gap-1 text-[11px]">
              <span class="rounded px-1.5 py-0.5 font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20 font-mono">
                {t().tokenAnalytics.kpi.cacheSavings}:{' '}
                {formatCost(
                  tokenSummary()?.cache_savings_usd || 0,
                  tokenSummary()?.cache_savings_cny || 0,
                )}
              </span>
            </div>
          </div>
          <div class="text-[11px] text-text-muted truncate">
            {t().tokenAnalytics.kpi.cacheSavingsDetail}
          </div>
        </div>

        {/* Card 3: Cache Hit Rate & Optimization */}
        <div class="flex flex-col justify-between rounded-xl border border-border-base bg-bg-surface p-4 shadow-sm">
          <div class="flex items-center justify-between text-text-muted">
            <span class="text-xs font-semibold text-text-secondary">{t().tokenAnalytics.kpi.cacheHitRate}</span>
            <div class="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <SavingsIcon class="h-4 w-4" />
            </div>
          </div>
          <div class="my-2">
            <div class="flex items-baseline gap-2">
              <span class="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 font-mono">
                {tokenSummary()?.cache_hit_rate_pct || 0}%
              </span>
              <span class="text-xs text-text-muted">{t().tokenAnalytics.kpi.hitEfficiency}</span>
            </div>
            {/* Progress Bar */}
            <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                class="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(100, tokenSummary()?.cache_hit_rate_pct || 0)}%` }}
              />
            </div>
          </div>
          <div class="flex items-center justify-between text-[11px] text-text-muted">
            <span>{t().tokenAnalytics.kpi.cacheWriteLabel}:</span>
            <span class="font-mono font-medium">{formatTokens(tokenSummary()?.total_cache_write_tokens || 0)}</span>
          </div>
        </div>

        {/* Card 4: Agents & Requests Activity */}
        <div class="flex flex-col justify-between rounded-xl border border-border-base bg-bg-surface p-4 shadow-sm">
          <div class="flex items-center justify-between text-text-muted">
            <span class="text-xs font-semibold text-text-secondary">{t().tokenAnalytics.kpi.activeAgents}</span>
            <div class="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <RobotIcon class="h-4 w-4" />
            </div>
          </div>
          <div class="my-2">
            <div class="flex items-baseline gap-2">
              <span class="text-2xl font-bold tracking-tight text-text-primary font-mono">
                {tokenSummary()?.active_agents_count || 0}
              </span>
              <span class="text-xs text-text-muted">{t().tokenAnalytics.kpi.toolsClients}</span>
            </div>
            <div class="mt-1.5 flex items-center gap-2 text-[11px] text-text-muted font-mono">
              <span>{t().tokenAnalytics.kpi.totalSessions}: {tokenSummary()?.total_sessions_count || 0}</span>
              <span>•</span>
              <span>{t().tokenAnalytics.kpi.totalRequests}: {tokenSummary()?.total_requests_count || 0}</span>
            </div>
          </div>
          <div class="text-[11px] text-text-muted">
            {tokenSummary()?.last_scanned_at
              ? `${t().tokenAnalytics.lastSynced}: ${new Date(
                  tokenSummary()!.last_scanned_at,
                ).toLocaleTimeString()}`
              : '-'}
          </div>
        </div>
      </div>

      {/* 3. Claude Code 5-Hour Rate Limit Block Banner */}
      <Show when={tokenSummary()?.claude_5h_block?.is_active}>
        <div class="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-bg-surface to-bg-surface p-4 shadow-sm">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <SparklesIcon class="h-5 w-5" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-semibold text-text-primary">
                    {t().tokenAnalytics.block.title}
                  </h3>
                  <Badge variant="warning" size="sm">
                    {t().tokenAnalytics.block.windowBadge}
                  </Badge>
                </div>
                <p class="text-xs text-text-muted mt-0.5">
                  {t().tokenAnalytics.block.activeAlert}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-4">
              <div class="text-right">
                <div class="text-xs text-text-muted">{t().tokenAnalytics.block.resetsIn}</div>
                <div class="flex items-center justify-end gap-1 font-mono text-sm font-bold text-amber-600 dark:text-amber-400">
                  <ClockIcon class="h-3.5 w-3.5" />
                  {formatSecondsCountdown(tokenSummary()?.claude_5h_block?.resets_in_seconds || 0)}
                </div>
              </div>

              <div class="text-right">
                <div class="text-xs text-text-muted">{t().tokenAnalytics.block.currentBurn}</div>
                <div class="text-sm font-bold text-text-primary font-mono">
                  {formatTokens(tokenSummary()?.claude_5h_block?.current_tokens || 0)}
                </div>
              </div>

              <div class="text-right">
                <div class="text-xs text-text-muted">{t().tokenAnalytics.block.burnRate}</div>
                <div class="text-sm font-medium text-sky-600 dark:text-sky-400 font-mono">
                  {tokenSummary()?.claude_5h_block?.burn_rate_tokens_per_min || 0}{' '}
                  {t().tokenAnalytics.block.tokensPerMin}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* 4. GitHub-Style 7-Row Calendar Activity Heatmap (52 Weeks) */}
      <div class="rounded-xl border border-border-base bg-bg-surface p-4 shadow-sm">
        <div class="mb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <CalendarStatsIcon class="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h2 class="text-sm font-semibold text-text-primary">
              {t().tokenAnalytics.heatmap.title}
            </h2>
          </div>
          <div class="flex items-center gap-1.5 text-xs text-text-muted">
            <span>{t().tokenAnalytics.heatmap.less}</span>
            <div class="h-3 w-3 rounded-xs bg-slate-200/90 dark:bg-slate-800 border border-slate-300/60 dark:border-slate-700/60" />
            <div class="h-3 w-3 rounded-xs bg-emerald-300 dark:bg-emerald-900 border border-emerald-400 dark:border-emerald-700/80" />
            <div class="h-3 w-3 rounded-xs bg-emerald-400 dark:bg-emerald-700" />
            <div class="h-3 w-3 rounded-xs bg-emerald-500 dark:bg-emerald-500" />
            <div class="h-3 w-3 rounded-xs bg-emerald-600 dark:bg-emerald-400 shadow-xs shadow-emerald-500/40 ring-1 ring-emerald-400/40" />
            <span>{t().tokenAnalytics.heatmap.more}</span>
          </div>
        </div>

        {/* 7-Row GitHub Calendar Matrix with Month Header */}
        <div class="overflow-x-auto pb-1">
          <div class="inline-flex flex-col min-w-[760px] py-1">
            {/* Month Labels Header */}
            <div class="flex gap-1 pl-8 pb-1 text-[9.5px] text-text-muted font-mono select-none">
              <For each={heatmapMonthLabels()}>
                {(label) => (
                  <div class="w-3 text-left overflow-visible whitespace-nowrap">
                    {label}
                  </div>
                )}
              </For>
            </div>

            <div class="inline-flex gap-1">
              {/* Weekday Label Column */}
              <div class="flex flex-col justify-between py-0.5 text-[9px] text-text-muted font-mono pr-1 select-none w-7 text-right">
                <span>{t().tokenAnalytics.heatmap.mon}</span>
                <span>{t().tokenAnalytics.heatmap.wed}</span>
                <span>{t().tokenAnalytics.heatmap.fri}</span>
                <span>{t().tokenAnalytics.heatmap.sun}</span>
              </div>

              {/* 52 Columns of 7 Days */}
              <For each={heatmapGridWeeks()}>
                {(week) => (
                  <div class="flex flex-col gap-1">
                    <For each={week}>
                      {(day: TokenHeatmapDay) => {
                        const getBgColor = () => {
                          switch (day.level) {
                            case 1:
                              return 'bg-emerald-300 dark:bg-emerald-900 border border-emerald-400 dark:border-emerald-700/80';
                            case 2:
                              return 'bg-emerald-400 dark:bg-emerald-700';
                            case 3:
                              return 'bg-emerald-500 dark:bg-emerald-500';
                            case 4:
                              return 'bg-emerald-600 dark:bg-emerald-400 shadow-xs shadow-emerald-500/40 ring-1 ring-emerald-300 dark:ring-emerald-300/40';
                            default:
                              return 'bg-slate-200/90 dark:bg-slate-800 border border-slate-300/60 dark:border-slate-700/60 hover:border-slate-400 dark:hover:border-slate-500';
                          }
                        };

                      return (
                        <div
                          title={`${formatHeatmapDate(day.date)}: ${formatTokens(day.total_tokens)} ${t().tokenAnalytics.tokensUnit} (${formatCost(day.cost_usd, day.cost_cny)}, ${day.requests_count} ${t().tokenAnalytics.heatmap.requestsCount})`}
                          class={`h-3 w-3 rounded-xs transition-all hover:scale-125 hover:z-20 cursor-pointer ${getBgColor()}`}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredHeatmapDay({
                              day,
                              x: rect.left + rect.width / 2,
                              y: rect.top,
                            });
                          }}
                          onMouseLeave={() => setHoveredHeatmapDay(null)}
                        />
                      );
                    }}
                    </For>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        {/* GitHub-style Floating Hover Tooltip rendered in Portal */}
        <Show when={hoveredHeatmapDay()}>
          {(info) => (
            <Portal>
              <div
                class="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-full mb-2 rounded-lg bg-slate-900/95 px-3 py-2 text-xs text-white shadow-2xl backdrop-blur-md border border-slate-700/80 transition-opacity duration-150 animate-in fade-in"
                style={{
                  left: `${info().x}px`,
                  top: `${info().y - 8}px`,
                }}
              >
                <div class="font-semibold text-slate-100 mb-0.5 flex items-center gap-1.5 whitespace-nowrap">
                  <span
                    class={`h-2 w-2 rounded-full ${
                      info().day.level > 0 ? 'bg-emerald-400' : 'bg-slate-500'
                    }`}
                  />
                  <span>{formatHeatmapDate(info().day.date)}</span>
                </div>
                <Show
                  when={info().day.total_tokens > 0}
                  fallback={
                    <div class="text-[11px] text-slate-400 whitespace-nowrap">
                      {t().tokenAnalytics.heatmap.noActivity}
                    </div>
                  }
                >
                  <div class="space-y-0.5 text-[11px] font-mono whitespace-nowrap">
                    <div class="text-emerald-400 font-bold">
                      {formatTokens(info().day.total_tokens)} {t().tokenAnalytics.tokensUnit} ({formatCost(info().day.cost_usd, info().day.cost_cny)})
                    </div>
                    <div class="text-slate-300">
                      {info().day.requests_count} {t().tokenAnalytics.heatmap.requestsCount}
                    </div>
                  </div>
                </Show>
                {/* Triangle pointer */}
                <div class="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900/95" />
              </div>
            </Portal>
          )}
        </Show>
      </div>

      {/* 5. Token Consumption Trend Waveform */}
      <div class="rounded-xl border border-border-base bg-bg-surface p-4 shadow-sm">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2.5">
            <div class="flex items-center gap-2">
              <TrendingUpIcon class="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <h2 class="text-sm font-semibold text-text-primary">
                {t().tokenAnalytics.trend.title}
              </h2>
            </div>
            <Show when={maxTrendTokens() > 0}>
              <span class="inline-flex items-center gap-1.5 rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-mono font-medium text-sky-600 dark:text-sky-400 border border-sky-500/20">
                <span class="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                {t().tokenAnalytics.trend.peak}: {formatTokens(maxTrendTokens())}
              </span>
            </Show>
            <Show when={totalTrendTokens() > 0}>
              <span class="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-mono font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {t().tokenAnalytics.trend.periodTotal}: {formatTokens(totalTrendTokens())} ({formatCost(totalTrendCostUsd(), totalTrendCostUsd() * 7.25)})
              </span>
            </Show>
          </div>

          <div class="flex rounded-lg border border-border-base bg-bg-base p-0.5">
            <button
              onClick={() => setActiveTrendRange('24h')}
              class={`rounded px-2.5 py-0.5 text-xs font-medium transition-colors ${
                activeTrendRange() === '24h'
                  ? 'bg-accent text-accent-fg'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {t().tokenAnalytics.trend.h24}
            </button>
            <button
              onClick={() => setActiveTrendRange('7d')}
              class={`rounded px-2.5 py-0.5 text-xs font-medium transition-colors ${
                activeTrendRange() === '7d'
                  ? 'bg-accent text-accent-fg'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {t().tokenAnalytics.trend.d7}
            </button>
            <button
              onClick={() => setActiveTrendRange('30d')}
              class={`rounded px-2.5 py-0.5 text-xs font-medium transition-colors ${
                activeTrendRange() === '30d'
                  ? 'bg-accent text-accent-fg'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {t().tokenAnalytics.trend.d30}
            </button>
          </div>
        </div>

        {/* Dual-Layer Area Waveform + Glassmorphism Bar Chart */}
        <div class="relative w-full rounded-lg bg-bg-base/40 p-3 border border-border-base/50">
          {/* Y-axis Reference Grid Marks */}
          <div class="pointer-events-none absolute inset-x-3 top-3 bottom-9 flex flex-col justify-between text-[9.5px] font-mono text-text-muted/60 select-none z-0">
            <div class="flex items-center justify-between border-b border-dashed border-border-base/50 pb-0.5">
              <span>{formatTokens(maxTrendTokens())}</span>
              <span class="text-[9px] opacity-75">100%</span>
            </div>
            <div class="flex items-center justify-between border-b border-dashed border-border-base/40 pb-0.5">
              <span>{formatTokens(Math.round(maxTrendTokens() / 2))}</span>
              <span class="text-[9px] opacity-75">50%</span>
            </div>
            <div class="flex items-center justify-between border-b border-border-base/70 pb-0.5">
              <span>0 {t().tokenAnalytics.tokensUnit}</span>
              <span class="text-[9px] opacity-75">0%</span>
            </div>
          </div>

          {/* SVG Smooth Continuous Waveform Curve & Area Fill */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="pointer-events-none absolute inset-x-3 top-3 bottom-9 h-[calc(100%-3rem)] w-[calc(100%-1.5rem)] z-0 overflow-visible">
            <defs>
              <linearGradient id="tokenTrendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.35" />
                <stop offset="65%" stop-color="#0ea5e9" stop-opacity="0.08" />
                <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0.0" />
              </linearGradient>
              <linearGradient id="tokenTrendLineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#38bdf8" />
                <stop offset="50%" stop-color="#0ea5e9" />
                <stop offset="100%" stop-color="#6366f1" />
              </linearGradient>
            </defs>
            <Show when={trendSvgPaths().areaPath}>
              <path d={trendSvgPaths().areaPath} fill="url(#tokenTrendAreaGrad)" />
            </Show>
            <Show when={trendSvgPaths().linePath}>
              <path
                d={trendSvgPaths().linePath}
                fill="none"
                stroke="url(#tokenTrendLineGrad)"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="filter drop-shadow-[0_2px_6px_rgba(14,165,233,0.4)]"
              />
            </Show>
            <For each={trendSvgPaths().coords}>
              {(c) => (
                <Show when={(c.point.total_tokens || 0) > 0}>
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r="2.2"
                    class="fill-sky-400 stroke-white dark:stroke-slate-900 stroke-[1.2] transition-transform duration-150 hover:scale-150"
                  />
                </Show>
              )}
            </For>
          </svg>

          {/* Interactive Histogram Bars Layer on Top */}
          <div class="relative z-10 flex h-36 items-end gap-1.5 w-full">
            <For each={activeTrendPoints()}>
              {(point) => {
                const hasTokens = (point.total_tokens || 0) > 0;
                const heightPct = hasTokens
                  ? Math.max(8, Math.round(((point.total_tokens || 0) / maxTrendTokens()) * 100))
                  : 4;

                return (
                  <div class="group relative flex flex-1 flex-col justify-end items-center h-full min-w-[18px] cursor-pointer">
                    {/* Floating Tooltip on Hover */}
                    <div class="pointer-events-none absolute bottom-full mb-2 hidden flex-col items-center rounded-lg bg-slate-900/95 px-3 py-2 text-xs text-white shadow-2xl backdrop-blur-md border border-slate-700/80 group-hover:flex z-40 whitespace-nowrap animate-in fade-in">
                      <div class="font-bold text-slate-100 flex items-center gap-1.5 mb-1">
                        <span
                          class={`h-2 w-2 rounded-full ${
                            hasTokens ? 'bg-sky-400 animate-pulse' : 'bg-slate-500'
                          }`}
                        />
                        <span>{point.label}</span>
                      </div>
                      <div class="space-y-0.5 text-[11px] font-mono text-left w-full">
                        <div class="text-sky-400 font-bold">
                          {t().tokenAnalytics.trend.totalLabel}: {formatTokens(point.total_tokens)} {t().tokenAnalytics.tokensUnit}
                        </div>
                        <div class="text-slate-300 text-[10px]">
                          {t().tokenAnalytics.trend.inLabel}: {formatTokens(point.input_tokens)} · {t().tokenAnalytics.trend.outLabel}: {formatTokens(point.output_tokens)}
                        </div>
                        <Show when={(point.cache_read_tokens || 0) > 0}>
                          <div class="text-emerald-400 text-[10px]">
                            {t().tokenAnalytics.trend.cacheLabel}: {formatTokens(point.cache_read_tokens)}
                          </div>
                        </Show>
                        <div class="text-emerald-400 font-semibold pt-0.5">
                          {t().tokenAnalytics.trend.costLabel}: {formatCost(point.cost_usd, point.cost_usd * 7.25)}
                        </div>
                      </div>
                      <div class="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900/95" />
                    </div>

                    {/* Bar Container */}
                    <div class="w-full h-full flex items-end justify-center">
                      <div
                        class={`w-full max-w-[24px] rounded-t-md transition-all duration-200 group-hover:brightness-125 group-hover:scale-x-110 ${
                          hasTokens
                            ? 'bg-gradient-to-t from-sky-600/90 via-sky-500 to-indigo-500 shadow-xs ring-1 ring-sky-400/30 group-hover:ring-sky-300'
                            : 'bg-slate-200/90 dark:bg-slate-800/80 border-t border-slate-300 dark:border-slate-700/80'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                  </div>
                );
              }}
            </For>
          </div>

          {/* Bottom X-Axis Labels */}
          <div class="flex items-center gap-1.5 w-full pt-2 border-t border-border-base/70">
            <For each={activeTrendPoints()}>
              {(point) => (
                <span class="flex-1 text-[10.5px] font-mono text-text-muted truncate text-center select-none">
                  {point.label}
                </span>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* 6. Multi-dimensional Breakdown Leaderboard Tabs */}
      <div class="rounded-xl border border-border-base bg-bg-surface p-4 shadow-sm">
        <Tabs
          value={activeBreakdownTab()}
          onValueChange={(details) => setActiveBreakdownTab(details.value)}
          class="w-full flex flex-col"
        >
          <TabsList class="w-fit mb-4">
            <TabsTrigger value="models">
              <CpuIcon class="h-3.5 w-3.5" />
              <span>{t().tokenAnalytics.breakdown.tabs.models}</span>
              <span class="font-mono text-[10px] text-sky-500 font-normal">
                ({tokenAnalytics()?.models?.length || 0})
              </span>
            </TabsTrigger>
            <TabsTrigger value="agents">
              <RobotIcon class="h-3.5 w-3.5" />
              <span>{t().tokenAnalytics.breakdown.tabs.agents}</span>
              <span class="font-mono text-[10px] text-teal-500 font-normal">
                ({tokenAnalytics()?.agents?.length || 0})
              </span>
            </TabsTrigger>
            <TabsTrigger value="projects">
              <FolderIcon class="h-3.5 w-3.5" />
              <span>{t().tokenAnalytics.breakdown.tabs.projects}</span>
              <span class="font-mono text-[10px] text-amber-500 font-normal">
                ({tokenAnalytics()?.projects?.length || 0})
              </span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Models Matrix */}
          <TabsContent value="models">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="border-b border-border-base text-text-muted">
                    <th class="py-2.5 px-3 font-semibold">{t().tokenAnalytics.breakdown.modelCol}</th>
                    <th class="py-2.5 px-3 font-semibold">{t().tokenAnalytics.breakdown.providerCol}</th>
                    <th class="py-2.5 px-3 font-semibold text-right">{t().tokenAnalytics.breakdown.tokensCol}</th>
                    <th class="py-2.5 px-3 font-semibold text-right">{t().tokenAnalytics.breakdown.costCol}</th>
                    <th class="py-2.5 px-3 font-semibold">{t().tokenAnalytics.breakdown.shareCol}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border-base">
                  <For each={tokenAnalytics()?.models || []}>
                    {(model: TokenModelStats) => (
                      <tr class="hover:bg-bg-base/60 transition-colors">
                        <td class="py-2.5 px-3 font-medium text-text-primary flex items-center gap-2">
                          <CpuIcon class="h-3.5 w-3.5 text-sky-500" />
                          <span>{model.display_name}</span>
                        </td>
                        <td class="py-2.5 px-3">
                          {renderProviderBadge(model.provider)}
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono font-medium text-text-primary">
                          {formatTokens(model.total_tokens)}
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          {formatCost(model.cost_usd, model.cost_cny)}
                        </td>
                        <td class="py-2.5 px-3 min-w-[140px]">
                          <div class="flex items-center gap-2">
                            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div
                                class="h-full bg-sky-500 rounded-full"
                                style={{ width: `${Math.min(100, model.percentage)}%` }}
                              />
                            </div>
                            <span class="text-[11px] font-mono text-text-muted w-10 text-right">
                              {model.percentage}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Tab 2: AI Agents Distribution */}
          <TabsContent value="agents">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <For each={tokenAnalytics()?.agents || []}>
                {(agent: TokenAgentStats) => (
                  <div class="rounded-xl border border-border-base bg-bg-base/50 p-3.5 transition-all hover:border-accent/40">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <div class="h-8 w-8 rounded-lg bg-bg-surface flex items-center justify-center border border-border-base">
                          {renderAgentIcon(agent.agent_id)}
                        </div>
                        <div>
                          <div class="font-semibold text-text-primary text-xs">{agent.name}</div>
                          <div class="text-[11px] text-text-muted">
                            {agent.sessions_count} {t().tokenAnalytics.breakdown.sessionsCol}
                          </div>
                        </div>
                      </div>
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-accent/15 text-accent border border-accent/25">
                        {agent.percentage}%
                      </span>
                    </div>
                    <div class="my-3 flex items-baseline justify-between">
                      <span class="text-xl font-bold text-text-primary font-mono">
                        {formatTokens(agent.total_tokens)}
                      </span>
                      <span class="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                        {formatCost(agent.cost_usd, agent.cost_cny)}
                      </span>
                    </div>
                    <div class="flex items-center justify-between text-[11px] text-text-muted font-mono">
                      <span>{t().tokenAnalytics.breakdown.sessionsCol}: {agent.sessions_count}</span>
                      <span>{t().tokenAnalytics.kpi.inLabel}: {formatTokens(agent.input_tokens)} / {t().tokenAnalytics.kpi.outLabel}: {formatTokens(agent.output_tokens)}</span>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </TabsContent>

          {/* Tab 3: Projects Repositories */}
          <TabsContent value="projects">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="border-b border-border-base text-text-muted">
                    <th class="py-2.5 px-3 font-semibold">{t().tokenAnalytics.breakdown.projectCol}</th>
                    <th class="py-2.5 px-3 font-semibold text-right">{t().tokenAnalytics.breakdown.tokensCol}</th>
                    <th class="py-2.5 px-3 font-semibold text-right">{t().tokenAnalytics.breakdown.costCol}</th>
                    <th class="py-2.5 px-3 font-semibold">{t().tokenAnalytics.breakdown.shareCol}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border-base">
                  <For each={tokenAnalytics()?.projects || []}>
                    {(proj: TokenProjectStats) => (
                      <tr class="hover:bg-bg-base/60 transition-colors">
                        <td class="py-2.5 px-3 font-medium text-text-primary flex items-center gap-2">
                          <FolderIcon class="h-3.5 w-3.5 text-amber-500" />
                          <span>{cleanProjectName(proj.project_name)}</span>
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono font-medium text-text-primary">
                          {formatTokens(proj.total_tokens)}
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          {formatCost(proj.cost_usd, proj.cost_cny)}
                        </td>
                        <td class="py-2.5 px-3 min-w-[140px]">
                          <div class="flex items-center gap-2">
                            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div
                                class="h-full bg-amber-500 rounded-full"
                                style={{ width: `${Math.min(100, proj.percentage)}%` }}
                              />
                            </div>
                            <span class="text-[11px] font-mono text-text-muted w-10 text-right">
                              {proj.percentage}%
                            </span>
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
      </div>

      {/* 7. Session Explorer & Audit Logs */}
      <div class="rounded-xl border border-border-base bg-bg-surface p-4 shadow-sm">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <ReceiptIcon class="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h2 class="text-sm font-semibold text-text-primary">
              {t().tokenAnalytics.sessions.title}
            </h2>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div class="relative">
              <SearchIcon class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder={t().tokenAnalytics.sessions.searchPlaceholder}
                value={sessionSearchQuery()}
                onInput={(e) => setSessionSearchQuery(e.currentTarget.value)}
                class="h-8 rounded-lg border border-border-base bg-bg-base pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Client Filter Dropdown */}
            <select
              value={selectedClientFilter()}
              onChange={(e) => setSelectedClientFilter(e.currentTarget.value)}
              class="h-8 rounded-lg border border-border-base bg-bg-base px-2.5 text-xs text-text-primary focus:border-accent focus:outline-none"
            >
              <option value="">{t().tokenAnalytics.sessions.filterAll}</option>
              <option value="claude_code">{t().tokenAnalytics.clients.claudeCode}</option>
              <option value="cursor">{t().tokenAnalytics.clients.cursor}</option>
              <option value="windsurf">{t().tokenAnalytics.clients.windsurf}</option>
              <option value="cline">{t().tokenAnalytics.clients.cline}</option>
              <option value="roo_code">{t().tokenAnalytics.clients.rooCode}</option>
              <option value="antigravity">{t().tokenAnalytics.clients.antigravity}</option>
              <option value="codex">{t().tokenAnalytics.clients.codex}</option>
              <option value="opencode">{t().tokenAnalytics.clients.opencode}</option>
              <option value="continue">{t().tokenAnalytics.clients.continueDev}</option>
              <option value="aider">{t().tokenAnalytics.clients.aider}</option>
            </select>
          </div>
        </div>

        {/* Sessions Table */}
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-border-base text-text-muted">
                <th class="py-2.5 px-3 font-semibold">{t().tokenAnalytics.sessions.timeCol}</th>
                <th class="py-2.5 px-3 font-semibold">{t().tokenAnalytics.sessions.agentCol}</th>
                <th class="py-2.5 px-3 font-semibold">{t().tokenAnalytics.sessions.projectCol}</th>
                <th class="py-2.5 px-3 font-semibold">{t().tokenAnalytics.sessions.modelCol}</th>
                <th class="py-2.5 px-3 font-semibold text-right">{t().tokenAnalytics.sessions.tokensDetailCol}</th>
                <th class="py-2.5 px-3 font-semibold text-right">{t().tokenAnalytics.sessions.totalCol}</th>
                <th class="py-2.5 px-3 font-semibold text-right">{t().tokenAnalytics.sessions.costCol}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-base">
              <Show
                when={filteredSessions().length > 0}
                fallback={
                  <tr>
                    <td colspan="7" class="py-8 text-center text-xs text-text-muted">
                      {t().tokenAnalytics.sessions.noData}
                    </td>
                  </tr>
                }
              >
                <For each={filteredSessions()}>
                  {(sess) => (
                    <tr class="hover:bg-bg-base/60 transition-colors">
                      <td class="py-2.5 px-3 text-text-muted font-mono whitespace-nowrap">
                        {formatTime(sess.timestamp)}
                      </td>
                      <td class="py-2.5 px-3">
                        <div class="flex items-center gap-1.5">
                          {renderAgentIcon(sess.client)}
                          <span class="font-medium text-text-primary capitalize">
                            {sess.client.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td class="py-2.5 px-3 text-text-muted max-w-[140px] truncate">
                        {cleanProjectName(sess.project_name)}
                      </td>
                      <td class="py-2.5 px-3">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-bg-base text-text-primary border border-border-base">
                          {sess.model}
                        </span>
                      </td>
                      <td class="py-2.5 px-3 text-right font-mono text-[11px] text-text-muted">
                        {formatTokens(sess.input_tokens)} / {formatTokens(sess.output_tokens)} / {formatTokens(sess.cache_read_tokens)}
                      </td>
                      <td class="py-2.5 px-3 text-right font-mono font-semibold text-text-primary">
                        {formatTokens(sess.total_tokens)}
                      </td>
                      <td class="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        {formatCost(sess.cost_usd, sess.cost_usd * 7.25)}
                      </td>
                    </tr>
                  )}
                </For>
              </Show>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
