import { For, Match, Show, Switch, createSignal, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import {
  copyToClipboard,
  fetchGitAccountApi,
  gitAccount,
  gitProjects,
  openAppApi,
  openSnapshotDrawer,
  scanGitProjectsApi,
} from '../services/store';
import {
  CodeIcon,
  CompactIcon,
  FolderIcon,
  GitIcon,
  GithubIcon,
  GridIcon,
  ListIcon,
  RefreshIcon,
  TerminalIcon,
  UserIcon,
} from './Icons';
import { SavePointDrawer } from './SavePointDrawer';
import { GitRepoLayoutMode, GitRepoSortBy, StorageKey } from '../constants';
import { t } from '../i18n';

const getInitialLayout = (): GitRepoLayoutMode => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(StorageKey.GIT_LAYOUT);
    if (
      saved === GitRepoLayoutMode.GRID ||
      saved === GitRepoLayoutMode.TABLE ||
      saved === GitRepoLayoutMode.COMPACT
    ) {
      return saved as GitRepoLayoutMode;
    }
  }
  return GitRepoLayoutMode.GRID;
};

export const GitRadar: Component = () => {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [isScanning, setIsScanning] = createSignal(false);
  const [layoutMode, setLayoutModeState] = createSignal<GitRepoLayoutMode>(getInitialLayout());
  const [sortBy, setSortBy] = createSignal<GitRepoSortBy>(GitRepoSortBy.RECENT);
  const [dirtyOnly, setDirtyOnly] = createSignal(false);

  const setLayoutMode = (mode: GitRepoLayoutMode) => {
    setLayoutModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(StorageKey.GIT_LAYOUT, mode);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    await Promise.all([scanGitProjectsApi(), fetchGitAccountApi()]);
    setIsScanning(false);
  };

  onMount(() => {
    fetchGitAccountApi();
    if (gitProjects().length === 0) {
      handleScan();
    }
  });

  const filteredAndSortedProjects = () => {
    let list = [...gitProjects()];
    const q = searchQuery().trim().toLowerCase();

    // 1. Keyword search filter
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.branch.toLowerCase().includes(q) ||
          p.path.toLowerCase().includes(q) ||
          p.last_commit_msg.toLowerCase().includes(q) ||
          p.last_commit_author.toLowerCase().includes(q),
      );
    }

    // 2. Dirty only filter
    if (dirtyOnly()) {
      list = list.filter((p) => p.is_dirty);
    }

    // 3. Sorting
    const sort = sortBy();
    if (sort === GitRepoSortBy.NAME) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === GitRepoSortBy.DIRTY) {
      list.sort((a, b) => {
        if (a.is_dirty && !b.is_dirty) return -1;
        if (!a.is_dirty && b.is_dirty) return 1;
        return (b.uncommitted_count || 0) - (a.uncommitted_count || 0);
      });
    }

    return list;
  };

  const dirtyCount = () => gitProjects().filter((p) => p.is_dirty).length;

  return (
    <div class="flex flex-col gap-3" aria-label={t().gitRadar.title}>
      {/* 1. Git & GitHub Account Identity Card Banner */}
      <section class="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Left: Local Git Global Identity */}
        <div class="glass-card flex flex-col justify-between p-4 shadow-xs">
          <div>
            <div class="flex items-center justify-between pb-2 border-b border-border-subtle">
              <div class="flex items-center gap-2">
                <div class="flex h-6.5 w-6.5 items-center justify-center rounded-lg bg-accent/10 text-accent border border-accent/20">
                  <GitIcon class="h-3.5 w-3.5" />
                </div>
                <h3 class="text-xs font-bold text-text-primary">{t().gitRadar.globalConfig}</h3>
              </div>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(gitAccount()?.git.config_path || '~/.gitconfig', 'Config Path')
                }
                class="mono text-[9.5px] text-text-muted hover:text-accent focus-visible:ring-1 focus-visible:ring-accent rounded px-1.5 py-0.5 bg-bg-subtle border border-border-subtle"
                title={gitAccount()?.git.config_path}
              >
                {gitAccount()?.git.config_path}
              </button>
            </div>

            <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span class="text-[10px] font-semibold text-text-muted">{t().gitRadar.user}</span>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <UserIcon class="h-3 w-3 text-text-muted" />
                  <span class="font-bold text-text-primary text-[12px] truncate">
                    {gitAccount()?.git.user_name || t().gitRadar.notConfigured}
                  </span>
                </div>
              </div>

              <div>
                <span class="text-[10px] font-semibold text-text-muted">{t().gitRadar.email}</span>
                <div class="mt-0.5">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(gitAccount()?.git.user_email || '', 'Git Email')}
                    class="mono text-[11px] text-text-secondary hover:text-accent text-left truncate block max-w-full focus-visible:ring-1 focus-visible:ring-accent rounded"
                    title={gitAccount()?.git.user_email || ''}
                  >
                    {gitAccount()?.git.user_email || t().gitRadar.notConfigured}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-3 flex items-center justify-between border-t border-border-subtle pt-2.5 text-[10px] text-text-muted mono">
            <span class="truncate">
              {t().gitRadar.defaultBranch}:{' '}
              <strong class="text-text-primary">
                {gitAccount()?.git.default_branch || 'main'}
              </strong>
            </span>
            <span class="truncate">
              {t().gitRadar.editor}:{' '}
              <span class="text-text-secondary font-medium">
                {gitAccount()?.git.editor || 'vim'}
              </span>
            </span>
          </div>
        </div>

        {/* Right: GitHub CLI & Remote Account Info */}
        <div class="glass-card flex flex-col justify-between p-4 shadow-xs">
          <div>
            <div class="flex items-center justify-between pb-2 border-b border-border-subtle">
              <div class="flex items-center gap-2">
                <div class="flex h-6.5 w-6.5 items-center justify-center rounded-lg bg-text-primary/10 text-text-primary border border-border-default">
                  <GithubIcon class="h-3.5 w-3.5" />
                </div>
                <h3 class="text-xs font-bold text-text-primary">{t().gitRadar.githubAccount}</h3>
              </div>

              <Show when={gitAccount()?.github?.username}>
                {(uname) => (
                  <a
                    href={`https://github.com/${uname()}`}
                    target="_blank"
                    rel="noreferrer"
                    class="mono text-[10px] font-semibold text-accent hover:underline flex items-center gap-1 focus-visible:ring-1 focus-visible:ring-accent rounded px-1.5 py-0.5 bg-bg-subtle border border-border-subtle"
                  >
                    github.com/{uname()}
                  </a>
                )}
              </Show>
            </div>

            <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span class="text-[10px] font-semibold text-text-muted">{t().gitRadar.user}</span>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <UserIcon class="h-3 w-3 text-text-muted" />
                  <span class="font-bold text-text-primary text-[12px] truncate">
                    {gitAccount()?.github?.username || t().gitRadar.notLoggedIn}
                  </span>
                </div>
              </div>

              <div>
                <span class="text-[10px] font-semibold text-text-muted">
                  {t().gitRadar.protocol}
                </span>
                <div class="mt-0.5">
                  <span class="mono text-[11px] text-text-secondary uppercase">
                    {gitAccount()?.github?.git_protocol || 'https'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-3 flex items-center justify-between border-t border-border-subtle pt-2.5 text-[10px]">
            <span class="text-text-muted font-mono">{t().gitRadar.authState}:</span>
            <span
              class="mono rounded-md px-2 py-0.5 font-bold text-[9.5px]"
              classList={{
                'bg-status-success/15 text-status-success border border-status-success/30': Boolean(
                  gitAccount()?.github?.is_authenticated,
                ),
                'bg-status-warning/15 text-status-warning border border-status-warning/30': Boolean(
                  !gitAccount()?.github?.is_authenticated && gitAccount()?.github?.username,
                ),
                'bg-bg-subtle text-text-muted border border-border-subtle': Boolean(
                  !gitAccount()?.github?.username,
                ),
              }}
            >
              {gitAccount()?.github?.status_text || t().gitRadar.notLoggedIn}
            </span>
          </div>
        </div>
      </section>

      {/* 2. Controls Toolbar */}
      <section class="glass-card flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        {/* Left: Title and Dirty Count Badge */}
        <div class="flex items-center gap-2.5">
          <div class="flex items-center gap-2">
            <h2 class="text-xs font-bold text-text-primary m-0">{t().gitRadar.title}</h2>
            <span class="mono text-[10px] font-bold text-text-muted bg-bg-subtle px-1.8 py-0.2 rounded border border-border-subtle">
              {gitProjects().length} {t().gitRadar.reposUnit}
            </span>
          </div>

          <Show when={dirtyCount() > 0}>
            <span class="rounded-full bg-status-warning/15 border border-status-warning/30 px-2 py-0.2 mono text-[10px] text-status-warning font-bold animate-pulse">
              {dirtyCount()} {t().gitRadar.dirty}
            </span>
          </Show>
        </div>

        {/* Right: Search, Filter, Sort, Layout Switcher & Refresh */}
        <div class="flex flex-wrap items-center gap-2">
          {/* Quick Dirty Filter Toggle */}
          <button
            type="button"
            onClick={() => setDirtyOnly(!dirtyOnly())}
            aria-pressed={dirtyOnly()}
            aria-label={t().gitRadar.filterDirtyOnly}
            class="rounded border px-2 py-1 text-[10.5px] transition-colors focus-visible:ring-1 focus-visible:ring-accent"
            classList={{
              'bg-status-warning/15 border-status-warning/30 text-status-warning font-medium':
                dirtyOnly(),
              'bg-bg-input border-border-subtle text-text-muted hover:text-text-primary':
                !dirtyOnly(),
            }}
          >
            {t().gitRadar.filterDirtyOnly}
          </button>

          {/* Sort Switcher */}
          <div class="flex items-center rounded border border-border-subtle bg-bg-input p-0.5 text-[10.5px]">
            <button
              type="button"
              onClick={() => setSortBy(GitRepoSortBy.RECENT)}
              aria-pressed={sortBy() === GitRepoSortBy.RECENT}
              class="rounded px-2 py-0.5 transition-colors focus-visible:ring-1 focus-visible:ring-accent"
              classList={{
                'bg-bg-active text-text-primary font-medium': sortBy() === GitRepoSortBy.RECENT,
                'text-text-muted hover:text-text-primary': sortBy() !== GitRepoSortBy.RECENT,
              }}
            >
              {t().gitRadar.sortRecent}
            </button>
            <button
              type="button"
              onClick={() => setSortBy(GitRepoSortBy.DIRTY)}
              aria-pressed={sortBy() === GitRepoSortBy.DIRTY}
              class="rounded px-2 py-0.5 transition-colors focus-visible:ring-1 focus-visible:ring-accent"
              classList={{
                'bg-bg-active text-text-primary font-medium': sortBy() === GitRepoSortBy.DIRTY,
                'text-text-muted hover:text-text-primary': sortBy() !== GitRepoSortBy.DIRTY,
              }}
            >
              {t().gitRadar.sortDirty}
            </button>
            <button
              type="button"
              onClick={() => setSortBy(GitRepoSortBy.NAME)}
              aria-pressed={sortBy() === GitRepoSortBy.NAME}
              class="rounded px-2 py-0.5 transition-colors focus-visible:ring-1 focus-visible:ring-accent"
              classList={{
                'bg-bg-active text-text-primary font-medium': sortBy() === GitRepoSortBy.NAME,
                'text-text-muted hover:text-text-primary': sortBy() !== GitRepoSortBy.NAME,
              }}
            >
              {t().gitRadar.sortName}
            </button>
          </div>

          {/* Layout Mode Switcher */}
          <div
            class="flex items-center rounded border border-border-subtle bg-bg-input p-0.5"
            role="group"
            aria-label="Layout Switcher"
          >
            <button
              type="button"
              onClick={() => setLayoutMode(GitRepoLayoutMode.GRID)}
              aria-pressed={layoutMode() === GitRepoLayoutMode.GRID}
              aria-label={t().gitRadar.layoutGrid}
              title={t().gitRadar.layoutGrid}
              class="flex h-6 w-6 items-center justify-center rounded transition-colors focus-visible:ring-1 focus-visible:ring-accent"
              classList={{
                'bg-bg-active text-text-primary': layoutMode() === GitRepoLayoutMode.GRID,
                'text-text-muted hover:text-text-primary': layoutMode() !== GitRepoLayoutMode.GRID,
              }}
            >
              <GridIcon class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode(GitRepoLayoutMode.TABLE)}
              aria-pressed={layoutMode() === GitRepoLayoutMode.TABLE}
              aria-label={t().gitRadar.layoutTable}
              title={t().gitRadar.layoutTable}
              class="flex h-6 w-6 items-center justify-center rounded transition-colors focus-visible:ring-1 focus-visible:ring-accent"
              classList={{
                'bg-bg-active text-text-primary': layoutMode() === GitRepoLayoutMode.TABLE,
                'text-text-muted hover:text-text-primary': layoutMode() !== GitRepoLayoutMode.TABLE,
              }}
            >
              <ListIcon class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode(GitRepoLayoutMode.COMPACT)}
              aria-pressed={layoutMode() === GitRepoLayoutMode.COMPACT}
              aria-label={t().gitRadar.layoutCompact}
              title={t().gitRadar.layoutCompact}
              class="flex h-6 w-6 items-center justify-center rounded transition-colors focus-visible:ring-1 focus-visible:ring-accent"
              classList={{
                'bg-bg-active text-text-primary': layoutMode() === GitRepoLayoutMode.COMPACT,
                'text-text-muted hover:text-text-primary':
                  layoutMode() !== GitRepoLayoutMode.COMPACT,
              }}
            >
              <CompactIcon class="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Search box */}
          <div class="relative flex items-center">
            <input
              type="text"
              aria-label={t().gitRadar.searchPlaceholder}
              placeholder={t().gitRadar.searchPlaceholder}
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="w-48 rounded border border-border-default bg-bg-input py-1 pl-2.5 pr-6 text-[11px] text-text-primary placeholder:text-text-muted outline-none transition-all focus:border-border-strong focus-visible:ring-1 focus-visible:ring-accent"
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

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleScan}
            disabled={isScanning()}
            aria-busy={isScanning()}
            aria-label={t().gitRadar.scanBtn}
            class="flex items-center justify-center gap-1.5 rounded border border-border-default bg-bg-subtle px-2.5 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-bg-hover disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent"
          >
            <RefreshIcon class={`h-3.5 w-3.5 ${isScanning() ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </section>

      {/* 3. Dynamic Views: Grid / Table / Compact */}
      <Switch>
        {/* ======================================================== */}
        {/* 1. GRID LAYOUT MODE (CARDS)                              */}
        {/* ======================================================== */}
        <Match when={layoutMode() === GitRepoLayoutMode.GRID}>
          <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <For
              each={filteredAndSortedProjects()}
              fallback={
                <div class="col-span-full py-12 text-center text-xs text-text-muted font-mono">
                  <Show when={isScanning()} fallback={t().gitRadar.empty}>
                    {t().gitRadar.scanning}
                  </Show>
                </div>
              }
            >
              {(repo) => (
                <div class="flex flex-col justify-between rounded-lg border border-border-subtle bg-bg-input p-3 transition-colors hover:border-border-default">
                  <div>
                    {/* Repo Name & Branch */}
                    <div class="flex items-start justify-between">
                      <div class="truncate">
                        <div class="text-xs font-bold text-text-primary truncate" title={repo.name}>
                          {repo.name}
                        </div>
                        <div class="flex items-center gap-1.5 mt-1">
                          <span class="flex items-center gap-1 rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.2 mono text-[9.5px] text-accent">
                            <GitIcon class="h-2.5 w-2.5" />
                            <span>{repo.branch}</span>
                          </span>

                          <Show
                            when={repo.is_dirty}
                            fallback={
                              <span class="rounded bg-status-success/10 px-1.5 py-0.2 mono text-[9px] text-status-success font-medium">
                                {t().gitRadar.clean}
                              </span>
                            }
                          >
                            <span class="rounded bg-status-warning/10 px-1.5 py-0.2 mono text-[9px] text-status-warning font-medium">
                              {repo.uncommitted_count} {t().gitRadar.dirtyShort}
                            </span>
                          </Show>
                        </div>
                      </div>

                      {/* Ahead / Behind */}
                      <div class="flex flex-col items-end text-[9.5px] mono text-text-muted">
                        <Show when={repo.ahead > 0}>
                          <span class="text-status-success">↑{repo.ahead}</span>
                        </Show>
                        <Show when={repo.behind > 0}>
                          <span class="text-status-warning">↓{repo.behind}</span>
                        </Show>
                      </div>
                    </div>

                    {/* Path */}
                    <button
                      type="button"
                      onClick={() => copyToClipboard(repo.path, 'Repo Path')}
                      class="mt-2 mono text-[9px] text-text-muted truncate hover:text-accent text-left block w-full focus-visible:ring-1 focus-visible:ring-accent rounded"
                      title={repo.path}
                      aria-label={repo.path}
                    >
                      {repo.path}
                    </button>

                    {/* Last Commit Box */}
                    <div class="mt-2 rounded bg-bg-subtle/70 p-2 text-[10px] text-text-secondary border border-border-subtle">
                      <div
                        class="truncate font-medium text-text-primary"
                        title={repo.last_commit_msg}
                      >
                        {repo.last_commit_msg}
                      </div>
                      <div class="mt-1 flex items-center justify-between text-[9px] text-text-muted mono">
                        <span>{repo.last_commit_author}</span>
                        <span>{repo.last_commit_time}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div class="mt-3 flex items-center justify-between gap-1 border-t border-border-subtle pt-2 text-[10.5px]">
                    <button
                      type="button"
                      onClick={() => openSnapshotDrawer(repo.path)}
                      class="flex items-center gap-1 rounded bg-accent/10 border border-accent/30 px-2 py-0.5 text-accent font-semibold hover:bg-accent hover:text-white transition-all active:scale-95 shadow-2xs focus-visible:ring-1 focus-visible:ring-accent"
                      title={t().snapshots.drawerSubtitle}
                    >
                      <span>⏳</span>
                      <span>{t().snapshots.viewSnapshotsBtn}</span>
                    </button>

                    <div class="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openAppApi(repo.path, 'code')}
                        aria-label={`VS Code: ${repo.name}`}
                        class="flex items-center gap-1 rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors focus-visible:ring-1 focus-visible:ring-accent"
                        title={t().gitRadar.openCode}
                      >
                        <CodeIcon class="h-3 w-3 text-accent" />
                        <span>{t().gitRadar.openCode}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openAppApi(repo.path, 'cursor')}
                        aria-label={`Cursor: ${repo.name}`}
                        class="flex items-center gap-1 rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors focus-visible:ring-1 focus-visible:ring-accent"
                        title={t().gitRadar.openCursor}
                      >
                        <CodeIcon class="h-3 w-3 text-status-warning" />
                        <span>{t().gitRadar.openCursor}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openAppApi(repo.path, 'terminal')}
                        aria-label={`Terminal: ${repo.name}`}
                        class="flex items-center gap-1 rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors focus-visible:ring-1 focus-visible:ring-accent"
                        title={t().gitRadar.openTerminal}
                      >
                        <TerminalIcon class="h-3 w-3 text-status-info" />
                        <span>{t().gitRadar.openTerminal}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openAppApi(repo.path, 'finder')}
                        aria-label={`Finder: ${repo.name}`}
                        class="flex items-center gap-1 rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.5 text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors focus-visible:ring-1 focus-visible:ring-accent"
                        title={t().gitRadar.openFinder}
                      >
                        <FolderIcon class="h-3 w-3 text-status-success" />
                        <span>{t().gitRadar.openFinder}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Match>

        {/* ======================================================== */}
        {/* 2. TABLE / DETAILED LIST LAYOUT MODE                    */}
        {/* ======================================================== */}
        <Match when={layoutMode() === GitRepoLayoutMode.TABLE}>
          <div class="max-h-[600px] overflow-y-auto rounded-md border border-border-subtle bg-bg-input">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="sticky top-0 z-10 border-b border-border-default bg-bg-subtle text-[10.5px] text-text-muted">
                  <th scope="col" class="py-2 px-3 font-medium">
                    {t().gitRadar.thRepo}
                  </th>
                  <th scope="col" class="py-2 px-3 font-medium w-36">
                    {t().gitRadar.thBranch}
                  </th>
                  <th scope="col" class="py-2 px-3 font-medium w-32">
                    {t().gitRadar.thStatus}
                  </th>
                  <th scope="col" class="py-2 px-3 font-medium">
                    {t().gitRadar.thCommit}
                  </th>
                  <th scope="col" class="py-2 px-3 font-medium w-44">
                    {t().gitRadar.thPath}
                  </th>
                  <th scope="col" class="py-2 px-3 font-medium w-36 text-right">
                    {t().gitRadar.thActions}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle text-[11px]">
                <For
                  each={filteredAndSortedProjects()}
                  fallback={
                    <tr>
                      <td colspan="6" class="py-12 text-center text-xs text-text-muted font-mono">
                        {t().gitRadar.empty}
                      </td>
                    </tr>
                  }
                >
                  {(repo) => (
                    <tr class="hover:bg-bg-hover transition-colors">
                      {/* Repo Name */}
                      <td class="py-2 px-3">
                        <div class="font-bold text-text-primary">{repo.name}</div>
                      </td>

                      {/* Branch */}
                      <td class="py-2 px-3 font-mono">
                        <span class="flex items-center gap-1 rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.2 text-[9.5px] text-accent w-fit">
                          <GitIcon class="h-2.5 w-2.5" />
                          <span>{repo.branch}</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td class="py-2 px-3 font-mono text-[10px]">
                        <div class="flex items-center gap-1.5">
                          <Show
                            when={repo.is_dirty}
                            fallback={
                              <span class="rounded bg-status-success/10 px-1.5 py-0.2 text-[9px] text-status-success font-medium">
                                {t().gitRadar.clean}
                              </span>
                            }
                          >
                            <span class="rounded bg-status-warning/10 px-1.5 py-0.2 text-[9px] text-status-warning font-medium">
                              {repo.uncommitted_count} {t().gitRadar.dirtyShort}
                            </span>
                          </Show>

                          <Show when={repo.ahead > 0}>
                            <span class="text-status-success">↑{repo.ahead}</span>
                          </Show>
                          <Show when={repo.behind > 0}>
                            <span class="text-status-warning">↓{repo.behind}</span>
                          </Show>
                        </div>
                      </td>

                      {/* Commit Info */}
                      <td class="py-2 px-3 max-w-[260px]">
                        <div
                          class="truncate text-text-primary text-[10.5px]"
                          title={repo.last_commit_msg}
                        >
                          {repo.last_commit_msg}
                        </div>
                        <div class="mono text-[9px] text-text-muted truncate">
                          {repo.last_commit_author} · {repo.last_commit_time}
                        </div>
                      </td>

                      {/* Path */}
                      <td class="py-2 px-3 font-mono text-[9.5px] text-text-muted">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(repo.path, 'Path')}
                          class="truncate max-w-[170px] hover:text-accent text-left block focus-visible:ring-1 focus-visible:ring-accent rounded"
                          title={repo.path}
                        >
                          {repo.path}
                        </button>
                      </td>

                      {/* Actions */}
                      <td class="py-2 px-3 text-right">
                        <div class="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openSnapshotDrawer(repo.path)}
                            aria-label={`Time Machine: ${repo.name}`}
                            title={t().snapshots.viewSnapshotsBtn}
                            class="rounded px-1.5 py-0.5 text-xs bg-accent/10 border border-accent/30 text-accent font-medium hover:bg-accent hover:text-white transition-all active:scale-95"
                          >
                            ⏳ {t().snapshots.viewSnapshotsBtn}
                          </button>
                          <button
                            type="button"
                            onClick={() => openAppApi(repo.path, 'code')}
                            aria-label={`VS Code: ${repo.name}`}
                            title={t().gitRadar.openCode}
                            class="rounded p-1 bg-bg-subtle border border-border-subtle text-text-secondary hover:text-accent hover:bg-bg-hover transition-colors"
                          >
                            <CodeIcon class="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openAppApi(repo.path, 'cursor')}
                            aria-label={`Cursor: ${repo.name}`}
                            title={t().gitRadar.openCursor}
                            class="rounded p-1 bg-bg-subtle border border-border-subtle text-text-secondary hover:text-status-warning hover:bg-bg-hover transition-colors"
                          >
                            <CodeIcon class="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openAppApi(repo.path, 'terminal')}
                            aria-label={`Terminal: ${repo.name}`}
                            title={t().gitRadar.openTerminal}
                            class="rounded p-1 bg-bg-subtle border border-border-subtle text-text-secondary hover:text-status-info hover:bg-bg-hover transition-colors"
                          >
                            <TerminalIcon class="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openAppApi(repo.path, 'finder')}
                            aria-label={`Finder: ${repo.name}`}
                            title={t().gitRadar.openFinder}
                            class="rounded p-1 bg-bg-subtle border border-border-subtle text-text-secondary hover:text-status-success hover:bg-bg-hover transition-colors"
                          >
                            <FolderIcon class="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Match>

        {/* ======================================================== */}
        {/* 3. COMPACT LIST LAYOUT MODE                              */}
        {/* ======================================================== */}
        <Match when={layoutMode() === GitRepoLayoutMode.COMPACT}>
          <div class="flex flex-col divide-y divide-border-subtle rounded-md border border-border-subtle bg-bg-input">
            <For
              each={filteredAndSortedProjects()}
              fallback={
                <div class="py-12 text-center text-xs text-text-muted font-mono">
                  {t().gitRadar.empty}
                </div>
              }
            >
              {(repo) => (
                <div class="flex items-center justify-between px-3 py-2 hover:bg-bg-hover transition-colors gap-3">
                  {/* Left: Indicator + Name + Branch */}
                  <div class="flex items-center gap-2 min-w-0">
                    <span
                      class="h-2 w-2 rounded-full shrink-0"
                      classList={{
                        'bg-status-warning': repo.is_dirty,
                        'bg-status-success': !repo.is_dirty,
                      }}
                      title={
                        repo.is_dirty
                          ? `${repo.uncommitted_count} ${t().gitRadar.dirty}`
                          : t().gitRadar.clean
                      }
                    />

                    <span class="font-bold text-xs text-text-primary truncate" title={repo.name}>
                      {repo.name}
                    </span>

                    <span class="flex items-center gap-1 rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.2 mono text-[9px] text-accent shrink-0">
                      <GitIcon class="h-2 w-2" />
                      <span>{repo.branch}</span>
                    </span>

                    <Show when={repo.ahead > 0 || repo.behind > 0}>
                      <span class="mono text-[9px] text-text-muted shrink-0">
                        {repo.ahead > 0 ? `↑${repo.ahead}` : ''}
                        {repo.behind > 0 ? `↓${repo.behind}` : ''}
                      </span>
                    </Show>
                  </div>

                  {/* Center: Latest Commit Message */}
                  <div class="hidden md:flex items-center gap-2 min-w-0 flex-1 px-2 text-[10.5px] text-text-secondary truncate">
                    <span class="truncate text-text-muted">{repo.last_commit_msg}</span>
                    <span class="mono text-[9px] text-text-muted shrink-0">
                      ({repo.last_commit_time})
                    </span>
                  </div>

                  {/* Right: Quick Action Buttons */}
                  <div class="flex items-center gap-1 shrink-0 text-[10px]">
                    <button
                      type="button"
                      onClick={() => openSnapshotDrawer(repo.path)}
                      aria-label={`Time Machine ${repo.name}`}
                      title={t().snapshots.viewSnapshotsBtn}
                      class="rounded bg-accent/10 border border-accent/30 px-1.5 py-0.5 text-accent font-medium hover:bg-accent hover:text-white transition-colors"
                    >
                      ⏳ {t().snapshots.viewSnapshotsBtn}
                    </button>
                    <button
                      type="button"
                      onClick={() => openAppApi(repo.path, 'code')}
                      aria-label={`VS Code ${repo.name}`}
                      class="rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.5 text-text-secondary hover:text-accent hover:bg-bg-hover transition-colors"
                    >
                      {t().gitRadar.openCode}
                    </button>
                    <button
                      type="button"
                      onClick={() => openAppApi(repo.path, 'cursor')}
                      aria-label={`Cursor ${repo.name}`}
                      class="rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.5 text-text-secondary hover:text-status-warning hover:bg-bg-hover transition-colors"
                    >
                      {t().gitRadar.openCursor}
                    </button>
                    <button
                      type="button"
                      onClick={() => openAppApi(repo.path, 'terminal')}
                      aria-label={`Terminal ${repo.name}`}
                      class="rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.5 text-text-secondary hover:text-status-info hover:bg-bg-hover transition-colors"
                    >
                      {t().gitRadar.openTerminal}
                    </button>
                    <button
                      type="button"
                      onClick={() => openAppApi(repo.path, 'finder')}
                      aria-label={`Finder ${repo.name}`}
                      class="rounded bg-bg-subtle border border-border-subtle px-1.5 py-0.5 text-text-secondary hover:text-status-success hover:bg-bg-hover transition-colors"
                    >
                      {t().gitRadar.openFinder}
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Match>
      </Switch>

      {/* Time Machine & Save Point Snapshot Drawer */}
      <SavePointDrawer />
    </div>
  );
};
