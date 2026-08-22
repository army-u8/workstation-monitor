# Node 24 GitHub Actions Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate Node 20 GitHub Actions while preserving CI and release behavior.

**Architecture:** Checkout runs through `actions/checkout@v5`; release creation and asset upload run through the official preinstalled GitHub CLI. The repository's release consistency checker enforces both invariants.

**Tech Stack:** GitHub Actions, actions/checkout v5, GitHub CLI, Python release validation.

---

### Task 1: Add red-capable workflow checks

- Modify `scripts/check_release_consistency.py` to reject checkout v4 and softprops release actions.
- Require checkout v5 and the `gh release create` command.
- Run the checker and confirm it fails against the current workflows.

### Task 2: Migrate the workflows

- Upgrade checkout in `.github/workflows/ci.yml` and `.github/workflows/release.yml`.
- Replace the release action step with authenticated `gh release create` using the existing tag, notes file, generated notes, and asset glob.
- Run the checker and confirm it passes.

### Task 3: Verify and integrate

- Run frontend verification, locked Rust tests, shell/YAML checks, and `git diff --check`.
- Commit and push the changes.
- Confirm the pushed Quality Gates workflow succeeds without Node 20 annotations.

