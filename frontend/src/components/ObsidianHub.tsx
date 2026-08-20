import { For, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
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
import { CloseIcon, FolderIcon, RefreshIcon, SearchIcon } from './Icons';
import { Badge, Button, Input } from './ui';
import { t } from '../i18n';
import type { ObsidianNoteDetail, ObsidianSearchResponse } from '../types';
import { trapDialogFocus } from '../utils/dialog-focus';
import { createLatestRequestGuard } from '../utils/latest-request';

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
  const searchRequests = createLatestRequestGuard();
  const noteRequests = createLatestRequestGuard();

  const closeNoteReader = () => {
    noteRequests.invalidate();
    setIsLoadingNote(false);
    setActiveNoteDetail(null);
  };

  const handleReaderKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeNoteReader();
    }
  };

  createEffect(() => {
    if (!activeNoteDetail()) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    onCleanup(() => {
      queueMicrotask(() => {
        if (previouslyFocused?.isConnected) previouslyFocused.focus();
      });
    });
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchObsidianVaultApi();
    setIsRefreshing(false);
  };

  onMount(() => {
    if (!obsidianSummary()) {
      handleRefresh();
    }

    onCleanup(() => {
      searchRequests.invalidate();
      noteRequests.invalidate();
    });
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
    const requestId = searchRequests.next();
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResult(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const res = await searchObsidianApi(query.trim());
    if (!searchRequests.isLatest(requestId)) return;
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
    const requestId = noteRequests.next();
    setIsLoadingNote(true);
    const detail = await fetchObsidianNoteApi(relPath);
    if (!noteRequests.isLatest(requestId)) return;
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
    <div class="flex flex-col gap-4" aria-label={t().obsidian.title}>
      {/* 1. Vault Cockpit Overview Card */}
      <section class="hud-box p-4 shadow-lg bg-bg-surface/90">
        <div class="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent shadow-2xs">
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
                <h1 class="text-sm font-bold text-text-primary m-0">
                  {obsidianSummary()?.vault_name || t().sidebar.navObsidian}
                </h1>
                <Show when={obsidianSummary()?.git_branch}>
                  <span class="rounded-md bg-bg-subtle border border-border-subtle px-2 py-0.5 mono text-[10px] text-text-secondary flex items-center gap-1 font-semibold">
                    <svg
                      class="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
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
                  fallback={<Badge variant="success">{t().obsidian.clean}</Badge>}
                >
                  <Badge variant="warning" dot>
                    {obsidianSummary()?.git_uncommitted_count} {t().obsidian.dirty}
                  </Badge>
                </Show>
              </div>

              <Show when={obsidianSummary()?.vault_path}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(obsidianSummary()?.vault_path || '', t().obsidian.vaultPath)
                  }
                  class="mt-1 max-w-lg truncate text-left mono text-[10.5px] text-text-muted hover:text-accent h-auto py-1 px-2 justify-start"
                  title={obsidianSummary()?.vault_path}
                >
                  <FolderIcon class="h-3.5 w-3.5 shrink-0 mr-1" />
                  <span class="truncate">{obsidianSummary()?.vault_path}</span>
                </Button>
              </Show>
            </div>
          </div>

          {/* Action Tools */}
          <div class="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => openObsidianApi({ target_app: 'obsidian' })}
              aria-label={t().obsidian.openApp}
            >
              <svg
                class="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>{t().obsidian.openApp}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openObsidianApi({ target_app: 'finder' })}
              aria-label={t().obsidian.openFinder}
            >
              {t().obsidian.openFinder}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openObsidianApi({ target_app: 'code' })}
              aria-label={t().obsidian.openCode}
            >
              {t().obsidian.openCode}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openObsidianApi({ target_app: 'terminal' })}
              aria-label={t().obsidian.openTerminal}
            >
              {t().obsidian.openTerminal}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing()}
              loading={isRefreshing()}
              aria-label={t().common.refresh}
            >
              <RefreshIcon class={`h-3.5 w-3.5 ${isRefreshing() ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Metric Badges Grid */}
        <div class="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5 border-t border-border-subtle pt-3.5">
          <div class="glass-card-subtle p-2.5">
            <span class="text-[10px] text-text-muted block font-semibold">
              {t().obsidian.totalNotes}
            </span>
            <span class="mono text-base font-bold text-text-primary mt-0.5 block tabular-nums">
              {obsidianSummary()?.total_notes ?? '-'}
            </span>
          </div>

          <div class="glass-card-subtle p-2.5">
            <span class="text-[10px] text-text-muted block font-semibold">
              {t().obsidian.totalWords}
            </span>
            <span class="mono text-base font-bold text-accent mt-0.5 block tabular-nums">
              {obsidianSummary()?.total_words?.toLocaleString() ?? '-'}
            </span>
          </div>

          <div class="glass-card-subtle p-2.5">
            <span class="text-[10px] text-text-muted block font-semibold">
              {t().obsidian.totalAttachments}
            </span>
            <span class="mono text-base font-bold text-text-primary mt-0.5 block tabular-nums">
              {obsidianSummary()?.total_attachments ?? '-'}
            </span>
          </div>

          <div class="glass-card-subtle p-2.5">
            <span class="text-[10px] text-text-muted block font-semibold">
              {t().obsidian.totalFolders}
            </span>
            <span class="mono text-base font-bold text-text-primary mt-0.5 block tabular-nums">
              {obsidianSummary()?.total_folders ?? '-'}
            </span>
          </div>

          <div class="glass-card-subtle p-2.5">
            <span class="text-[10px] text-text-muted block font-semibold">
              {t().obsidian.vaultSize}
            </span>
            <span class="mono text-base font-bold text-status-success mt-0.5 block tabular-nums">
              {obsidianSummary()?.disk_size_human ?? '-'}
            </span>
          </div>
        </div>
      </section>

      {/* 2. Quick Capture (灵感闪念盒) */}
      <section class="glass-card p-4 shadow-xs">
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
            <Button
              type="button"
              variant={captureTarget() === 'daily' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCaptureTarget('daily')}
              aria-pressed={captureTarget() === 'daily'}
            >
              {t().obsidian.targetDaily}
            </Button>
            <Button
              type="button"
              variant={captureTarget() === 'inbox' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCaptureTarget('inbox')}
              aria-pressed={captureTarget() === 'inbox'}
            >
              {t().obsidian.targetInbox}
            </Button>
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
            aria-label={t().obsidian.quickCaptureTitle}
            class="w-full rounded-lg border border-border-default bg-bg-input p-2.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors resize-none"
          />

          <div class="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 w-full sm:w-auto">
              <span class="mono text-xs text-text-muted">#</span>
              <Input
                type="text"
                value={quickCaptureTag()}
                onInput={(e) => setQuickCaptureTag(e.currentTarget.value)}
                placeholder={t().obsidian.tagPlaceholder}
                aria-label={t().obsidian.tagPlaceholder}
                class="h-7 w-full sm:w-48"
              />
            </div>

            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={isCapturing() || !quickCaptureText().trim()}
              loading={isCapturing()}
              class="w-full sm:w-auto"
            >
              <span>{isCapturing() ? t().obsidian.capturing : t().obsidian.captureBtn}</span>
            </Button>
          </div>
        </form>
      </section>

      {/* 2. Omnisearch & Instant Note Reader */}
      <section class="glass-card p-4 shadow-xs">
        <div class="flex flex-col gap-2 border-b border-border-subtle pb-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 class="text-sm font-bold text-text-primary m-0">{t().obsidian.recentNotes}</h2>
            </div>

            {/* Search Input Bar */}
            <div class="relative w-full sm:w-80">
              <Input
                type="text"
                value={searchQuery()}
                onInput={(e) => handleSearch(e.currentTarget.value)}
                placeholder={t().obsidian.searchPlaceholder}
                aria-label={t().obsidian.searchPlaceholder}
                class="w-full pl-8 pr-7"
              />
              <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
                <SearchIcon class="h-3.5 w-3.5" />
              </span>
              <Show when={isSearching()}>
                <span class="absolute right-7 top-1/2 -translate-y-1/2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </Show>
              <Show when={searchQuery()}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleSearch('')}
                  aria-label={t().common.cancel}
                  class="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                >
                  <CloseIcon class="h-3 w-3" />
                </Button>
              </Show>
            </div>

            <Show when={selectedTag()}>
              <div class="flex items-center gap-1.5 text-xs">
                <span class="text-text-muted text-[11px] font-semibold">
                  {t().obsidian.tagFilter}:
                </span>
                <span class="rounded-md bg-accent/15 text-accent border border-accent/30 px-2 py-0.5 mono text-[11px] font-bold flex items-center gap-1">
                  #{selectedTag()}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedTag(null)}
                    aria-label={t().common.cancel}
                    class="h-4 w-4 p-0"
                  >
                    <CloseIcon class="h-3 w-3" />
                  </Button>
                </span>
              </div>
            </Show>
          </div>

          {/* Popular Tag Radar Pills */}
          <Show when={obsidianSummary()?.top_tags?.length}>
            <div class="flex flex-wrap items-center gap-1.5 pt-1">
              <span class="text-[10px] text-text-muted font-bold mr-1">
                {t().obsidian.tagFilter}:
              </span>
              <For each={obsidianSummary()?.top_tags}>
                {(tag) => (
                  <Button
                    type="button"
                    variant={selectedTag() === tag.name ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => handleSelectTag(tag.name)}
                    class="mono text-[10px]"
                  >
                    #{tag.name} <span class="opacity-75 text-[9px]">({tag.count})</span>
                  </Button>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Search Results Dropdown List (if any) */}
        <Show when={searchQuery().trim() && searchResult()}>
          <div class="mt-3.5 rounded-lg border border-border-default bg-bg-base/80 p-3.5 animate-in fade-in duration-150">
            <div class="flex items-center justify-between text-[11px] text-text-muted mb-2.5 border-b border-border-subtle pb-2">
              <span class="font-bold">
                {t().obsidian.searchMatches.replace(
                  '{count}',
                  searchResult()?.total_matches.toString() || '0',
                )}
              </span>
              <span class="mono text-[10.5px] text-accent font-bold">"{searchQuery()}"</span>
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
                  <button
                    type="button"
                    onClick={() => handleOpenNote(match.rel_path)}
                    class="w-full py-2.5 px-2 hover:bg-bg-hover/60 rounded-lg cursor-pointer transition-colors group text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                  >
                    <div class="flex items-center justify-between text-xs">
                      <span class="font-bold text-text-primary group-hover:text-accent truncate">
                        {match.title}
                      </span>
                      <span class="mono text-[10px] text-text-muted">
                        {t().obsidian.searchLine.replace('{line}', match.line_number.toString())}
                      </span>
                    </div>
                    <p class="mt-1 mono text-[11px] text-text-secondary line-clamp-2 leading-relaxed">
                      {match.line_content}
                    </p>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>
      </section>

      {/* 4. Recent Notes Grid */}
      <section class="glass-card p-4 shadow-xs">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-accent animate-pulse-dot" />
            <h2 class="text-xs font-bold text-text-primary m-0">{t().obsidian.recentNotes}</h2>
            <span class="rounded-md bg-bg-subtle border border-border-subtle px-1.8 py-0.2 mono text-[10px] font-bold text-text-muted">
              {filteredNotes().length}
            </span>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <For
            each={filteredNotes()}
            fallback={
              <div class="col-span-full py-12 text-center text-xs text-text-muted font-mono">
                {t().obsidian.emptyNotes}
              </div>
            }
          >
            {(note) => (
              <button
                type="button"
                onClick={() => handleOpenNote(note.rel_path)}
                class="glass-card-subtle flex w-full flex-col justify-between p-3.5 hover:border-border-hover cursor-pointer transition-all duration-150 group shadow-xs hover:translate-y-[-1px] text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              >
                <div>
                  <div class="flex items-start justify-between gap-2">
                    <h3 class="text-xs font-bold text-text-primary group-hover:text-accent transition-colors line-clamp-1 m-0">
                      {note.title}
                    </h3>
                    <span class="mono text-[9.5px] text-text-muted shrink-0 font-medium">
                      {note.modified_human}
                    </span>
                  </div>

                  <p class="mt-2 text-[11px] text-text-secondary line-clamp-2 leading-relaxed">
                    {note.preview_snippet || '…'}
                  </p>
                </div>

                <div class="mt-3.5 flex items-center justify-between border-t border-border-subtle/60 pt-2.5 text-[10px]">
                  <div class="flex items-center gap-1 overflow-hidden truncate">
                    <Show
                      when={note.tags.length > 0}
                      fallback={
                        <span class="mono text-[9.5px] text-text-muted truncate">
                          {note.rel_path}
                        </span>
                      }
                    >
                      <For each={note.tags.slice(0, 2)}>
                        {(tag) => (
                          <span class="rounded bg-bg-surface border border-border-subtle px-1.8 py-0.2 mono text-[9.5px] font-bold text-accent truncate">
                            #{tag}
                          </span>
                        )}
                      </For>
                    </Show>
                  </div>

                  <span class="mono text-text-muted shrink-0 text-[10px] font-semibold">
                    {note.word_count} {t().obsidian.words}
                  </span>
                </div>
              </button>
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
            onKeyDown={(e) => {
              trapDialogFocus(e, e.currentTarget);
              handleReaderKeyDown(e);
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeNoteReader();
            }}
          >
            <div
              ref={(element) => queueMicrotask(() => element.focus())}
              tabIndex={-1}
              class="relative flex flex-col w-full max-w-3xl max-h-[85vh] rounded-xl border border-border-strong bg-bg-modal shadow-2xl transition-all duration-200 animate-in fade-in zoom-in-95 overflow-hidden focus:outline-none"
            >
              {/* Header Bar */}
              <div class="flex items-center justify-between border-b border-border-subtle bg-bg-subtle/50 px-4 py-3">
                <div class="min-w-0 flex-1 pr-3">
                  <h2 id="note-reader-title" class="text-sm font-bold text-text-primary truncate">
                    {note().title}
                  </h2>
                  <div class="mt-0.5 flex items-center gap-2 text-[10.5px] text-text-muted mono truncate">
                    <span>{note().rel_path}</span>
                    <span>•</span>
                    <span>
                      {note().word_count} {t().obsidian.words}
                    </span>
                    <span>•</span>
                    <span>{note().modified_human}</span>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() =>
                      openObsidianApi({
                        file_path: note().rel_path,
                        target_app: 'obsidian',
                      })
                    }
                  >
                    {t().obsidian.editInObsidian}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(note().content, t().obsidian.copyContent)}
                  >
                    {t().obsidian.copyContent}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={closeNoteReader}
                    aria-label={t().obsidian.closeReader}
                  >
                    <CloseIcon class="h-4 w-4" />
                  </Button>
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
