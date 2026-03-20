#!/usr/bin/env python3
"""
BrowserOS Fingerprint Configuration Generator

Generates fingerprint configuration files for kernel-level browser
fingerprint customization. These configuration files are read by the patched
Chromium code at runtime.

Usage:
    python generate_config.py --output /path/to/config.txt
    python generate_config.py --platform windows --output /path/to/config.txt
    python generate_config.py --json /path/to/fingerprint.json --output /path/to/config.txt
"""

import argparse
import hashlib
import json
import random
import sys
from pathlib import Path
from typing import Any, Dict, Optional

from webgl_gpu_profiles import WEBGL_CONFIG_TO_GPU_PROFILE, WEBGL_GPU_PROFILES, get_gpu_profile

# Common hardware configurations
# navigator.deviceMemory is capped at 8 per Web spec; real browsers never
# return values above 8.  Using 16/32 gets flagged by fingerprint detection.
HARDWARE_CONFIGS = {
    "low_end": {
        "hardware_concurrency": 4,
        "device_memory": 4,
    },
    "mid_range": {
        "hardware_concurrency": 8,
        "device_memory": 8,
    },
    "high_end": {
        "hardware_concurrency": 16,
        "device_memory": 8,
    },
}

# WebGL renderer strings by platform
WEBGL_CONFIGS = {
    "windows_intel": {
        "vendor": "Google Inc. (Intel)",
        "renderer": "ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)",
        "unmasked_vendor": "Google Inc. (Intel)",
        "unmasked_renderer": "ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "gl_backend": "d3d11",
    },
    "windows_nvidia": {
        "vendor": "Google Inc. (NVIDIA)",
        "renderer": "ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)",
        "unmasked_vendor": "Google Inc. (NVIDIA)",
        "unmasked_renderer": "ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "gl_backend": "d3d11",
    },
    "windows_amd": {
        "vendor": "Google Inc. (AMD)",
        "renderer": "ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0)",
        "unmasked_vendor": "Google Inc. (AMD)",
        "unmasked_renderer": "ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "gl_backend": "d3d11",
    },
    "mac_intel": {
        "vendor": "Google Inc. (Intel Inc.)",
        "renderer": "ANGLE (Intel Inc., Intel(R) Iris(TM) Plus Graphics 640, OpenGL 4.1)",
        "unmasked_vendor": "Google Inc. (Intel Inc.)",
        "unmasked_renderer": "ANGLE (Intel Inc., Intel(R) Iris(TM) Plus Graphics 640, OpenGL 4.1 Metal - 76.3)",
        "gl_backend": "metal",
    },
    "mac_apple": {
        "vendor": "Google Inc. (Apple)",
        "renderer": "ANGLE (Apple, Apple M1, OpenGL 4.1)",
        "unmasked_vendor": "Google Inc. (Apple)",
        "unmasked_renderer": "ANGLE (Apple, Apple M1, OpenGL 4.1 Metal - 76.3)",
        "gl_backend": "metal",
    },
    "linux_intel": {
        "vendor": "Google Inc. (Intel)",
        "renderer": "ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6)",
        "unmasked_vendor": "Google Inc. (Intel)",
        "unmasked_renderer": "ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6)",
        "gl_backend": "opengl",
    },
}


def build_angle_gl_version(profile_seed: str) -> str:
    """Build a GL_VERSION string matching real Chrome's format.

    Chrome wraps this value as: "WebGL 1.0 (<gl_version>)" or "WebGL 2.0 (<gl_version>)"
    The prefix is added by Chromium's WebGL layer, so we only supply the inner part.
    Real Chrome uses the simplified "Chromium" suffix, not the full ANGLE hash.
    """
    return "OpenGL ES 2.0 Chromium"


def build_angle_gl_version_2(profile_seed: str) -> str:
    """Build the WebGL2 GL_VERSION inner string.

    Chrome wraps this as: "WebGL 2.0 (<gl_version_2>)"
    """
    return "OpenGL ES 3.0 Chromium"


def build_angle_shading_language_version() -> str:
    """Build a GL_SHADING_LANGUAGE_VERSION string consistent with the GL_VERSION.

    Chrome wraps this as: "WebGL GLSL ES 1.0 (<value>)" or "WebGL GLSL ES 3.00 (<value>)"
    """
    return "OpenGL ES GLSL ES 1.0 Chromium"


def build_angle_shading_language_version_2() -> str:
    """Build the WebGL2 GL_SHADING_LANGUAGE_VERSION inner string.

    Chrome wraps this as: "WebGL GLSL ES 3.00 (<value>)"
    """
    return "OpenGL ES GLSL ES 3.0 Chromium"

# Platform-specific fingerprint layers.
# A layer bundles hardware tier, screen, and a bounded set of WebGL models so
# values stay coherent while still diversifying across profiles.
PROFILE_LAYERS = {
    "windows": [
        {
            "weight": 36,
            "hardware_tier": "mid_range",
            "screen": {
                "width": 1920,
                "height": 1080,
                "availHeight": 1040,
                "devicePixelRatio": 1.0,
            },
            "webgl_keys": ["windows_intel", "windows_nvidia"],
        },
        {
            "weight": 20,
            "hardware_tier": "low_end",
            "screen": {
                "width": 1366,
                "height": 768,
                "availHeight": 728,
                "devicePixelRatio": 1.0,
            },
            "webgl_keys": ["windows_intel"],
        },
        {
            "weight": 16,
            "hardware_tier": "mid_range",
            "screen": {
                "width": 1536,
                "height": 864,
                "availHeight": 824,
                "devicePixelRatio": 1.25,
            },
            "webgl_keys": ["windows_intel"],
        },
        {
            "weight": 20,
            "hardware_tier": "high_end",
            "screen": {
                "width": 2560,
                "height": 1440,
                "availHeight": 1400,
                "devicePixelRatio": 1.0,
            },
            "webgl_keys": ["windows_nvidia", "windows_amd"],
        },
        {
            "weight": 8,
            "hardware_tier": "high_end",
            "screen": {
                "width": 3840,
                "height": 2160,
                "availHeight": 2120,
                "devicePixelRatio": 1.5,
            },
            "webgl_keys": ["windows_nvidia"],
        },
    ],
    "mac": [
        {
            "weight": 56,
            "hardware_tier": "high_end",
            "screen": {
                "width": 2560,
                "height": 1600,
                "availHeight": 1555,
                "devicePixelRatio": 2.0,
            },
            "webgl_keys": ["mac_apple"],
        },
        {
            "weight": 29,
            "hardware_tier": "mid_range",
            "screen": {
                "width": 1440,
                "height": 900,
                "availHeight": 855,
                "devicePixelRatio": 2.0,
            },
            "webgl_keys": ["mac_intel"],
        },
        {
            "weight": 15,
            "hardware_tier": "mid_range",
            "screen": {
                "width": 2560,
                "height": 1600,
                "availHeight": 1555,
                "devicePixelRatio": 2.0,
            },
            "webgl_keys": ["mac_intel"],
        },
    ],
    "linux": [
        {
            "weight": 55,
            "hardware_tier": "mid_range",
            "screen": {
                "width": 1920,
                "height": 1080,
                "availHeight": 1040,
                "devicePixelRatio": 1.0,
            },
            "webgl_keys": ["linux_intel"],
        },
        {
            "weight": 25,
            "hardware_tier": "low_end",
            "screen": {
                "width": 1366,
                "height": 768,
                "availHeight": 728,
                "devicePixelRatio": 1.0,
            },
            "webgl_keys": ["linux_intel"],
        },
        {
            "weight": 20,
            "hardware_tier": "high_end",
            "screen": {
                "width": 2560,
                "height": 1440,
                "availHeight": 1400,
                "devicePixelRatio": 1.0,
            },
            "webgl_keys": ["linux_intel"],
        },
    ],
}

# Platform-specific font pools.
# Only include fonts that actually ship with each OS to avoid detection.
PLATFORM_FONTS = {
    "windows": {
        # Fonts that always exist on a real Windows 10/11 install
        "base": [
            "Arial",
            "Courier New",
            "Georgia",
            "Times New Roman",
            "Verdana",
            "Tahoma",
            "Trebuchet MS",
            "Segoe UI",
            "Calibri",
        ],
        # Fonts commonly present but not 100% guaranteed
        "extra": [
            "Comic Sans MS",
            "Impact",
            "Arial Black",
            "Lucida Console",
            "Lucida Sans Unicode",
            "Palatino Linotype",
            "Book Antiqua",
            "Cambria",
            "Candara",
            "Consolas",
            "Constantia",
            "Corbel",
            "Franklin Gothic Medium",
            "Garamond",
            "Century Gothic",
            "Bookman Old Style",
            "Rockwell",
            "Perpetua",
            "Segoe UI Symbol",
            "Segoe Print",
            "Sylfaen",
            "Microsoft Sans Serif",
        ],
    },
    "mac": {
        # Fonts that always exist on macOS 12+
        "base": [
            "Arial",
            "Courier New",
            "Georgia",
            "Times New Roman",
            "Verdana",
            "Helvetica",
            "Helvetica Neue",
            "San Francisco",
            "Menlo",
        ],
        # Fonts commonly present on macOS
        "extra": [
            "Trebuchet MS",
            "Tahoma",
            "Futura",
            "Gill Sans",
            "Optima",
            "Palatino",
            "Didot",
            "American Typewriter",
            "Baskerville",
            "Big Caslon",
            "Cochin",
            "Copperplate",
            "Marker Felt",
            "Papyrus",
            "Phosphate",
            "Rockwell",
            "Skia",
            "Hoefler Text",
            "Avenir",
            "Avenir Next",
            "Monaco",
            "Lucida Grande",
        ],
    },
    "linux": {
        # Fonts that come with most desktop Linux distros
        "base": [
            "Arial",
            "Courier New",
            "Georgia",
            "Times New Roman",
            "Verdana",
            "DejaVu Sans",
            "DejaVu Serif",
            "Liberation Sans",
            "Liberation Serif",
        ],
        # Fonts commonly installed via fontconfig / distro packages
        "extra": [
            "Trebuchet MS",
            "Impact",
            "Comic Sans MS",
            "DejaVu Sans Mono",
            "Liberation Mono",
            "Noto Sans",
            "Noto Serif",
            "Droid Sans",
            "Droid Serif",
            "Ubuntu",
            "Cantarell",
            "FreeSans",
            "FreeSerif",
            "FreeMono",
            "Nimbus Sans",
            "Nimbus Roman",
        ],
    },
}


def select_font_subset(
    seed_source: Optional[str] = None,
    platform_key: str = "windows",
    min_extra: int = 6,
    max_extra: int = 14,
) -> list[str]:
    """Select a deterministic per-profile subset of platform-appropriate fonts."""
    platform_fonts = PLATFORM_FONTS.get(platform_key, PLATFORM_FONTS["linux"])
    base = list(platform_fonts["base"])
    extra_pool = list(platform_fonts["extra"])

    if seed_source:
        rng = random.Random(stable_hash_int(seed_source, "fonts"))
    else:
        rng = random.Random()

    count = rng.randint(min_extra, min(max_extra, len(extra_pool)))
    extras = rng.sample(extra_pool, count)

    return sorted(set(base + extras))


DEFAULT_CHROME_VERSION = "142.0.7313.116"
CHROMIUM_VERSION_PATH = Path(__file__).resolve().parents[3] / "CHROMIUM_VERSION"

# Real Chrome stable release versions by major version.
# Source: https://chromiumdash.appspot.com/releases
REAL_CHROME_VERSIONS: Dict[int, str] = {
    145: "145.0.7422.54",
    144: "144.0.7376.97",
    143: "143.0.7341.93",
    142: "142.0.7313.116",
    141: "141.0.7278.98",
    140: "140.0.7243.122",
    139: "139.0.7208.92",
    138: "138.0.7173.114",
    137: "137.0.7137.92",
    136: "136.0.7103.115",
}

# Build number ranges for real Chrome stable releases.
CHROME_BUILD_RANGES: Dict[int, tuple[int, int]] = {
    145: (7400, 7450),
    144: (7350, 7400),
    143: (7310, 7360),
    142: (7280, 7330),
    141: (7250, 7300),
    140: (7210, 7260),
    139: (7180, 7230),
    138: (7140, 7190),
    137: (7100, 7150),
    136: (7070, 7120),
}


def as_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def first_non_none(*values: Any) -> Any:
    for value in values:
        if value is not None:
            return value
    return None


def parse_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in ("1", "true", "yes", "on"):
            return True
        if normalized in ("0", "false", "no", "off"):
            return False
    return default


def parse_int(value: Any, default: int) -> int:
    try:
        parsed = int(value)
        if parsed <= 0:
            return default
        return parsed
    except (TypeError, ValueError):
        return default


def parse_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_languages(value: Any, fallback: str) -> str:
    if isinstance(value, str):
        cleaned = ",".join(
            part.strip() for part in value.split(",") if part.strip()
        )
        if cleaned:
            return cleaned
    if isinstance(value, list):
        cleaned_list = [
            part.strip()
            for part in value
            if isinstance(part, str) and part.strip()
        ]
        if cleaned_list:
            return ",".join(cleaned_list)
    return fallback


def split_languages_csv(value: str) -> list[str]:
    return [part.strip() for part in value.split(",") if part.strip()]


def normalize_to_real_chrome_version(version: str) -> str:
    """Map a Chromium build version to a real Chrome stable release.

    BrowserOS/Nova Seller builds use custom build numbers (e.g. 142.0.7444.49)
    that don't match any Chrome stable release.  Detection sites flag these.
    """
    parts = version.split(".")
    if len(parts) < 3:
        return version
    try:
        major = int(parts[0])
        build = int(parts[2])
    except ValueError:
        return version

    build_range = CHROME_BUILD_RANGES.get(major)
    if build_range is None:
        return version

    lo, hi = build_range
    if lo <= build <= hi:
        return version

    return REAL_CHROME_VERSIONS.get(major, version)


def load_chrome_version() -> str:
    try:
        parsed: Dict[str, str] = {}
        with open(CHROMIUM_VERSION_PATH) as f:
            for line in f:
                line = line.strip()
                if not line or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                parsed[key.strip().upper()] = val.strip()
        major = parsed.get("MAJOR")
        minor = parsed.get("MINOR")
        build = parsed.get("BUILD")
        patch = parsed.get("PATCH")
        if all(part and part.isdigit() for part in (major, minor, build, patch)):
            raw = f"{major}.{minor}.{build}.{patch}"
            return normalize_to_real_chrome_version(raw)
    except OSError:
        pass
    return DEFAULT_CHROME_VERSION


def infer_platform_key(platform_hint: Optional[str], user_agent: str) -> str:
    hint = (platform_hint or "").lower()
    if "win" in hint:
        return "windows"
    if "mac" in hint:
        return "mac"
    if "linux" in hint or "x11" in hint:
        return "linux"

    ua = user_agent.lower()
    if "windows nt" in ua:
        return "windows"
    if "mac os x" in ua or "macintosh" in ua:
        return "mac"
    if "linux" in ua or "x11" in ua:
        return "linux"
    return "linux"


def platform_value_for_key(platform_key: str) -> str:
    if platform_key == "windows":
        return "Win32"
    if platform_key == "mac":
        return "MacIntel"
    return "Linux x86_64"


def build_default_user_agent(platform_key: str, chrome_version: str) -> str:
    if platform_key == "windows":
        os_token = "Windows NT 10.0; Win64; x64"
    elif platform_key == "mac":
        os_token = "Macintosh; Intel Mac OS X 10_15_7"
    else:
        os_token = "X11; Linux x86_64"
    return (
        f"Mozilla/5.0 ({os_token}) AppleWebKit/537.36 "
        f"(KHTML, like Gecko) Chrome/{chrome_version} Safari/537.36"
    )


def generate_session_seed(seed_source: Optional[str] = None) -> int:
    """
    Generate a session seed.

    If seed_source is provided (e.g. profile id), the seed is deterministic.
    Otherwise a random seed is returned.
    """
    if seed_source:
        digest = hashlib.blake2s(seed_source.encode("utf-8"), digest_size=4).digest()
        seed = int.from_bytes(digest, byteorder="big")
        return max(seed, 1)
    return random.randint(1, 2**32 - 1)


def stable_hash_int(seed_source: str, label: str) -> int:
    digest = hashlib.blake2s(
        f"{seed_source}:{label}".encode("utf-8"),
        digest_size=8,
    ).digest()
    return int.from_bytes(digest, byteorder="big")


def choose_weighted(
    items: list[Any],
    weights: list[int],
    seed_source: Optional[str] = None,
    label: str = "",
) -> Any:
    if not items:
        raise ValueError("items must not be empty")
    if len(items) != len(weights):
        raise ValueError("items and weights must have same length")

    normalized_weights = [max(int(weight), 1) for weight in weights]
    if seed_source:
        total = sum(normalized_weights)
        slot = stable_hash_int(seed_source, label or "weighted-choice") % total
        running = 0
        for item, weight in zip(items, normalized_weights):
            running += weight
            if slot < running:
                return item
        return items[-1]

    return random.choices(items, weights=normalized_weights, k=1)[0]


def select_profile_layer(
    platform_key: str,
    seed_source: Optional[str] = None,
) -> Dict[str, Any]:
    layers = PROFILE_LAYERS.get(platform_key, PROFILE_LAYERS["linux"])
    return choose_weighted(
        items=layers,
        weights=[int(layer.get("weight", 1)) for layer in layers],
        seed_source=seed_source,
        label=f"{platform_key}:layer",
    )


def select_webgl_key_for_layer(
    platform_key: str,
    layer: Dict[str, Any],
    seed_source: Optional[str] = None,
) -> str:
    keys = layer.get("webgl_keys")
    if not isinstance(keys, list) or not keys:
        fallback = {
            "windows": ["windows_intel", "windows_nvidia", "windows_amd"],
            "mac": ["mac_apple", "mac_intel"],
            "linux": ["linux_intel"],
        }
        keys = fallback.get(platform_key, list(WEBGL_CONFIGS.keys()))

    selected = choose_weighted(
        items=keys,
        weights=[1 for _ in keys],
        seed_source=seed_source,
        label=f"{platform_key}:webgl",
    )
    if selected in WEBGL_CONFIGS:
        return selected
    return "linux_intel"


def build_profile_defaults(
    platform_key: str,
    seed_source: Optional[str] = None,
) -> Dict[str, Any]:
    layer = select_profile_layer(platform_key, seed_source)

    hardware_tier = str(layer.get("hardware_tier", "mid_range"))
    if hardware_tier not in HARDWARE_CONFIGS:
        hardware_tier = "mid_range"
    hardware = HARDWARE_CONFIGS[hardware_tier]

    screen = as_dict(layer.get("screen"))
    width = parse_int(screen.get("width"), 1920)
    height = parse_int(screen.get("height"), 1080)
    avail_width = parse_int(screen.get("availWidth"), width)
    avail_height = parse_int(screen.get("availHeight"), max(height - 40, 1))
    dpr = parse_float(screen.get("devicePixelRatio"), 1.0)

    webgl_key = select_webgl_key_for_layer(platform_key, layer, seed_source)
    webgl = WEBGL_CONFIGS.get(webgl_key, WEBGL_CONFIGS["linux_intel"])
    gpu_profile = get_gpu_profile(webgl_key)

    return {
        "hardware": hardware,
        "screen": {
            "width": width,
            "height": height,
            "availWidth": avail_width,
            "availHeight": avail_height,
            "devicePixelRatio": dpr,
        },
        "webgl": webgl,
        "gpu_profile": gpu_profile,
    }


def generate_fingerprint_config(
    platform: Optional[str] = None,
    json_input: Optional[Dict[str, Any]] = None,
    profile_seed: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate a complete fingerprint configuration.

    Args:
        platform: Target platform (windows, mac, linux)
        json_input: Optional JSON input with pre-defined values
        profile_seed: Optional profile id used to derive stable session seeds

    Returns:
        Dictionary containing all fingerprint configuration values
    """
    config: Dict[str, Any] = {}
    chrome_version = load_chrome_version()
    explicit_platform = (platform or "").strip().lower() or None
    seed_key = (profile_seed or "").strip() or None

    # Use JSON input if provided, otherwise generate random values
    if json_input:
        nav = as_dict(json_input.get("navigator"))
        screen = as_dict(json_input.get("screen"))
        webgl = as_dict(json_input.get("webgl"))
        canvas = as_dict(json_input.get("canvas"))
        audio = as_dict(json_input.get("audio"))
        webrtc = as_dict(json_input.get("webrtc"))
        profile = as_dict(json_input.get("profile"))

        if not seed_key:
            profile_id = first_non_none(
                profile.get("id"),
                profile.get("profileId"),
                profile.get("profile_id"),
            )
            if isinstance(profile_id, str) and profile_id.strip():
                seed_key = profile_id.strip()

        user_agent = first_non_none(
            nav.get("userAgent"),
            nav.get("user_agent"),
            json_input.get("userAgent"),
            json_input.get("user_agent"),
        )
        user_agent = (
            str(user_agent).strip()
            if isinstance(user_agent, str) and user_agent.strip()
            else ""
        )

        platform_hint = first_non_none(
            explicit_platform,
            nav.get("platform"),
            json_input.get("platform"),
        )
        platform_key = infer_platform_key(
            str(platform_hint) if isinstance(platform_hint, str) else None,
            user_agent,
        )

        if not user_agent:
            user_agent = build_default_user_agent(platform_key, chrome_version)

        profile_defaults = build_profile_defaults(platform_key, seed_key)

        config["user_agent"] = user_agent
        config["platform"] = str(
            first_non_none(
                nav.get("platform"),
                json_input.get("platform"),
                platform_value_for_key(platform_key),
            )
        )
        config["vendor"] = str(
            first_non_none(
                nav.get("vendor"),
                json_input.get("vendor"),
                "Google Inc.",
            )
        )

        language = first_non_none(
            nav.get("language"),
            json_input.get("language"),
            "en-US",
        )
        language = str(language) if language is not None else "en-US"
        config["language"] = language
        config["languages"] = normalize_languages(
            first_non_none(nav.get("languages"), json_input.get("languages")),
            f"{language},en",
        )
        config["accept_language"] = str(
            first_non_none(
                nav.get("acceptLanguage"),
                nav.get("accept_language"),
                json_input.get("acceptLanguage"),
                json_input.get("accept_language"),
                "en-US,en;q=0.9",
            )
        )

        config["hardware_concurrency"] = parse_int(
            first_non_none(
                nav.get("hardwareConcurrency"),
                nav.get("hardware_concurrency"),
                json_input.get("hardwareConcurrency"),
                json_input.get("hardware_concurrency"),
            ),
            profile_defaults["hardware"]["hardware_concurrency"],
        )
        config["device_memory"] = parse_float(
            first_non_none(
                nav.get("deviceMemory"),
                nav.get("device_memory"),
                json_input.get("deviceMemory"),
                json_input.get("device_memory"),
            ),
            float(profile_defaults["hardware"]["device_memory"]),
        )

        # Screen properties
        config["screen_width"] = parse_int(
            first_non_none(screen.get("width"), screen.get("screen_width")),
            profile_defaults["screen"]["width"],
        )
        config["screen_height"] = parse_int(
            first_non_none(screen.get("height"), screen.get("screen_height")),
            profile_defaults["screen"]["height"],
        )
        config["screen_avail_width"] = parse_int(
            first_non_none(
                screen.get("availWidth"),
                screen.get("avail_width"),
                screen.get("screen_avail_width"),
            ),
            profile_defaults["screen"]["availWidth"],
        )
        config["screen_avail_height"] = parse_int(
            first_non_none(
                screen.get("availHeight"),
                screen.get("avail_height"),
                screen.get("screen_avail_height"),
            ),
            profile_defaults["screen"]["availHeight"],
        )
        config["screen_color_depth"] = parse_int(
            first_non_none(
                screen.get("colorDepth"),
                screen.get("color_depth"),
                screen.get("screen_color_depth"),
            ),
            24,
        )
        config["screen_pixel_depth"] = parse_int(
            first_non_none(
                screen.get("pixelDepth"),
                screen.get("pixel_depth"),
                screen.get("screen_pixel_depth"),
            ),
            config["screen_color_depth"],
        )
        config["device_pixel_ratio"] = parse_float(
            first_non_none(
                screen.get("devicePixelRatio"),
                screen.get("device_pixel_ratio"),
            ),
            profile_defaults["screen"]["devicePixelRatio"],
        )

        # WebGL properties
        fallback_webgl = profile_defaults["webgl"]
        config["webgl_vendor"] = str(
            first_non_none(
                webgl.get("vendor"),
                webgl.get("webgl_vendor"),
                fallback_webgl["vendor"],
            )
        )
        config["webgl_renderer"] = str(
            first_non_none(
                webgl.get("renderer"),
                webgl.get("webgl_renderer"),
                fallback_webgl["renderer"],
            )
        )
        config["webgl_unmasked_vendor"] = str(
            first_non_none(
                webgl.get("unmaskedVendor"),
                webgl.get("unmasked_vendor"),
                fallback_webgl["unmasked_vendor"],
            )
        )
        config["webgl_unmasked_renderer"] = str(
            first_non_none(
                webgl.get("unmaskedRenderer"),
                webgl.get("unmasked_renderer"),
                fallback_webgl["unmasked_renderer"],
            )
        )

        # WebGL GL_VERSION and GL_SHADING_LANGUAGE_VERSION
        config["webgl_gl_version"] = str(
            first_non_none(
                webgl.get("glVersion"),
                webgl.get("gl_version"),
                build_angle_gl_version(seed_key or "default"),
            )
        )
        config["webgl_shading_language_version"] = str(
            first_non_none(
                webgl.get("shadingLanguageVersion"),
                webgl.get("shading_language_version"),
                build_angle_shading_language_version(),
            )
        )
        config["webgl_gl_version_2"] = str(
            first_non_none(
                webgl.get("glVersion2"),
                webgl.get("gl_version_2"),
                build_angle_gl_version_2(seed_key or "default"),
            )
        )
        config["webgl_shading_language_version_2"] = str(
            first_non_none(
                webgl.get("shadingLanguageVersion2"),
                webgl.get("shading_language_version_2"),
                build_angle_shading_language_version_2(),
            )
        )

        # Attach GPU profile data (shader precision, params, extensions)
        # from JSON input if present, otherwise from profile defaults
        gpu_data = {}
        if webgl.get("shaderPrecision"):
            gpu_data["shaderPrecision"] = webgl["shaderPrecision"]
        if webgl.get("params"):
            gpu_data["params"] = webgl["params"]
        if webgl.get("extensions"):
            gpu_data["extensions"] = webgl["extensions"]
        if not gpu_data:
            gpu_data = profile_defaults.get("gpu_profile", {})
        config["webgl_gpu_profile"] = gpu_data

        # Canvas noise: low amplitude + per-profile stable seed.
        config["canvas_noise_enabled"] = str(
            parse_bool(
                first_non_none(
                    canvas.get("noiseEnabled"),
                    canvas.get("noise_enabled"),
                ),
                True,
            )
        ).lower()
        config["canvas_noise_level"] = parse_float(
            first_non_none(
                canvas.get("noiseLevel"),
                canvas.get("noiseFactor"),
                canvas.get("noise_level"),
            ),
            0.00002,
        )

        # Audio noise: enabled by default for per-profile audio fingerprint diversity.
        config["audio_noise_enabled"] = str(
            parse_bool(
                first_non_none(
                    audio.get("noiseEnabled"),
                    audio.get("noise_enabled"),
                ),
                True,
            )
        ).lower()
        config["audio_noise_level"] = parse_float(
            first_non_none(
                audio.get("noiseLevel"),
                audio.get("noiseFactor"),
                audio.get("noise_level"),
            ),
            0.0001,
        )

        # WebRTC (default disabled to reduce local/public IP leaks)
        config["webrtc_disabled"] = str(
            parse_bool(
                first_non_none(
                    webrtc.get("disableWebRTC"),
                    webrtc.get("disabled"),
                    webrtc.get("webrtc_disabled"),
                ),
                True,
            )
        ).lower()
        config["webrtc_public_ip"] = str(
            first_non_none(
                webrtc.get("publicIp"),
                webrtc.get("public_ip"),
                "",
            )
        )
        config["webrtc_local_ip"] = str(
            first_non_none(
                webrtc.get("localIp"),
                webrtc.get("local_ip"),
                "",
            )
        )

        canvas_seed = parse_int(
            first_non_none(
                canvas.get("noiseSeed"),
                canvas.get("sessionSeed"),
                canvas.get("session_seed"),
            ),
            generate_session_seed(seed_key),
        )
        config["canvas_session_seed"] = canvas_seed
        config["audio_session_seed"] = parse_int(
            first_non_none(
                audio.get("noiseSeed"),
                audio.get("sessionSeed"),
                audio.get("session_seed"),
            ),
            canvas_seed,
        )

        # Font enumeration filtering
        fonts = as_dict(json_input.get("fonts"))
        config["block_font_enumeration"] = str(
            parse_bool(
                first_non_none(
                    fonts.get("blockFontEnumeration"),
                    fonts.get("block_font_enumeration"),
                ),
                True,
            )
        ).lower()
        if fonts.get("enabledFonts") or fonts.get("enabled_fonts"):
            raw_fonts = fonts.get("enabledFonts") or fonts.get("enabled_fonts")
            if isinstance(raw_fonts, list):
                config["enabled_fonts"] = sorted(raw_fonts)
            elif isinstance(raw_fonts, str):
                config["enabled_fonts"] = sorted(
                    f.strip() for f in raw_fonts.split(",") if f.strip()
                )
            else:
                config["enabled_fonts"] = select_font_subset(seed_key, platform_key)
        else:
            config["enabled_fonts"] = select_font_subset(seed_key, platform_key)
    else:
        # Generate configuration defaults
        platform_key = infer_platform_key(explicit_platform, "")
        profile_defaults = build_profile_defaults(platform_key, seed_key)
        hw_config = profile_defaults["hardware"]
        screen_defaults = profile_defaults["screen"]
        webgl_config = profile_defaults["webgl"]

        # Navigator
        config["user_agent"] = build_default_user_agent(platform_key, chrome_version)
        config["platform"] = platform_value_for_key(platform_key)
        config["vendor"] = "Google Inc."
        config["language"] = "en-US"
        config["languages"] = "en-US,en"
        config["accept_language"] = "en-US,en;q=0.9"
        config["hardware_concurrency"] = hw_config["hardware_concurrency"]
        config["device_memory"] = hw_config["device_memory"]

        # Screen
        config["screen_width"] = screen_defaults["width"]
        config["screen_height"] = screen_defaults["height"]
        config["screen_avail_width"] = screen_defaults["availWidth"]
        config["screen_avail_height"] = screen_defaults["availHeight"]
        config["screen_color_depth"] = 24
        config["screen_pixel_depth"] = 24
        config["device_pixel_ratio"] = screen_defaults["devicePixelRatio"]

        # WebGL
        config["webgl_vendor"] = webgl_config["vendor"]
        config["webgl_renderer"] = webgl_config["renderer"]
        config["webgl_unmasked_vendor"] = webgl_config["unmasked_vendor"]
        config["webgl_unmasked_renderer"] = webgl_config["unmasked_renderer"]
        config["webgl_gl_version"] = build_angle_gl_version(seed_key or "default")
        config["webgl_gl_version_2"] = build_angle_gl_version_2(seed_key or "default")
        config["webgl_shading_language_version"] = build_angle_shading_language_version()
        config["webgl_shading_language_version_2"] = build_angle_shading_language_version_2()
        config["webgl_gpu_profile"] = profile_defaults.get("gpu_profile", {})

        # Canvas noise defaults: low amplitude + stable per-profile seed.
        config["canvas_noise_enabled"] = "true"
        config["canvas_noise_level"] = 0.00002
        config["audio_noise_enabled"] = "true"
        config["audio_noise_level"] = 0.0000005

        # WebRTC defaults
        config["webrtc_disabled"] = "true"
        config["webrtc_public_ip"] = ""
        config["webrtc_local_ip"] = ""

        # Session seeds
        config["canvas_session_seed"] = generate_session_seed(seed_key)
        config["audio_session_seed"] = config["canvas_session_seed"]

        # Font enumeration filtering
        config["block_font_enumeration"] = "true"
        config["enabled_fonts"] = select_font_subset(seed_key, platform_key)

    return config


def write_config_file(config: Dict[str, Any], output_path: Path) -> None:
    """
    Write configuration to a key=value format file.

    This format is read by the patched Chromium code.
    """
    with open(output_path, "w") as f:
        for key, value in config.items():
            f.write(f"{key}={value}\n")

    print(f"Configuration written to: {output_path}")


def write_json_config(config: Dict[str, Any], output_path: Path) -> None:
    """Write configuration as JSON (for browseragent integration)."""
    # Convert to nested structure for browseragent compatibility
    webgl_section: Dict[str, Any] = {
        "vendor": config["webgl_vendor"],
        "renderer": config["webgl_renderer"],
        "unmaskedVendor": config["webgl_unmasked_vendor"],
        "unmaskedRenderer": config["webgl_unmasked_renderer"],
        "glVersion": config["webgl_gl_version"],
        "glVersion2": config.get("webgl_gl_version_2", ""),
        "shadingLanguageVersion": config["webgl_shading_language_version"],
        "shadingLanguageVersion2": config.get("webgl_shading_language_version_2", ""),
    }

    # Include GPU-specific shader precision, params, and extensions
    if "webgl_gpu_profile" in config and config["webgl_gpu_profile"]:
        gpu = config["webgl_gpu_profile"]
        if "shaderPrecision" in gpu:
            webgl_section["shaderPrecision"] = gpu["shaderPrecision"]
        if "params" in gpu:
            webgl_section["params"] = gpu["params"]
        if "extensions" in gpu:
            webgl_section["extensions"] = gpu["extensions"]

    json_config = {
        "navigator": {
            "userAgent": config["user_agent"],
            "vendor": config["vendor"],
            "platform": config["platform"],
            "language": config["language"],
            "languages": split_languages_csv(config["languages"]),
            "acceptLanguage": config["accept_language"],
            "hardwareConcurrency": config["hardware_concurrency"],
            "deviceMemory": config["device_memory"],
        },
        "screen": {
            "width": config["screen_width"],
            "height": config["screen_height"],
            "availWidth": config["screen_avail_width"],
            "availHeight": config["screen_avail_height"],
            "colorDepth": config["screen_color_depth"],
            "pixelDepth": config["screen_pixel_depth"],
            "devicePixelRatio": config["device_pixel_ratio"],
        },
        "webgl": webgl_section,
        "canvas": {
            "noiseEnabled": config["canvas_noise_enabled"] == "true",
            "noiseLevel": config["canvas_noise_level"],
            "sessionSeed": config["canvas_session_seed"],
        },
        "audio": {
            "noiseEnabled": config["audio_noise_enabled"] == "true",
            "noiseLevel": config["audio_noise_level"],
            "sessionSeed": config["audio_session_seed"],
        },
        "webrtc": {
            "disabled": config["webrtc_disabled"] == "true",
            "publicIp": config["webrtc_public_ip"],
            "localIp": config["webrtc_local_ip"],
        },
        "fonts": {
            "blockFontEnumeration": config.get("block_font_enumeration", "false") == "true",
            "enabledFonts": config.get("enabled_fonts", []),
        },
    }

    with open(output_path, "w") as f:
        json.dump(json_config, f, indent=2)

    print(f"JSON configuration written to: {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate BrowserOS fingerprint configuration"
    )
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        required=True,
        help="Output configuration file path",
    )
    parser.add_argument(
        "--platform",
        "-p",
        choices=["windows", "mac", "linux"],
        help="Target platform for fingerprint generation",
    )
    parser.add_argument(
        "--json",
        "-j",
        type=Path,
        help="Input JSON file with fingerprint values (browseragent format)",
    )
    parser.add_argument(
        "--profile-id",
        type=str,
        help="Profile id used for deterministic layer selection and noise seeds",
    )
    parser.add_argument(
        "--format",
        "-f",
        choices=["text", "json"],
        default="text",
        help="Output format (default: text for Chromium, json for browseragent)",
    )

    args = parser.parse_args()

    # Load JSON input if provided
    json_input = None
    if args.json:
        if not args.json.exists():
            print(f"Error: JSON file not found: {args.json}", file=sys.stderr)
            sys.exit(1)
        with open(args.json) as f:
            json_input = json.load(f)

    # Generate configuration
    config = generate_fingerprint_config(
        platform=args.platform,
        json_input=json_input,
        profile_seed=args.profile_id,
    )

    # Write output
    args.output.parent.mkdir(parents=True, exist_ok=True)

    if args.format == "json":
        write_json_config(config, args.output)
    else:
        write_config_file(config, args.output)

    # Print summary
    print("\nGenerated fingerprint configuration:")
    print(f"  User Agent: {config['user_agent']}")
    print(f"  Hardware Concurrency: {config['hardware_concurrency']}")
    print(f"  Device Memory: {config['device_memory']}GB")
    print(f"  Screen: {config['screen_width']}x{config['screen_height']}")
    print(f"  WebGL Vendor: {config['webgl_vendor']}")
    print(f"  Canvas Noise: {config['canvas_noise_enabled']}")
    print(f"  WebRTC Disabled: {config['webrtc_disabled']}")


if __name__ == "__main__":
    main()
