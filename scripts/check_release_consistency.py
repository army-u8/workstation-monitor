#!/usr/bin/env python3
"""Validate development and release configuration invariants.

This script intentionally uses only the Python standard library so it can run
both locally and in GitHub Actions before dependencies are installed.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import tomllib
from pathlib import Path

sys.dont_write_bytecode = True
from extract_changelog import extract_section


ROOT = Path(__file__).resolve().parent.parent


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--tag",
        help="Release tag to validate against Cargo.toml (for example v0.2.5)",
    )
    args = parser.parse_args()

    errors: list[str] = []
    cargo = tomllib.loads(read("Cargo.toml"))
    cargo_lock = tomllib.loads(read("Cargo.lock"))
    frontend_package = json.loads(read("frontend/package.json"))
    frontend_lock = json.loads(read("frontend/package-lock.json"))
    cargo_version = cargo["package"]["version"]
    bundle_version = cargo["package"]["metadata"]["bundle"]["version"]
    locked_backend = next(
        package for package in cargo_lock["package"] if package["name"] == "workstation-monitor"
    )

    require(
        bundle_version == cargo_version,
        f"Cargo bundle version {bundle_version!r} != package version {cargo_version!r}",
        errors,
    )
    require(
        frontend_package["version"] == cargo_version,
        f"frontend version {frontend_package['version']!r} != Cargo version {cargo_version!r}",
        errors,
    )
    require(
        locked_backend["version"] == cargo_version,
        f"Cargo.lock version {locked_backend['version']!r} != Cargo version {cargo_version!r}",
        errors,
    )
    require(
        frontend_lock["packages"][""]["version"] == cargo_version,
        f"frontend lock version {frontend_lock['packages']['']['version']!r} != Cargo version {cargo_version!r}",
        errors,
    )
    require(
        frontend_package.get("scripts", {}).get("verify")
        == "npm run lint && npm test && npm run build",
        "frontend package is missing the combined lint/test/build verify script",
        errors,
    )

    if args.tag:
        require(
            re.fullmatch(r"v\d+\.\d+\.\d+", args.tag) is not None,
            f"release tag {args.tag!r} must use vMAJOR.MINOR.PATCH",
            errors,
        )
        require(
            args.tag == f"v{cargo_version}",
            f"release tag {args.tag!r} != Cargo version tag 'v{cargo_version}'",
            errors,
        )

    main_rs = read("src/main.rs")
    vite = read("frontend/vite.config.ts")
    backend_match = re.search(r"\.unwrap_or\((\d+)\);", main_rs)
    proxy_match = re.search(
        r"process\.env\.VITE_BACKEND_PORT\s*\|\|\s*['\"](\d+)['\"]", vite
    )
    vite_port_match = re.search(r"\bport:\s*(\d+)", vite)
    require(backend_match is not None, "cannot determine Rust default backend port", errors)
    require(proxy_match is not None, "cannot determine Vite default backend proxy port", errors)
    require(vite_port_match is not None, "cannot determine Vite UI port", errors)

    if backend_match and proxy_match:
        require(
            proxy_match.group(1) == backend_match.group(1),
            f"Vite proxy port {proxy_match.group(1)} != Rust backend port {backend_match.group(1)}",
            errors,
        )
    if vite_port_match:
        require(
            vite_port_match.group(1) == "9529",
            f"Vite UI port {vite_port_match.group(1)} != documented project port 9529",
            errors,
        )

    for path, heading, url_line in (
        (
            "README.md",
            "### Frontend dev mode (Vite, port 9529)",
            "Open **http://localhost:9529** — Vite proxies `/api` and `/ws` to the backend on `9527`.",
        ),
        (
            "README.zh-CN.md",
            "### 前端开发模式（Vite，端口 9529）",
            "打开 **http://localhost:9529** —— Vite 会自动将 `/api` 和 `/ws` 代理到 9527 端口的后端。",
        ),
    ):
        content = read(path)
        require(heading in content, f"{path} has an outdated Vite port heading", errors)
        require(url_line in content, f"{path} has an outdated Vite development URL", errors)
        require(
            "Workstation_Monitor_VERSION_aarch64.app.zip" in content
            and "Workstation_Monitor_VERSION_x64.app.zip" in content,
            f"{path} does not document the architecture-specific release asset names",
            errors,
        )

    readme_en = read("README.md")
    readme_zh = read("README.zh-CN.md")
    require(
        "| Node.js | 20.19+ or 22.12+" in readme_en,
        "README.md documents a Node.js version unsupported by Vite 8",
        errors,
    )
    require(
        "| Node.js | 20.19+ 或 22.12+" in readme_zh,
        "README.zh-CN.md documents a Node.js version unsupported by Vite 8",
        errors,
    )

    build_rs = read("build.rs")
    require(
        "cargo:rerun-if-changed=frontend/dist" not in build_rs,
        "build.rs watches frontend/dist even though it writes that directory",
        errors,
    )

    changelog = read("CHANGELOG.md")
    english_marker = "# Changelog (English)"
    require(english_marker in changelog, "CHANGELOG.md is missing its English section", errors)
    if english_marker in changelog:
        chinese, english = changelog.split(english_marker, 1)
        version_heading = re.compile(rf"^## \[{re.escape(cargo_version)}\] - \d{{4}}-\d{{2}}-\d{{2}}$", re.MULTILINE)
        require(
            version_heading.search(chinese) is not None,
            f"CHANGELOG.md Chinese section is missing {cargo_version}",
            errors,
        )
        require(
            version_heading.search(english) is not None,
            f"CHANGELOG.md English section is missing {cargo_version}",
            errors,
        )
        require(
            bool(extract_section(changelog, cargo_version)),
            f"changelog extractor cannot produce bilingual notes for {cargo_version}",
            errors,
        )

    ci_path = ROOT / ".github/workflows/ci.yml"
    require(ci_path.exists(), ".github/workflows/ci.yml quality gate is missing", errors)
    if ci_path.exists():
        ci_workflow = ci_path.read_text(encoding="utf-8")
        for command in (
            "python3 scripts/check_release_consistency.py",
            "npm run verify",
            "cargo test --locked",
            "cargo check --locked",
        ):
            require(command in ci_workflow, f"CI quality gate is missing `{command}`", errors)

    release_workflow = read(".github/workflows/release.yml")
    for token, description in (
        ("tag:", "a required manual release tag input"),
        (
            "test -f scripts/check_release_consistency.py",
            "an explicit guard for tags that predate the release tooling",
        ),
        ("python3 scripts/check_release_consistency.py --tag", "release version validation"),
        ("npm run verify", "frontend lint/build validation"),
        ("cargo test --locked", "locked Rust tests"),
        ("tag_name:", "an explicit release tag"),
    ):
        require(token in release_workflow, f"release workflow is missing {description}", errors)

    build_all = read("scripts/build_all_mac.sh")
    require(
        build_all.count("cargo build --locked --release --target") == 2,
        "multi-architecture builds do not enforce Cargo.lock",
        errors,
    )

    if errors:
        print("release consistency check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"release consistency check passed for v{cargo_version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
