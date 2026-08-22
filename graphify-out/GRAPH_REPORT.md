# Graph Report - workstation-monitor  (2026-08-22)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1181 nodes · 2725 edges · 56 communities (50 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `150125b1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 54
- Community 55
- Community 57

## God Nodes (most connected - your core abstractions)
1. `t()` - 57 edges
2. `cn()` - 37 edges
3. `AutoUpdater` - 32 edges
4. `showToast()` - 28 edges
5. `AppState` - 28 edges
6. `copyToClipboard()` - 24 edges
7. `Button()` - 21 edges
8. `compilerOptions` - 19 edges
9. `ObsidianManager` - 19 edges
10. `Badge()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `build_router()`  [INFERRED]
  src/main.rs → src/server/router.rs
- `post_kill_port()` --calls--> `kill_process_by_port()`  [INFERRED]
  src/server/router.rs → src/collectors/processes.rs
- `post_kill_process()` --calls--> `kill_process()`  [INFERRED]
  src/server/router.rs → src/collectors/processes.rs
- `NavItem` --references--> `NavSectionId`  [EXTRACTED]
  frontend/src/components/Sidebar.tsx → frontend/src/constants/index.ts
- `Badge()` --calls--> `cn()`  [EXTRACTED]
  frontend/src/components/ui/badge.tsx → frontend/src/components/ui/utils.ts

## Import Cycles
- None detected.

## Communities (56 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (36): AtomicBool, AutoUpdater, backup_listing_ignores_partial_symlinked_and_malformed_files(), failed_atomic_archive_does_not_truncate_existing_backup(), failed_install_rename_restores_the_running_executable(), failed_operation_result_sets_failed_progress(), failed_version_archive_preserves_the_running_executable(), GitHubReleaseAsset (+28 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (33): AiRadarView(), KNOWN_API_KEYS, KnownApiKeyDef, AntennaIcon, BrainIcon, CopyIcon, DevToolsIcon, DiskIcon (+25 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (58): [activeSection, setActiveSection], [activeSnapshotPath, setActiveSnapshotPath], applyUpdateApi(), [battery, setBattery], [cleanerItems, setCleanerItems], [confirmModal, setConfirmModal], [currentTab, setCurrentTab], [devTools, setDevTools] (+50 more)

### Community 3 - "Community 3"
Cohesion: 0.10
Nodes (54): AppVersionInfo, BatteryInfo, CapturedPacket, CleanerItem, CleanRequest, CreateSnapshotRequest, DevToolInfo, DiskInfo (+46 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (25): File, Metadata, ObsidianNoteDetail, ObsidianSearchResponse, ObsidianVaultSummary, anchored_append_rejects_parent_swapped_to_symlink_after_root_open(), anchored_read_rejects_parent_swapped_to_symlink_after_root_open(), AnchoredVault (+17 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (37): ChevronDownIcon, Accordion, AccordionContent(), AccordionItem, AccordionTrigger(), Avatar(), AvatarProps, BadgeProps (+29 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (26): CleanerItem, command_failure_is_not_reported_as_a_successful_clean(), destructive_cleanup_commands_use_a_longer_timeout_than_scan_probes(), dir_size_does_not_follow_directory_symlinks(), directory_only_clean_does_not_start_an_external_command(), every_scanned_directory_target_has_a_clean_path(), external_commands_are_terminated_after_the_deadline(), remove_dir_contents_rejects_a_symlinked_root() (+18 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (25): GitAccountSummary, GitHubAccountInfo, GitProjectInfo, HashSet, failed_git_status_is_reported_as_unknown_instead_of_clean(), git_command_timeout_cannot_be_extended_by_a_child_holding_output_pipes(), git_commands_are_terminated_after_the_deadline(), GitRadar (+17 more)

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (39): @ark-ui/solid, dependencies, @ark-ui/solid, @kobalte/core, solid-js, @solid-primitives/clipboard, @solid-primitives/i18n, @solid-primitives/keyboard (+31 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (39): AppVersionInfo, BatteryInfo, CapturedPacket, ConfirmModalConfig, DetectedApiKey, DevToolInfo, DiskInfo, EnvVarEntry (+31 more)

### Community 10 - "Community 10"
Cohesion: 0.10
Nodes (33): getInitialLayout(), GitRadar(), CameraIcon, ClockIcon, CodeIcon, ExternalLinkIcon, FolderIcon, GithubIcon (+25 more)

### Community 11 - "Community 11"
Cohesion: 0.10
Nodes (28): Box, CapturedPacket, Domain, Error, IpAddr, OsString, SocketAddr, parse_ethernet_packet() (+20 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (35): eslint, eslint-config-prettier, @eslint/js, eslint-plugin-i18n, eslint-plugin-solid, devDependencies, eslint, eslint-config-prettier (+27 more)

### Community 13 - "Community 13"
Cohesion: 0.15
Nodes (32): Json, get_ai_agents(), get_cleaner_scan(), get_env_vars(), get_git_account(), get_git_projects(), get_hosts(), get_llm_latency() (+24 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (20): HeaderMap, Instant, Networks, SpeedTestResult, Client, Result, String, SpeedEndpoint (+12 more)

### Community 15 - "Community 15"
Cohesion: 0.08
Nodes (30): Arc, RwLock, get_battery(), get_dev_tools(), get_disks(), get_latency(), get_processes(), get_sockets() (+22 more)

### Community 16 - "Community 16"
Cohesion: 0.19
Nodes (10): AppLayout(), ConfirmModal(), Footer(), AlertWarningIcon, UpdateModal(), closeConfirmDialog(), fetchVersionBackupsApi(), FOCUSABLE_SELECTOR (+2 more)

### Community 17 - "Community 17"
Cohesion: 0.08
Nodes (24): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, jsxImportSource, lib, module (+16 more)

### Community 18 - "Community 18"
Cohesion: 0.17
Nodes (15): SnapshotActionResponse, SnapshotsListResponse, GitIndexBackup, rollback_stops_when_requested_safety_backup_cannot_be_committed(), Drop, Option, Path, PathBuf (+7 more)

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (19): OpsIcon, PlugIcon, ObsidianHub(), OpsView(), DEFAULT_PROBE_HOST, fetchObsidianNoteApi(), fetchObsidianVaultApi(), flushDnsApi() (+11 more)

### Community 20 - "Community 20"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 21 - "Community 21"
Cohesion: 0.23
Nodes (11): DetectedApiKey, EnvVarEntry, EnvVarsCollector, EnvVarsPayload, PathEntry, HashMap, Option, String (+3 more)

### Community 22 - "Community 22"
Cohesion: 0.16
Nodes (17): CString, open_directory_at(), read_local_asset(), Drop, IntoResponse, OsStr, OwnedFd, Path (+9 more)

### Community 23 - "Community 23"
Cohesion: 0.12
Nodes (33): App(), DevToolsView(), DisksHardware(), HostsManager(), KpiRibbon(), LatencyMatrix(), MachineInfo(), PacketSniffer() (+25 more)

### Community 24 - "Community 24"
Cohesion: 0.40
Nodes (5): cycleTheme(), getSystemPreferredTheme(), resolvedTheme(), setTheme(), toggleTheme()

### Community 25 - "Community 25"
Cohesion: 0.10
Nodes (23): CompactIcon, MoonIcon, SunIcon, SystemThemeIcon, NavItem, ToastShelf(), ApiEndpoint, CONTENT_TYPES (+15 more)

### Community 26 - "Community 26"
Cohesion: 0.40
Nodes (4): buildWebSocketUrl(), handleWsEvent(), initWebSocket(), scheduleReconnect()

### Community 27 - "Community 27"
Cohesion: 0.18
Nodes (9): LlmApiLatency, LocalAgentInfo, OllamaStatusResponse, AiRadarManager, Client, Option, Result, String (+1 more)

### Community 28 - "Community 28"
Cohesion: 0.22
Nodes (8): AppVersionInfo, MachineHardwareInfo, MachineInfoSummary, MachineInfoCollector, Option, String, Vec, test_collect_machine_info()

### Community 29 - "Community 29"
Cohesion: 0.18
Nodes (11): enMap, zhMap, Header(), en, Dict, zh, dictionaries, [locale, setLocaleState] (+3 more)

### Community 31 - "Community 31"
Cohesion: 0.24
Nodes (9): kill_process(), kill_process_by_port(), ProcessCollector, ProcessInfo, Result, Self, String, System (+1 more)

### Community 32 - "Community 32"
Cohesion: 0.26
Nodes (10): auditFile(), Finding, getLiteralText(), hasLanguageText(), isControlFlowLiteral(), isLanguageNeutral(), LANGUAGE_NEUTRAL_TEXT, normalizeText() (+2 more)

### Community 33 - "Community 33"
Cohesion: 0.23
Nodes (9): Process, ConnectionsCollector, ProcessMeta, resolve_process_meta(), Option, Self, SocketsPayload, String (+1 more)

### Community 34 - "Community 34"
Cohesion: 0.24
Nodes (12): Response, Router, build_router(), destructive_api_allows_local_vite_origin(), destructive_api_allows_same_origin_lan_post(), destructive_api_rejects_cross_origin_post_before_handler(), destructive_api_rejects_cross_origin_preflight(), destructive_api_rejects_other_loopback_port() (+4 more)

### Community 35 - "Community 35"
Cohesion: 0.20
Nodes (11): Body, Next, Request, enforce_local_browser_origin(), is_allowed_browser_request(), is_vite_dev_origin(), parse_browser_origin(), parse_ping_output() (+3 more)

### Community 36 - "Community 36"
Cohesion: 0.08
Nodes (42): ActivityIcon, AppBoxIcon, BoltIcon, CheckIcon, ChromeIcon, CircleDotIcon, CircleIcon, CleanerIcon (+34 more)

### Community 37 - "Community 37"
Cohesion: 0.36
Nodes (5): GitProjectInfo, WebArtifactInfo, commitTimestamp(), rankWorkbenchProjects(), summarizeWorkbenchServices()

### Community 38 - "Community 38"
Cohesion: 0.31
Nodes (6): clean_version_string(), DevToolsCollector, DevToolInfo, Self, String, Vec

### Community 39 - "Community 39"
Cohesion: 0.33
Nodes (6): LatencyCollector, LatencyProbeConfig, LatencyTarget, Self, String, Vec

### Community 40 - "Community 40"
Cohesion: 0.32
Nodes (5): Disks, DiskCollector, DiskInfo, Self, Vec

### Community 41 - "Community 41"
Cohesion: 0.29
Nodes (8): Query, get_obsidian_note(), get_snapshots(), NoteQuery, post_obsidian_search(), String, SearchQueryPayload, SnapshotQuery

### Community 42 - "Community 42"
Cohesion: 0.43
Nodes (6): main(), read(), require(), extract_section(), main(), Return the matching Markdown section from both language halves.

### Community 43 - "Community 43"
Cohesion: 0.43
Nodes (5): BatteryCollector, parse_pmset_output(), BatteryInfo, Option, Self

### Community 44 - "Community 44"
Cohesion: 0.39
Nodes (5): SpeedIcon, SpeedTester(), Button(), runSpeedTestApi(), getSpeedStatusClass()

### Community 46 - "Community 46"
Cohesion: 0.50
Nodes (3): HostEntry, HostsManager, Vec

### Community 48 - "Community 48"
Cohesion: 0.67
Nodes (3): main(), Path, run()

### Community 49 - "Community 49"
Cohesion: 0.67
Nodes (3): package_arch(), build_all_mac.sh script, SKIP_FRONTEND_BUILD

## Knowledge Gaps
- **188 isolated node(s):** `KnownApiKeyDef`, `BadgeData`, `NavGroup`, `LatestRequestGuard`, `NavSection` (+183 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppState` connect `Community 15` to `Community 34`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `AiRadarManager` connect `Community 27` to `Community 3`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `KnownApiKeyDef`, `BadgeData`, `NavGroup` to the rest of the system?**
  _188 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08509911141490088 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08558558558558559 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.03502824858757062 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.10025062656641603 - nodes in this community are weakly interconnected._