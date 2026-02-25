#!/usr/bin/env python3
"""
BrowserOS Fingerprint Configuration Generator

Generates fingerprint configuration files for kernel-level browser fingerprint customization.
These configuration files are read by the patched Chromium code at runtime.

Usage:
    python generate_config.py --output /path/to/config.txt
    python generate_config.py --profile chrome_windows --output /path/to/config.txt
    python generate_config.py --json /path/to/fingerprint.json --output /path/to/config.txt
"""

import argparse
import json
import random
import string
import sys
from pathlib import Path
from typing import Dict, Any, Optional


# Common screen resolutions
COMMON_RESOLUTIONS = [
    (1920, 1080),   # Full HD - most common
    (2560, 1440),   # QHD
    (1366, 768),    # Common laptop
    (1536, 864),    # Scaled laptop
    (1440, 900),    # MacBook Air
    (2560, 1600),   # MacBook Pro
    (3840, 2160),   # 4K
]

# Common hardware configurations
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
        "device_memory": 16,
    },
}

# WebGL renderer strings by platform
WEBGL_CONFIGS = {
    "windows_intel": {
        "vendor": "Google Inc. (Intel)",
        "renderer": "ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)",
        "unmasked_vendor": "Google Inc. (Intel)",
        "unmasked_renderer": "ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)",
    },
    "windows_nvidia": {
        "vendor": "Google Inc. (NVIDIA)",
        "renderer": "ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0)",
        "unmasked_vendor": "Google Inc. (NVIDIA)",
        "unmasked_renderer": "ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
    },
    "windows_amd": {
        "vendor": "Google Inc. (AMD)",
        "renderer": "ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0)",
        "unmasked_vendor": "Google Inc. (AMD)",
        "unmasked_renderer": "ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)",
    },
    "mac_intel": {
        "vendor": "Google Inc. (Intel Inc.)",
        "renderer": "ANGLE (Intel Inc., Intel(R) Iris(TM) Plus Graphics 640, OpenGL 4.1)",
        "unmasked_vendor": "Google Inc. (Intel Inc.)",
        "unmasked_renderer": "ANGLE (Intel Inc., Intel(R) Iris(TM) Plus Graphics 640, OpenGL 4.1 Metal - 76.3)",
    },
    "mac_apple": {
        "vendor": "Google Inc. (Apple)",
        "renderer": "ANGLE (Apple, Apple M1, OpenGL 4.1)",
        "unmasked_vendor": "Google Inc. (Apple)",
        "unmasked_renderer": "ANGLE (Apple, Apple M1, OpenGL 4.1 Metal - 76.3)",
    },
    "linux_intel": {
        "vendor": "Intel",
        "renderer": "Mesa Intel(R) UHD Graphics 620 (KBL GT2)",
        "unmasked_vendor": "Intel",
        "unmasked_renderer": "Mesa Intel(R) UHD Graphics 620 (KBL GT2)",
    },
}

# Browser profiles for TLS fingerprinting
TLS_PROFILES = ["chrome", "firefox", "safari"]


def generate_session_seed() -> int:
    """Generate a random session seed for consistent noise within a session."""
    return random.randint(1, 2**32 - 1)


def select_resolution() -> tuple:
    """Select a random common screen resolution."""
    return random.choice(COMMON_RESOLUTIONS)


def select_hardware_config() -> Dict[str, int]:
    """Select a random hardware configuration."""
    configs = list(HARDWARE_CONFIGS.values())
    weights = [0.3, 0.5, 0.2]  # mid_range is most common
    return random.choices(configs, weights=weights)[0]


def select_webgl_config(platform: Optional[str] = None) -> Dict[str, str]:
    """Select a WebGL configuration based on platform."""
    if platform:
        if platform.startswith("windows"):
            options = ["windows_intel", "windows_nvidia", "windows_amd"]
            weights = [0.4, 0.35, 0.25]
        elif platform.startswith("mac"):
            options = ["mac_intel", "mac_apple"]
            weights = [0.4, 0.6]
        else:  # linux
            options = ["linux_intel"]
            weights = [1.0]
        key = random.choices(options, weights=weights)[0]
    else:
        key = random.choice(list(WEBGL_CONFIGS.keys()))
    return WEBGL_CONFIGS[key]


def generate_fingerprint_config(
    platform: Optional[str] = None,
    json_input: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Generate a complete fingerprint configuration.

    Args:
        platform: Target platform (windows, mac, linux)
        json_input: Optional JSON input with pre-defined values

    Returns:
        Dictionary containing all fingerprint configuration values
    """
    config = {}

    # Use JSON input if provided, otherwise generate random values
    if json_input:
        # Navigator properties
        nav = json_input.get("navigator", {})
        config["hardware_concurrency"] = nav.get("hardwareConcurrency", 8)
        config["device_memory"] = nav.get("deviceMemory", 8)
        config["platform"] = nav.get("platform", "Win32")

        # Screen properties
        screen = json_input.get("screen", {})
        config["screen_width"] = screen.get("width", 1920)
        config["screen_height"] = screen.get("height", 1080)
        config["screen_avail_width"] = screen.get("availWidth", 1920)
        config["screen_avail_height"] = screen.get("availHeight", 1040)
        config["screen_color_depth"] = screen.get("colorDepth", 24)
        config["screen_pixel_depth"] = screen.get("pixelDepth", 24)
        config["device_pixel_ratio"] = screen.get("devicePixelRatio", 1)

        # WebGL properties
        webgl = json_input.get("webgl", {})
        config["webgl_vendor"] = webgl.get("vendor", "")
        config["webgl_renderer"] = webgl.get("renderer", "")
        config["webgl_unmasked_vendor"] = webgl.get("unmaskedVendor", "")
        config["webgl_unmasked_renderer"] = webgl.get("unmaskedRenderer", "")

        # Canvas noise
        canvas = json_input.get("canvas", {})
        config["canvas_noise_enabled"] = str(canvas.get("noiseEnabled", True)).lower()
        config["canvas_noise_level"] = canvas.get("noiseLevel", 0.001)

        # Audio noise
        audio = json_input.get("audio", {})
        config["audio_noise_enabled"] = str(audio.get("noiseEnabled", True)).lower()
        config["audio_noise_level"] = audio.get("noiseLevel", 0.0001)

    else:
        # Generate random configuration
        hw_config = select_hardware_config()
        resolution = select_resolution()
        webgl_config = select_webgl_config(platform)

        # Navigator
        config["hardware_concurrency"] = hw_config["hardware_concurrency"]
        config["device_memory"] = hw_config["device_memory"]

        if platform == "windows":
            config["platform"] = "Win32"
        elif platform == "mac":
            config["platform"] = "MacIntel"
        else:
            config["platform"] = "Linux x86_64"

        # Screen
        config["screen_width"] = resolution[0]
        config["screen_height"] = resolution[1]
        config["screen_avail_width"] = resolution[0]
        config["screen_avail_height"] = resolution[1] - 40  # Taskbar
        config["screen_color_depth"] = 24
        config["screen_pixel_depth"] = 24
        config["device_pixel_ratio"] = random.choice([1, 1.25, 1.5, 2])

        # WebGL
        config["webgl_vendor"] = webgl_config["vendor"]
        config["webgl_renderer"] = webgl_config["renderer"]
        config["webgl_unmasked_vendor"] = webgl_config["unmasked_vendor"]
        config["webgl_unmasked_renderer"] = webgl_config["unmasked_renderer"]

        # Canvas noise
        config["canvas_noise_enabled"] = "true"
        config["canvas_noise_level"] = 0.001

        # Audio noise
        config["audio_noise_enabled"] = "true"
        config["audio_noise_level"] = 0.0001

    # Session seed (always random for each generation)
    config["canvas_session_seed"] = generate_session_seed()

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
    json_config = {
        "navigator": {
            "hardwareConcurrency": config["hardware_concurrency"],
            "deviceMemory": config["device_memory"],
            "platform": config.get("platform", "Win32"),
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
        "webgl": {
            "vendor": config["webgl_vendor"],
            "renderer": config["webgl_renderer"],
            "unmaskedVendor": config["webgl_unmasked_vendor"],
            "unmaskedRenderer": config["webgl_unmasked_renderer"],
        },
        "canvas": {
            "noiseEnabled": config["canvas_noise_enabled"] == "true",
            "noiseLevel": config["canvas_noise_level"],
            "sessionSeed": config["canvas_session_seed"],
        },
        "audio": {
            "noiseEnabled": config["audio_noise_enabled"] == "true",
            "noiseLevel": config["audio_noise_level"],
        },
    }

    with open(output_path, "w") as f:
        json.dump(json_config, f, indent=2)

    print(f"JSON configuration written to: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate BrowserOS fingerprint configuration"
    )
    parser.add_argument(
        "--output", "-o",
        type=Path,
        required=True,
        help="Output configuration file path",
    )
    parser.add_argument(
        "--platform", "-p",
        choices=["windows", "mac", "linux"],
        help="Target platform for fingerprint generation",
    )
    parser.add_argument(
        "--json", "-j",
        type=Path,
        help="Input JSON file with fingerprint values (browseragent format)",
    )
    parser.add_argument(
        "--format", "-f",
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
    )

    # Write output
    args.output.parent.mkdir(parents=True, exist_ok=True)

    if args.format == "json":
        write_json_config(config, args.output)
    else:
        write_config_file(config, args.output)

    # Print summary
    print("\nGenerated fingerprint configuration:")
    print(f"  Hardware Concurrency: {config['hardware_concurrency']}")
    print(f"  Device Memory: {config['device_memory']}GB")
    print(f"  Screen: {config['screen_width']}x{config['screen_height']}")
    print(f"  WebGL Vendor: {config['webgl_vendor']}")
    print(f"  Canvas Noise: {config['canvas_noise_enabled']}")


if __name__ == "__main__":
    main()
