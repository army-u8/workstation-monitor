# Bun Frontend Toolchain Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Bun the package manager and script runtime for the frontend while retaining Vite for SolidJS compilation and bundling.

**Architecture:** The `frontend` package will use `bun.lock` as its only lockfile. Bun will execute all frontend scripts, while Vite remains the configured dev server and production bundler. Rust and Cargo remain unchanged except that `build.rs` and packaging scripts invoke Bun for the frontend build.

**Tech Stack:** Bun 1.3+, SolidJS, Vite, Tailwind CSS v4, Rust/Cargo, GitHub Actions.

---

### Task 1: Replace the frontend lockfile and script entry points

**Files:**
- Modify: `frontend/package.json`
- Delete: `frontend/package-lock.json`
- Create: `frontend/bun.lock`

**Steps:**

1. Add the Bun lockfile using `bun install` and verify dependency resolution.
2. Keep Vite commands as package scripts, but document that they are invoked through `bun run`.
3. Ensure the test script remains compatible with Bun's test runner or explicitly invokes the existing TypeScript test command through Bun.
4. Verify `bun install --frozen-lockfile` and `bun run verify`.

### Task 2: Update build and packaging entry points

**Files:**
- Modify: `build.rs`
- Modify: `scripts/build_all_mac.sh`

**Steps:**

1. Detect Bun cross-platform and fail clearly when frontend compilation is requested without it.
2. Use `bun install --frozen-lockfile` and `bun run build` when dependencies are missing or a frontend build is required.
3. Preserve `SKIP_FRONTEND_BUILD=1` and embedded `frontend/dist` behavior.
4. Run shell syntax checks and a release build with the frontend build skipped.

### Task 3: Update CI, release validation, and documentation

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `scripts/check_release_consistency.py`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `AGENTS.md`

**Steps:**

1. Install and cache Bun in CI and release workflows using `frontend/bun.lock`.
2. Replace frontend npm commands with Bun equivalents.
3. Update release consistency checks to require Bun lockfile and Bun commands.
4. Update bilingual development and build instructions.
5. Run the release consistency checker.

### Task 4: Verify the full migration

**Steps:**

1. Remove and reinstall frontend dependencies with `bun install --frozen-lockfile`.
2. Run `bun run verify` and confirm lint, i18n, tests, and Vite build pass.
3. Run `SKIP_FRONTEND_BUILD=1 cargo test --locked` and `SKIP_FRONTEND_BUILD=1 cargo build --release --locked`.
4. Search for stale frontend npm install/build invocations and confirm only explanatory historical references remain.
5. Run `git diff --check` and inspect the final diff.

### Task 5: Commit the migration

```bash
git add -A
git commit -m "build: run frontend toolchain with Bun"
```

