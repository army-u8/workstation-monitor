# 🚀 macOS 全局本机总控台 (Mission Control Pro)

基于 **SolidJS + Tailwind CSS v4 + Vite + TypeScript** 现代前端框架与 **Rust (Axum + Tokio)** 后端的高性能 macOS 本机总控制台，为开发者提供全方位的系统资源调度、网络监听、存储硬件与开发环境运维控制。

---

## ⚡ 技术栈全景

- **前端架构 (Frontend)**：
  - **核心框架**：[SolidJS](https://www.solidjs.com/) (无虚拟 DOM 的细粒度响应式更新)
  - **样式引擎**：[Tailwind CSS v4](https://tailwindcss.com/) (配合 `@tailwindcss/vite` 原生集成)
  - **构建工具**：[Vite](https://vitejs.dev/) + TypeScript
  - **设计规范**：遵循 `design-taste-frontend` 极客黑曜钛金规范，0 破折号，按压微物理触感
- **后端架构 (Backend)**：
  - **语言/运行时**：Rust (Edition 2021) + Tokio 异步高并发运行时
  - **Web 框架**：Axum 0.7 + WebSocket 全双工广播通道 (`tokio::sync::broadcast`)
  - **硬件与系统探针**：`sysinfo` (网卡差分流量、CPU/MEM、Top 进程、APFS 磁盘) + `netstat2` (端口/活跃连接)
  - **macOS 电源探针**：`pmset` 电源与电池状态自动嗅探
  - **报文嗅探**：macOS 原生 `libpcap` (`/dev/bpf`) 深度数据包解析 (具备无 root 权限平滑降级机制)
  - **内嵌静态资源**：`rust-embed` 将 `frontend/dist` 静态资源直接打包编译为单一可执行二进制文件

---

## 🌟 4 大核心总控中枢模块

### 🌐 1. 网络观测中枢 (Network Observatory)
- **实时吞吐与波形**：毫秒级统计各网卡（`en0`、`utun`、`lo0`）上传/下载速率与累计流量，动态 Canvas 渐变波形与十字准星悬浮。
- **监听端口与活跃外联**：一览本地开放的 TCP/UDP 端口、关联进程名、PID 与所有活跃 TCP 外联（`ESTABLISHED` 等）。
- **服务健康度矩阵**：实时探测公共 DNS、本地网关及核心服务的 TCP 响应延时与 SVG 迷你趋势图。
- **报文嗅探流**：实时解析本地报文（TCP/UDP/DNS/TLS/ICMP/ARP），支持空格键随时暂停与过滤。

### ⚙️ 2. 进程与资源调度中心 (Process Cockpit)
- **实时 Top 进程捕获**：按 CPU 占用率或物理内存占用实时降序排列系统最高负荷进程。
- **详细指标分析**：PID、进程名、CPU 占比条、物理内存占用（MB/GB）、磁盘读写量、运行状态。
- **一键安全终止进程**：支持进程名/PID 快速搜索，提供带二次确认的安全“终止进程 (Kill PID)”总控能力。

### 💾 3. 存储与硬件能耗中心 (Disks & Power State)
- **APFS 磁盘卷监测**：自动扫描所有本地 APFS 分区与外接挂载驱动器，直观展示总容量、已用空间占比进度条与剩余可用空间。
- **macOS 电池与供电管理**：实时感知电池电量百分比、供电状态（交流电 / 电池供电）与续航时间预估。

### 🛠️ 4. 开发者环境与一键运维工具箱 (DevOps Toolkit)
- **环境探针矩阵**：自动检测 `Node.js`, `npm`, `pnpm`, `Bun`, `Rust (rustc/cargo)`, `Go`, `Python 3`, `Git`, `Docker`, `Homebrew` 等本地运行时版本与路径。
- **一键刷新 DNS 缓存**：执行 `dscacheutil -flushcache` 并重载 `mDNSResponder`，瞬间修复网络解析漂移。
- **一键释放占用端口**：输入端口号（如 3000、8080），自动查找并杀死占用该端口的进程，彻底终结 `EADDRINUSE` 冲突。
- **即时 Ping 连通诊断**：输入任意目标 IP 或域名发起快速探测，输出平均往返延迟与网络状态。

---

## 🛠️ 启动与运行指南

### 1. 默认生产启动 (默认端口 9527)
```bash
# 启动后端总控台 (自动托管 SolidJS 构建产物)
cd workstation-monitor
cargo run

# 或指定自定义 9 开头端口启动
cargo run -- 9999
# 或 PORT=9000 cargo run

# 解锁 libpcap 深度抓包 (macOS /dev/bpf 需要管理员权限)
sudo ./target/debug/workstation-monitor
```
👉 浏览器访问：**[http://localhost:9527](http://localhost:9527)**

---

### 2. 前端独立开发模式 (Vite Dev Server, 端口 9528)
```bash
cd workstation-monitor/frontend
npm run dev
```
👉 浏览器访问：**[http://localhost:9528](http://localhost:9528)**（自动反向代理 `/api` 与 `/ws` 到后端 9527 端口）
