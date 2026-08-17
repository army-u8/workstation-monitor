更新日志（中文）

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

[0.1.1] - 2026-08-17
新增
- 多架构 macOS 原生发布体系：新增 Apple Silicon (aarch64)、Intel (x64) 以及 Universal 2 (Fat Binary) 的原生打包支持。
- 高清 Retina 图标支持：生成 10 层标准 Apple Retina 分辨率的 .icns 应用与 DMG 卷标图标。
- GitHub Actions 自动化发布流水线：支持 tag 推送触发全自动跨架构编译与 GitHub Releases 资产发布。

---

Changelog (English)

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

[0.1.1] - 2026-08-17
Added
- Multi-Architecture macOS Release Pipeline: Native packaging support for Apple Silicon (aarch64), Intel (x64), and Universal 2 Fat binaries.
- High-Resolution Apple Retina ICNS: Compiled 10-layer standard Retina app icon and DMG volume icon.
- GitHub Actions Automation: Tag-driven automated multi-target compilation and asset release pipeline.
