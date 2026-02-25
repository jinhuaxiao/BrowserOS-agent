# BrowserOS Fingerprint Customization

This document describes the kernel-level browser fingerprint customization system in BrowserOS.

## Overview

BrowserOS provides kernel-level fingerprint spoofing that is more robust than JavaScript-based injection. By modifying Chromium's source code, the fingerprint values are returned directly from the browser's native APIs, making them harder to detect.

## Architecture

### Kernel-Level Patches

The fingerprint customization is implemented through patches to Chromium source code:

```
chromium_patches/
├── content/renderer/renderer_main.cc               # Config load (renderer init)
├── third_party/blink/common/fingerprint/           # Config parser
│   ├── fingerprint_config.h
│   └── fingerprint_config.cc
├── third_party/blink/renderer/core/frame/          # Navigator/Screen/DPR
│   ├── navigator.cc
│   ├── navigator_base.cc
│   ├── navigator_device_memory.cc
│   ├── screen.cc
│   └── local_dom_window.cc
├── components/embedder_support/                    # UA-CH network headers
│   └── user_agent_utils.cc
├── third_party/blink/renderer/modules/webgl/       # WebGL vendor/renderer
│   └── webgl_rendering_context_base.cc
├── third_party/blink/renderer/modules/canvas/      # Canvas noise
│   └── canvas2d/base_rendering_context_2d.cc
├── third_party/blink/renderer/modules/webaudio/    # Audio noise
│   ├── audio_buffer.cc
│   └── audio_buffer.h
├── third_party/blink/renderer/modules/plugins/     # Plugins / MimeTypes
│   └── dom_plugin_array.cc
└── third_party/blink/renderer/platform/fonts/      # Font allowlist
    └── font_cache.cc
```

### Configuration Loading

The patches read configuration from a file specified by the `BROWSEROS_FINGERPRINT_CONFIG` environment variable or `--fingerprint-config` command line flag.

On sandboxed renderers (notably macOS), BrowserOS forwards the config content to
renderer processes via `--fingerprint-config-base64` (auto-generated from the
file/env in the browser process). This avoids renderer filesystem access. You
can also pass `--fingerprint-config-base64` directly to skip file reads.

Configuration format (auto-detected):

- **JSON** (browseragent `fingerprint.json` format, preferred)
- **key=value** (legacy/compact kernel config)

JSON example (partial):

```json
{
  "mediaDevices": {
    "devices": [
      {
        "kind": "audioinput",
        "deviceId": "mic-1",
        "label": "Microphone (Realtek(R) Audio)",
        "groupId": "audio-group"
      },
      {
        "kind": "videoinput",
        "deviceId": "cam-1",
        "label": "Integrated Camera",
        "groupId": "video-group"
      }
    ]
  },
  "plugins": {
    "items": [
      {
        "name": "Chrome PDF Viewer",
        "description": "Portable Document Format",
        "filename": "internal-pdf-viewer",
        "mimeTypes": [
          {
            "type": "application/pdf",
            "description": "Portable Document Format",
            "suffixes": "pdf"
          }
        ]
      }
    ]
  },
  "fonts": {
    "blockFontEnumeration": true,
    "enabledFonts": ["Arial", "Helvetica", "Times New Roman"]
  }
}
```

```ini
# Navigator
user_agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.6367.91 Safari/537.36
vendor=Google Inc.
hardware_concurrency=8
device_memory=8
platform=Win32
language=en-US
languages=en-US,en
accept_language=en-US,en;q=0.9

# Screen
screen_width=1920
screen_height=1080
screen_avail_width=1920
screen_avail_height=1040
screen_color_depth=24
screen_pixel_depth=24
device_pixel_ratio=1

# WebGL
webgl_vendor=Google Inc. (Intel)
webgl_renderer=ANGLE (Intel, Intel(R) UHD Graphics Direct3D11)
webgl_unmasked_vendor=Google Inc. (Intel)
webgl_unmasked_renderer=ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)

# Canvas noise
canvas_noise_enabled=true
canvas_noise_level=0.001
canvas_session_seed=1234567890

# Audio noise
audio_noise_enabled=true
audio_noise_level=0.0001
audio_session_seed=1234567890

# WebRTC
webrtc_disabled=false
webrtc_public_ip=203.0.113.10
webrtc_local_ip=192.168.1.10

# Fonts
block_font_enumeration=true
fonts_enabled=Arial,Helvetica,Times New Roman,Times,Georgia,Verdana
```

## Spoofed APIs

### Navigator API

| Property | Description |
|----------|-------------|
| `navigator.hardwareConcurrency` | Number of CPU cores |
| `navigator.deviceMemory` | Device RAM in GB |
| `navigator.platform` | Platform string (Win32, MacIntel, Linux x86_64) |
| `navigator.userAgent` | User Agent string |
| `navigator.vendor` | Vendor string (Google Inc.) |
| `navigator.language` | Primary language |
| `navigator.languages` | Language list |
| `navigator.userAgentData` | UA-CH metadata derived from User-Agent |
| `navigator.webdriver` | Always returns `false` |

### HTTP Client Hints (UA-CH)

When fingerprint config is enabled, BrowserOS aligns network-level
`Sec-CH-UA*` headers with the configured User-Agent to avoid JS/HTTP
inconsistencies.

### Screen API

| Property | Description |
|----------|-------------|
| `screen.width` | Screen width in pixels |
| `screen.height` | Screen height in pixels |
| `screen.availWidth` | Available screen width |
| `screen.availHeight` | Available screen height |
| `screen.colorDepth` | Color depth (typically 24) |
| `screen.pixelDepth` | Pixel depth (typically 24) |

### WebGL API

| Property | Description |
|----------|-------------|
| `GL_VENDOR` | WebGL vendor string |
| `GL_RENDERER` | WebGL renderer string |
| `UNMASKED_VENDOR_WEBGL` | Unmasked vendor (via debug extension) |
| `UNMASKED_RENDERER_WEBGL` | Unmasked renderer (via debug extension) |

### Canvas Fingerprint Protection

Canvas fingerprinting is mitigated by adding subtle, deterministic noise to canvas pixel data. The noise is:

- Consistent within a session (same seed)
- Different across sessions (unique seed per profile)
- Subtle enough to not affect visual appearance

### AudioContext Fingerprint Protection

Similar to canvas, audio fingerprinting is mitigated by adding subtle noise to audio buffers.

### WebRTC

WebRTC can be disabled entirely, or have candidate IPs rewritten to match
profile-specific public/local IPs for consistency.

### MediaDevices

`navigator.mediaDevices.enumerateDevices()` can be overridden with a
profile-specific device list. Labels, deviceId, and groupId are masked if
permissions are not granted to match normal browser behavior.

### Plugins / MimeTypes

`navigator.plugins` and `navigator.mimeTypes` are generated from the configured
plugin list. This lets you control PDF viewer presence and align plugin surfaces
with the profile.

### Fonts

Font enumeration is controlled via an allowlist. When enabled, calls such as
`document.fonts.check()` and platform font availability checks only return
`true` for the configured fonts. This helps prevent detection via system font
probing and keeps font surfaces consistent across APIs.

### TLS Fingerprint (JA3/JA4)

TLS fingerprinting is mitigated by allowing customization of:

- Cipher suite ordering
- TLS extension ordering
- Supported groups
- EC point formats

Supported profiles: `chrome`, `firefox`, `safari`

Set via environment variable:
```bash
BROWSEROS_TLS_PROFILE=firefox
```

## Integration with browseragent

The `browseragent` project integrates with BrowserOS through:

1. **Profile Generation**: `fingerprint-generator.ts` generates fingerprint configurations
2. **Config Conversion**: `browseros-config.ts` converts to BrowserOS kernel format
3. **Launch Integration**: `launcher.ts` writes config and sets environment variables

Example usage:

```typescript
import { generateFingerprint } from './fingerprint-generator';
import { writeBrowserOSConfig } from './browseros-config';
import { launchBrowser } from './launcher';

// Generate fingerprint
const fingerprint = generateFingerprint({
  profileId: 'my-profile',
  targetPlatform: 'windows',
});

// Launch with kernel-level spoofing
const result = await launchBrowser({
  id: 'my-profile',
  fingerprint,
  userDataDir: '/path/to/profile',
});
```

## Building with Fingerprint Patches

1. Apply patches during build:
   ```bash
   cd packages/browseros
   python -m build.browseros build --prep --build
   ```

2. The fingerprint feature is enabled in `features.yaml`:
   ```yaml
   fingerprint-protection:
     description: "feat: kernel-level browser fingerprint protection"
     files:
       - third_party/blink/renderer/core/frame/navigator_fingerprint.cc
       - third_party/blink/renderer/core/frame/screen_fingerprint.cc
       - ...
   ```

## Verification

Test your fingerprint configuration at:

- https://browserleaks.com/
- https://fingerprintjs.com/
- https://coveryourtracks.eff.org/
- https://ja3er.com/ (TLS fingerprint)

## Security Considerations

1. **Consistency**: Always use the same fingerprint for a profile to avoid detection
2. **Plausibility**: Use realistic values that match actual hardware configurations
3. **Correlation**: Ensure timezone, language, and other settings match the fingerprint
4. **Updates**: Regularly update WebGL renderer strings to match current hardware
