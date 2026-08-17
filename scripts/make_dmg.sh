#!/usr/bin/env bash
# Build "Workstation Monitor.dmg" from the cargo-bundle .app output.
#
# Why ditto instead of cp/zip: ditto preserves extended attributes, resource
# forks and file permissions of the .app bundle. A corrupted/missing icon after
# copying to another Mac is almost always caused by (a) icon cache, or
# (b) metadata loss during packaging — this script rules out (b).
#
# Usage:
#   cargo bundle --release
#   ./scripts/make_dmg.sh
#
# Output: target/release/bundle/osx/Workstation Monitor.dmg
set -euo pipefail

cd "$(dirname "$0")/.."

APP_SRC="target/release/bundle/osx/Workstation Monitor.app"
APP_NAME="Workstation Monitor"
STAGING="target/dmg-staging"
DMG_OUT="target/release/bundle/osx/${APP_NAME}.dmg"

if [[ ! -d "$APP_SRC" ]]; then
  echo "error: $APP_SRC not found. Build it first:" >&2
  echo "  cargo bundle --release" >&2
  exit 1
fi

if [[ ! -f "$APP_SRC/Contents/Info.plist" ]]; then
  echo "error: $APP_SRC/Contents/Info.plist missing — not a valid .app bundle" >&2
  exit 1
fi

if [[ ! -f "$APP_SRC/Contents/Resources/icon.icns" ]]; then
  echo "error: $APP_SRC/Contents/Resources/icon.icns missing — the app has no icon" >&2
  exit 1
fi

echo "==> Staging .app with ditto (preserves metadata)..."
rm -rf "$STAGING"
mkdir -p "$STAGING"
ditto "$APP_SRC" "$STAGING/${APP_NAME}.app"

# Set DMG volume icon
if [[ -f "assets/icon.icns" ]]; then
  cp "assets/icon.icns" "$STAGING/.VolumeIcon.icns"
  if command -v SetFile &>/dev/null; then
    SetFile -c icnC "$STAGING/.VolumeIcon.icns" 2>/dev/null || true
    SetFile -a C "$STAGING" 2>/dev/null || true
    SetFile -a B "$STAGING/${APP_NAME}.app" 2>/dev/null || true
  fi
fi

# Touch app bundle so LaunchServices parses icon timestamp cleanly
touch "$STAGING/${APP_NAME}.app"

echo "==> Adding /Applications symlink for drag-to-install..."
ln -s /Applications "$STAGING/Applications"

echo "==> Verifying staged bundle..."
plutil -lint "$STAGING/${APP_NAME}.app/Contents/Info.plist" >/dev/null
test -f "$STAGING/${APP_NAME}.app/Contents/Resources/icon.icns" \
  && echo "    icon.icns OK ($(stat -f %z "$STAGING/${APP_NAME}.app/Contents/Resources/icon.icns") bytes)"

echo "==> Creating compressed DMG..."
rm -f "$DMG_OUT"
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$STAGING" \
  -ov \
  -format UDZO \
  "$DMG_OUT" >/dev/null

rm -rf "$STAGING"

echo "==> Done: $DMG_OUT"
echo "    Copy this .dmg to other Macs. Drag the app into /Applications."
echo "    If Finder still shows a generic icon after copying, run 'killall Finder' on that Mac."
