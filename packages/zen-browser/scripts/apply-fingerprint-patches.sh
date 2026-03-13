#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZEN_DIR="$SCRIPT_DIR/.."
UPSTREAM_DIR="$ZEN_DIR/upstream"
PATCHES_DIR="$ZEN_DIR/patches"
ENGINE_DIR="$UPSTREAM_DIR/engine"

PHASE="${1:-}"

if [ -z "$PHASE" ]; then
    echo "Usage: $0 <phase>"
    echo "  phase1    - Simple patches (screen, timezone, geolocation, etc.)"
    echo "  phase2    - Medium patches (chromeutil, browser-init, locale, audio, etc.)"
    echo "  phase3    - Hard patches (fingerprint-injection, webgl, anti-font, webrtc)"
    echo "  browseros - BrowserOS custom patches (profile badge, etc.)"
    echo "  all       - Apply all phases in order"
    exit 1
fi

if [ ! -d "$ENGINE_DIR" ]; then
    echo "Error: engine/ not found at $ENGINE_DIR"
    echo "Run 'make init' first to download Firefox source."
    exit 1
fi

# Patch ordering per phase (using functions to avoid bash 4 associative arrays)
get_phase_patches() {
    case "$1" in
        phase1)
            echo "config.patch
screen-hijacker.patch
timezone-spoofing.patch
geolocation-spoofing.patch
shadow-root-bypass.patch
force-default-pointer.patch
no-css-animations.patch
global-style-sheets.patch"
            ;;
        phase2)
            echo "chromeutil.patch
browser-init.patch
locale-spoofing.patch
audio-context-spoofing.patch
voice-spoofing.patch
media-device-spoofing.patch
font-hijacker.patch"
            ;;
        phase3)
            echo "fingerprint-injection.patch
webgl-spoofing.patch
anti-font-fingerprinting.patch
webrtc-ip-spoofing.patch
clientrects-noise.patch
webgpu-spoofing.patch
navigator-main-thread.patch
apple-system-font.patch"
            ;;
        browseros)
            echo ""
            ;;
        *)
            echo ""
            ;;
    esac
}

apply_patch() {
    local patch_file="$1"
    local patch_name
    patch_name=$(basename "$patch_file")

    # Dry run first
    echo "  Testing: $patch_name"
    if ! (cd "$ENGINE_DIR" && patch -p1 --dry-run --forward -l --binary -i "$patch_file" > /dev/null 2>&1); then
        echo "  ⚠ Dry run failed for $patch_name, attempting with fuzz..."
        if ! (cd "$ENGINE_DIR" && patch -p1 --dry-run --forward -l --binary --fuzz=3 -i "$patch_file" > /dev/null 2>&1); then
            echo "  ✗ FAILED: $patch_name"
            echo "    Run: cd $ENGINE_DIR && patch -p1 --dry-run -i $patch_file"
            echo "    to see details, then fix manually."
            return 1
        fi
    fi

    # Apply for real
    echo "  Applying: $patch_name"
    (cd "$ENGINE_DIR" && patch -p1 --forward -l --binary -i "$patch_file") || {
        local rejects
        rejects=$(find "$ENGINE_DIR" -name "*.rej" -newer "$patch_file" 2>/dev/null || true)
        if [ -n "$rejects" ]; then
            echo "  ✗ Patch $patch_name had rejects:"
            echo "$rejects"
            return 1
        fi
        echo "  ⚠ $patch_name may already be applied"
    }

    return 0
}

apply_phase() {
    local phase="$1"
    local phase_dir="$PATCHES_DIR/$phase"
    local patches
    patches="$(get_phase_patches "$phase")"

    if [ ! -d "$phase_dir" ]; then
        echo "  No patches directory for $phase, skipping."
        return 0
    fi

    if [ -z "$patches" ]; then
        # If no explicit ordering, apply all .patch files sorted by name
        local found=0
        for patch_file in "$phase_dir"/*.patch; do
            [ -f "$patch_file" ] || continue
            apply_patch "$patch_file" || return 1
            found=$((found + 1))
        done
        if [ "$found" -eq 0 ]; then
            echo "  No patches found in $phase_dir"
        fi
        return 0
    fi

    local applied=0
    local failed=0

    while IFS= read -r patch_name; do
        # Skip empty lines
        [ -z "$patch_name" ] && continue
        patch_name=$(echo "$patch_name" | xargs)  # trim whitespace
        [ -z "$patch_name" ] && continue

        local patch_file="$phase_dir/$patch_name"
        if [ ! -f "$patch_file" ]; then
            echo "  ⚠ Patch not found: $patch_file"
            continue
        fi

        if apply_patch "$patch_file"; then
            applied=$((applied + 1))
        else
            failed=$((failed + 1))
        fi
    done <<< "$patches"

    echo ""
    echo "  Phase $phase: Applied=$applied, Failed=$failed"
    [ "$failed" -eq 0 ] || return 1
}

echo "=== Fingerprint Patch Applicator ==="
echo "Engine: $ENGINE_DIR"
echo ""

if [ "$PHASE" = "all" ]; then
    for p in phase1 phase2 phase3 browseros; do
        echo "--- $p ---"
        apply_phase "$p"
        echo ""
    done
else
    apply_phase "$PHASE"
fi

echo "Done."
