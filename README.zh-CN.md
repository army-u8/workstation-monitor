# workstation-monitor

[English](./README.md) · 仅支持 macOS 的本机监控控制台

> 一个自托管的单文件二进制仪表盘，用于监控与操作你的 macOS 工作站——实时网络、进程、磁盘、电源，以及一系列一键式运维工具。

[![Rust](https://img.shields.io/badge/rust-2021-orange)](https://www.rust-lang.org/)
[![Axum](https://img.shields.io/badge/web-Axum%200.7-9cf)](https://github.com/tokio-rs/axum)
[![SolidJS](https://img.shields.io/badge/frontend-SolidJS%20%2B%20Tailwind-violet)](https://www.solidjs.com/)
[![License](https://img.shields.io/badge/license-private-red)]()

---

## 功能特性

- **网络观测** —— 各网卡实时吞吐（en0/utun/lo0）、监听端口与活跃连接、服务延迟矩阵，以及实时报文嗅探（TCP/UDP/DNS/TLS/ICMP/ARP）。
- **进程调度** —— 按 CPU/内存排序的 Top 进程、详细指标，以及带二次确认的一键终止。
- **磁盘与电源** —— APFS 卷使用率与电池/供电状态监控。
- **运维工具箱** —— 运行时版本探测（Node/Rust/Go/Python/Git/Docker/Homebrew）、刷新 DNS 缓存、释放端口、Ping 诊断。
- **扩展功能** —— Git 项目雷达、hosts 文件管理、系统清理、Obsidian 仓库浏览、网速测试。
- **单一二进制** —— 前端通过 `rust-embed` 打包进 Rust 二进制，无需单独静态服务器。

---

## 环境要求

| 组件 | 版本 |
| --- | --- |
| macOS | 11+（Apple Silicon 或 Intel） |
| Rust | 1.75+（edition 2021） |
| Node.js | 18+（前端开发/构建） |
| Xcode 命令行工具 | 必选（`pcap` 编译依赖） |

> **报文嗅探** 使用原生 `libpcap`（`/dev/bpf`）。使用 `sudo` 运行以开启深度抓包；否则嗅探器会自动降级。

---

## 安装

```bash
git clone git@github.com:army-u8/workstation-monitor.git
cd workstation-monitor

# 构建发布版二进制（会自动构建并内嵌前端）
cargo build --release
```

或者先构建前端，再由 `cargo run` 托管：

```bash
cd frontend
npm install
npm run build   # 输出到 frontend/dist，运行时被内嵌
```

---

## 使用

### 启动服务（默认端口 9527）

```bash
cargo run --release
# 或自定义端口
cargo run --release -- 9999
# 或通过环境变量
PORT=9000 cargo run --release
```

打开 **http://localhost:9527**。

### 前端开发模式（Vite，端口 9528）

```bash
cd frontend
npm install
npm run dev
```

打开 **http://localhost:9528** —— Vite 会自动将 `/api` 和 `/ws` 代理到 9527 端口的后端。

---

## 配置

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `9527` | HTTP/WebSocket 监听端口，也可通过第一个命令行参数覆盖（`cargo run -- 9999`）。 |
| `RUST_LOG` | `workstation_monitor=info,tower_http=warn` | 日志过滤级别（如 `RUST_LOG=debug`）。 |

---

## API

所有接口返回 JSON，WebSocket 实时推送地址为 `/ws`。

### 查询接口

| 方法 | 接口 | 说明 |
| --- | --- | --- |
| GET | `/api/status` | CPU、内存、运行时长、嗅探器状态 |
| GET | `/api/traffic` | 网卡流量 |
| GET | `/api/sockets` | 监听端口与活跃连接 |
| GET | `/api/latency` | 服务延迟探测 |
| GET | `/api/processes` | 进程列表 |
| GET | `/api/disks` | 磁盘卷 |
| GET | `/api/battery` | 电池/电源状态 |
| GET | `/api/dev-tools` | 已检测运行时 |
| GET | `/api/system/machine-info` | 硬件与系统摘要 |
| GET | `/api/cleaner/scan` | 可清理项扫描 |
| GET | `/api/git/projects` | 本地 Git 项目 |
| GET | `/api/git/account` | Git/GitHub 身份 |
| GET | `/api/hosts/get` | hosts 文件条目 |
| GET | `/api/obsidian/vault` | Obsidian 仓库摘要 |
| GET | `/api/obsidian/note?path=` | 笔记内容 |

### 操作接口（POST）

| 接口 | 请求体 | 说明 |
| --- | --- | --- |
| `/api/cleaner/clean` | `{ "id": "..." }` | 清理指定缓存项 |
| `/api/tools/speedtest` | — | 网速测试 |
| `/api/tools/open-app` | `{ "path": "...", "app": "code" \| "cursor" \| "terminal" \| ... }` | 在指定应用中打开路径 |
| `/api/obsidian/search` | `{ "query": "..." }` | 搜索仓库 |
| `/api/obsidian/quick-capture` | `{ "content": "..." }` | 追加速记 |
| `/api/obsidian/open` | `{ "file_path": "...", "target_app": "..." }` | 打开笔记 |
| `/api/process/kill` | `{ "pid": 1234 }` | 终止进程 |
| `/api/port/kill` | `{ "port": 3000 }` | 释放占用端口的进程 |
| `/api/tools/flush-dns` | — | 刷新 macOS DNS 缓存 |
| `/api/tools/ping` | `{ "host": "...", "count": 4 }` | Ping / TCP 往返探测 |

---

## 项目结构

```
workstation-monitor/
├── src/                  # Rust 后端（Axum 服务 + 采集器）
│   ├── main.rs           # 入口，后台采集任务，服务启动
│   ├── server/           # 路由、WebSocket、内嵌前端资源
│   ├── collectors/       # 流量、连接、延迟、进程、磁盘、电池、运行时、嗅探、git、hosts、obsidian、清理
│   └── types.rs          # 共享数据模型
├── frontend/            # SolidJS + Tailwind v4 + Vite 前端
│   └── src/components/   # UI 组件与视图
├── web/                  # 遗留/独立静态资源
└── Cargo.toml
```

---

## 路线图

- [ ] Linux/Windows 支持
- [ ] 配置文件（`config.toml`）
- [ ] 远程访问鉴权 / Token
- [ ] 历史指标与图表导出

---

## 许可证

私有仓库，仅供个人使用，保留所有权利。
