#!/usr/bin/env python3
"""Bundled Extensions Module - Build and bundle extensions from local source"""

import json
import shutil
import subprocess
from pathlib import Path
from typing import Dict

from ...common.context import Context
from ...common.module import CommandModule, ValidationError
from ...common.utils import log_info, log_success, log_error
from .crx3 import load_or_generate_key, get_public_key_der, derive_extension_id, pack_crx3


SIGNING_KEY_PATH = Path(__file__).parent.parent.parent / "keys" / "extension.pem"


class BundledExtensionsModule(CommandModule):
    """Build extensions from local source and bundle into Chromium"""

    produces = ["bundled_extensions"]
    requires = []
    description = "Build and bundle extensions from local monorepo source"

    def validate(self, ctx: Context) -> None:
        if not ctx.chromium_src or not ctx.chromium_src.exists():
            raise ValidationError(
                f"Chromium source directory not found: {ctx.chromium_src}"
            )

        agent_dir = self._get_agent_source_dir(ctx)
        if not agent_dir.exists():
            raise ValidationError(
                f"Agent extension source not found: {agent_dir}"
            )

    def execute(self, ctx: Context) -> None:
        log_info("\n📦 Building and bundling local extensions...")

        output_dir = self._get_output_dir(ctx)
        output_dir.mkdir(parents=True, exist_ok=True)
        log_info(f"  Output: {output_dir}")

        private_key = load_or_generate_key(SIGNING_KEY_PATH)
        pub_der = get_public_key_der(private_key)
        extension_id = derive_extension_id(pub_der)
        log_info(f"  Extension ID: {extension_id}")

        agent_dir = self._get_agent_source_dir(ctx)
        version = self._get_extension_version(agent_dir)

        self._build_extension(ctx)

        dist_dir = self._get_agent_dist_dir(agent_dir)
        if not dist_dir.exists():
            raise RuntimeError(f"Build output not found: {dist_dir}")

        crx_filename = f"{extension_id}.crx"
        crx_path = output_dir / crx_filename
        actual_id = pack_crx3(dist_dir, private_key, crx_path)
        log_info(f"  Created {crx_filename} (id={actual_id}, v{version})")

        self._generate_json(extension_id, crx_filename, version, output_dir)
        self._cleanup_old_files(output_dir, extension_id)

        log_success("Bundled local extension successfully")

    def _get_output_dir(self, ctx: Context) -> Path:
        return ctx.chromium_src / "chrome" / "browser" / "browseros" / "bundled_extensions"

    def _get_monorepo_root(self, ctx: Context) -> Path:
        return ctx.root_dir.parent.parent

    def _get_agent_source_dir(self, ctx: Context) -> Path:
        return self._get_monorepo_root(ctx) / "apps" / "agent"

    def _get_agent_dist_dir(self, agent_dir: Path) -> Path:
        prod_dir = agent_dir / "dist" / "chrome-mv3"
        dev_dir = agent_dir / "dist" / "chrome-mv3-dev"
        if prod_dir.exists() and any(prod_dir.iterdir()):
            return prod_dir
        if dev_dir.exists() and any(dev_dir.iterdir()):
            return dev_dir
        return prod_dir

    def _get_extension_version(self, agent_dir: Path) -> str:
        package_json = agent_dir / "package.json"
        if package_json.exists():
            data = json.loads(package_json.read_text())
            return data.get("version", "1.0.0")
        return "1.0.0"

    def _build_extension(self, ctx: Context) -> None:
        agent_dir = self._get_agent_source_dir(ctx)
        dist_dir = self._get_agent_dist_dir(agent_dir)

        if dist_dir.exists() and any(dist_dir.iterdir()):
            log_info(f"  Using existing extension build: {dist_dir.name}")
            return

        log_info("  Building agent extension from local source...")
        monorepo_root = self._get_monorepo_root(ctx)
        try:
            result = subprocess.run(
                ["bun", "run", "build:agent"],
                cwd=monorepo_root,
                capture_output=True,
                text=True,
                timeout=300,
            )
            if result.returncode != 0:
                log_error(f"  Build stderr: {result.stderr}")
                raise RuntimeError(
                    f"Extension build failed (exit {result.returncode})"
                )
            log_info("  Extension build completed")
        except FileNotFoundError:
            raise RuntimeError(
                "bun not found. Install bun to build extensions locally."
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError("Extension build timed out (300s)")

    def _generate_json(
        self, extension_id: str, crx_filename: str, version: str, output_dir: Path
    ) -> None:
        json_path = output_dir / "bundled_extensions.json"

        data: Dict[str, Dict[str, str]] = {
            extension_id: {
                "external_crx": crx_filename,
                "external_version": version,
            }
        }

        with open(json_path, "w") as f:
            json.dump(data, f, indent=2)
            f.write("\n")

        log_info(f"  Generated {json_path.name}")

    def _cleanup_old_files(self, output_dir: Path, extension_id: str) -> None:
        """Remove old CRX files and unpacked directories that don't match current ID."""
        for item in output_dir.iterdir():
            if item.name == "bundled_extensions.json":
                continue
            if item.name == f"{extension_id}.crx":
                continue
            if item.name == "BUILD.gn":
                continue
            if item.is_dir():
                shutil.rmtree(item)
                log_info(f"  Cleaned up old directory: {item.name}")
            elif item.suffix == ".crx" and item.stem != extension_id:
                item.unlink()
                log_info(f"  Cleaned up old CRX: {item.name}")
