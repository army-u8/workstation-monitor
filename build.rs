use std::process::Command;

/// Build the frontend (SolidJS + Vite) at compile time so that `cargo build`
/// always embeds a fresh `frontend/dist` into the binary via `rust-embed`.
///
/// This removes the footgun where running `cargo build` alone produced a
/// binary whose embedded frontend 404s because `dist/` was never generated.
fn main() {
    // Re-run the build script when any relevant frontend input changes, or when
    // the skip toggle flips, so Cargo never embeds a stale `frontend/dist`.
    println!("cargo:rerun-if-changed=frontend/src");
    println!("cargo:rerun-if-changed=frontend/public");
    println!("cargo:rerun-if-changed=frontend/index.html");
    println!("cargo:rerun-if-changed=frontend/package.json");
    println!("cargo:rerun-if-changed=frontend/package-lock.json");
    println!("cargo:rerun-if-changed=frontend/vite.config.ts");
    println!("cargo:rerun-if-changed=frontend/tsconfig.json");
    println!("cargo:rerun-if-changed=frontend/dist");
    println!("cargo:rerun-if-env-changed=SKIP_FRONTEND_BUILD");

    // Skip frontend build when explicitly disabled (e.g. CI that pre-builds it,
    // or when node is unavailable and a prebuilt dist already exists).
    if std::env::var("SKIP_FRONTEND_BUILD").is_ok() {
        eprintln!("build.rs: SKIP_FRONTEND_BUILD set, skipping frontend build");
        return;
    }

    let frontend = std::path::Path::new("frontend");
    if !frontend.exists() {
        eprintln!("build.rs: frontend/ not found, skipping");
        return;
    }

    // On Windows `npm` is `npm.cmd`; calling `npm` directly fails because the
    // shell wrapper isn't on PATH as an executable. Select the right binary.
    let npm = if cfg!(windows) { "npm.cmd" } else { "npm" };

    // `npm ci` prefers a clean install when a lockfile exists, otherwise `npm install`.
    let install = if frontend.join("package-lock.json").exists() {
        (npm, vec!["ci"])
    } else {
        (npm, vec!["install"])
    };

    run(install.0, &install.1, frontend, "npm install");
    run(npm, &["run", "build"], frontend, "npm run build");
}

fn run(program: &str, args: &[&str], dir: &std::path::Path, label: &str) {
    eprintln!("build.rs: running {label} in {}", dir.display());
    let status = Command::new(program)
        .args(args)
        .current_dir(dir)
        .status()
        .unwrap_or_else(|e| panic!("build.rs: failed to spawn `{label}`: {e}"));

    if !status.success() {
        panic!("build.rs: `{label}` failed (exit {status})");
    }
}
