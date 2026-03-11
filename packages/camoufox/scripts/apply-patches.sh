#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAMOUFOX_DIR="$SCRIPT_DIR/../upstream"
PATCHES_DIR="$SCRIPT_DIR/../patches"
ADDITIONS_DIR="$SCRIPT_DIR/../additions"

# Find the Firefox source directory (created by `make dir`)
FIREFOX_SRC=$(find "$CAMOUFOX_DIR" -maxdepth 1 -type d -name "camoufox-*" | head -1)

if [ -z "$FIREFOX_SRC" ]; then
    echo "Error: Firefox source directory not found."
    echo "Run 'cd upstream && make dir' first."
    exit 1
fi

echo "Firefox source: $FIREFOX_SRC"

# Step 1: Copy our additions on top of Camoufox's
if [ -d "$ADDITIONS_DIR" ]; then
    echo ""
    echo "=== Copying BrowserOS additions ==="
    cp -rv "$ADDITIONS_DIR/"* "$FIREFOX_SRC/"
    echo "Done copying additions."
fi

# Step 2: Apply patches
echo ""
echo "=== Applying BrowserOS patches ==="

apply_patch() {
    local patch_file="$1"
    local patch_name
    patch_name=$(basename "$patch_file")

    echo "  Applying: $patch_name"
    cd "$FIREFOX_SRC" && patch -p1 --forward -l --binary -i "$patch_file" || {
        # Check for .rej files
        local rejects
        rejects=$(find "$FIREFOX_SRC" -name "*.rej" 2>/dev/null)
        if [ -n "$rejects" ]; then
            echo "  Error: Patch $patch_name had rejects:"
            echo "$rejects"
            return 1
        fi
        # patch may return non-zero if already applied
        echo "  Warning: $patch_name may already be applied"
    }
}

# Only apply actual .patch files that have diff content
PATCH_FILES=(
    "ui/profile-badge.patch"
)

applied=0
skipped=0

for patch_rel in "${PATCH_FILES[@]}"; do
    patch_file="$PATCHES_DIR/$patch_rel"
    if [ -f "$patch_file" ]; then
        # Check if it starts with "diff" (real patch) or "#" (documentation)
        first_char=$(head -c 1 "$patch_file")
        if [ "$first_char" = "d" ]; then
            apply_patch "$patch_file"
            ((applied++))
        else
            echo "  Skipping documentation: $patch_rel"
            ((skipped++))
        fi
    else
        echo "  Patch not found: $patch_rel"
        ((skipped++))
    fi
done

echo ""
echo "Done. Applied: $applied, Skipped: $skipped"
