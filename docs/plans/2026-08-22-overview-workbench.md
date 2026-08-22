# Overview Workbench Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the existing Overview page into an actionable workstation cockpit that aggregates Git projects, live Web services, system health, and quick navigation without duplicating backend collectors.

**Architecture:** Keep the existing `OverviewView` as the composition root and add a focused `WorkbenchPulse` component for the new panels. Read Solid signals from `services/store.ts`, reuse existing action functions, and leave the deep-monitoring components below the new cockpit. Add dictionary entries to both locale files and regression tests that protect the aggregation/actions/i18n contract.

**Tech Stack:** SolidJS, TypeScript, Tailwind CSS v4, Tabler icons, Bun test, existing Rust/Axum APIs.

---

### Task 1: Add regression coverage for the workbench contract

**Files:**
- Create: `frontend/tests/overview-workbench.regression.test.ts`
- Test: `frontend/tests/overview-workbench.regression.test.ts`

**Step 1: Write the failing test**

Assert that `OverviewView.tsx` composes the new workbench component, that the component reads project/service/system signals, calls the existing refresh and action APIs, and uses translation keys rather than hardcoded user-facing prose. Also assert that both locale dictionaries expose the new `overviewWorkbench` section.

**Step 2: Run test to verify it fails**

Run: `bun --cwd frontend test tests/overview-workbench.regression.test.ts`

Expected: FAIL because the new component and dictionary section do not exist yet.

### Task 2: Add synchronized workbench translations and icons

**Files:**
- Modify: `frontend/src/i18n/dict/zh.ts`
- Modify: `frontend/src/i18n/dict/en.ts`
- Modify: `frontend/src/components/Icons.tsx` only if an existing exported Tabler icon is insufficient

**Step 1: Add the dictionary contract**

Add keys for the dashboard title, refresh state, project metrics/actions, service metrics/actions, health labels, empty/loading states, and navigation labels. Keep placeholders identical in both dictionaries.

**Step 2: Run the dictionary check**

Run: `bun --cwd frontend run i18n:check`

Expected: all dictionary keys remain synchronized.

### Task 3: Implement the aggregated workbench panels

**Files:**
- Create: `frontend/src/components/WorkbenchPulse.tsx`
- Modify: `frontend/src/components/views/OverviewView.tsx`

**Step 1: Implement the refresh and derived data layer**

Use `createMemo` to derive project counts, dirty projects, service health counts, disk usage, and installed tool counts. Add a local refresh signal and call `scanGitProjectsApi`, `fetchWebArtifactsApi`, and `fetchMachineInfoApi` via `Promise.all`. Use existing `openAppApi`, `openSnapshotDrawer`, and `freeArtifactPortApi` for actions.

**Step 2: Implement project pulse cards**

Show at most five projects sorted with dirty repositories first, then recent commit time. Include branch, path, dirty/ahead/behind status, and buttons for VS Code, terminal, Save Point, and the full Git Radar route. Render a translated empty state when no projects are indexed.

**Step 3: Implement live service cards**

Show at most four Web artifacts with URL/port, framework, health, and response time. Open healthy URLs in a new tab and delegate degraded-port cleanup to `freeArtifactPortApi`; expose a full Web Artifacts route. Render a translated empty state when no services are detected.

**Step 4: Implement health and quick-navigation panels**

Summarize WebSocket state, CPU/memory, primary disk usage, battery, and installed developer tools. Add links to AI Radar, DevTools, and Ops using router `A` components. Keep all user-facing text dictionary-backed and all icons from `Icons.tsx`.

**Step 5: Compose the new section above deep telemetry**

Update `OverviewView.tsx` to render `WorkbenchPulse` first, then preserve `KpiRibbon`, `TrafficWaveform`, `LatencyMatrix`, `PacketSniffer`, and `SocketInspector` unchanged.

### Task 4: Run focused tests and fix failures

**Files:**
- Modify: files from Tasks 2-3 as required by test/lint feedback

**Step 1: Run the new regression test**

Run: `bun --cwd frontend test tests/overview-workbench.regression.test.ts`

Expected: PASS.

**Step 2: Run lint and i18n checks**

Run: `bun --cwd frontend run lint`

Expected: ESLint and bilingual dictionary checks pass.

### Task 5: Verify the full project and commit

**Files:**
- No additional files expected.

**Step 1: Run the complete frontend verification**

Run: `bun --cwd frontend run verify`

Expected: all tests pass and Vite produces a production build.

**Step 2: Run Rust checks**

Run: `cargo test --locked && cargo check --locked`

Expected: Rust tests and type checking pass.

**Step 3: Review diff and commit**

Run: `git diff --check && git status --short`

Then commit with:

```bash
git add frontend/src/components/WorkbenchPulse.tsx frontend/src/components/views/OverviewView.tsx frontend/src/i18n/dict/zh.ts frontend/src/i18n/dict/en.ts frontend/tests/overview-workbench.regression.test.ts docs/plans/2026-08-22-overview-workbench.md
git commit -m "feat: turn overview into workstation cockpit"
```
