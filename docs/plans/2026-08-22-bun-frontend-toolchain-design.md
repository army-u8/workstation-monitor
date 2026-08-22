# Bun-Driven Frontend Toolchain Design

## Goal

Make Bun the package manager and script runtime for the frontend while retaining Vite as the SolidJS-aware development server and bundler.

## Scope

- Replace the frontend package lock with Bun's lockfile.
- Run frontend install, lint, i18n checks, tests, and builds through `bun run`.
- Update Rust's frontend build hook, macOS packaging scripts, CI, release workflow, release consistency checks, and documentation where they invoke frontend tooling.
- Keep Vite, `vite-plugin-solid`, Tailwind's Vite plugin, SolidJS source code, and the Rust backend unchanged in behavior.

## Architecture

The frontend remains a Vite application. Bun supplies dependency resolution and executes package scripts, so commands become `bun install --frozen-lockfile` and `bun run <script>`. `build.rs` and GitHub Actions will require Bun for frontend compilation; Cargo continues to build the backend. `package-lock.json` is removed and `bun.lock` becomes the single frontend dependency source of truth.

## Compatibility and Failure Handling

- Build entry points fail with a clear message if Bun is unavailable; they must not silently fall back to npm.
- The existing `SKIP_FRONTEND_BUILD=1` escape hatch remains intact.
- CI and release jobs explicitly install Bun and cache from `frontend/bun.lock`.
- Existing ports, Vite proxy behavior, embedded `dist/` output, and API/WebSocket behavior remain unchanged.

## Verification

- `bun install --frozen-lockfile`
- `bun run verify`
- `python3 scripts/check_release_consistency.py --tag v0.2.6`
- `SKIP_FRONTEND_BUILD=1 cargo test --locked`
- `SKIP_FRONTEND_BUILD=1 cargo build --release --locked`
- `git diff --check`

