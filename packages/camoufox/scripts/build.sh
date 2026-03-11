#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAMOUFOX_DIR="$SCRIPT_DIR/.."

echo "=== Camoufox Build Pipeline ==="
echo ""

cd "$CAMOUFOX_DIR"

# Step 1: Clone upstream if needed
if [ ! -d "upstream" ]; then
    echo "[1/5] Cloning Camoufox upstream..."
    make clone
else
    echo "[1/5] Upstream exists, skipping clone."
fi

# Step 2: Fetch Firefox source and bootstrap (first time)
if [ ! -d upstream/camoufox-* ] 2>/dev/null; then
    echo "[2/5] Setting up build environment (first time)..."
    make setup
else
    echo "[2/5] Build environment ready, skipping setup."
fi

# Step 3: Apply patches
echo "[3/5] Applying patches..."
make apply-patches

# Step 4: Build
echo "[4/5] Building Firefox..."
make rebuild

# Step 5: Package
echo "[5/5] Packaging for macOS..."
make package

echo ""
echo "=== Build complete! ==="
echo "Run 'make run' to launch the browser."
