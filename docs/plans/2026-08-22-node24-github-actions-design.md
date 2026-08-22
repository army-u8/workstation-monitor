# Node 24 GitHub Actions Migration Design

## Goal

Remove GitHub Actions Node 20 deprecation warnings without changing release behavior.

## Design

- Upgrade `actions/checkout` from v4 to v5 in CI and release workflows. Checkout v5 declares the Node 24 action runtime.
- Remove `softprops/action-gh-release@v2`, which still declares the Node 20 runtime.
- Use the GitHub-hosted runner's authenticated `gh release create` command to create the release, prepend `release_body.md`, generate GitHub notes, verify the existing remote tag, and upload every file in `target/release-assets/`.
- Keep `contents: write`, release tag validation, draft/prerelease behavior, and asset names unchanged.
- Extend the release consistency checker to reject known Node 20 action references and require the official CLI release command.

## Verification

- Run the release consistency checker and YAML syntax inspection.
- Run frontend verification and locked Rust tests.
- Push `main` and confirm the Quality Gates workflow succeeds without Node 20 annotations.

