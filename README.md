# 🚀 workstation-monitor

[中文文档](./README.zh-CN.md)

A high-performance local workstation monitoring console built with a **React + Vite + TypeScript** frontend and a **Rust (Axum + Tokio)** backend, providing developers with full-stack capabilities for system resource scheduling, network observability, storage/hardware monitoring, and DevOps operations.

---

## ⚡ Tech Stack

- **Frontend**:
  - **Framework**: [React](https://react.dev/) + TypeScript
  - **Build tool**: [Vite](https://vitejs.dev/)
  - **UI**: Custom component library (`src/components`) with built-in i18n (`src/i18n`, English & Chinese)
- **Backend**:
  - **Language/Runtime**: Rust (Edition 2021) + Tokio async runtime
  - **Web framework**: Axum + WebSocket full-duplex broadcast channel (`tokio::sync::broadcast`)
  - **System probes**: `sysinfo` (network traffic, CPU/memory, processes, disks) + `netstat2` (ports/connections)
  - **Packet sniffing**: Native macOS `libpcap` (`/dev/bpf`) deep packet parsing, with graceful degradation when running without root
  - **Embedded assets**: `rust-embed` bundles `frontend/dist` into a single binary

---

## 🌟 Core Modules

### 🌐 1. Network Observatory
- Real-time throughput & waveform: per-interface (`en0`, `utun`, `lo0`) upload/download rates and cumulative traffic.
- Listening ports & active connections: local open ports, associated processes, PIDs, and active TCP connections.
- Service health matrix: TCP latency trends for public DNS, local gateway, and core services.
- Packet sniffing stream: live parsing of local packets (TCP/UDP/DNS/TLS/ICMP/ARP) with pause and filter support.

### ⚙️ 2. Process Cockpit
- Real-time top processes: ranked by CPU or memory usage.
- Detailed metrics: PID, name, CPU share, memory usage, disk I/O, and status.
- Safe one-click kill: search by name/PID with a confirmation dialog.

### 💾 3. Disks & Power State
- APFS volume monitoring: scans local partitions and external drives, showing capacity and free space.
- Battery & power management: real-time charge level, power source, and time-to-empty estimates.

### 🛠️ 4. DevOps Toolkit
- Environment probes: detects versions of Node.js, Rust, Go, Python, Git, Docker, Homebrew, etc.
- One-click DNS flush: runs `dscacheutil -flushcache` and reloads `mDNSResponder`.
- One-click port release: finds and kills the process holding a given port.
- Instant ping diagnostics: probe any IP/domain and report round-trip latency.

---

## 🛠️ Getting Started

### 1. Production build (default port 9527)
```bash
# Start the backend (serves the built frontend automatically)
cd workstation-monitor
cargo run

# Custom port
cargo run -- 9999
# or PORT=9000 cargo run

# Unlock libpcap deep packet capture (macOS /dev/bpf requires admin privileges)
sudo ./target/debug/workstation-monitor
```
👉 Open: **[http://localhost:9527](http://localhost:9527)**

### 2. Frontend dev mode (Vite Dev Server, port 9528)
```bash
cd workstation-monitor/frontend
npm install
npm run dev
```
👉 Open: **[http://localhost:9528](http://localhost:9528)** (proxies `/api` and `/ws` to backend on 9527)

---

## 📄 License

Private repository for personal use.
