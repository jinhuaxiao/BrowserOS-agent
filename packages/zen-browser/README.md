# Zen Browser + Camoufox Fingerprint Engine

Zen Browser's modern UI (sidebar tabs, compact mode, Web Panel) combined with Camoufox's C++ fingerprint spoofing engine.

## Prerequisites

- macOS with Xcode (`sudo xcode-select --switch /Applications/Xcode.app`)
- Node.js 21+
- Python 3
- Rust + Cargo
- sccache
- 30GB free disk space

## Quick Start

```bash
# 1. Clone Zen Browser and download Firefox source (~30min)
make clone
make init

# 2. Copy fingerprint engine additions
make copy-additions

# 3. Apply fingerprint patches (by phase)
make apply-phase1   # screen, timezone, geolocation, etc.
make apply-phase2   # chromeutil, browser-init, locale, audio, etc.
make apply-phase3   # fingerprint-injection, webgl, anti-font, webrtc

# 4. Build
make build

# 5. Run
make run

# Or run with a test fingerprint profile
make run-profile
```

## Patch Phases

| Phase | Patches | Target |
|-------|---------|--------|
| Phase 1 | 8 simple patches (screen, timezone, geolocation, shadow-root, pointer, css-anim, stylesheets) | BrowserScan ~55-60% |
| Phase 2 | 7 medium patches (chromeutil, browser-init, locale, audio, voice, media-device, font) | BrowserScan ~70-75% |
| Phase 3 | 4 hard patches (fingerprint-injection, webgl, anti-font-fingerprinting, webrtc) | BrowserScan 85%+ |
| BrowserOS | Custom patches (profile badge, branding) | UI integration |

## Rebasing Patches

Patches originate from Camoufox (Firefox 146) and must be rebased for Zen's Firefox 148 engine:

```bash
# Try rebasing a single patch
./scripts/rebase-patch.sh screen-hijacker.patch phase1

# If it applies cleanly, done. If not, fix manually and regenerate.
```

## Generate Fingerprint Config

```bash
python3 scripts/generate-config.py \
    --profile-name "shop01" \
    --profile-color "#4CAF50" \
    --proxy-ip "203.0.113.42" \
    --country "US"
```
