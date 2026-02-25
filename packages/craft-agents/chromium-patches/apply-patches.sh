#!/bin/bash
#
# Nova Seller Browser - Chromium Patch Application Script
#
# This script applies all Nova Seller patches to a Chromium source tree.
#
# Usage:
#   ./apply-patches.sh [chromium_src_dir]
#
# Default chromium_src_dir: /Users/xiaojinhua/chromium/src
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHROMIUM_SRC="${1:-/Users/xiaojinhua/chromium/src}"

echo "Nova Seller Browser - Patch Application"
echo "========================================"
echo "Patches directory: $SCRIPT_DIR"
echo "Chromium source:   $CHROMIUM_SRC"
echo ""

# Verify Chromium source directory exists
if [ ! -d "$CHROMIUM_SRC" ]; then
    echo "Error: Chromium source directory not found: $CHROMIUM_SRC"
    echo "Usage: $0 [chromium_src_dir]"
    exit 1
fi

# Verify it's a Chromium source tree
if [ ! -f "$CHROMIUM_SRC/chrome/browser/BUILD.gn" ]; then
    echo "Error: Directory doesn't appear to be a Chromium source tree"
    exit 1
fi

cd "$CHROMIUM_SRC"

echo "Step 1: Copying new files..."
echo "-----------------------------"

# Create directories if needed
mkdir -p chrome/browser/ui/views/location_bar
mkdir -p third_party/blink/renderer/core/frame

# Copy ProfileBadgeView files
echo "  Copying profile_badge_view.h..."
cp "$SCRIPT_DIR/chrome/browser/ui/views/location_bar/profile_badge_view.h" \
   chrome/browser/ui/views/location_bar/

echo "  Copying profile_badge_view.cc..."
cp "$SCRIPT_DIR/chrome/browser/ui/views/location_bar/profile_badge_view.cc" \
   chrome/browser/ui/views/location_bar/

# Copy FingerprintConfig files
echo "  Copying fingerprint_config.h..."
cp "$SCRIPT_DIR/third_party/blink/renderer/core/frame/fingerprint_config.h" \
   third_party/blink/renderer/core/frame/

echo "  Copying fingerprint_config.cc..."
cp "$SCRIPT_DIR/third_party/blink/renderer/core/frame/fingerprint_config.cc" \
   third_party/blink/renderer/core/frame/

echo ""
echo "Step 2: Applying patches..."
echo "---------------------------"

apply_patch() {
    local patch_file="$1"
    local description="$2"

    if [ -f "$SCRIPT_DIR/$patch_file" ]; then
        echo "  Applying: $description"
        if patch -p1 --forward --dry-run < "$SCRIPT_DIR/$patch_file" > /dev/null 2>&1; then
            patch -p1 --forward < "$SCRIPT_DIR/$patch_file"
        else
            echo "    Warning: Patch may already be applied or needs manual adjustment"
            echo "    Trying with --ignore-whitespace..."
            patch -p1 --forward --ignore-whitespace < "$SCRIPT_DIR/$patch_file" || true
        fi
    else
        echo "  Warning: Patch file not found: $patch_file"
    fi
}

# Location bar patches
apply_patch "chrome/browser/ui/views/location_bar/location_bar_view.h.patch" \
    "LocationBarView header"

apply_patch "chrome/browser/ui/views/location_bar/location_bar_view.cc.patch" \
    "LocationBarView implementation"

apply_patch "chrome/browser/ui/views/location_bar/BUILD.gn.patch" \
    "Location bar BUILD.gn"

# Blink frame patches
apply_patch "third_party/blink/renderer/core/frame/navigator.cc.patch" \
    "Navigator spoofing"

apply_patch "third_party/blink/renderer/core/frame/navigator_base.cc.patch" \
    "NavigatorBase (hardwareConcurrency)"

apply_patch "third_party/blink/renderer/core/frame/navigator_device_memory.cc.patch" \
    "NavigatorDeviceMemory"

apply_patch "third_party/blink/renderer/core/frame/screen.cc.patch" \
    "Screen properties spoofing"

apply_patch "third_party/blink/renderer/core/frame/BUILD.gn.patch" \
    "Blink frame BUILD.gn"

# WebGL patches
apply_patch "third_party/blink/renderer/modules/webgl/webgl_rendering_context_base.cc.patch" \
    "WebGL vendor/renderer"

apply_patch "third_party/blink/renderer/modules/webgl/webgl_debug_renderer_info.cc.patch" \
    "WebGL unmasked vendor/renderer"

echo ""
echo "Step 3: Verification..."
echo "-----------------------"

# Check if key files exist
check_file() {
    if [ -f "$1" ]; then
        echo "  ✓ $1"
    else
        echo "  ✗ $1 (missing)"
    fi
}

echo "Checking new files:"
check_file "chrome/browser/ui/views/location_bar/profile_badge_view.h"
check_file "chrome/browser/ui/views/location_bar/profile_badge_view.cc"
check_file "third_party/blink/renderer/core/frame/fingerprint_config.h"
check_file "third_party/blink/renderer/core/frame/fingerprint_config.cc"

echo ""
echo "========================================"
echo "Patch application complete!"
echo ""
echo "Next steps:"
echo "  1. Configure build:  gn gen out/Release --args='...'"
echo "  2. Compile:          autoninja -C out/Release chrome"
echo ""
echo "For macOS app bundle:"
echo "  autoninja -C out/Release chrome/installer/mac"
echo ""
