#!/usr/bin/env bash
set -euo pipefail

# Rebase a single Camoufox patch for the Zen Browser (Firefox 148) engine.
#
# Usage:
#   ./scripts/rebase-patch.sh <camoufox-patch> [phase]
#
# Example:
#   ./scripts/rebase-patch.sh screen-hijacker.patch phase1
#
# This script:
# 1. Copies the patch from camoufox upstream
# 2. Attempts a dry-run apply on the Zen engine
# 3. If it fails, shows the .rej files for manual fixing
# 4. After manual fix, can regenerate the patch with --export

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZEN_DIR="$SCRIPT_DIR/.."
ENGINE_DIR="$ZEN_DIR/upstream/engine"
CAMOUFOX_PATCHES="$ZEN_DIR/../camoufox/upstream/patches"

PATCH_NAME="${1:-}"
PHASE="${2:-phase1}"

if [ -z "$PATCH_NAME" ]; then
    echo "Usage: $0 <patch-name> [phase]"
    echo ""
    echo "Available camoufox patches:"
    ls "$CAMOUFOX_PATCHES"/*.patch 2>/dev/null | xargs -I{} basename {} | sort
    exit 1
fi

CAMOUFOX_PATCH="$CAMOUFOX_PATCHES/$PATCH_NAME"
TARGET_PATCH="$ZEN_DIR/patches/$PHASE/$PATCH_NAME"

if [ ! -f "$CAMOUFOX_PATCH" ]; then
    echo "Error: Patch not found: $CAMOUFOX_PATCH"
    exit 1
fi

if [ ! -d "$ENGINE_DIR" ]; then
    echo "Error: Engine directory not found: $ENGINE_DIR"
    echo "Run 'make init' first."
    exit 1
fi

echo "=== Rebase Patch ==="
echo "Source: $CAMOUFOX_PATCH"
echo "Target: $TARGET_PATCH"
echo "Engine: $ENGINE_DIR"
echo ""

# Copy to target location
mkdir -p "$(dirname "$TARGET_PATCH")"
cp "$CAMOUFOX_PATCH" "$TARGET_PATCH"

# Try dry run
echo "--- Dry run ---"
cd "$ENGINE_DIR"

if patch -p1 --dry-run --forward -l --binary -i "$TARGET_PATCH" 2>&1; then
    echo ""
    echo "Patch applies cleanly! No rebase needed."
    echo "Saved to: $TARGET_PATCH"
else
    echo ""
    echo "--- Patch needs rebase ---"
    echo ""
    echo "To manually fix:"
    echo "  1. Apply with rejects:  cd $ENGINE_DIR && patch -p1 --forward -l --binary -i $TARGET_PATCH"
    echo "  2. Fix each .rej file by editing the target source file"
    echo "  3. Remove .rej files:   find $ENGINE_DIR -name '*.rej' -delete"
    echo "  4. Regenerate patch:    cd $ENGINE_DIR && git diff > $TARGET_PATCH"
    echo ""
    echo "Or use Zen's export: cd $ZEN_DIR/upstream && npm run export <path>"
fi
