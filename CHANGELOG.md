更新日志（中文）

[0.1.9] - 2026-08-17
修复
- 彻底修复热更新后由于端口竞争导致服务崩溃/超时的 Bug：
  - **解耦重启守护机制 (Decoupled Restart Supervisor)**：将新进程拉起重构为异步脱钩 Shell 调度器，先使旧进程优雅退出并释放 3000 端口，杜绝新进程启动时因 `Address already in use` 导致的闪退崩溃。
  - **macOS 原生 .app 唤醒适配**：自动识别 macOS `.app` Application Bundle 容器，通过 `open -n` 规范拉起完整应用，避免脱离 GUI 容器导致的环境异常。
  - **前端重连轮询韧性提升**：增强 `/api/status` 探测鲁棒性，保障服务原子重启后 100% 自动无缝刷新页面。

[0.1.8] - 2026-08-17
新增
- 系统环境变量与 $PATH 链路全景诊断探针 (Environment Variables & $PATH Inspector)：
  - **$PATH 链路拆解分析**：将冒号隔开的 `$PATH` 逐条拆解为带寻址优先级的链路列表，自动检测每一项目录在 macOS 上的有效性；
  - **全量环境变量检索器**：实时呈现系统全局环境变量（包括 Dev、System、Proxy、Custom 等维度），支持实时搜索与分类过滤；
  - **敏感密钥自动脱敏保护**：遇到包含 `KEY`、`SECRET`、`TOKEN`、`PASSWORD`、`AUTH` 等敏感环境变量自动进行掩码脱敏，支持点击明文切换；
  - **终端代理状态检测**：自动侦测 `HTTP_PROXY` / `HTTPS_PROXY` / `ALL_PROXY` 配置状态。
变更
- 环境探针界面重构：采用选项卡切换机制，在同一页面无缝切换「工具链与运行时」、「$PATH 链路拆解」与「环境变量检索器」。

[0.1.7] - 2026-08-17
修复
- 修复点击 VS Code 按钮意外打开 Cursor 的问题：将编辑器调起逻辑重构为基于 macOS 原生 App Bundle (`Visual Studio Code.app` / `Cursor.app`) 精准唤起，彻底避免被 Cursor CLI 劫持的 `/usr/local/bin/code` 软链接导致误打开。
- 增加对 Windsurf、Zed 等现代编辑器的精准唤起支持。

[0.1.6] - 2026-08-17
新增
- 本地 Web 产物即时画廊与端口冲突自愈 (Web Artifacts & Port Auto-Healer)：智能嗅探本地正在监听的 Web 开发端口（3000、5173、8000、8080 等），自动识别 Next.js、Vite、Vue、React、FastAPI 等框架与网页标题，支持一键在浏览器打开或 1 秒强制释放冲突端口。
- 全球主流 LLM API 连通性测速雷达 (AI & LLM API Radar)：一键向 DeepSeek (深度求索)、Anthropic (Claude)、OpenAI (GPT-4o)、Google Gemini、OpenRouter、SiliconFlow 等全球 AI 节点发起时延测速与网络路由诊断，1 秒排查科学代理与超时问题。
- 本地大模型 (Ollama) 显控与显存一键释放：自动连接本地 Ollama 服务，实时呈现模型列表、量化等级以及对 Apple Silicon 统一内存 / GPU 显存的占用，支持一键卸载模型释放显存。
变更
- 侧边栏导航扩展：在工作空间与开发工具中新增「产物画廊」与「AI 测速 & 显控」专属一级入口。

[0.1.5] - 2026-08-17
新增
- 游戏化时光机与存档点系统 (Save Point & Time Machine)：在让 AI 大改代码前一键保存好用状态，改崩时 1 秒无痛回滚。
- 自动安全隐式备份机制：在执行回滚操作前自动在后台生成安全备份，杜绝任何误操作丢代码的风险。
- 全景时光轴抽屉：在 Git 项目卡片上直接唤起时光机面板，直观查看所有历史好用状态节点与 HEAD 指针。
变更
- GitRadar 卡片交互升级：在 Grid、Table、Compact 三种视图中均集成时光机快捷入口。
修复
- 优化 TypeScript 类型定义，去除编译器无用警告。

[0.1.4] - 2026-08-17
新增
- 架构资产精准匹配：升级资产选择算法，自动优先为 Apple Silicon (M1~M4) 匹配仅 3.2MB 的 aarch64 专用包，为 Intel Mac 匹配 x64 专用包，下载体积减半、速度提升 2 倍。
- 双引擎热更新下载体系：在 HTTP 下载器中内置 macOS 原生 curl 自动容灾引擎，完美处理 GitHub/AWS S3 的 302 重定向与代理分块传输。
- 采用 MIT 开源许可证：正式采用标准宽松的 MIT License 协议。
修复
- 修复热升级 API 在特定网络或代理环境下可能出现的 500 解码异常 (error decoding response body)。
- 清理冗余类型定义与编译器警告。

[0.1.3] - 2026-08-17
新增
- 独立开发环境页面：将开发环境工具链检测矩阵独立为专用视图，支持查看 Node.js/Rust/Python/Docker/Ollama 等工具版本与路径一键复制。
- 独立快捷运维页面：将 DNS 刷新、端口释放与实时 Ping 诊断独立为专属运维控制台。
变更
- 页面架构解耦：拆分原合并的 DevOps 视图，优化路由匹配与侧边栏激活联动。
修复
- 修复开发环境与快捷运维路由指向相同组件的问题。

[0.1.2] - 2026-08-17
新增
- 一键在线自动升级系统：支持 GitHub Releases 语义化版本检测、增量下载、macOS 运行中二进制原子热替换与服务无感重拉起，并在前端控制台提供专属升级弹窗与进度反馈。
- 跟随系统外观模式：支持跟随 macOS 系统深色/浅色偏好自动无缝切换，并在顶部导航栏提供清晰直观的 Select 下拉切换框。
变更
- 顶部导航栏控件优化：将主题切换重构为图标与状态联动的下拉选择框，提供更准确的状态反馈。
- 极速编译链路优化：优化构建脚本，避免多架构全量打包过程中的重复依赖安装与并发冲突。
修复
- 修复 macOS 应用在后台启动时底下 Dock 栏图标一直上下跳动的问题（添加 LSUIElement 守护进程配置）。
- 修复检查更新提示文案中未替换版本模板变量（v{version}）的 UI 问题。

[.0.1.1] - 2026-08-17
Added
- Multi-Architecture macOS Release Pipeline: Native packaging support for Apple Silicon (aarch64), Intel (x64), and Universal 2 Fat binaries.
- High-Resolution Apple Retina ICNS: Compiled 10-layer standard Retina app icon and DMG volume icon.
- GitHub Actions Automation: Tag-driven automated multi-target compilation and asset release pipeline.

---

Changelog (English)

[0.1.9] - 2026-08-17
Fixed
- Fixed Hot Update Relaunch Crash Bug:
  - **Decoupled Restart Supervisor**: Spawns detached shell supervisor to cleanly allow old process to exit and release port 3000 before new process binds, preventing `Address already in use` crashes.
  - **macOS App Bundle Launching**: Detects `.app` wrapper and uses `open -n` to launch cleanly in macOS window environment.
  - **Robust Reconnection Polling**: Enhanced `/api/status` polling resilience for seamless automatic reload.

[0.1.8] - 2026-08-17
Added
- Environment Variables & $PATH Resolution Inspector:
  - **$PATH Chain Resolution**: Analyzes the exact lookup priority of colon-separated `$PATH` directories and validates directory existence on macOS.
  - **Environment Variables Browser**: Real-time browser categorized across Dev, System, Proxy, and Custom variables with live search.
  - **Automatic Secret Masking**: Masks sensitive API tokens, secrets, and credentials with 1-click reveal toggle.
  - **Proxy Configuration Radar**: Detects active `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY` variables.
Changed
- DevTools UI Tab Navigation: Seamlessly switch between Toolchains, $PATH Analysis, and Variables Browser.

[0.1.7] - 2026-08-17
Fixed
- Fixed VS Code Button Opening Cursor: Upgraded app launcher to target macOS native App Bundles directly (`Visual Studio Code.app` / `Cursor.app`), resolving hijacked `/usr/local/bin/code` symlink conflicts.
- Added native bundle dispatching support for Windsurf and Zed editors.

[0.1.6] - 2026-08-17
Added
- Local Web Artifacts Gallery & Port Auto-Healer: Automatically detects active listening web ports (3000, 5173, 8000, etc.), infers frameworks (Next.js, Vite, React, Vue, FastAPI) and page titles, providing 1-click browser opening and instant port freeing.
- Global LLM API Latency Radar: Probes network reachability and round-trip latency to DeepSeek, Anthropic Claude, OpenAI, Google Gemini, OpenRouter, and SiliconFlow in 1 second.
- Local LLM (Ollama) Memory Controller: Connects to local Ollama daemon to inspect active models in Apple Silicon unified memory / GPU VRAM and release memory with 1-click unload.
Changed
- Navigation Sidebar Expansion: Added dedicated top-level navigation entries for "Web Artifacts" and "AI Radar & Hub".

[0.1.5] - 2026-08-17
Added
- Game-like Save Point & Time Machine System: Create instant save points before AI modifies code, and rollback to working state in 1 second.
- Automatic Hidden Safety Backup: Silently backs up any dirty modifications before rollback execution to eliminate risk of accidental code loss.
- Panoramic Time Machine Drawer: Interactive vertical timeline component directly integrated into project cards with HEAD indicators.
Changed
- GitRadar Card Action Upgrade: Embedded Time Machine action triggers across Grid, Table, and Compact layouts.
Fixed
- Cleaned up TypeScript type definitions and fixed unused compiler warnings.

[0.1.4] - 2026-08-17
Added
- Exact Architecture Matching: Prioritizes arch-specific packages (e.g. 3.2MB aarch64 for Apple Silicon, 3.3MB x64 for Intel) over universal bundles, halving download size and doubling update speed.
- Dual-Engine Download Pipeline: Integrated macOS native curl fallback engine to flawlessly handle AWS S3 redirects and chunked proxy streams.
- MIT Open Source License: Formally adopted the standard MIT license across the repository.
Fixed
- Fixed 500 stream decoding error (error decoding response body) during update apply in certain proxy environments.
- Cleaned up redundant struct definitions and compiler warnings.

[0.1.3] - 2026-08-17
Added
- Dedicated Dev Tools View: Separated developer environment toolchain inspection into a standalone page with version detection and one-click path copying.
- Dedicated Ops Toolkit View: Separated DNS flush, port killing, and real-time ICMP Ping diagnostics into an operations console.
Changed
- View Architecture Decoupling: Split merged DevOps views and improved routing and sidebar synchronization.
Fixed
- Fixed route mapping conflict where both /devtools and /ops rendered the same component.

[0.1.2] - 2026-08-17
Added
- One-Click In-App Auto-Updater: Automatic GitHub Releases semver detection, incremental binary download, atomic hot-swap replacement of running macOS executables, and seamless server relaunch with real-time UI progress.
- Follow System Theme Mode: Real-time synchronization with macOS dark/light mode preferences via system media query.
- Theme Select Dropdown: Replaced toggle button with an intuitive Select dropdown control in the top navigation header.
Changed
- Build System Optimization: Streamlined multi-architecture release compilation scripts to eliminate redundant dependency installation and concurrent file contention.
Fixed
- Fixed continuous Dock bouncing on launch by configuring LSUIElement daemon property.
- Fixed unreplaced version template placeholder in update check toast notification.

[.0.1.1] - 2026-08-17
Added
- Multi-Architecture macOS Release Pipeline: Native packaging support for Apple Silicon (aarch64), Intel (x64), and Universal 2 Fat binaries.
- High-Resolution Apple Retina ICNS: Compiled 10-layer standard Retina app icon and DMG volume icon.
- GitHub Actions Automation: Tag-driven automated multi-target compilation and asset release pipeline.
