# Cyber-HUD 航天战情巡天室 (Aero-Tactical Cockpit HUD) 设计规范与重构方案

## 1. 设计愿景与美学定位 (Design Thesis & Identity)

- **核心主题**：SpaceX 龙飞船 / 航空航天高阶战情控制台 (Aero-Tactical Mission Cockpit)。
- **设计哲学**：彻底淘汰平庸的“圆角白框/灰框堆叠”传统管理台模板，将 macOS 本机监控打造成充满**硬核科技感、精密仪器感与电影级视觉张力**的数字战情中心。
- **空间语言**：无缝精密标尺网格（Gapless Hairline Dividers）、四角战术光标（Corner Brackets）、十字准星指示线（Reticle Crosshairs `+`）、等宽雷达频谱。

---

## 2. 空间布局与架构体系 (Spatial Grid & HUD Anatomy)

### 2.1 全局框架 (Cockpit Shell)
1. **顶栏战情带 (Tactical Header)**：
   - 左侧：极客终端坐标系 `[SYS_NODE: Mutallip-MBP.local]` + `[STATUS: 🟢 OPTIMAL]`
   - 中间：动态核心遥测跑马灯（CPU / 内存 / 电源 / 运行时间）
   - 右侧：语言、主题、版本与紧急自愈控制终端。
2. **左侧战术导航 (Nav Rail)**：
   - 细长高密度的战术侧栏，各模块带有专属雷达缩写代码（如 `[01:OVR]`、`[02:NET]`、`[03:GIT]`、`[04:OBS]`、`[05:AI]`）。
   - 底部嵌入实时微型双核 CPU/RAM 进度矩阵与硬件电压/电池动态光柱。

### 2.2 总览主视窗 (Overview Command Deck)
1. **宽幅战情遥测带 (Wide Telemetry Command Deck)**：
   - 彻底废除分散的 4 个小白卡，改为通栏的**一体化数字示波战情带**。
   - 大字阶吞吐速率（`124.8 MB/s`）与动态 LED 状态跑道（Active Sockets、CPU 负荷、网络吞吐峰值）融为一体。
2. **全景动态示波器 (Oscilloscope Matrix)**：
   - 画布背景叠加 0.5px 精密频率刻度网格与准星十字线。
   - 实时网络流速波形带有激光光晕与衰减余辉，悬停时触发微米级游标十字瞄准线。
3. **分屏战术雷达区 (Tactical Split Grid)**：
   - **全球节点延迟矩阵 (Global Latency Ring)**：环形或横向声纳扫描条，展示 Cloudflare、Google、阿里等节点的毫秒延迟。
   - **报文流抓包终端 (Live Packet Terminal)**：黑客流式终端窗口，实时滚动高亮网络会话。
4. **套接字与端口战术矩阵 (Port Matrix & Socket Grid)**：
   - 分类过滤器采用战术胶囊键（`[ALL]`、`[WEB]`、`[DB]`、`[DEV]`、`[APPS]`）。
   - 监听端口列表以精密的 HUD 战术表格呈现，危险操作（如释放端口）带有紧急红色告警警示框与激光脉冲。

---

## 3. 色彩、排版与微质感规范 (Tokens & Shader Effects)

### 3.1 战术色彩空间 (Tactical Color Palette)
- **基底画布**：`--bg-base: #05070a`（极夜黑曜石）
- **HUD 板块**：`--bg-surface: #090d15`，`--bg-subtle: #0d121c`
- **标尺与准星**：`--border-default: rgba(0, 240, 255, 0.15)`，`--border-subtle: rgba(255, 255, 255, 0.06)`
- **战术激光蓝**：`--accent: #00f0ff`（高能电光青）
- **雷达生命绿**：`--status-success: #00ff9d`（健康、活跃连接）
- **警报战备黄**：`--status-warning: #ffb700`（高负载、未提交改动）
- **紧急告警红**：`--status-danger: #ff2a55`（端口冲突、强杀进程）

### 3.2 字体与字阶 (Type Scale)
- **数据与数字**：`JetBrains Mono` / `SF Mono`（强制启用 `font-feature-settings: "tnum" 1` 等宽数字）。
- **界面标签与导航**：`Geist` / `-apple-system` 搭配全大写战术字阶（`text-[10px] tracking-wider uppercase font-mono`）。

### 3.3 HUD 专属微质感 (Micro-Interactions)
- **Corner Brackets**：每个核心面板四个角拥有 `1.5px` 的战术直角包角（`hud-corner`）。
- **Crosshair Reticle**：在网格交汇处渲染 `+` 准星标记。
- **Scanline & Laser Pulse**：鼠标悬停交互产生微弱的扫描线光晕，数据更新时产生微妙的数字滚动翻牌感。

---

## 4. 实施阶段规划 (Implementation Phases)

1. **Phase 1: 核心设计 Token 与 HUD 基础组件库**
   - 扩展 `index.css`，注入 HUD 准星、包角、激光光晕与战术刻度网格样式。
   - 重构 `Button`、`Badge`、`Tabs`、`Tooltip` 为 Cyber-HUD 战术变体。
2. **Phase 2: 全局战术框架与顶栏/侧栏 HUD 化**
   - 重塑 `AppLayout`、`Header`、`Sidebar`，注入战术坐标、LED 状态阵列与硬件光柱。
3. **Phase 3: 全局总览看板 (Overview) 战情室重构**
   - 重写 `KpiRibbon` -> 一体化 `TacticalTelemetryBar`。
   - 升级 `TrafficWaveform`、`LatencyMatrix`、`SocketInspector` 为 Cyber 示波雷达。
4. **Phase 4: 子模块全面 HUD 化**
   - 重构 `GitRadar`（仓库坐标阵列）、`WebArtifactsView`（端口产物雷达）、`ObsidianHub`（知识库战术舱）、`AiRadarView`（LLM 矩阵战情）、`DevToolsView` 与 `SpeedTester`。
5. **Phase 5: 机械检测、全端验证与视觉调优**
   - 运行 Impeccable 检测器，使用 `ego-browser` 截图验证与全分辨率适配。
