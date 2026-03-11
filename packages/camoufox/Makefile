UPSTREAM_DIR := upstream
SCRIPTS_DIR := scripts
PATCHES_DIR := patches

.PHONY: clone setup fetch bootstrap dir apply-patches build package run \
        rebuild clean update help

help:
	@echo "Camoufox BrowserOS Build System"
	@echo ""
	@echo "First time setup:"
	@echo "  make clone          - Clone Camoufox upstream"
	@echo "  make fetch          - Download Firefox source tarball"
	@echo "  make bootstrap      - Install Mozilla build dependencies (macOS)"
	@echo ""
	@echo "Build:"
	@echo "  make dir            - Prepare source with Camoufox patches"
	@echo "  make apply-patches  - Apply BrowserOS patches on top"
	@echo "  make build          - Compile Firefox (calls dir + apply-patches if needed)"
	@echo "  make package        - Package macOS .app"
	@echo "  make run            - Run the built browser"
	@echo ""
	@echo "Development:"
	@echo "  make rebuild        - Rebuild without re-patching"
	@echo "  make clean          - Clean build artifacts"
	@echo "  make update         - Pull latest upstream"

# Clone upstream Camoufox repository
clone:
	@if [ ! -d "$(UPSTREAM_DIR)" ]; then \
		echo "Cloning Camoufox..."; \
		git clone --depth 1 https://github.com/daijro/camoufox $(UPSTREAM_DIR); \
	else \
		echo "Upstream already exists. Use 'make update' to pull latest."; \
	fi

# Update upstream
update:
	cd $(UPSTREAM_DIR) && git pull --rebase

# Download Firefox source tarball
fetch: clone
	cd $(UPSTREAM_DIR) && make fetch

# Install build dependencies (macOS: uses mach bootstrap)
bootstrap:
	cd $(UPSTREAM_DIR) && make mozbootstrap

# Prepare source directory with Camoufox patches
dir: clone
	cd $(UPSTREAM_DIR) && make dir

# Apply our BrowserOS patches on top of Camoufox
apply-patches:
	$(SCRIPTS_DIR)/apply-patches.sh

# Full build pipeline
build: dir apply-patches
	cd $(UPSTREAM_DIR) && make build

# Package for macOS
package:
	cd $(UPSTREAM_DIR) && make package-macos

# Run the built browser
run:
	cd $(UPSTREAM_DIR) && make run

# Run with profile badge config for testing
run-profile:
	cd $(UPSTREAM_DIR) && \
	CAMOU_CONFIG='{"profile.name":"amazon66","profile.color":"#4CAF50","profile.ip":"203.0.113.42","profile.country":"US","debug":true}' \
	make run

# Rebuild without re-applying patches
rebuild:
	cd $(UPSTREAM_DIR) && make build

# Clean build artifacts
clean:
	cd $(UPSTREAM_DIR) && make clean

# Full pipeline: fetch + bootstrap + build + package
all: fetch bootstrap build package
	@echo "Build complete! Run 'make run' to launch."
