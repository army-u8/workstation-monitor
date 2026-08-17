# 🚀 workstation-monitor

基于 **React + Vite + TypeScript** 前端与 **Rust (Axum + Tokio)** 后端的高性能本机监控控制台，为开发者提供系统资源调度、网络监听、存储硬件与开发环境运维等全方位能力。

---

## ⚡ 技术栈

- **前端 (Frontend)**：
  - **核心框架**：[React](https://react.dev/) + TypeScript
  - **构建工具**：[Vite](https://vitejs.dev/)
  - **UI 组件**：自定义组件库（`src/components`），内置中英文国际化（`src/i18n`）
- **后端 (Backend)**：
  - **语言/运行时**：Rust (Edition 2021) + Tokio 异步运行时
  - **Web 框架**：Axum + WebSocket 全双工广播通道（`tokio::sync::broadcast`）
  - **硬件与系统探针**：`sysinfo`（网卡流量、CPU/内存、进程、磁盘）+ `netstat2`（端口/连接）
  - **报文嗅探**：macOS 原生 `libpcap`（`/dev/bpf`）数据包解析（无 root 权限时自动降级）
  - **内嵌静态资源**：`rust-embed` 将 `frontend/dist` 打包进单一二进制文件

---

## 🌟 核心模块

### 🌐 1. 网络观测中枢 (Network Observatory)
- 实时吞吐与波形：各网卡（`en0`、`utun`、`lo0`）上传/下载速率与累计流量。
- 监听端口与活跃外联：本地开放端口、关联进程、PID 与活跃 TCP 连接。
- 服务健康度矩阵：探测公共 DNS、网关及核心服务的 TCP 延时趋势。
- 报文嗅探流：实时解析本地报文（TCP/UDP/DNS/TLS/ICMP/ARP），支持暂停与过滤。

### ⚙️ 2. 进程与资源调度中心 (Process Cockpit)
- 实时 Top 进程：按 CPU 或内存占用降序排列。
- 详细指标：PID、进程名、CPU 占比、内存占用、磁盘读写、运行状态。
- 一键安全终止：按进程名/PID 搜索，带二次确认的安全终止能力。

### 💾 3. 存储与硬件能耗中心 (Disks & Power State)
- APFS 磁盘卷监测：扫描本地分区与外接驱动器，展示容量与可用空间。
- 电池与供电管理：实时感知电量、供电状态与续航预估。

### 🛠️ 4. 开发者环境与一键运维工具箱 (DevOps Toolkit)
- 环境探针：检测 Node.js、Rust、Go、Python、Git、Docker、Homebrew 等运行时版本。
- 一键刷新 DNS 缓存：执行 `dscacheutil -flushcache` 并重载 `mDNSResponder`。
- 一键释放占用端口：查找并终止占用指定端口的进程。
- 即时 Ping 诊断：输入目标 IP/域名发起探测，输出往返延迟。

---

## 🛠️ 启动与运行指南

### 1. 生产启动（默认端口 9527）
```bash
# 启动后端（自动托管前端构建产物）
cd workstation-monitor
cargo run

# 自定义端口
cargo run -- 9999
# 或 PORT=9000 cargo run

# 解锁 libpcap 深度抓包（macOS /dev/bpf 需要管理员权限）
sudo ./target/debug/workstation-monitor
```
👉 浏览器访问：**[http://localhost:9527](http://localhost:9527)**

### 2. 前端独立开发模式（Vite Dev Server，端口 9528）
```bash
cd workstation-monitor/frontend
npm install
npm run dev
```
👉 浏览器访问：**[http://localhost:9528](http://localhost:9528)**（自动代理 `/api` 与 `/ws` 到后端 9527）

---

## 📄 License

私有仓库，仅供个人使用。
