import { For, Show, createSignal, onCleanup, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import {
  copyToClipboard,
  fetchObsidianNoteApi,
  fetchObsidianVaultApi,
  obsidianSummary,
  openObsidianApi,
  quickCaptureObsidianApi,
  searchObsidianApi,
} from '../services/store';
import type { ObsidianNoteDetail, ObsidianSearchResponse } from '../types';
import { RefreshIcon } from './Icons';
import { t } from '../i18n';

export const ObsidianHub: Component = () => {
  const [isRefreshing, setIsRefreshing] = createSignal(false);
  const [quickCaptureText, setQuickCaptureText] = createSignal('');
  const [quickCaptureTag, setQuickCaptureTag] = createSignal('');
  const [captureTarget, setCaptureTarget] = createSignal<'daily' | 'inbox'>('daily');
  const [isCapturing, setIsCapturing] = createSignal(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = createSignal('');
  const [selectedTag, setSelectedTag] = createSignal<string | null>(null);
  const [isSearching, setIsSearching] = createSignal(false);
  const [searchResult, setSearchResult] = createSignal<ObsidianSearchResponse | null>(null);

  // Reader Modal State
  const [activeNoteDetail, setActiveNoteDetail] = createSignal<ObsidianNoteDetail | null>(null);
  const [isLoadingNote, setIsLoadingNote] = createSignal(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchObsidianVaultApi();
    setIsRefreshing(false);
  };

  onMount(() => {
    if (!obsidianSummary()) {
      handleRefresh();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeNoteDetail()) {
        setActiveNoteDetail(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
  });

  const handleQuickCapture = async (e?: Event) => {
    if (e) e.preventDefault();
    const content = quickCaptureText().trim();
    if (!content || isCapturing()) return;

    setIsCapturing(true);
    const success = await quickCaptureObsidianApi({
      content,
      target: captureTarget(),
      tag: quickCaptureTag().trim() || undefined,
    });
    setIsCapturing(false);

    if (success) {
      setQuickCaptureText('');
      setQuickCaptureTag('');
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResult(null);
      return;
    }

    setIsSearching(true);
    const res = await searchObsidianApi(query.trim());
    setSearchResult(res);
    setIsSearching(false);
  };

  const handleSelectTag = (tag: string) => {
    if (selectedTag() === tag) {
      setSelectedTag(null);
    } else {
      setSelectedTag(tag);
      setSearchQuery('');
      setSearchResult(null);
    }
  };

  const handleOpenNote = async (relPath: string) => {
    setIsLoadingNote(true);
    const detail = await fetchObsidianNoteApi(relPath);
    setActiveNoteDetail(detail);
    setIsLoadingNote(false);
  };

  const filteredNotes = () => {
    const list = obsidianSummary()?.recent_notes || [];
    const tag = selectedTag();
    if (!tag) return list;
    return list.filter((n) => n.tags.includes(tag));
  };

  return (
    <div class="flex flex-col gap-3.5" aria-label={t().obsidian.title}>
      {/* 1. Vault Cockpit Overview Card */}
      <section class="rounded-xl border border-border-default bg-bg-surface p-4 shadow-xs">
        <div class="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-accent/10 text-accent">
              {/* Obsidian Diamond/Gem Icon */}
              <svg
                class="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M6 3h12l4 6-10 13L2 9z" />
                <path d="M11 3v18" />
                <path d="M2 9h20" />
              </svg>
            </div>

            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-sm font-bold text-text-primary">
                  {obsidianSummary()?.vault_name || 'Obsidian Vault'}
                </h1>
                <Show when={obsidianSummary()?.git_branch}>
                  <span class="rounded bg-bg-subtle border border-border-subtle px-2 py-0.5 mono text-[10px] text-text-secondary flex items-center gap-1">
                    <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="6" y1="3" x2="6" y2="15" />
                      <circle cx="18" cy="6" r="3" />
                      <circle cx="6" cy="18" r="3" />
                      <path d="M18 9a9 9 0 0 1-9 9" />
                    </svg>
                    <span>{obsidianSummary()?.git_branch}</span>
                  </span>
                </Show>

                <Show
                  when={obsidianSummary()?.git_dirty}
                  fallback={
                    <span class="rounded bg-status-success-bg border border-status-success/20 px-2 py-0.5 text-[9.5px] font-medium text-status-success">
                      ✓ {t().obsidian.clean}
                    </span>
                  }
                >
                  <span class="rounded bg-status-warning-bg border border-status-warning/20 px-2 py-0.5 text-[9.5px] font-medium text-status-warning">
                    ● {obsidianSummary()?.git_uncommitted_count} {t().obsidian.dirty}
                  </span>
                </Show>
              </div>

              <Show when={obsidianSummary()?.vault_path}>
                <button
                  type="button"
                  onClick={() => copyToClipboard(obsidianSummary()?.vault_path || '', 'Vault Path')}
                  class="mt-1 block max-w-lg truncate text-left mono text-[10.5px] text-text-muted hover:text-accent focus-visible:ring-1 focus-visible:ring-accent rounded transition-colors"
                  title={obsidianSummary()?.vault_path}
                >
                  📁 {obsidianSummary()?.vault_path}
                </button>
              </Show>
            </div>
          </div>

          {/* Action Tools */}
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openObsidianApi({ target_app: 'obsidian' })}
              aria-label={t().obsidian.openApp}
              class="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-accent-hover transition-colors focus-visible:ring-2 focus-visible:ring-accent"
            >
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>{t().obsidian.openApp}</span>
            </button>

            <button
              type="button"
              onClick={() => openObsidianApi({ target_app: 'finder' })}
              aria-label={t().obsidian.openFinder}
              class="rounded-lg border border-border-default bg-bg-subtle px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t().obsidian.openFinder}
            </button>

            <button
              type="button"
              onClick={() => openObsidianApi({ target_app: 'code' })}
              aria-label={t().obsidian.openCode}
              class="rounded-lg border border-border-default bg-bg-subtle px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t().obsidian.openCode}
            </button>

            <button
              type="button"
              onClick={() => openObsidianApi({ target_app: 'terminal' })}
              aria-label={t().obsidian.openTerminal}
              class="rounded-lg border border-border-default bg-bg-subtle px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t().obsidian.openTerminal}
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing()}
              aria-label={t().common.refresh}
              class="rounded-lg border border-border-default bg-bg-subtle p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent"
            >
              <RefreshIcon class={`h-3.5 w-3.5 ${isRefreshing() ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Metric Badges Grid */}
        <div class="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5 border-t border-border-subtle pt-3">
          <div class="rounded-lg bg-bg-input p-2.5 border border-border-subtle/60">
            <span class="text-[10px] text-text-muted block">{t().obsidian.totalNotes}</span>
            <span class="mono text-base font-bold text-text-primary mt-0.5 block">
              {obsidianSummary()?.total_notes ?? '-'}
            </span>
          </div>

          <div class="rounded-lg bg-bg-input p-2.5 border border-border-subtle/60">
            <span class="text-[10px] text-text-muted block">{t().obsidian.totalWords}</span>
            <span class="mono text-base font-bold text-accent mt-0.5 block">
              {obsidianSummary()?.total_words?.toLocaleString() ?? '-'}
            </span>
          </div>

          <div class="rounded-lg bg-bg-input p-2.5 border border-border-subtle/60">
            <span class="text-[10px] text-text-muted block">{t().obsidian.totalAttachments}</span>
            <span class="mono text-base font-bold text-text-primary mt-0.5 block">
              {obsidianSummary()?.total_attachments ?? '-'}
            </span>
          </div>

          <div class="rounded-lg bg-bg-input p-2.5 border border-border-subtle/60">
            <span class="text-[10px] text-text-muted block">{t().obsidian.totalFolders}</span>
            <span class="mono text-base font-bold text-text-primary mt-0.5 block">
              {obsidianSummary()?.total_folders ?? '-'}
            </span>
          </div>

          <div class="rounded-lg bg-bg-input p-2.5 border border-border-subtle/60">
            <span class="text-[10px] text-text-muted block">{t().obsidian.vaultSize}</span>
            <span class="mono text-base font-bold text-status-success mt-0.5 block">
              {obsidianSummary()?.disk_size_human ?? '-'}
            </span>
          </div>
        </div>
      </section>

      {/* 2. Quick Capture (灵感闪念盒) */}
      <section class="rounded-xl border border-border-default bg-bg-surface p-4 shadow-xs">
        <div class="flex items-center justify-between mb-2.5">
          <div class="flex items-center gap-2">
            <h2 class="text-xs font-semibold text-text-primary">
              {t().obsidian.quickCaptureTitle}
            </h2>
            <span class="text-[11px] text-text-muted hidden sm:inline">
              {t().obsidian.quickCaptureDesc}
            </span>
          </div>

          {/* Target Switcher */}
          <div class="flex items-center rounded-lg border border-border-default bg-bg-input p-0.5 text-[10.5px]">
            <button
              type="button"
              onClick={() => setCaptureTarget('daily')}
              aria-pressed={captureTarget() === 'daily'}
              class="rounded-md px-2 py-0.5 transition-colors focus-visible:ring-1 focus-visible:ring-accent"
              classList={{
                'bg-bg-active text-text-primary font-semibold shadow-xs': captureTarget() === 'daily',
                'text-text-muted hover:text-text-primary': captureTarget() !== 'daily',
              }}
            >
              {t().obsidian.targetDaily}
            </button>
            <button
              type="button"
              onClick={() => setCaptureTarget('inbox')}
              aria-pressed={captureTarget() === 'inbox'}
              class="rounded-md px-2 py-0.5 transition-colors focus-visible:ring-1 focus-visible:ring-accent"
              classList={{
                'bg-bg-active text-text-primary font-semibold shadow-xs': captureTarget() === 'inbox',
                'text-text-muted hover:text-text-primary': captureTarget() !== 'inbox',
              }}
            >
              {t().obsidian.targetInbox}
            </button>
          </div>
        </div>

        <form onSubmit={handleQuickCapture} class="flex flex-col gap-2">
          <textarea
            rows="2"
            value={quickCaptureText()}
            onInput={(e) => setQuickCaptureText(e.currentTarget.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleQuickCapture();
              }
            }}
            placeholder={t().obsidian.quickCapturePlaceholder}
            class="w-full rounded-lg border border-border-default bg-bg-input p-2.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors resize-none"
          />

          <div class="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 w-full sm:w-auto">
              <span class="mono text-xs text-text-muted">#</span>
              <input
                type="text"
                value={quickCaptureTag()}
                onInput={(e) => setQuickCaptureTag(e.currentTarget.value)}
                placeholder={t().obsidian.tagPlaceholder}
                class="h-7 w-full sm:w-48 rounded border border-border-default bg-bg-input px-2 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isCapturing() || !quickCaptureText().trim()}
              aria-busy={isCapturing()}
              class="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-accent-hover disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Show when={isCapturing()}>
                <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              </Show>
              <span>{isCapturing() ? t().obsidian.capturing : t().obsidian.captureBtn}</span>
            </button>
          </div>
        </form>
      </section>

      {/* 3. Search & Tag Radar Filter */}
      <section class="rounded-xl border border-border-default bg-bg-surface p-4 shadow-xs">
        <div class="flex flex-col gap-3">
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div class="relative flex-1">
              <input
                type="text"
                value={searchQuery()}
                onInput={(e) => handleSearch(e.currentTarget.value)}
                placeholder={t().obsidian.searchPlaceholder}
                class="h-8 w-full rounded-lg border border-border-default bg-bg-input pl-8 pr-7 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
              />
              <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs">🔍</span>
              <Show when={isSearching()}>
                <span class="absolute right-7 top-1/2 -translate-y-1/2 inline-block h-3 w-3 animate-spin rounded-full border border-accent border-t-transparent" />
              </Show>
              <Show when={searchQuery()}>
                <button
                  type="button"
                  onClick={() => handleSearch('')}
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-muted hover:text-text-primary"
                >
                  ✕
                </button>
              </Show>
            </div>

            <Show when={selectedTag()}>
              <div class="flex items-center gap-1 text-xs">
                <span class="text-text-muted text-[11px]">Tag:</span>
                <span class="rounded bg-accent/15 text-accent border border-accent/25 px-2 py-0.5 mono text-[10.5px] font-semibold flex items-center gap-1">
                  #{selectedTag()}
                  <button type="button" onClick={() => setSelectedTag(null)} class="hover:opacity-80">✕</button>
                </span>
              </div>
            </Show>
          </div>

          {/* Popular Tag Radar Pills */}
          <Show when={obsidianSummary()?.top_tags?.length}>
            <div class="flex flex-wrap items-center gap-1.5 pt-1">
              <span class="text-[10px] text-text-muted font-medium mr-1">{t().obsidian.tagFilter}:</span>
              <For each={obsidianSummary()?.top_tags}>
                {(tag) => (
                  <button
                    type="button"
                    onClick={() => handleSelectTag(tag.name)}
                    class="rounded-md border px-2 py-0.5 mono text-[10px] font-medium transition-colors focus-visible:ring-1 focus-visible:ring-accent"
                    classList={{
                      'bg-accent text-white border-accent shadow-xs': selectedTag() === tag.name,
                      'bg-bg-subtle text-text-secondary border-border-subtle hover:bg-bg-hover hover:text-text-primary': selectedTag() !== tag.name,
                    }}
                  >
                    #{tag.name} <span class="opacity-70 text-[9px]">({tag.count})</span>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Search Results Dropdown List (if any) */}
        <Show when={searchQuery().trim() && searchResult()}>
          <div class="mt-3 rounded-lg border border-border-default bg-bg-input p-3 animate-in fade-in duration-150">
            <div class="flex items-center justify-between text-[11px] text-text-muted mb-2 border-b border-border-subtle pb-1.5">
              <span>{t().obsidian.searchMatches.replace('{count}', searchResult()?.total_matches.toString() || '0')}</span>
              <span class="mono text-[10px] text-accent">"{searchQuery()}"</span>
            </div>

            <div class="max-h-60 overflow-y-auto divide-y divide-border-subtle/50">
              <For
                each={searchResult()?.matches}
                fallback={
                  <div class="py-6 text-center text-xs text-text-muted font-mono">
                    {t().obsidian.emptySearch}
                  </div>
                }
              >
                {(match) => (
                  <div
                    onClick={() => handleOpenNote(match.rel_path)}
                    class="py-2 px-1.5 hover:bg-bg-hover/60 rounded cursor-pointer transition-colors group"
                  >
                    <div class="flex items-center justify-between text-xs">
                      <span class="font-semibold text-text-primary group-hover:text-accent truncate">
                        {match.title}
                      </span>
                      <span class="mono text-[10px] text-text-muted">
                        Line {match.line_number}
                      </span>
                    </div>
                    <p class="mt-1 mono text-[11px] text-text-secondary line-clamp-2 leading-relaxed">
                      {match.line_content}
                    </p>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </section>

      {/* 4. Recent Notes Grid */}
      <section class="rounded-xl border border-border-default bg-bg-surface p-4 shadow-xs">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <h2 class="text-xs font-semibold text-text-primary">
              {t().obsidian.recentNotes}
            </h2>
            <span class="rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.2 mono text-[9.5px] text-text-muted">
              {filteredNotes().length}
            </span>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <For
            each={filteredNotes()}
            fallback={
              <div class="col-span-full py-12 text-center text-xs text-text-muted font-mono">
                {t().obsidian.emptyNotes}
              </div>
            }
          >
            {(note) => (
              <div
                onClick={() => handleOpenNote(note.rel_path)}
                class="flex flex-col justify-between rounded-lg border border-border-subtle bg-bg-input p-3 hover:border-border-default hover:bg-bg-surface cursor-pointer transition-all duration-150 group shadow-xs hover:shadow-sm"
              >
                <div>
                  <div class="flex items-start justify-between gap-2">
                    <h3 class="text-xs font-bold text-text-primary group-hover:text-accent transition-colors line-clamp-1">
                      {note.title}
                    </h3>
                    <span class="mono text-[9.5px] text-text-muted shrink-0">
                      {note.modified_human}
                    </span>
                  </div>

                  <p class="mt-1.5 text-[11px] text-text-secondary line-clamp-2 leading-relaxed">
                    {note.preview_snippet || '...'}
                  </p>
                </div>

                <div class="mt-3 flex items-center justify-between border-t border-border-subtle/60 pt-2 text-[10px]">
                  <div class="flex items-center gap-1 overflow-hidden truncate">
                    <Show when={note.tags.length > 0} fallback={<span class="mono text-[9px] text-text-muted truncate">{note.rel_path}</span>}>
                      <For each={note.tags.slice(0, 2)}>
                        {(tag) => (
                          <span class="rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.2 mono text-[9px] text-accent truncate">
                            #{tag}
                          </span>
                        )}
                      </For>
                    </Show>
                  </div>

                  <span class="mono text-text-muted shrink-0 text-[9.5px]">
                    {note.word_count} {t().obsidian.words}
                  </span>
                </div>
              </div>
            )}
          </For>
        </div>
      </section>

      {/* 5. Note Reader Drawer / Modal */}
      <Show when={activeNoteDetail()}>
        {(note) => (
          <div
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs transition-opacity duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-reader-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setActiveNoteDetail(null);
            }}
          >
            <div class="relative flex flex-col w-full max-w-3xl max-h-[85vh] rounded-xl border border-border-strong bg-bg-modal shadow-2xl transition-all duration-200 animate-in fade-in zoom-in-95 overflow-hidden">
              {/* Header Bar */}
              <div class="flex items-center justify-between border-b border-border-subtle bg-bg-subtle/50 px-4 py-3">
                <div class="min-w-0 flex-1 pr-3">
                  <h2 id="note-reader-title" class="text-sm font-bold text-text-primary truncate">
                    {note().title}
                  </h2>
                  <div class="mt-0.5 flex items-center gap-2 text-[10.5px] text-text-muted mono truncate">
                    <span>{note().rel_path}</span>
                    <span>•</span>
                    <span>{note().word_count} {t().obsidian.words}</span>
                    <span>•</span>
                    <span>{note().modified_human}</span>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      openObsidianApi({
                        file_path: note().rel_path,
                        target_app: 'obsidian',
                      })
                    }
                    class="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-accent-hover transition-colors"
                  >
                    {t().obsidian.editInObsidian}
                  </button>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(note().content, 'Markdown')}
                    class="rounded-lg border border-border-default bg-bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
                  >
                    {t().obsidian.copyContent}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveNoteDetail(null)}
                    aria-label={t().obsidian.closeReader}
                    class="rounded-lg border border-border-default bg-bg-surface p-1 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Markdown Content Area */}
              <div class="flex-1 overflow-y-auto p-4 bg-bg-modal">
                <div class="prose dark:prose-invert max-w-none text-xs font-mono leading-relaxed text-text-primary whitespace-pre-wrap select-text">
                  {note().content}
                </div>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Loading Indicator */}
      <Show when={isLoadingNote()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <span class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </Show>
    </div>
  );
};
