#!/usr/bin/env python3
"""
Generate fingerprint configuration for Camoufox browser.

Outputs JSON config compatible with Camoufox's CAMOU_CONFIG_* environment
variable system, including custom profile badge fields.

Usage:
    python generate-config.py --profile-name "amazon66" --profile-color "#4CAF50" \
        --proxy-ip "203.0.113.42" --country "US" --output config.json

    python generate-config.py --profile-name "shop01" --env  # Output as env vars
"""

import argparse
import hashlib
import json
import math
import os
import random
import sys

# Screen resolution presets by tier
SCREEN_RESOLUTIONS = {
    "low": [(1366, 768), (1280, 720), (1440, 900)],
    "mid": [(1920, 1080), (1680, 1050), (1600, 900)],
    "high": [(2560, 1440), (3840, 2160), (2560, 1600)],
}

# WebGL vendor/renderer pairs
WEBGL_PROFILES = [
    {"vendor": "Google Inc. (Intel)", "renderer": "ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.1)"},
    {"vendor": "Google Inc. (NVIDIA)", "renderer": "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Ti, OpenGL 4.1)"},
    {"vendor": "Google Inc. (AMD)", "renderer": "ANGLE (AMD, AMD Radeon Pro 5500M, OpenGL 4.1)"},
    {"vendor": "Google Inc. (Apple)", "renderer": "ANGLE (Apple, Apple M1, OpenGL 4.1)"},
    {"vendor": "Google Inc. (Apple)", "renderer": "ANGLE (Apple, Apple M2, OpenGL 4.1)"},
    {"vendor": "Google Inc. (Intel)", "renderer": "ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics, OpenGL 4.1)"},
]

# Firefox user agent templates
FIREFOX_VERSIONS = [128, 129, 130, 131, 132, 133]

PLATFORMS_UA = {
    "windows": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:{ver}.0) Gecko/20100101 Firefox/{ver}.0",
    "macos": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:{ver}.0) Gecko/20100101 Firefox/{ver}.0",
    "linux": "Mozilla/5.0 (X11; Linux x86_64; rv:{ver}.0) Gecko/20100101 Firefox/{ver}.0",
}

# Hardware memory options (capped at 8 per Web spec to avoid detection)
DEVICE_MEMORY_OPTIONS = [2, 4, 8]
HARDWARE_CONCURRENCY_OPTIONS = [2, 4, 8, 12, 16]


def stable_seed(profile_id: str, label: str = "") -> int:
    """Generate deterministic seed from profile ID using Blake2s."""
    data = f"{profile_id}:{label}".encode()
    h = hashlib.blake2s(data, digest_size=8)
    return int.from_bytes(h.digest(), "big")


def seeded_choice(options: list, seed: int) -> any:
    """Deterministically pick from a list given a seed."""
    return options[seed % len(options)]


def generate_firefox_ua(platform: str = "macos", seed: int = 0) -> str:
    """Generate a Firefox user agent string."""
    ver = seeded_choice(FIREFOX_VERSIONS, seed)
    template = PLATFORMS_UA.get(platform, PLATFORMS_UA["macos"])
    return template.format(ver=ver)


def generate_screen(tier: str = "mid", seed: int = 0) -> tuple[int, int]:
    """Pick a screen resolution for the given tier."""
    resolutions = SCREEN_RESOLUTIONS.get(tier, SCREEN_RESOLUTIONS["mid"])
    return seeded_choice(resolutions, seed)


def generate_webgl(seed: int = 0) -> dict:
    """Pick a WebGL vendor/renderer pair."""
    return seeded_choice(WEBGL_PROFILES, seed)


def generate_config(
    profile_name: str = "",
    profile_color: str = "#2196F3",
    proxy_ip: str = "",
    country: str = "",
    platform: str = "macos",
    profile_id: str = "",
    hardware_tier: str = "mid",
) -> dict:
    """Generate a complete Camoufox fingerprint config."""
    # Use profile_name as seed source if no explicit ID
    seed_source = profile_id or profile_name or "default"
    seed = stable_seed(seed_source)

    # Screen
    width, height = generate_screen(hardware_tier, stable_seed(seed_source, "screen"))

    # WebGL
    webgl = generate_webgl(stable_seed(seed_source, "webgl"))

    # Hardware
    device_memory = seeded_choice(DEVICE_MEMORY_OPTIONS, stable_seed(seed_source, "memory"))
    hw_concurrency = seeded_choice(HARDWARE_CONCURRENCY_OPTIONS, stable_seed(seed_source, "cpu"))

    config = {
        # Camoufox standard fingerprint fields
        "navigator.userAgent": generate_firefox_ua(platform, stable_seed(seed_source, "ua")),
        "navigator.platform": {
            "windows": "Win32",
            "macos": "MacIntel",
            "linux": "Linux x86_64",
        }.get(platform, "MacIntel"),
        "navigator.hardwareConcurrency": hw_concurrency,
        "navigator.deviceMemory": device_memory,
        "screen:width": width,
        "screen:height": height,
        "screen:availWidth": width,
        "screen:availHeight": height - 25,  # Account for OS taskbar
        "screen:colorDepth": 24,
        "webgl:vendor": webgl["vendor"],
        "webgl:renderer": webgl["renderer"],
    }

    # Profile badge fields (custom extension)
    if profile_name:
        config["profile.name"] = profile_name
    if profile_color:
        config["profile.color"] = profile_color
    if proxy_ip:
        config["profile.ip"] = proxy_ip
    if country:
        config["profile.country"] = country

    return config


def config_to_env_vars(config: dict) -> dict[str, str]:
    """
    Split config JSON into CAMOU_CONFIG_* environment variables.

    Camoufox reads config from env vars named CAMOU_CONFIG_0, CAMOU_CONFIG_1, etc.
    Each chunk is max 32000 bytes to avoid shell limits.
    """
    json_str = json.dumps(config)
    chunk_size = 32000
    env = {}
    for i in range(0, len(json_str), chunk_size):
        env[f"CAMOU_CONFIG_{i // chunk_size}"] = json_str[i : i + chunk_size]
    return env


def main():
    parser = argparse.ArgumentParser(description="Generate Camoufox fingerprint config")
    parser.add_argument("--profile-name", default="", help="Profile display name")
    parser.add_argument("--profile-color", default="#2196F3", help="Profile badge color (hex)")
    parser.add_argument("--proxy-ip", default="", help="Proxy IP address")
    parser.add_argument("--country", default="", help="Country code (e.g., US, JP)")
    parser.add_argument("--platform", default="macos", choices=["windows", "macos", "linux"])
    parser.add_argument("--profile-id", default="", help="Profile ID for deterministic seeding")
    parser.add_argument("--hardware-tier", default="mid", choices=["low", "mid", "high"])
    parser.add_argument("--output", "-o", default="", help="Output file path (default: stdout)")
    parser.add_argument("--env", action="store_true", help="Output as shell env var exports")

    args = parser.parse_args()

    config = generate_config(
        profile_name=args.profile_name,
        profile_color=args.profile_color,
        proxy_ip=args.proxy_ip,
        country=args.country,
        platform=args.platform,
        profile_id=args.profile_id,
        hardware_tier=args.hardware_tier,
    )

    if args.env:
        env_vars = config_to_env_vars(config)
        output = "\n".join(f'export {k}=\'{v}\'' for k, v in sorted(env_vars.items()))
    else:
        output = json.dumps(config, indent=2)

    if args.output:
        with open(args.output, "w") as f:
            f.write(output + "\n")
        print(f"Config written to {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()
