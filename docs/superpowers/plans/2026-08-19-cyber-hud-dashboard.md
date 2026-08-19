# Cyber-HUD 航天战情巡天室 (Aero-Tactical Cockpit HUD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the entire Workstation Mission Control dashboard from standard generic stacked cards into a high-craft Aero-Tactical Cyber-HUD Cockpit with frameless hairline grids, corner brackets, crosshairs, and oscilloscope telemetry.

**Architecture:** Solid.js reactive stores + Tailwind CSS HUD utility engine + Ark UI headless primitives + HTML5 Canvas oscilloscope renderers + Axum/Rust real-time telemetry backplane.

**Tech Stack:** Solid.js, TypeScript, Tailwind CSS, Lucide / Tabler SVG icons, HTML5 Canvas 2D, Rust/Axum.

## Global Constraints

- Preserve 100% existing functionality, API integrations, WebSocket telemetry streams, and internationalization (i18n).
- Maintain zero layout overflow and absolute text-wrapping protection (`whitespace-nowrap shrink-0` on actions/badges).
- Strictly adhere to WCAG AAA contrast (≥4.5:1) on dark matte obsidian surfaces.
- Strictly ban bounce/elastic animations; use exponential ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`).

---

### Task 1: Cyber-HUD Design Tokens & CSS Utilities

**Files:**
- Modify: `frontend/src/index.css`
- Test: `frontend/src/index.css`

- [ ] **Step 1: Add HUD CSS variables and utility classes**
Inject `.hud-panel`, `.hud-corner`, `.hud-crosshair`, `.hud-badge`, `.hud-glow-cyan`, `.hud-glow-emerald`, and scanline keyframes.

- [ ] **Step 2: Run frontend build check**
Run: `npm --prefix frontend run build`
Expected: PASS

- [ ] **Step 3: Commit**
Run: `git add frontend/src/index.css && git commit -m "feat(ui): add Cyber-HUD tokens, corner brackets, and scanline shaders"`

---

### Task 2: Cyber-HUD Core UI Components (Button, Badge, Tabs, Tooltip)

**Files:**
- Modify: `frontend/src/components/ui/button.tsx`
- Modify: `frontend/src/components/ui/badge.tsx`
- Modify: `frontend/src/components/ui/tabs.tsx`
- Modify: `frontend/src/components/ui/tooltip.tsx`

- [ ] **Step 1: Enhance Button with tactical HUD variants and laser focus**
- [ ] **Step 2: Enhance Badge with bracketed monospace tactical style `[● READY]`**
- [ ] **Step 3: Enhance Tabs with laser indicator and hairline tab list**
- [ ] **Step 4: Run build check and commit**
Run: `npm --prefix frontend run lint && npm --prefix frontend run build`
Run: `git add frontend/src/components/ui && git commit -m "feat(ui): upgrade UI primitives to Cyber-HUD tactical styling"`

---

### Task 3: Cockpit Shell & Tactical Navigation (Header & Sidebar)

**Files:**
- Modify: `frontend/src/components/Header.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/components/AppLayout.tsx`

- [ ] **Step 1: Rebuild Header with node coordinates, live vitals ticker, and tactical status HUD**
- [ ] **Step 2: Rebuild Sidebar with tactical code prefixes `[01:OVR]`, `[02:NET]`, etc., and mini-hardware gauges**
- [ ] **Step 3: Run build check and commit**
Run: `npm --prefix frontend run build`
Run: `git add frontend/src/components/Header.tsx frontend/src/components/Sidebar.tsx frontend/src/components/AppLayout.tsx && git commit -m "feat(ui): rebuild Cockpit header, sidebar, and app layout with HUD aesthetics"`

---

### Task 4: Overview Command Deck (TacticalTelemetryBar, Oscilloscope, Latency & Packets)

**Files:**
- Modify: `frontend/src/components/KpiRibbon.tsx`
- Modify: `frontend/src/components/TrafficWaveform.tsx`
- Modify: `frontend/src/components/LatencyMatrix.tsx`
- Modify: `frontend/src/components/PacketSniffer.tsx`
- Modify: `frontend/src/components/SocketInspector.tsx`
- Modify: `frontend/src/components/views/OverviewView.tsx`

- [ ] **Step 1: Transform KpiRibbon into Wide Tactical Telemetry Command Deck**
- [ ] **Step 2: Upgrade TrafficWaveform to precision Oscilloscope with laser persistence & coordinate grid**
- [ ] **Step 3: Refactor LatencyMatrix & PacketSniffer into tactical radar stream**
- [ ] **Step 4: Refactor SocketInspector with tactical port matrix & laser-focus killing modal**
- [ ] **Step 5: Run tests, check build, and commit**
Run: `npm --prefix frontend run build && cargo test`
Run: `git add frontend/src/components && git commit -m "feat(ui): transform Overview command deck into full Cyber-HUD tactical center"`

---

### Task 5: Sub-view HUD Unification (GitRadar, Artifacts, Obsidian, AI Radar, DevTools, SpeedTester)

**Files:**
- Modify: `frontend/src/components/GitRadar.tsx`
- Modify: `frontend/src/components/WebArtifactsView.tsx`
- Modify: `frontend/src/components/ObsidianHub.tsx`
- Modify: `frontend/src/components/AiRadarView.tsx`
- Modify: `frontend/src/components/DevToolsView.tsx`
- Modify: `frontend/src/components/SpeedTester.tsx`

- [ ] **Step 1: Apply HUD corner brackets and tactical coordinates across sub-views**
- [ ] **Step 2: Run Impeccable detector check**
Run: `node .agents/skills/impeccable-4/scripts/detect.mjs --json frontend/src`
Expected: `[]` (0 warnings)
- [ ] **Step 3: Run full verification, build, and commit**
Run: `npm --prefix frontend run lint && npm --prefix frontend run build && cargo test`
Run: `git add frontend/src/components && git commit -m "feat(ui): unify all sub-modules under Cyber-HUD design system"`
