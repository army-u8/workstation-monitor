#!/usr/bin/env bash
set -e

# VibeDesk (Workstation Monitor) One-Line Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/army-u8/workstation-monitor/main/scripts/install.sh | bash

REPO="army-u8/workstation-monitor"
VERSION="0.3.0"

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "  █░█ █ █▄▄ █▀▀ █▀▄ █▀▀ █▀ █▄▀"
echo "  ▀▄▀ █ █▄█ ██▄ █▄▀ ██▄ ▄█ █ █  v${VERSION}"
echo "  macOS Workstation Mission Control & AI Coding Cockpit"
echo -e "${NC}"

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin)
    case "$ARCH" in
      arm64) ASSET="workstation-monitor-aarch64-apple-darwin" ;;
      x86_64) ASSET="workstation-monitor-x86_64-apple-darwin" ;;
      *) echo -e "${RED}Unsupported macOS architecture: $ARCH${NC}"; exit 1 ;;
    esac
    ;;
  Linux)
    case "$ARCH" in
      aarch64|arm64) ASSET="workstation-monitor-aarch64-unknown-linux-gnu" ;;
      x86_64) ASSET="workstation-monitor-x86_64-unknown-linux-gnu" ;;
      *) echo -e "${RED}Unsupported Linux architecture: $ARCH${NC}"; exit 1 ;;
    esac
    ;;
  *)
    echo -e "${RED}Unsupported operating system: $OS${NC}"
    exit 1
    ;;
esac

# Determine installation directory
if [ -w "/usr/local/bin" ]; then
  INSTALL_DIR="/usr/local/bin"
elif [ -d "$HOME/.local/bin" ]; then
  INSTALL_DIR="$HOME/.local/bin"
elif [ -d "$HOME/bin" ]; then
  INSTALL_DIR="$HOME/bin"
else
  INSTALL_DIR="$HOME/.local/bin"
  mkdir -p "$INSTALL_DIR"
fi

TARGET="$INSTALL_DIR/vibedesk"
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/v${VERSION}/${ASSET}"
MIRROR_URL="https://ghproxy.net/${DOWNLOAD_URL}"

echo -e "⬇️  Downloading VibeDesk binary for ${GREEN}${OS}-${ARCH}${NC}..."
if curl -fsSL "$DOWNLOAD_URL" -o "$TARGET" 2>/dev/null; then
  echo -e "${GREEN}✓ Download complete from GitHub.${NC}"
elif curl -fsSL "$MIRROR_URL" -o "$TARGET" 2>/dev/null; then
  echo -e "${GREEN}✓ Download complete via mirror CDN.${NC}"
else
  echo -e "${RED}Failed to download binary from $DOWNLOAD_URL${NC}"
  exit 1
fi

chmod +x "$TARGET"
ln -sf "$TARGET" "$INSTALL_DIR/workstation-monitor" 2>/dev/null || true

echo -e "\n${GREEN}🎉 VibeDesk v${VERSION} installed successfully to ${CYAN}${TARGET}${NC}!"

# Check if INSTALL_DIR is in PATH
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    echo -e "${YELLOW}⚠️  Note: $INSTALL_DIR is not currently in your PATH.${NC}"
    echo -e "   Add it by running: export PATH=\"$INSTALL_DIR:\$PATH\""
    ;;
esac

echo -e "\n${CYAN}To launch the dashboard, simply run:${NC}"
echo -e "  ${GREEN}vibedesk${NC}\n"
