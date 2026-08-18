# AGENTS.md — VibeDesk (Workstation Monitor) Developer & Agent Guidelines

> **Target Audience**: AI Coding Agents (Claude Code, Cursor, Windsurf, Antigravity, Aider, Codex) & Human Engineers.
> **Project**: VibeDesk / Workstation Monitor — macOS Workstation Mission Control & AI Coding Cockpit.

---

## 1. Project Overview & Architecture

VibeDesk is a self-hosted, high-performance macOS workstation mission control dashboard and AI Vibe Coding Hub packaged as a **single standalone binary** with zero external runtime dependencies.

### Core Tech Stack

| Layer | Technologies | Key Roles |
| :--- | :--- | :--- |
| **Backend** | **Rust 2021** (Axum 0.7, Tokio, Sysinfo, Libpcap) | Real-time hardware telemetry, BPF packet sniffer, socket inspector, AI agent detector, Git radar, time machine snapshots. |
| **Frontend** | **SolidJS**, TypeScript, **Tailwind CSS v4** | Fine-grained reactive UI, 60fps real-time data streaming, dark/light theme engine. |
| **Component Kit** | **Kobalte UI**, **@tabler/icons-solidjs** | Accessible WAI-ARIA primitives (Tabs, Tooltips, Dialogs) and cohesive pixel-perfect icons. |
| **Packaging** | **rust-embed** / `build.rs` | Auto-compiles frontend `dist/` and embeds assets directly into the Rust binary. |

---

## 2. Core Behavioral Rules for AI Agents

When modifying or adding code in this repository, all AI agents **MUST** strictly follow these rules:

### 🛡️ Rule 1: Zero-Regression & Defensive Evolution
- **Preserve Existing Code & Comments**: Never truncate, delete, or comment out working functions unless explicitly instructed by the user.
- **No Mock or Placeholder Code**: Always implement production-grade, complete logic. Placeholders like `// TODO: implement later` or `...rest of code` are strictly banned.
- **Non-Destructive Refactoring**: Isolate state mutations and ensure backward compatibility for all API payloads and WebSocket messages.

### 🌐 Rule 2: 100% Bilingual i18n Synchronization
- **Zero Hardcoded Text in `.tsx`**: Never write raw Chinese or English user-facing strings directly in frontend templates. Always use `t().<section>.<key>`.
- **Synchronized Dictionaries**: Every newly added key must be present in both:
  - `frontend/src/i18n/dict/zh.ts` (Simplified Chinese)
  - `frontend/src/i18n/dict/en.ts` (English)
- **Automated Check**: Always verify with `npm --prefix frontend run i18n:check` before submitting changes.

### 🎨 Rule 3: Icon Consistency Standard
- **Exclusively use Tabler Icons**: Import icons from `frontend/src/components/Icons.tsx` (backed by `@tabler/icons-solidjs`).
- **No Emojis as UI Icons**: Banned from using emoji characters (e.g. 📊, 🚀, 📁) in primary UI components or action buttons.

### ⚡ Rule 4: Port & Privilege Safety
- Default backend port is `9527`. Development Vite port is `9529`.
- macOS packet sniffing (`/dev/bpf`) requires `sudo` privileges. If run without root, the sniffer must degrade gracefully without crashing the server.

---

## 3. Directory & File Structure Topology

```text
workstation-monitor/
├── Cargo.toml                       # Rust workspace & dependencies
├── build.rs                         # Compiles frontend automatically on `cargo build`
├── AGENTS.md                        # Agent behavioral guidelines & architecture docs
├── README.md / README.zh-CN.md     # Public project documentation
├── docs/
│   ├── VIBEDESK_PRD.md             # VibeDesk Product Requirements Document (PRD v1.0)
│   └── VIBE_STUDIO_ROADMAP.md      # Vibe Studio 5-Phase Evolution Roadmap
├── src/                             # Rust Backend
│   ├── main.rs                      # Binary entrypoint, CLI args, server initialization
│   ├── types.rs                     # Shared Rust structs & Serde JSON definitions
│   ├── collectors/                  # Hardware, system & AI telemetry collectors
│   │   ├── ai_radar.rs              # LLM latency probe, Ollama manager, Local Agent probe
│   │   ├── connections.rs           # Sockets & listening ports inspector (App & PID mapping)
│   │   ├── dev_tools.rs             # Runtime versions probe (Node, Rust, Go, Python, Git)
│   │   ├── env_vars.rs              # Environment variables & API key secret scanner
│   │   ├── git_radar.rs             # Git repositories radar & dirty workspace tracker
│   │   ├── machine_info.rs          # Apple Silicon specs, macOS build & core app detector
│   │   ├── obsidian.rs              # Obsidian vault discovery, full-text search & capture
│   │   ├── save_point.rs            # Safety snapshot & Git Time Machine rollback
│   │   ├── sniffer.rs               # Libpcap BPF deep network packet sniffer
│   │   ├── traffic.rs               # Per-interface network throughput monitor
│   │   └── updater.rs               # Auto-updater with GitHub Release & safety rollback
│   └── server/                      # HTTP & WebSocket Engine
│       ├── router.rs                # Axum REST routes & HTTP handlers
│       ├── ws.rs                    # WebSocket broadcaster & client session hub
│       └── embedded.rs              # Dynamic local disk + rust-embed static file server
└── frontend/                        # SolidJS Frontend
    ├── package.json                 # Scripts: dev, build, build:watch, lint, i18n:check
    ├── vite.config.ts               # Vite configuration + auto backend proxy
    └── src/
        ├── App.tsx                  # Root layout, router & navigation frame
        ├── components/              # Feature views
        │   ├── Overview.tsx         # Mission control top-level telemetry cockpit
        │   ├── AiRadarView.tsx      # AI Hub (Latency, Agents, Ollama, Key Vault, Rules)
        │   ├── SocketInspector.tsx  # Socket ports & application process inspector
        │   ├── TrafficSniffer.tsx   # Live packet capture & bandwidth waveform
        │   ├── GitRadarView.tsx     # Workspace repos, branch status & Git account
        │   ├── ObsidianView.tsx     # Obsidian notes graph & quick capture
        │   ├── SavePointManager.tsx # Time machine rollback & snapshot manager
        │   ├── EnvVarsView.tsx      # $PATH & Environment variable analyzer
        │   └── Icons.tsx            # Unified Tabler icons export barrel
        ├── constants/index.ts       # Route paths, API endpoints & WebSocket event names
        ├── i18n/                    # Bilingual translation engine
        │   ├── index.tsx            # Reactive i18n context & hooks
        │   └── dict/                # zh.ts & en.ts dictionaries
        ├── services/store.ts        # Global reactive signals & API client SDK
        └── types/index.ts           # Frontend TypeScript interfaces
```

---

## 4. Development & Hot Reload Workflow

### Mode A: Full Frontend HMR (Recommended for UI Development)
```bash
# 1. Start Rust backend
cargo run -- 9527

# 2. In another terminal, start Vite dev server with instant HMR
npm --prefix frontend run dev
```
> Open `http://localhost:9529`. Vite automatically proxies `/api` and `/ws` to port `9527`. All `.tsx` and `.css` modifications take effect in milliseconds without reloading.

### Mode B: Dynamic Disk Static File Hot Loading (Single Server Mode)
The server in `src/server/embedded.rs` prioritizes local `frontend/dist/` from disk before falling back to in-memory binary assets.
```bash
# Run Vite build in watch mode
npm --prefix frontend run build:watch
```
> Modifying frontend code automatically rebuilds `dist/`. Simply press `F5` in your browser (`http://localhost:9527`) to see updates immediately **without restarting the Rust backend**.

### Mode C: Backend Auto-Restart (`cargo-watch`)
```bash
# Automatically recompiles and restarts backend when any .rs file changes
cargo watch -x 'run -- 9527'
```

---

## 5. Quality Assurance & Pre-Commit Gates

Every commit is guarded by automated Git hooks (`lint-staged` + `cargo check` + `cargo test`). Run these manually before submitting:

```bash
# 1. Frontend ESLint & i18n Synchronization Check
npm --prefix frontend run lint

# 2. Frontend Production Build Check
npm --prefix frontend run build

# 3. Rust Unit Tests
cargo test --offline

# 4. Rust Production Release Build
cargo build --release
```

---

## 6. API Route Reference for Agents

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/status` | `GET` | Basic daemon health and uptime status |
| `/ws` | `GET` (WS) | High-speed telemetry broadcast (Traffic, Sockets, Latency, Stats) |
| `/api/system/machine-info` | `GET` | Apple Silicon hardware info, OS build, SIP status & core apps |
| `/api/system/env-vars` | `GET` | Environment variables, $PATH entries & masked AI API keys |
| `/api/ai/agents` | `GET` | Local AI Coding Agents probe (Claude Code, Cursor, Windsurf, Aider, etc.) |
| `/api/tools/llm-latency` | `GET` | Global LLM connectivity matrix & latency probing |
| `/api/tools/ollama/status` | `GET` | Ollama model VRAM usage & loaded model details |
| `/api/tools/ollama/unload` | `POST` | Release Ollama model unified memory (`keep_alive: 0`) |
| `/api/git/projects` | `GET` | Local Git repository scanner & dirty workspace status |
| `/api/projects/snapshots` | `GET` | Time Machine snapshots list |
| `/api/projects/snapshots/rollback` | `POST` | Safe rollback to historical Git snapshot with backup |
| `/api/obsidian/vault` | `GET` | Obsidian vault structure & notes summary |
| `/api/obsidian/search` | `POST` | Full-text search across Obsidian markdown notes |
| `/api/cleaner/scan` | `GET` | macOS developer cache cleaner scanner (Xcode, Node, Cargo, Homebrew) |
| `/api/cleaner/clean` | `POST` | Safe cleaning of selected developer caches |
| `/api/process/kill` | `POST` | Terminate process by PID |
| `/api/port/kill` | `POST` | Release listening port |
