# 更新日志 (Changelog)

本项目遵循 [Semantic Versioning (语义化版本 2.0.0)](https://semver.org/lang/zh-CN/) 与 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范。

---

## [0.2.4] - 2026-08-17

### 修复
- **热更新重启多开标签页修复 (In-Place Reload & No Extra Tab)**：
  - 在 Rust 核心引入 `--no-open` 命令行参数与 `WORKSTATION_NO_OPEN=1` 环境变量识别机制；
  - 升级与回退唤醒脚本自动携带静默启动标记，避免新进程启动时无条件唤起系统浏览器，实现**当前已有标签页原地无感刷新，杜绝多余标签页**。
- **国际化多语言与 AST 级别硬编码全面清零**：
  - 引入 AST 级自动化检测拦截，全面清零 DevTools、AI 测速雷达、Web 产物画廊、项目时光机中遗留的 27 处硬编码中文，保障多语言 100% 动态对齐。

### 优化
- **最新版本状态 UI 交互重塑**：
  - 重构更新弹窗（UpdateModal）状态机，在当前已是最新稳定版时呈现专属绿色徽章卡片与即时「🔄 重新检查更新」操作。

---

## [0.2.3] - 2026-08-17

### 优化
- **全站 UI 视觉与交互质感重构** (`design-taste-frontend` 顶级反模板化设计准则)：
  - **黑曜石暗黑科技与 Hairline 金属微光**：底色与卡片重构为深邃有层次的黑曜石深色层级（`#0a0d14` ➔ `#121723` ➔ `#181f2f`），卡片顶部引入 `inset 0 1px 0 0 rgba(255, 255, 255, 0.08)` 类似 Apple 硬件倒角的金属微光；
  - **Tabular Mono 等宽数字防抖**：全站硬件占用百分比、网速、时延、端口 PID 统一开启 `tabular-nums`，实时数值跳动时彻底消除视觉抖动；
  - **侧边栏与顶栏磨砂毛玻璃重塑**：流线型胶囊导航项、极简控件与心跳微缩仪表盘；
  - **专属视图精修**：AI 测速网格梯队色彩化、本地 Web 产物画廊微卡片、DevTools $PATH 链路节点连线与环境变量密钥一键脱敏。

### 修复
- **国际化多语言与硬编码文本全面修复**：
  - 修复了 DevTools 开发环境页面中顶部副标题、$PATH 寻址链路、环境变量表格表头等写死中文的问题；
  - 修复了 AI 测速雷达、本地 Web 产物画廊、项目时光机等视图中遗留的未本地化文本，确保中英文切换 100% 动态对齐。

---

## [0.2.2] - 2026-08-17

### 新增
- **下一代 Web 热更新与版本时光机系统** (借鉴 Hermes Studio 架构最佳实践)：
  - **细粒度状态机与 409 并发防重锁**：在 Rust 核心构建 `UpdateProgress` 强类型状态机，提供实时进度通道，并引入 409 Conflict 锁杜绝多次点击与并发写冲突；
  - **多源加速与国内镜像自动容灾 (Multi-Feed Mirror Accelerator)**：支持官方 GitHub Releases 直链与高速加速镜像（如 `ghfast.top` 等）并行测速择优拉取，极速下载安装包；
  - **版本时光机与一键秒级回退 (Version Rollback & Self-Healing)**：升级前自动将旧版本归档至 `~/.workstation-monitor/versions/`，支持 1 秒无痛一键回退至任意历史稳定版本；
  - **沉浸式双 Tab 更新与回退面板**：前端更新弹窗重构为「🚀 在线自动升级」与「⏳ 版本时光机 (回退)」双选项卡，支持实时百分比进度条（0%~100%）与历史归档列表。

---

## [0.2.1] - 2026-08-17

### 修复
- **GitHub API 403 频控限流与更新检测修复**：
  - **双通道无限制检测 (Rate-Limit Immune Fallback)**：当 GitHub REST API 达到 60次/小时 匿名限流返回 403 Forbidden 时，自动降级至 GitHub 官方 Web 重定向端点解析最新 Tag，并合成对应架构直链，100% 免疫 403 拦截；
  - **跨进程 Session 完全脱钩 (`setsid`)**：在拉起重启守护脚本时通过 `libc::setsid()` 建立独立进程会话组，防止父进程退出时内核发送 `SIGHUP` 提前误杀唤醒脚本。

---

## [0.2.0] - 2026-08-17

### 修复
- **macOS 热更新与系统安全隔离机制加固** (Gatekeeper & Quarantine Removal)：
  - **自动剥离隔离属性 (`xattr -cr`)**：在解压并替换新版本应用时自动执行 `xattr -cr`，彻底清除 macOS Gatekeeper 隔离标记，杜绝被系统安全机制无提示拦截；
  - **本地 ad-hoc 签名加固 (`codesign -f -s -`)**：自动完成 macOS 签名校验加固，保障 Apple Silicon (M1~M4) 上新二进制无阻碍执行；
  - **双通道保底重启调度器**：采用 `(open -n '<App.app>' || '<exe_path>')` 双通道容灾机制，无论处于 `.app` 容器还是命令行独立运行均能 100% 成功唤醒；
  - **前端长效超时探测控制器**：在轮询重连中引入 `AbortController` 并延长探测窗口至 45 秒，避免请求挂起阻塞。

---

## [0.1.9] - 2026-08-17

### 修复
- **热更新重启端口竞争与服务退出修复**：
  - **解耦重启守护机制 (Decoupled Restart Supervisor)**：将新进程拉起重构为异步脱钩 Shell 调度器，先使旧进程优雅退出并释放 3000 端口，杜绝新进程启动时因 `Address already in use` 导致的闪退崩溃；
  - **macOS 原生 .app 唤醒适配**：自动识别 macOS `.app` Application Bundle 容器，通过 `open -n` 规范拉起完整应用，避免脱离 GUI 容器导致的环境异常；
  - **前端重连轮询韧性提升**：增强 `/api/status` 探测鲁棒性，保障服务原子重启后 100% 自动无缝刷新页面。

---

## [0.1.8] - 2026-08-17

### 新增
- **系统环境变量与 $PATH 链路全景诊断探针** (Environment Variables & $PATH Inspector)：
  - **$PATH 链路拆解分析**：将冒号隔开的 `$PATH` 逐条拆解为带寻址优先级的链路列表，自动检测每一项目录在 macOS 上的有效性；
  - **全量环境变量检索器**：实时呈现系统全局环境变量（包括 Dev、System、Proxy、Custom 等维度），支持实时搜索与分类过滤；
  - **敏感密钥自动脱敏保护**：遇到包含 `KEY`、`SECRET`、`TOKEN`、`PASSWORD`、`AUTH` 等敏感环境变量自动进行掩码脱敏，支持点击明文切换；
  - **终端代理状态检测**：自动侦测 `HTTP_PROXY` / `HTTPS_PROXY` / `ALL_PROXY` 配置状态。

### 优化
- **环境探针界面重构**：采用选项卡切换机制，在同一页面无缝切换「工具链与运行时」、「$PATH 链路拆解」与「环境变量检索器」。

---

## [0.1.7] - 2026-08-17

### 修复
- **编辑器精准唤起机制修复**：将编辑器调起逻辑重构为基于 macOS 原生 App Bundle (`Visual Studio Code.app` / `Cursor.app`) 精准唤起，彻底解决被 Cursor CLI 劫持的 `/usr/local/bin/code` 软链接导致误打开的问题；
- **增加现代编辑器唤起支持**：扩展对 Windsurf、Zed 等现代编辑器的精准唤起支持。

---

## [0.1.6] - 2026-08-17

### 新增
- **本地 Web 产物即时画廊与端口冲突自愈** (Web Artifacts & Port Auto-Healer)：智能嗅探本地正在监听的 Web 开发端口（3000、5173、8000、8080 等），自动识别 Next.js、Vite、Vue、React、FastAPI 等框架与网页标题，支持一键在浏览器打开或 1 秒强制释放冲突端口；
- **全球主流 LLM API 连通性测速雷达** (AI & LLM API Radar)：一键向 DeepSeek、Anthropic (Claude)、OpenAI (GPT-4o)、Google Gemini、OpenRouter、SiliconFlow 等全球 AI 节点发起时延测速与网络路由诊断；
- **本地大模型 (Ollama) 显控与显存一键释放**：自动连接本地 Ollama 服务，实时呈现模型列表、量化等级以及对 Apple Silicon 统一内存 / GPU 显存的占用，支持一键卸载模型释放显存。

### 优化
- **侧边栏导航扩展**：在工作空间与开发工具中新增「产物画廊」与「AI 测速 & 显控」专属一级入口。

---

## [0.1.5] - 2026-08-17

### 新增
- **游戏化时光机与存档点系统** (Save Point & Time Machine)：在让 AI 大改代码前一键保存好用状态，改崩时 1 秒无痛回滚；
- **自动安全隐式备份机制**：在执行回滚操作前自动在后台生成安全备份，杜绝任何误操作丢代码的风险；
- **全景时光轴抽屉**：在 Git 项目卡片上直接唤起时光机面板，直观查看所有历史好用状态节点与 HEAD 指针。

### 优化
- **GitRadar 卡片交互升级**：在 Grid、Table、Compact 三种视图中均集成时光机快捷入口。

---

## [0.1.4] - 2026-08-17

### 新增
- **架构资产精准匹配**：升级资产选择算法，自动优先为 Apple Silicon (M1~M4) 匹配仅 3.2MB 的 aarch64 专用包，为 Intel Mac 匹配 x64 专用包，下载体积减半、速度提升 2 倍；
- **双引擎热更新下载体系**：在 HTTP 下载器中内置 macOS 原生 curl 自动容灾引擎，完美处理 GitHub/AWS S3 的 302 重定向与代理分块传输；
- **正式采用 MIT 开源许可证**：采用标准宽松的 MIT License 协议。

### 修复
- **热升级流式传输解码修复**：修复特定网络或代理环境下出现的 500 流解码异常。

---

## [0.1.3] - 2026-08-17

### 新增
- **独立开发环境工具链页面**：将开发环境检测矩阵独立为专用视图，支持查看 Node.js/Rust/Python/Docker/Ollama 等工具版本与路径一键复制；
- **独立快捷运维页面**：将 DNS 刷新、端口释放与实时 Ping 诊断独立为专属运维控制台。

### 优化
- **页面架构解耦**：拆分原合并的 DevOps 视图，优化路由匹配与侧边栏激活联动。

---

## [0.1.2] - 2026-08-17

### 新增
- **一键在线自动升级系统**：支持 GitHub Releases 语义化版本检测、增量下载、macOS 运行中二进制原子热替换与服务无感重拉起，并在前端控制台提供专属升级弹窗与进度反馈；
- **跟随系统外观模式**：支持跟随 macOS 系统深色/浅色偏好自动无缝切换，并在顶部导航栏提供清晰直观的 Select 下拉切换框。

### 修复
- **macOS 后台运行 Dock 栏图标弹跳修复**：通过配置 LSUIElement 守护进程属性消除后台启动时的图标弹跳；
- **检查更新提示模板修复**：修复检查更新提示文案中未替换版本模板变量（v{version}）的 UI 问题。

---

## [0.1.1] - 2026-08-17

### 新增
- **多架构 macOS 原生发布体系**：新增 Apple Silicon (aarch64)、Intel (x64) 以及 Universal 2 (Fat Binary) 的原生打包支持；
- **高清 Retina 图标支持**：生成 10 层 standard Apple Retina 分辨率的 .icns 应用与 DMG 卷标图标；
- **GitHub Actions 自动化发布流水线**：支持 tag 推送触发全自动跨架构编译与 GitHub Releases 资产发布。

---

# Changelog (English)

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.4] - 2026-08-17

### Fixed
- **Prevent Duplicate Browser Tabs on Hot-Update & Rollback**:
  - Added `--no-open` argument and `WORKSTATION_NO_OPEN=1` environment variable support in the Rust core;
  - Decoupled supervisor restart scripts to relaunch quietly so the existing browser tab reloads smoothly in-place without spawning redundant tabs.
- **AST-Level Hardcoded String Elimination & Full i18n**:
  - Eliminated all residual hardcoded strings across DevTools, AI Radar, Web Artifacts, and Save Point views with 100% dynamic locale switching.

### Changed
- **Dedicated Latest-Version UI State**:
  - Rebuilt UpdateModal state machine with a polished "Already Up to Date" hero badge, instant re-check button, and clean action footer.

---

## [0.2.3] - 2026-08-17

### Changed
- **Full UI/UX Redesign** (design-taste-frontend Anti-Slop Principles):
  - **Obsidian Dark Tech & Hairline Metal Glow**: Deep background hierarchy (`#0a0d14` ➔ `#121723` ➔ `#181f2f`) with `inset 0 1px 0 0 rgba(255, 255, 255, 0.08)` hairline top highlight;
  - **Tabular Mono Typography**: Eliminated layout jitter with global `tabular-nums` on all stats, bandwidth, latency, and PIDs;
  - **Refined Navigation & Vitals**: Frosted glass header, capsule active navigation, and compact hardware vitals with live pulse;
  - **Dedicated Views Polish**: Tier-colored AI radar, web artifacts cards, $PATH chain timeline, and secret masking.

### Fixed
- **Internationalization (i18n) & Hardcoded Text Polish**:
  - Fixed hardcoded Chinese strings in DevToolsView ($PATH resolution hints, table headers, actions, search placeholders);
  - Fixed residual non-localized text across AI Radar, Web Artifacts Gallery, and Project Time Machine views to ensure 100% dynamic multi-language switching.

---

## [0.2.2] - 2026-08-17

### Added
- **Advanced Web Hot Updater & Version Time Machine** (Hermes Studio Inspired Architecture):
  - **Fine-Grained State Machine & 409 Concurrency Lock**: Added `UpdateProgress` state engine with live update progress channel and 409 Conflict rejection;
  - **Multi-Feed Mirror Accelerator**: Dual-channel downloading with GitHub Releases and high-speed mirror fallbacks;
  - **Version Rollback & Self-Healing**: Automatic pre-upgrade binary archiving with 1-click rollback support via `/api/system/update/rollback`;
  - **Dual-Tab UpdateModal UI**: Rebuilt modal with In-Place Upgrade and Version Rollback tabs, real-time download progress bar (0%~100%), and archived backups browser.

---

## [0.2.1] - 2026-08-17

### Fixed
- **Rate-Limit Immune Update Checker**: Added zero-rate-limit web releases fallback when GitHub REST API hits 403 Forbidden;
- **Detached Session Supervisor (`libc::setsid`)**: Prevented `SIGHUP` child process termination upon parent process exit.

---

## [0.2.0] - 2026-08-17

### Fixed
- **Hardened macOS Hot Update & Quarantine Handling**:
  - **Quarantine Stripping (`xattr -cr`)**: Automatically strips `com.apple.quarantine` on extracted assets to prevent Gatekeeper silent execution blocking;
  - **Ad-Hoc Code Signing (`codesign -f -s -`)**: Automatically signs modified binaries on Apple Silicon to guarantee smooth kernel execution;
  - **Dual-Channel Fallback Relaunch**: `(open -n '<App.app>' || '<exe_path>')` guarantees execution across both `.app` bundles and CLI sessions;
  - **Enhanced Frontend Polling**: Introduced `AbortController` and extended reconnect window up to 45 seconds.

---

## [0.1.9] - 2026-08-17

### Fixed
- **Fixed Hot Update Relaunch Port Conflict**:
  - **Decoupled Restart Supervisor**: Spawns detached shell supervisor to cleanly allow old process to exit and release port 3000 before new process binds, preventing `Address already in use` crashes;
  - **macOS App Bundle Launching**: Detects `.app` wrapper and uses `open -n` to launch cleanly in macOS window environment;
  - **Robust Reconnection Polling**: Enhanced `/api/status` polling resilience for seamless automatic reload.

---

## [0.1.8] - 2026-08-17

### Added
- **Environment Variables & $PATH Resolution Inspector**:
  - **$PATH Chain Resolution**: Analyzes the exact lookup priority of colon-separated `$PATH` directories and validates directory existence on macOS;
  - **Environment Variables Browser**: Real-time browser categorized across Dev, System, Proxy, and Custom variables with live search;
  - **Automatic Secret Masking**: Masks sensitive API tokens, secrets, and credentials with 1-click reveal toggle;
  - **Proxy Configuration Radar**: Detects active `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY` variables.

### Changed
- **DevTools UI Tab Navigation**: Seamlessly switch between Toolchains, $PATH Analysis, and Variables Browser.

---

## [0.1.7] - 2026-08-17

### Fixed
- **Fixed VS Code Button Opening Cursor**: Upgraded app launcher to target macOS native App Bundles directly (`Visual Studio Code.app` / `Cursor.app`), resolving hijacked `/usr/local/bin/code` symlink conflicts;
- **Added Native Bundle Dispatching**: Added precise launching support for Windsurf and Zed editors.

---

## [0.1.6] - 2026-08-17

### Added
- **Local Web Artifacts Gallery & Port Auto-Healer**: Automatically detects active listening web ports (3000, 5173, 8000, etc.), infers frameworks (Next.js, Vite, React, Vue, FastAPI) and page titles, providing 1-click browser opening and instant port freeing;
- **Global LLM API Latency Radar**: Probes network reachability and round-trip latency to DeepSeek, Anthropic Claude, OpenAI, Google Gemini, OpenRouter, and SiliconFlow;
- **Local LLM (Ollama) Memory Controller**: Connects to local Ollama daemon to inspect active models in Apple Silicon unified memory / GPU VRAM and release memory with 1-click unload.

### Changed
- **Navigation Sidebar Expansion**: Added dedicated top-level navigation entries for "Web Artifacts" and "AI Radar & Hub".

---

## [0.1.5] - 2026-08-17

### Added
- **Game-like Save Point & Time Machine System**: Create instant save points before AI modifies code, and rollback to working state in 1 second;
- **Automatic Hidden Safety Backup**: Silently backs up any dirty modifications before rollback execution to eliminate risk of accidental code loss;
- **Panoramic Time Machine Drawer**: Interactive vertical timeline component directly integrated into project cards with HEAD indicators.

### Changed
- **GitRadar Card Action Upgrade**: Embedded Time Machine action triggers across Grid, Table, and Compact layouts.

---

## [0.1.4] - 2026-08-17

### Added
- **Exact Architecture Matching**: Prioritizes arch-specific packages (e.g. 3.2MB aarch64 for Apple Silicon, 3.3MB x64 for Intel) over universal bundles, halving download size and doubling update speed;
- **Dual-Engine Download Pipeline**: Integrated macOS native curl fallback engine to flawlessly handle AWS S3 redirects and chunked proxy streams;
- **Adopted MIT Open Source License**: Formally adopted the standard MIT license across the repository.

### Fixed
- **Fixed 500 Stream Decoding Error**: Resolved response body decode issues during update apply in certain proxy environments.

---

## [0.1.3] - 2026-08-17

### Added
- **Dedicated Dev Tools View**: Separated developer environment toolchain inspection into a standalone page with version detection and one-click path copying;
- **Dedicated Ops Toolkit View**: Separated DNS flush, port killing, and real-time ICMP Ping diagnostics into an operations console.

### Changed
- **View Architecture Decoupling**: Split merged DevOps views and improved routing and sidebar synchronization.

---

## [0.1.2] - 2026-08-17

### Added
- **One-Click In-App Auto-Updater**: Automatic GitHub Releases semver detection, incremental binary download, atomic hot-swap replacement of running macOS executables, and seamless server relaunch with real-time UI progress;
- **Follow System Theme Mode**: Real-time synchronization with macOS dark/light mode preferences via system media query.

### Fixed
- **Fixed Continuous Dock Bouncing on Launch**: Configured LSUIElement daemon property for seamless background launch;
- **Fixed Unreplaced Version Placeholder**: Fixed `{version}` placeholder string in update toast notifications.

---

## [0.1.1] - 2026-08-17

### Added
- **Multi-Architecture macOS Release Pipeline**: Native packaging support for Apple Silicon (aarch64), Intel (x64), and Universal 2 Fat binaries;
- **High-Resolution Apple Retina ICNS**: Compiled 10-layer standard Retina app icon and DMG volume icon;
- **GitHub Actions Automation**: Tag-driven automated multi-target compilation and asset release pipeline.
