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


KEYS_DIR = Path(__file__).parent.parent.parent / "keys"
AGENT_SIGNING_KEY_PATH = KEYS_DIR / "extension.pem"
CONTROLLER_SIGNING_KEY_PATH = KEYS_DIR / "controller-ext.pem"


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

        extensions: Dict[str, Dict[str, str]] = {}
        valid_ids: set[str] = set()

        # Build and sign Agent extension
        agent_id, agent_version = self._build_and_sign_agent(ctx, output_dir)
        extensions[agent_id] = {
            "external_crx": f"{agent_id}.crx",
            "external_version": agent_version,
        }
        valid_ids.add(agent_id)

        # Build and sign Controller extension
        ctrl_id, ctrl_version = self._build_and_sign_controller(ctx, output_dir)
        if ctrl_id:
            extensions[ctrl_id] = {
                "external_crx": f"{ctrl_id}.crx",
                "external_version": ctrl_version,
            }
            valid_ids.add(ctrl_id)

        self._generate_json(extensions, output_dir)
        self._cleanup_old_files(output_dir, valid_ids)

        log_success("Bundled local extensions successfully")

    def _build_and_sign_agent(self, ctx: Context, output_dir: Path) -> tuple[str, str]:
        private_key = load_or_generate_key(AGENT_SIGNING_KEY_PATH)
        pub_der = get_public_key_der(private_key)
        extension_id = derive_extension_id(pub_der)
        log_info(f"  Agent Extension ID: {extension_id}")

        agent_dir = self._get_agent_source_dir(ctx)
        version = self._get_extension_version(agent_dir)

        self._build_extension(ctx, "build:agent", agent_dir)

        dist_dir = self._get_agent_dist_dir(agent_dir)
        if not dist_dir.exists():
            raise RuntimeError(f"Agent build output not found: {dist_dir}")

        crx_filename = f"{extension_id}.crx"
        crx_path = output_dir / crx_filename
        actual_id = pack_crx3(dist_dir, private_key, crx_path)
        log_info(f"  Created {crx_filename} (id={actual_id}, v{version})")

        return extension_id, version

    def _build_and_sign_controller(self, ctx: Context, output_dir: Path) -> tuple[str | None, str]:
        controller_dir = self._get_controller_source_dir(ctx)
        if not controller_dir.exists():
            log_info("  Controller extension source not found, skipping")
            return None, ""

        private_key = load_or_generate_key(CONTROLLER_SIGNING_KEY_PATH)
        pub_der = get_public_key_der(private_key)
        extension_id = derive_extension_id(pub_der)
        log_info(f"  Controller Extension ID: {extension_id}")

        version = self._get_extension_version(controller_dir)

        self._build_extension(ctx, "build:ext", controller_dir)

        dist_dir = controller_dir / "dist"
        if not dist_dir.exists():
            raise RuntimeError(f"Controller build output not found: {dist_dir}")

        crx_filename = f"{extension_id}.crx"
        crx_path = output_dir / crx_filename
        actual_id = pack_crx3(dist_dir, private_key, crx_path)
        log_info(f"  Created {crx_filename} (id={actual_id}, v{version})")

        return extension_id, version

    def _get_output_dir(self, ctx: Context) -> Path:
        return ctx.chromium_src / "chrome" / "browser" / "browseros" / "bundled_extensions"

    def _get_monorepo_root(self, ctx: Context) -> Path:
        return ctx.root_dir.parent.parent

    def _get_agent_source_dir(self, ctx: Context) -> Path:
        return self._get_monorepo_root(ctx) / "apps" / "agent"

    def _get_controller_source_dir(self, ctx: Context) -> Path:
        return self._get_monorepo_root(ctx) / "apps" / "controller-ext"

    def _get_agent_dist_dir(self, agent_dir: Path) -> Path:
        prod_dir = agent_dir / "dist" / "chrome-mv3"
        dev_dir = agent_dir / "dist" / "chrome-mv3-dev"
        if prod_dir.exists() and any(prod_dir.iterdir()):
            return prod_dir
        if dev_dir.exists() and any(dev_dir.iterdir()):
            return dev_dir
        return prod_dir

    def _get_extension_version(self, ext_dir: Path) -> str:
        package_json = ext_dir / "package.json"
        if package_json.exists():
            data = json.loads(package_json.read_text())
            return data.get("version", "1.0.0")
        return "1.0.0"

    def _build_extension(self, ctx: Context, build_script: str, source_dir: Path) -> None:
        dist_candidates = [
            source_dir / "dist" / "chrome-mv3",
            source_dir / "dist" / "chrome-mv3-dev",
            source_dir / "dist",
        ]
        for dist_dir in dist_candidates:
            if dist_dir.exists() and any(dist_dir.iterdir()):
                log_info(f"  Using existing build: {dist_dir}")
                return

        log_info(f"  Building extension ({build_script})...")
        monorepo_root = self._get_monorepo_root(ctx)
        try:
            result = subprocess.run(
                ["bun", "run", build_script],
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
        self, extensions: Dict[str, Dict[str, str]], output_dir: Path
    ) -> None:
        json_path = output_dir / "bundled_extensions.json"

        with open(json_path, "w") as f:
            json.dump(extensions, f, indent=2)
            f.write("\n")

        log_info(f"  Generated {json_path.name}")

    def _cleanup_old_files(self, output_dir: Path, valid_ids: set[str]) -> None:
        """Remove old CRX files and unpacked directories that don't match current IDs."""
        for item in output_dir.iterdir():
            if item.name == "bundled_extensions.json":
                continue
            if item.name == "BUILD.gn":
                continue
            if item.suffix == ".crx" and item.stem in valid_ids:
                continue
            if item.is_dir():
                shutil.rmtree(item)
                log_info(f"  Cleaned up old directory: {item.name}")
            elif item.suffix == ".crx":
                item.unlink()
                log_info(f"  Cleaned up old CRX: {item.name}")
