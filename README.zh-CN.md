# workstation-monitor

[English](./README.md) · 仅支持 macOS 的本机监控控制台

> 一个自托管的单文件二进制仪表盘，用于监控与操作你的 macOS 工作站——实时网络、进程、磁盘、电源，以及一系列一键式运维工具。

[![Rust](https://img.shields.io/badge/rust-2021-orange)](https://www.rust-lang.org/)
[![Axum](https://img.shields.io/badge/web-Axum%200.7-9cf)](https://github.com/tokio-rs/axum)
[![SolidJS](https://img.shields.io/badge/frontend-SolidJS%20%2B%20Tailwind-violet)](https://www.solidjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 功能特性

- **网络观测** —— 各网卡实时吞吐（en0/utun/lo0）、监听端口与活跃连接、服务延迟矩阵，以及实时报文嗅探（TCP/UDP/DNS/TLS/ICMP/ARP）。
- **进程调度** —— 按 CPU/内存排序的 Top 进程、详细指标，以及带二次确认的一键终止。
- **磁盘与电源** —— APFS 卷使用率与电池/供电状态监控。
- **运维工具箱** —— 运行时版本探测（Node/Rust/Go/Python/Git/Docker/Homebrew）、刷新 DNS 缓存、释放端口、Ping 诊断。
- **扩展功能** —— Git 项目雷达、hosts 文件管理、系统清理、Obsidian 仓库浏览、网速测试。
- **活动与审计** —— 持久化展示服务事件、操作请求、确认和执行结果，并按关联 ID 组成完整时间线。
- **全局命令面板** —— 在任意页面按 `⌘K` 搜索强类型工作站操作，查看风险等级，并对受保护操作进行一次性确认。
- **单一二进制** —— 前端通过 `rust-embed` 打包进 Rust 二进制，无需单独静态服务器。

---

## 环境要求

| 组件 | 版本 |
| --- | --- |
| macOS | 11+（Apple Silicon 或 Intel） |
| Rust | 1.75+（edition 2021） |
| Bun | 1.3+（前端安装依赖、开发、构建和测试） |
| Xcode 命令行工具 | 必选（`pcap` 编译依赖） |

> **报文嗅探** 使用原生 `libpcap`（`/dev/bpf`）。通过 `sudo` 启动时只在打开抓包设备期间保留权限，随后会在 HTTP 服务启动前立即降权回调用用户；不使用 `sudo` 时嗅探器会自动降级。

---

## 快速开始（推荐使用 NPX 秒开）

无需配置环境，一行命令直接运行：

```bash
# 自动下载/启动并自动在浏览器打开 http://localhost:9527
npx vibedesk
```

也可以通过 npm 全局安装或一键脚本安装：

```bash
# 通过 npm 全局安装
npm install -g vibedesk
vibedesk

# 或通过一键 Shell 脚本安装
curl -fsSL https://raw.githubusercontent.com/army-u8/workstation-monitor/main/scripts/install.sh | bash
```

### CLI 常用指令

```bash
vibedesk                     # 默认端口 9527 启动并自动打开浏览器
vibedesk -p 9999 --no-open   # 指定自定义端口，后台运行不弹窗
vibedesk status              # 查看当前后台常驻服务的运行状态、PID 与内存指标
vibedesk stop                # 优雅停止后台服务实例
vibedesk open                # 在浏览器中打开正在运行的控制台
vibedesk --help              # 查看完整 CLI 命令行帮助菜单
```

---

## 桌面端应用下载 (.app)

适合喜欢传统双击打开 App 的 macOS 用户：

1. 前往 **[Releases](https://github.com/army-u8/workstation-monitor/releases)** 下载适合当前 Mac 的压缩包：Apple Silicon 选择 `Workstation_Monitor_VERSION_aarch64.app.zip`，Intel 选择 `Workstation_Monitor_VERSION_x64.app.zip`。
2. 解压后把 **Workstation Monitor** 拖入"应用程序"文件夹。
3. 双击打开，浏览器会自动跳转到 **http://localhost:9527**。

> macOS 可能提示*"无法打开"Workstation Monitor"，因为无法验证开发者"*。未签名应用的正常现象，见下方[绕过 Gatekeeper](#绕过-gatekeeper)。

---

## 安装（从源码编译）

> 前端现在由 `build.rs` 在**编译时自动构建**，并通过 Bun 运行 Vite，因此只需一条 `cargo build` 即可，不再需要单独的前端构建步骤。

```bash
git clone git@github.com:army-u8/workstation-monitor.git
cd workstation-monitor

# 自动构建前端（经 build.rs）并内嵌进二进制
cargo build --release
```

若想跳过自动前端构建（例如你已经手动构建过），设置 `SKIP_FRONTEND_BUILD=1`。

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

### 前端开发模式（Vite，端口 9529）

```bash
cd frontend
bun install --frozen-lockfile
bun run dev
```

打开 **http://localhost:9529** —— Vite 会自动将 `/api` 和 `/ws` 代理到 9527 端口的后端。

后端使用自定义端口时可设置 `VITE_BACKEND_PORT`，例如
`VITE_BACKEND_PORT=9999 bun run dev`。

---

## 配置

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `9527` | HTTP/WebSocket 监听端口，也可通过第一个命令行参数覆盖（`cargo run -- 9999`）。 |
| `RUST_LOG` | `workstation_monitor=info,tower_http=warn` | 日志过滤级别（如 `RUST_LOG=debug`）。 |
| `WORKSTATION_DATA_DIR` | `~/Library/Application Support/VibeDesk` | 持久化控制数据库 `vibedesk.db` 所在目录。 |
| `WORKSTATION_EVENT_RETENTION_DAYS` | `30` | 活动事件保留天数，自动限制在 `1..=365`；启动时及每 24 小时清理过期事件。 |

### 工作站控制安全

活动页面与 `⌘K` 命令面板使用同一个本机控制平面。安全操作在强类型参数校验后立即执行；受保护操作会返回短时有效、仅可使用一次的确认凭据，并绑定请求、操作和参数。需要管理员权限的操作不会自动提权。活动时间线不会展示确认凭据或原始敏感信息。

事件和操作结果保存在 `vibedesk.db`。若配置的数据库无法打开或写入，实时监控仍会继续，系统改用有上限的内存时间线，并在活动页面显示存储降级提示；仅保存在内存中的事件不会跨重启保留。

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
| GET | `/api/control/events` | 支持过滤和游标分页的持久化活动时间线 |
| GET | `/api/control/actions` | 强类型工作站操作目录 |
| GET | `/api/control/actions/:request_id` | 幂等操作请求的执行结果 |

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
| `/api/control/actions/execute` | 强类型 `ActionRequest` | 执行或确认幂等控制操作 |

---

## 项目结构

```
workstation-monitor/
├── src/                  # Rust 后端（Axum 服务 + 采集器）
│   ├── main.rs           # 入口，后台采集任务，服务启动
│   ├── control/          # 事件、SQLite 审计仓库、策略与操作注册表
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

## 打包与发布

应用以**未签名**的 `.app` 形式分发，使用 [`cargo-bundle`](https://github.com/burtonqin/cargo-bundle) 打包：

```bash
# 一次性安装打包工具
cargo install cargo-bundle

# 构建发布版并打包 .app（前端由 build.rs 自动构建）
cargo bundle --release
```

产物位于 `target/release/bundle/osx/Workstation Monitor.app`。将其压缩后上传到 GitHub Release，用户即可按[快速开始](#快速开始无需编译)使用。

应用图标 `assets/icon.icns` 由 `assets/AppIcon-1024.png` 经 `scripts/gen_icon.py` + `iconutil` 生成。

---

## 绕过 Gatekeeper

分发的 `.app` **未做代码签名与公证**（无 Apple 开发者证书）。首次打开会被 macOS 拦截。打开方式：

**方式 A —— 右键打开**
1. 在"应用程序"里右键点击 **Workstation Monitor**。
2. 选择 **打开**。
3. 在确认弹窗中再次点击 **打开**。（仅需一次）

**方式 B —— 系统设置**
1. 尝试打开被拦截后，进入 **系统设置 → 隐私与安全性**。
2. 找到*"Workstation Monitor 已被拦截"*提示，点击 **仍要打开**。

**方式 C —— 终端**（若直接下载了 zip）
```bash
xattr -cr /Applications/Workstation\ Monitor.app
```
随后双击打开。

> 通过 `sudo` 启动可开启深度报文嗅探（`/dev/bpf`），随后会在暴露控制台前放弃 root 权限。缺少非 root `SUDO_UID`/`SUDO_GID` 的直接 root 启动会被拒绝；不使用 sudo 时应用同样完整可用，仅缺少原始报文抓包。

---

## 🚀 产品需求与未来路线图

关于向 **Vibe Coding（氛围编程）与 AI 创造者工作台 (VibeDesk)** 的详细产品需求规范与演进路线图，详见：
- 📖 **[VibeDesk 产品需求文档 PRD v1.0 (docs/VIBEDESK_PRD.md)](docs/VIBEDESK_PRD.md)**
- 🗺️ **[Vibe Studio 演化路线图 (docs/VIBE_STUDIO_ROADMAP.md)](docs/VIBE_STUDIO_ROADMAP.md)**

---

## 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。版权所有 (c) 2026 army-u8。
