# workstation-monitor

[中文文档](./README.zh-CN.md) · macOS-only local workstation dashboard

> A self-hosted, single-binary dashboard for monitoring and operating your macOS workstation — real-time network, processes, disks, power, and a toolbox of one-click DevOps actions.

[![Rust](https://img.shields.io/badge/rust-2021-orange)](https://www.rust-lang.org/)
[![Axum](https://img.shields.io/badge/web-Axum%200.7-9cf)](https://github.com/tokio-rs/axum)
[![SolidJS](https://img.shields.io/badge/frontend-SolidJS%20%2B%20Tailwind-violet)](https://www.solidjs.com/)
[![License](https://img.shields.io/badge/license-private-red)]()

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
| Node.js | 18+ (for frontend dev/build) |
| Xcode Command Line Tools | required (`pcap` build) |

> **Packet sniffing** uses native `libpcap` (`/dev/bpf`). Run with `sudo` to enable deep capture; without it the sniffer degrades gracefully.

---

## Installation

```bash
git clone git@github.com:army-u8/workstation-monitor.git
cd workstation-monitor

# 1. Build the frontend first (outputs to frontend/dist)
cd frontend
npm install
npm run build

# 2. Build the backend, which embeds frontend/dist at compile time
cd ..
cargo build --release
```

> The frontend is embedded into the binary via `rust-embed` **at compile time** (from `frontend/dist/`). Since `dist/` is gitignored, you must run `npm run build` before `cargo build` — a fresh clone has no `dist/` and the server will 404 until the frontend is built.

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

### Frontend dev mode (Vite, port 9528)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:9528** — Vite proxies `/api` and `/ws` to the backend on `9527`.

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

## License

Private repository for personal use. All rights reserved.
