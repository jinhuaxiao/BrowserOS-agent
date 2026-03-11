UPSTREAM_DIR := upstream
SCRIPTS_DIR := scripts
PATCHES_DIR := patches
ADDITIONS_DIR := additions
CAMOUFOX_DIR := ../camoufox
CONTROLLER_EXT_DIR := extensions/controller-ext

.PHONY: clone init build build-ui run clean reset help \
        copy-additions apply-patches apply-phase1 apply-phase2 apply-phase3 \
        apply-browseros export-patch update generate-config \
        build-controller-ext

help:
	@echo "Zen Browser + Camoufox Fingerprint Engine"
	@echo ""
	@echo "First time setup:"
	@echo "  make clone          - Clone Zen Browser upstream"
	@echo "  make init           - Install deps + download Firefox source"
	@echo "  make bootstrap      - Install Mozilla build dependencies"
	@echo ""
	@echo "Build:"
	@echo "  make copy-additions - Copy camoucfg additions into engine/"
	@echo "  make apply-phase1   - Apply Phase 1 patches (simple)"
	@echo "  make apply-phase2   - Apply Phase 2 patches (medium)"
	@echo "  make apply-phase3   - Apply Phase 3 patches (hard)"
	@echo "  make apply-browseros- Apply BrowserOS custom patches"
	@echo "  make apply-patches  - Apply all patches in order"
	@echo "  make build          - Full build (npm run build)"
	@echo "  make build-ui       - UI-only rebuild"
	@echo ""
	@echo "Run:"
	@echo "  make run            - Launch Zen Browser"
	@echo "  make run-profile    - Launch with test fingerprint profile"
	@echo ""
	@echo "Extensions:"
	@echo "  make build-controller-ext - Build MCP controller extension (.xpi)"
	@echo ""
	@echo "Development:"
	@echo "  make export-patch   - Export a modified file as patch"
	@echo "  make reset          - Reset engine to clean state"
	@echo "  make clean          - Clean build artifacts"
	@echo "  make generate-config- Generate fingerprint config JSON"

# ── Setup ──────────────────────────────────────────────────────────

clone:
	@if [ ! -d "$(UPSTREAM_DIR)" ]; then \
		echo "Cloning Zen Browser..."; \
		git clone --depth 10 https://github.com/zen-browser/desktop.git $(UPSTREAM_DIR); \
	else \
		echo "Upstream already exists."; \
	fi

init: clone
	cd $(UPSTREAM_DIR) && npm install && npm run init

bootstrap:
	cd $(UPSTREAM_DIR) && npm run bootstrap

# ── Additions ──────────────────────────────────────────────────────

copy-additions:
	@echo "=== Copying additions into engine/ ==="
	@if [ ! -d "$(UPSTREAM_DIR)/engine" ]; then \
		echo "Error: engine/ not found. Run 'make init' first."; \
		exit 1; \
	fi
	@mkdir -p $(UPSTREAM_DIR)/engine/camoucfg
	cp -v $(ADDITIONS_DIR)/camoucfg/* $(UPSTREAM_DIR)/engine/camoucfg/
	@mkdir -p $(UPSTREAM_DIR)/engine/browseros
	@if [ -d "$(ADDITIONS_DIR)/browser" ]; then \
		cp -v $(ADDITIONS_DIR)/browser/base/content/*.js $(UPSTREAM_DIR)/engine/browseros/ 2>/dev/null || true; \
		cp -v $(ADDITIONS_DIR)/browser/themes/shared/*.css $(UPSTREAM_DIR)/engine/browseros/ 2>/dev/null || true; \
	fi
	@if [ -d "$(ADDITIONS_DIR)/lw" ]; then \
		mkdir -p $(UPSTREAM_DIR)/engine/lw; \
		cp -v $(ADDITIONS_DIR)/lw/* $(UPSTREAM_DIR)/engine/lw/; \
	fi
	@echo "=== Copying Zen locale files into engine/ ==="
	cd $(UPSTREAM_DIR) && python3 scripts/copy_language_pack.py en-US
	@echo "Done."

# ── Patch Application ─────────────────────────────────────────────

apply-phase1: copy-additions
	@echo "=== Applying Phase 1 patches (simple) ==="
	$(SCRIPTS_DIR)/apply-fingerprint-patches.sh phase1

apply-phase2:
	@echo "=== Applying Phase 2 patches (medium) ==="
	$(SCRIPTS_DIR)/apply-fingerprint-patches.sh phase2

apply-phase3:
	@echo "=== Applying Phase 3 patches (hard) ==="
	$(SCRIPTS_DIR)/apply-fingerprint-patches.sh phase3

apply-browseros:
	@echo "=== Applying BrowserOS custom patches ==="
	$(SCRIPTS_DIR)/apply-fingerprint-patches.sh browseros

apply-patches: apply-phase1 apply-phase2 apply-phase3 apply-browseros
	@echo "All patches applied."

# ── Build ──────────────────────────────────────────────────────────

build:
	cd $(UPSTREAM_DIR) && npm run build

build-ui:
	cd $(UPSTREAM_DIR) && npm run build:ui

# ── Run ────────────────────────────────────────────────────────────

run:
	cd $(UPSTREAM_DIR) && npm start

run-profile:
	cd $(UPSTREAM_DIR) && \
	CAMOU_CONFIG='{"screen.width":1920,"screen.height":1080,"timezone":"America/New_York","profile.name":"test-zen","profile.color":"#4CAF50","profile.ip":"203.0.113.42","profile.country":"US","debug":true}' \
	npm start

# ── Development ────────────────────────────────────────────────────

export-patch:
	@echo "Usage: make export-patch FILE=path/relative/to/engine"
	@echo "Example: make export-patch FILE=dom/base/nsScreen.cpp"
	@if [ -n "$(FILE)" ]; then \
		cd $(UPSTREAM_DIR) && npm run export $(FILE); \
	fi

reset:
	@echo "Resetting engine to clean state..."
	cd $(UPSTREAM_DIR) && npm run reset-ff && npm run init

clean:
	cd $(UPSTREAM_DIR) && rm -rf engine/obj-*

generate-config:
	@python3 $(SCRIPTS_DIR)/generate-config.py $(ARGS)

# ── Controller Extension ──────────────────────────────────────────

build-controller-ext:
	@echo "=== Building Controller Extension ==="
	cd $(CONTROLLER_EXT_DIR) && bun install && bun run build
	@echo "Controller extension built."
	@if [ -f "$(CONTROLLER_EXT_DIR)/controller.xpi" ]; then \
		echo "XPI available at: $(CONTROLLER_EXT_DIR)/controller.xpi"; \
	fi

# ── Full Pipeline ──────────────────────────────────────────────────

all: init copy-additions apply-patches build-controller-ext build
	@echo "Build complete! Run 'make run' to launch."
