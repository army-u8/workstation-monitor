#!/usr/bin/env bash
# Build complete multi-architecture macOS release assets:
# 1. Apple Silicon (aarch64 / arm64) DMG, zip & tar.gz
# 2. Intel Mac (x86_64 / x64) DMG, zip & tar.gz
# 3. Universal 2 (Fat binary: arm64 + x86_64) DMG, zip & tar.gz
# 4. SHA256 checksums file (SHA256SUMS.txt)
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

VERSION=$(grep '^version = ' Cargo.toml | head -1 | cut -d '"' -f 2)
APP_NAME="Workstation Monitor"
SLUG_NAME="Workstation_Monitor_${VERSION}"
DIST_DIR="${PROJECT_ROOT}/target/release-assets"

echo "========================================================="
echo " Building multi-architecture macOS releases for v${VERSION}"
echo "========================================================="

# 1. Clean & Prepare output directory
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# 2. Ensure frontend deps & build UI
echo "==> [1/6] Building embedded frontend..."
if [ ! -d "frontend/node_modules" ]; then
  echo "    Installing frontend dependencies (bun install --frozen-lockfile)..."
  (cd frontend && bun install --frozen-lockfile)
fi
(cd frontend && bun run build)
export SKIP_FRONTEND_BUILD=1

# 3. Ensure Icon is 100% compliant
echo "==> [2/6] Verifying icon assets..."
python3 scripts/gen_icon.py

# 4. Compile Rust Targets
echo "==> [3/6] Compiling for Apple Silicon (aarch64-apple-darwin)..."
cargo build --locked --release --target aarch64-apple-darwin

echo "==> [4/6] Compiling for Intel Mac (x86_64-apple-darwin)..."
cargo build --locked --release --target x86_64-apple-darwin

echo "==> [5/6] Creating Universal 2 (Fat) binary with lipo..."
mkdir -p target/universal-apple-darwin/release
lipo -create \
  target/x86_64-apple-darwin/release/workstation-monitor \
  target/aarch64-apple-darwin/release/workstation-monitor \
  -output target/universal-apple-darwin/release/workstation-monitor

# 5. Helper function to package .app, .zip, and .dmg for a target architecture
package_arch() {
  local ARCH_KEY="$1"       # "aarch64", "x64", or "universal"
  local BIN_PATH="$2"       # path to binary
  local ARCH_TITLE="$3"

  echo "---------------------------------------------------------"
  echo " Packaging for ${ARCH_TITLE} (${ARCH_KEY})..."
  echo "---------------------------------------------------------"

  local STAGE_DIR="target/stage_${ARCH_KEY}"
  rm -rf "$STAGE_DIR"
  mkdir -p "${STAGE_DIR}/${APP_NAME}.app/Contents/MacOS"
  mkdir -p "${STAGE_DIR}/${APP_NAME}.app/Contents/Resources"

  # Copy compiled binary & make executable
  cp "$BIN_PATH" "${STAGE_DIR}/${APP_NAME}.app/Contents/MacOS/workstation-monitor"
  chmod +x "${STAGE_DIR}/${APP_NAME}.app/Contents/MacOS/workstation-monitor"

  # Copy Icon
  cp assets/icon.icns "${STAGE_DIR}/${APP_NAME}.app/Contents/Resources/icon.icns"

  # Generate Info.plist
  cat <<EOF > "${STAGE_DIR}/${APP_NAME}.app/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>English</string>
  <key>CFBundleDisplayName</key>
  <string>${APP_NAME}</string>
  <key>CFBundleExecutable</key>
  <string>workstation-monitor</string>
  <key>CFBundleIconFile</key>
  <string>icon.icns</string>
  <key>CFBundleIdentifier</key>
  <string>com.armyu8.workstation-monitor</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${APP_NAME}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${VERSION}</string>
  <key>CFBundleVersion</key>
  <string>${VERSION}</string>
  <key>LSApplicationCategoryType</key>
  <string>public.app-category.utilities</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSHumanReadableCopyright</key>
  <string>Copyright (c) 2026 army-u8. All rights reserved.</string>
</dict>
</plist>
EOF

  touch "${STAGE_DIR}/${APP_NAME}.app"

  # A. Create metadata-preserving .app.zip archive (Apple ditto)
  local ZIP_OUT="${DIST_DIR}/${SLUG_NAME}_${ARCH_KEY}.app.zip"
  echo "  -> Generating ${SLUG_NAME}_${ARCH_KEY}.app.zip (preserves metadata)..."
  ditto -c -k --sequesterRsrc --keepParent "${STAGE_DIR}/${APP_NAME}.app" "$ZIP_OUT"

  # B. Create .app.tar.gz archive
  local TAR_OUT="${DIST_DIR}/${SLUG_NAME}_${ARCH_KEY}.app.tar.gz"
  echo "  -> Generating ${SLUG_NAME}_${ARCH_KEY}.app.tar.gz..."
  COPYFILE_DISABLE=0 tar -czf "$TAR_OUT" -C "$STAGE_DIR" "${APP_NAME}.app"

  # C. Create .dmg installer
  local DMG_STAGE="target/dmg_stage_${ARCH_KEY}"
  rm -rf "$DMG_STAGE"
  mkdir -p "$DMG_STAGE"
  ditto "${STAGE_DIR}/${APP_NAME}.app" "${DMG_STAGE}/${APP_NAME}.app"
  ln -s /Applications "${DMG_STAGE}/Applications"
  cp assets/icon.icns "${DMG_STAGE}/.VolumeIcon.icns"

  if command -v SetFile &>/dev/null; then
    SetFile -c icnC "${DMG_STAGE}/.VolumeIcon.icns" 2>/dev/null || true
    SetFile -a C "$DMG_STAGE" 2>/dev/null || true
    SetFile -a B "${DMG_STAGE}/${APP_NAME}.app" 2>/dev/null || true
  fi

  local DMG_OUT="${DIST_DIR}/${SLUG_NAME}_${ARCH_KEY}.dmg"
  echo "  -> Generating ${SLUG_NAME}_${ARCH_KEY}.dmg..."
  rm -f "$DMG_OUT"
  hdiutil create \
    -volname "$APP_NAME" \
    -srcfolder "$DMG_STAGE" \
    -ov \
    -format UDZO \
    "$DMG_OUT" >/dev/null

  rm -rf "$STAGE_DIR" "$DMG_STAGE"
}

# 6. Build packages for each architecture
package_arch "aarch64" "target/aarch64-apple-darwin/release/workstation-monitor" "Apple Silicon (M1/M2/M3/M4)"
package_arch "x64" "target/x86_64-apple-darwin/release/workstation-monitor" "Intel Mac (x86_64)"
package_arch "universal" "target/universal-apple-darwin/release/workstation-monitor" "Universal (Intel + Apple Silicon)"

# 7. Generate SHA-256 Checksums
echo "==> [6/6] Generating SHA256 checksums..."
(
  cd "$DIST_DIR"
  shasum -a 256 * > SHA256SUMS.txt
)

echo ""
echo "========================================================="
echo " ✨ All macOS Release Assets Successfully Generated! ✨"
echo "========================================================="
ls -lh "$DIST_DIR"
echo ""
echo "Checksums (SHA256):"
cat "${DIST_DIR}/SHA256SUMS.txt"
