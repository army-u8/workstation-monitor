# workstation-monitor

[中文文档](./README.zh-CN.md) · macOS-only local workstation dashboard

> A self-hosted, single-binary dashboard for monitoring and operating your macOS workstation — real-time network, processes, disks, power, and a toolbox of one-click DevOps actions.

[![Rust](https://img.shields.io/badge/rust-2021-orange)](https://www.rust-lang.org/)
[![Axum](https://img.shields.io/badge/web-Axum%200.7-9cf)](https://github.com/tokio-rs/axum)
[![SolidJS](https://img.shields.io/badge/frontend-SolidJS%20%2B%20Tailwind-violet)](https://www.solidjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Features

- **Network Observatory** — per-interface throughput (en0/utun/lo0), listening ports & active connections, service latency matrix, and live packet sniffing (TCP/UDP/DNS/TLS/ICMP/ARP).
- **Process Cockpit** — top processes by CPU/memory, detailed metrics, and safe one-click kill with confirmation.
- **Disks & Power** — APFS volume usage and battery/power-state monitoring.
- **DevOps Toolkit** — runtime version probes (Node/Rust/Go/Python/Git/Docker/Homebrew), flush DNS cache, release a port, and ping diagnostics.
- **Extras** — Git project radar, hosts file manager, system cleaner, Obsidian vault browser, and speed test.
- **Single binary** — the SolidJS frontend is embedded into the Rust binary via `rust-embed`; no separate static server needed.

---

## Requirements

| Component | Version |
| --- | --- |
| macOS | 11+ (Apple Silicon or Intel) |
| Rust | 1.75+ (edition 2021) |
| Node.js | 20.19+ or 22.12+ (for frontend dev/build) |
| Xcode Command Line Tools | required (`pcap` build) |

> **Packet sniffing** uses native `libpcap` (`/dev/bpf`). A `sudo` launch opens the capture device and then immediately drops back to the invoking user before starting the HTTP server. Without `sudo`, the sniffer degrades gracefully.

---

## Quick Start (no build needed)

For most users — **no command line, no toolchain required**:

1. Go to **[Releases](https://github.com/army-u8/workstation-monitor/releases)** and download the archive for your Mac: `Workstation_Monitor_VERSION_aarch64.app.zip` for Apple Silicon or `Workstation_Monitor_VERSION_x64.app.zip` for Intel. The Universal archive supports both architectures.
2. Unzip and drag **Workstation Monitor** into your `Applications` folder.
3. Double-click it. Your browser opens automatically to **http://localhost:9527**.

> macOS may show *"Workstation Monitor cannot be opened because the developer cannot be verified."* This is normal for an unsigned app. See [Bypassing Gatekeeper](#bypassing-gatekeeper) below.

---

## Installation (build from source)

> The frontend is now built **automatically at compile time** by `build.rs`, so a single `cargo build` is enough — no separate `npm run build` step is required anymore.

```bash
git clone git@github.com:army-u8/workstation-monitor.git
cd workstation-monitor

# Builds the frontend (via build.rs) and embeds it into the binary
cargo build --release
```

To skip the automatic frontend build (e.g. you already ran it), set `SKIP_FRONTEND_BUILD=1`.

---

## Usage

### Run the server (default port 9527)

```bash
cargo run --release
# or a custom port
cargo run --release -- 9999
# or via env
PORT=9000 cargo run --release
```

Open **http://localhost:9527**.

### Frontend dev mode (Vite, port 9529)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:9529** — Vite proxies `/api` and `/ws` to the backend on `9527`.

Set `VITE_BACKEND_PORT` when the backend uses a custom port, for example
`VITE_BACKEND_PORT=9999 npm run dev`.

---

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `9527` | HTTP/WebSocket listen port. Also overridable by the first CLI arg (`cargo run -- 9999`). |
| `RUST_LOG` | `workstation_monitor=info,tower_http=warn` | Tracing filter (e.g. `RUST_LOG=debug`). |

---

## API

All endpoints return JSON. A WebSocket feed is available at `/ws`.

### Query

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/status` | CPU, memory, uptime, sniffer state |
| GET | `/api/traffic` | Network interface traffic |
| GET | `/api/sockets` | Listening ports & active connections |
| GET | `/api/latency` | Service latency probes |
| GET | `/api/processes` | Process list |
| GET | `/api/disks` | Disk volumes |
| GET | `/api/battery` | Battery / power state |
| GET | `/api/dev-tools` | Detected runtimes |
| GET | `/api/system/machine-info` | Hardware & OS summary |
| GET | `/api/cleaner/scan` | Scannable cache items |
| GET | `/api/git/projects` | Local Git projects |
| GET | `/api/git/account` | Git/GitHub identity |
| GET | `/api/hosts/get` | Hosts file entries |
| GET | `/api/obsidian/vault` | Obsidian vault summary |
| GET | `/api/obsidian/note?path=` | Note content |

### Actions (POST)

| Endpoint | Body | Description |
| --- | --- | --- |
| `/api/cleaner/clean` | `{ "id": "..." }` | Clean a cache item |
| `/api/tools/speedtest` | — | Run speed test |
| `/api/tools/open-app` | `{ "path": "...", "app": "code" \| "cursor" \| "terminal" \| ... }` | Open a path in an app |
| `/api/obsidian/search` | `{ "query": "..." }` | Search vault |
| `/api/obsidian/quick-capture` | `{ "content": "..." }` | Append a quick note |
| `/api/obsidian/open` | `{ "file_path": "...", "target_app": "..." }` | Open a note |
| `/api/process/kill` | `{ "pid": 1234 }` | Kill a process |
| `/api/port/kill` | `{ "port": 3000 }` | Kill process on a port |
| `/api/tools/flush-dns` | — | Flush macOS DNS cache |
| `/api/tools/ping` | `{ "host": "...", "count": 4 }` | Ping / TCP RTT probe |

---

## Project Structure

```
workstation-monitor/
├── src/                  # Rust backend (Axum server + collectors)
│   ├── main.rs           # Entry point, background collectors, server bootstrap
│   ├── server/           # Router, WebSocket, embedded frontend assets
│   ├── collectors/       # traffic, sockets, latency, processes, disks, battery, dev-tools, sniffer, git, hosts, obsidian, cleaner
│   └── types.rs          # Shared data models
├── frontend/            # SolidJS + Tailwind v4 + Vite frontend
│   └── src/components/   # UI components & views
├── web/                  # Legacy/standalone static assets
└── Cargo.toml
```

---

## Roadmap

- [ ] Linux/Windows support
- [ ] Config file (`config.toml`)
- [ ] Auth / token for remote access
- [ ] Historical metrics & charts export

---

## Packaging & Release

The app is distributed as a signed-less `.app` bundle built with [`cargo-bundle`](https://github.com/burtonqin/cargo-bundle):

```bash
# One-time install of the bundler
cargo install cargo-bundle

# Build release binary (frontend auto-built by build.rs) and package the .app
cargo bundle --release
```

The result lands at `target/release/bundle/osx/Workstation Monitor.app`. Zip it and upload to a GitHub Release so users can follow [Quick Start](#quick-start-no-build-needed).

The app icon (`assets/icon.icns`) is generated from `assets/AppIcon-1024.png` via `scripts/gen_icon.py` + `iconutil`.

---

## Bypassing Gatekeeper

The distributed `.app` is **not code-signed or notarized** (no Apple Developer certificate). On first launch macOS blocks it. To open it:

**Option A — right-click**
1. Right-click **Workstation Monitor** in Applications.
2. Choose **Open**.
3. Click **Open** again in the confirmation dialog. (Needed only once.)

**Option B — System Settings**
1. Try to open it; when blocked, go to **System Settings → Privacy & Security**.
2. Find the *"Workstation Monitor was blocked"* message and click **Open Anyway**.

**Option C — Terminal** (if you downloaded the zip directly)
```bash
xattr -cr /Applications/Workstation\ Monitor.app
```
Then double-click to open.

> A `sudo` launch enables the deep packet sniffer (`/dev/bpf`), then drops root privileges before exposing the dashboard. Direct root launches without a non-root `SUDO_UID`/`SUDO_GID` are refused. Without `sudo`, the app still works fully, just without raw packet capture.

---

## 🚀 Future Roadmap & Product Spec

For the transformation into a dedicated **Vibe Coding & AI Creator Workbench (VibeDesk)**, please check:
- 📖 **[VibeDesk PRD v1.0 (docs/VIBEDESK_PRD.md)](docs/VIBEDESK_PRD.md)**
- 🗺️ **[Vibe Studio Roadmap (docs/VIBE_STUDIO_ROADMAP.md)](docs/VIBE_STUDIO_ROADMAP.md)**

---

## License

Licensed under the [MIT License](LICENSE). Copyright (c) 2026 army-u8.
