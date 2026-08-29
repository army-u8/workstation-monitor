# 更新日志 (Changelog)

本项目遵循 [Semantic Versioning (语义化版本 2.0.0)](https://semver.org/lang/zh-CN/) 与 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范。

---

## [未发布]

## [0.3.1] - 2026-08-29

### 新增与优化 (UI/UX 驾驶舱大重构)
- **Bento Grid 遥测驾驶舱首屏重构**：总览页全新升级为 Bento Grid 高信息密度驾驶舱架构，将 RX/TX 速率超大数字、Apple Silicon 芯片信息、实时多核 CPU 与内存负载置顶展示。
- **macOS Liquid Glass 视觉引擎与微交互**：全局引入 `.glass-card-interactive` 磨砂毛玻璃卡片、发光微渐变边框以及按压悬浮微交互动效。
- **侧边栏硬件指标实时动态条**：升级侧边栏底部硬件概况卡片，修复并优化 CPU、内存与电池电量平滑动态进度条，支持自适应告警色彩渐变。
- **高密度工作台脉搏组件**：重构 `WorkbenchPulse` 为双列微型卡片，支持 Git 仓库一键直达 VS Code / 终端以及本地 Web 服务即时探活与端口自愈。
- **UI/UX Pro Max 技能集成**：集成完整设计系统资产与双语无缝同步校验。

### 质量与测试
- **全量回归保障**：48 项前端回归测试全部通过，845 项双语 i18n 字典 100% 保持同步。


### 新增
- **NPX 零安装即开即用与全功能 CLI 启动套件**：新增 `npx vibedesk` 启动支持与全局 CLI 指令（`vibedesk status`, `vibedesk stop`, `vibedesk open`，`-p/--port`, `-n/--no-open`, `-H/--host`），支持跨平台自动探测系统架构并拉取官方单文件预编译二进制。
- **一键 Shell 安装脚本**：提供 `curl -fsSL .../install.sh | bash` 便捷安装至本机系统路径。
- **全智能本地 AI 编程 Agent Token 消耗分析中枢**：全新上线 AI Token 全局统计看板，支持全自动扫描和解析 Claude Code、Cursor、Windsurf、Google Antigravity、OpenAI Codex、Cline、Roo Code、Aider 等主流 AI Agent 的本地数据库与日志。
- **双层平滑 Token 消耗趋势波形与柱状图**：支持 24 小时、7 天、30 天多周期连续贝塞尔平滑面积曲线与微拟物柱体切换，带发光峰值、费用折算与富交互悬浮气泡。
- **GitHub 风格年度全息活动热力图**：支持 52 周 371 天活动格子色阶展示，悬浮卡片精准展示每日活跃请求数、Token 消耗量与中英文格式化日期。
- **全动态模型自适应探测引擎**：废除静态硬编码模型规则，基于真实会话日志和请求载荷动态提取模型标识，智能适配最新发布的各系列模型与多币种价格计算。

### 优化与性能
- **零拷贝分析引擎**：重构 Token 聚合算法为零拷贝引用遍历，15 万条记录分析耗时从 4.5 秒降至 1 毫秒内完成。
- **原生 Rust CLI 参数解析**：后端主程序原生支持 `--help`, `--version`, `-p`, `-H`, `-n` 参数。

### 工程与测试
- **全面质量门禁**：新增 CLI 参数解析单元测试，Rust 单元测试增至 112 项，前端全量测试与 842 项双语 i18n 字典全部保持 100% 同步。

## [0.2.9] - 2026-08-28

### 新增
- **智能工作站控制内核**：新增版本化事件、SQLite 审计仓库、风险策略、一次性确认凭据、幂等操作注册表和兼容现有接口的统一审计链。
- **活动时间线**：新增可过滤、关联分组、游标分页的持久化活动页面，并在存储失败时自动降级为有界内存时间线。
- **全局命令面板**：新增 `⌘K` 强类型操作搜索、参数表单、风险与可用性提示，以及复用全局确认弹窗的安全执行流程。

### 安全
- **持久化操作幂等**：请求声明在副作用前持久化，并绑定操作 ID 与参数哈希；重复请求稳定返回原结果，冲突复用返回 409，无法判定的中断请求不会被再次执行。
- **确认与权限边界**：一次性确认凭据采用有界、确定性的过期淘汰；管理员操作按有效 UID 显示与执行，DNS 刷新仅在全部系统命令成功时报告完成。

### 修复
- **存储迁移与权限**：SQLite v1 数据可无损升级至 v2，新建数据目录使用私有权限且不再修改既有父目录权限。
- **API 错误隔离**：统一控制接口及旧接口的 500 响应不再泄露内部错误；完整诊断仅写入服务日志，无效活动游标返回明确的 400 错误。
- **活动与弹窗交互**：活动详情独立显示本地化状态、操作 ID 与耗时；确认弹窗打开时暂停命令面板键盘处理和焦点恢复，阻止 Escape 与路由切换造成焦点穿透。

### 工程
- **事件保留策略**：支持 `WORKSTATION_EVENT_RETENTION_DAYS`（默认 30 天，范围 1–365），启动时及每 24 小时清理过期事件。
- **质量门禁**：补充控制面、真实 v1→v2 迁移、活动时间线、命令面板、国际化与无障碍回归测试。

## [0.2.8] - 2026-08-22

### 新增
- **工作台总控首页**：聚合 Git 项目脉搏、本地 Web 运行服务、本机健康状态与 AI/运维快捷入口。
- **项目与服务快捷动作**：从首页直接打开 VS Code、终端、Save Point、运行网页，并处理异常端口。

### 工程
- **Node 24 Actions**：GitHub Actions 迁移到 Node 24 兼容的 checkout 与官方 `gh` Release CLI 流程。
- **前端回归门禁**：新增工作台聚合逻辑测试，前端回归测试扩展至 30 项。

## [0.2.7] - 2026-08-22

### 安全
- **HTTPS 探测校验加固**：AI Radar 与本地 Web 产物探测恢复证书校验，禁止本地服务重定向到其他地址。
- **用户目录边界加固**：Cleaner、Git Radar、Obsidian 与环境变量采集器不再猜测或访问硬编码用户目录。

### 修复
- **自动更新器路径兼容性**：支持非 UTF-8 文件系统路径，避免解压更新包时因路径转换失败而崩溃。
- **Bun 依赖锁定**：锁文件统一使用官方 npm registry，避免构建依赖本机镜像配置。

### 工程
- **回归门禁**：新增上述安全边界的发布一致性检查，并完成 Rust、前端和 Bun 依赖审计。

## [0.2.6] - 2026-08-20

### 安全
- **本地服务边界加固**：默认仅监听 loopback，阻断跨域与 DNS rebinding；通过 `sudo` 启动时仅打开 BPF 设备，随后在 HTTP 服务启动前降权回调用用户。
- **自动更新器加固**：仅接受官方 GitHub Release 资产和受限重定向，使用原子归档/替换、并发锁、启动健康检查及失败自动恢复；回滚前保留当前版本以支持立即撤销。
- **文件系统隔离**：Obsidian 与动态静态资源改用目录 FD、`openat` 和 `O_NOFOLLOW`，阻断路径穿越、符号链接逃逸与校验后替换竞态。

### 修复
- **采集器可靠性**：修复 Cleaner 扫描与删除范围不一致、命令子进程泄漏和清理超时；Git 状态采集失败改为显式“状态未知”。
- **项目时光机**：安全备份失败时终止回滚，并完整恢复原 Git 暂存区状态。
- **前端交互**：修复 WebSocket 代理端口、Obsidian 异步请求竞态、更新历史重复请求、Modal 焦点逃逸及多个状态显示错误。
- **国际化与可访问性**：同步 615 个中英文键，并完善 Dialog 语义、键盘焦点循环、焦点恢复和实时区域提示。

### 工程
- **发布质量门禁**：新增前后端 CI、发布版本一致性校验、锁文件构建和 65 个 Rust / 26 个前端回归测试。

## [0.2.5] - 2026-08-18

### 新增
- **AI Studio Hub**：新增 LLM 延迟、本地 Agent、Ollama、API 密钥与项目规则的统一工作台。
- **动态前端热加载**：后端优先读取本地 `frontend/dist`，支持不重启 Rust 服务刷新前端产物。

### 优化
- **统一组件与图标系统**：迁移至基于 Ark UI/Kobalte 的 SolidJS 组件体系，并统一使用 Tabler 图标。
- **工作台布局精修**：统一按钮、标签、过滤器和输入框，改善卡片边界、文本截断与 Git Radar 操作区。

### 修复
- **开发工具可靠性**：增强本地 API 密钥探测、Socket 应用映射和多 CDN 网速测试的容错能力。

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

## [Unreleased]

## [0.3.0] - 2026-08-29

### Added
- **NPX Instant Launch & Full CLI Suite**: Add `npx vibedesk` instant launch and global CLI commands (`vibedesk status`, `vibedesk stop`, `vibedesk open`, `-p/--port`, `-n/--no-open`, `-H/--host`), supporting cross-platform auto-architecture detection and automated pre-compiled binary downloads.
- **One-Line POSIX Shell Installer**: Provide `curl -fsSL .../install.sh | bash` for automated binary installation into the system PATH.
- **AI Coding Agent Token Analytics Hub**: Comprehensive local AI Token analytics dashboard, parsing SQLite and JSONL session data from Claude Code, Cursor, Windsurf, Google Antigravity, OpenAI Codex, Cline, Roo Code, and Aider.
- **Dual-Layer Token Consumption Trend Waveform**: Smooth Catmull-Rom/Bezier continuous area curve with micro-skeuomorphic histogram bars for 24h, 7d, and 30d timeframes, dynamic peak badges, currency conversion, and rich floating tooltips.
- **GitHub-Style 52-Week Activity Heatmap**: Interactive 371-day contribution matrix with dynamic green color scale and date/request/token tooltips.
- **Dynamic AI Model Detection Engine**: Automatically identify models dynamically from session traces, replacing static hardcoded lists and supporting latest LLM releases.

### Performance & Optimization
- **Zero-Copy Analytics Engine**: Optimize token analytics aggregation using zero-copy pointer slice iteration, reducing 150k record processing latency from 4.5s to under 1ms.
- **Native Rust CLI Argument Parsing**: The backend executable natively supports `--help`, `--version`, `-p`, `-H`, and `-n` options.

### Engineering & Quality Gates
- **Comprehensive Quality Gates**: Add CLI argument unit tests, expanding Rust tests to 112 passed, with 48 frontend regression tests and 842 synchronized i18n keys.

## [0.2.9] - 2026-08-28

### Added
- **Workstation control kernel**: Add versioned events, a SQLite audit repository, risk policies, single-use confirmation tickets, an idempotent action registry, and a unified audit chain compatible with existing endpoints.
- **Activity timeline**: Add a persistent, filterable, correlation-grouped timeline with cursor pagination and a bounded in-memory fallback when storage is degraded.
- **Global command palette**: Add `⌘K` typed action search, parameter forms, risk and availability hints, and safe execution through the shared confirmation dialog.

### Security
- **Durable action idempotency**: Persist request claims before side effects and bind them to the action ID and parameter hash; duplicates return the original result, conflicting reuse returns 409, and interrupted indeterminate requests are never re-executed.
- **Confirmation and privilege boundaries**: Bound and deterministically evict single-use confirmation challenges; derive administrator actions from the effective UID and report DNS flush success only when every system command succeeds.

### Fixed
- **Storage migration and permissions**: Preserve v1 SQLite data during the v2 upgrade, apply private permissions only to newly created data directories, and leave existing parent-directory modes unchanged.
- **API error isolation**: Prevent unified and legacy 500 responses from exposing internal failures while retaining full server-side diagnostics; return a clear 400 response for invalid activity cursors.
- **Activity and modal interactions**: Render localized status, action ID, and duration independently; suspend palette keyboard handling and focus restoration while confirmation is active so Escape and route changes cannot penetrate the modal.

### Engineering
- **Event retention policy**: Support `WORKSTATION_EVENT_RETENTION_DAYS` with a 30-day default, a 1–365 day bound, startup pruning, and 24-hour maintenance.
- **Quality gates**: Add control-plane, real v1-to-v2 migration, activity timeline, command palette, i18n, and accessibility regressions.

## [0.2.8] - 2026-08-22

### Added
- **Workbench cockpit homepage**: Aggregate Git project pulse, local Web services, host health, and AI/Ops quick links in one actionable overview.
- **Project and service shortcuts**: Open VS Code, terminal, Save Points, running pages, and degraded-port cleanup directly from the homepage.

### Engineering
- **Node 24 Actions**: Migrate GitHub Actions to the Node 24-compatible checkout action and official `gh` Release CLI flow.
- **Frontend regression gates**: Add workbench aggregation coverage and expand the frontend regression suite to 30 tests.

## [0.2.7] - 2026-08-22

### Security
- **HTTPS probe hardening**: Restore certificate validation for AI Radar and local web artifact probes, and prevent local services from redirecting probes elsewhere.
- **User directory containment**: Cleaner, Git Radar, Obsidian, and environment-variable collection no longer guess or access hardcoded user directories.

### Fixed
- **Updater path compatibility**: Preserve non-UTF-8 filesystem paths when extracting update archives instead of panicking during path conversion.
- **Bun dependency locking**: Pin the Bun lockfile to the official npm registry instead of inheriting a machine-local mirror configuration.

### Engineering
- **Regression gates**: Add release consistency checks for the security boundaries above and complete Rust, frontend, and Bun dependency verification.

## [0.2.6] - 2026-08-20

### Security
- **Local Service Boundary Hardening**: Bind to loopback by default, block cross-origin and DNS-rebinding requests, and drop from `sudo` root to the invoking user before starting the HTTP server after opening BPF.
- **Updater Hardening**: Accept only official GitHub Release assets and restricted redirects; add atomic archive/replacement, concurrency locking, launch health checks, automatic recovery, and reversible rollback archives.
- **Filesystem Containment**: Anchor Obsidian and dynamic static-file access with directory FDs, `openat`, and `O_NOFOLLOW` to prevent traversal, symlink escape, and check-then-open races.

### Fixed
- **Collector Reliability**: Align Cleaner scan/delete scope, terminate command process groups, use realistic cleanup timeouts, and report failed Git status collection as unknown.
- **Project Time Machine**: Abort rollback when its safety backup fails and restore the original Git index exactly.
- **Frontend Interactions**: Fix WebSocket proxy ports, Obsidian request races, duplicate update-history requests, modal focus escape, and several incorrect status displays.
- **Internationalization and Accessibility**: Synchronize 615 bilingual keys and improve dialog semantics, keyboard focus trapping/restoration, and live-region announcements.

### Engineering
- **Release Quality Gates**: Add frontend/backend CI, release consistency checks, locked builds, and 65 Rust plus 26 frontend regression tests.

## [0.2.5] - 2026-08-18

### Added
- **AI Studio Hub**: Added a unified workspace for LLM latency, local agents, Ollama, API keys, and project rules.
- **Dynamic Frontend Reloading**: The backend now prioritizes local `frontend/dist` assets so rebuilt UI assets can be refreshed without restarting Rust.

### Changed
- **Unified Components and Icons**: Migrated to an Ark UI/Kobalte-based SolidJS component system and standardized the interface on Tabler icons.
- **Workbench Layout Polish**: Standardized buttons, badges, filters, and inputs while improving card boundaries, text truncation, and Git Radar actions.

### Fixed
- **Developer Tool Reliability**: Improved local API-key discovery, socket-to-application mapping, and multi-CDN speed-test resilience.

---

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
