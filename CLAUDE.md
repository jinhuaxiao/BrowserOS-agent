# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a unified monorepo (agent-platform) with two major subsystems:

- `apps/` + `packages/shared` + `packages/agent-sdk` — TypeScript/Bun AI Agent system (MCP server, Chrome extensions, SDK)
- `packages/browseros/` — Python Chromium build system (fingerprint browser)
- `packages/craft-agents/` — Electron desktop client (Craft Agents) for multi-profile management and batch orchestration

### BrowserOS Build System (`packages/browseros/`)
- Language: Python 3.12+
- Build: `cd packages/browseros && uv run browseros build`
- Chromium source: `/Users/xiaojinhua/chromium/src`
- Patches: `packages/browseros/chromium_patches/` — C++ source patches for fingerprint APIs
- Config generation: `packages/browseros/build/scripts/fingerprint/generate_config.py`
- Docs: `packages/browseros/docs/`

### Craft Agents (`packages/craft-agents/`)
Electron desktop client (git subtree from `jinhuaxiao/browseragent`). Provides multi-fingerprint browser profile management, proxy pool management, batch BrowserOS instance launching, and Claude Agent SDK integration.

- Language: TypeScript/React (Electron + Vite)
- Package scope: `@craft-agent/*`
- Apps: `packages/craft-agents/apps/electron/` (main Electron app), `packages/craft-agents/apps/viewer/`
- Packages: `packages/craft-agents/packages/core/`, `packages/craft-agents/packages/shared/`, `packages/craft-agents/packages/ui/`
- Start dev: `bun run craft:dev`
- Build: `bun run craft:build`

## Docs Image Workflow

When updating documentation that involves new screenshots or images:

1. Prompt the user to copy the image to their clipboard (Cmd+C)
2. Run: `python scripts/save_clipboard.py <target_path>`
3. Example: `python scripts/save_clipboard.py docs/images/agent-step.png`

## Coding guidelines

- **Use extensionless imports.** Do not use `.js` extensions in TypeScript imports. Bun resolves `.ts` files automatically.
  ```typescript
  // ✅ Correct
  import { foo } from './utils'
  import type { Bar } from '../types'

  // ❌ Wrong
  import { foo } from './utils.js'
  ```
- Write minimal code comments. Only add comments for non-obvious logic, complex algorithms, or critical warnings. Skip comments for self-explanatory code, obvious function names, and simple operations.
- Logger messages should not include `[prefix]` tags (e.g., `[Config]`, `[HTTP Server]`). Source tracking automatically adds file:line:function in development mode.
- Avoid magic constants scattered in the codebase. Use `@browseros/shared` for all shared configuration:
  - `@browseros/shared/constants/ports` - Port numbers (DEFAULT_PORTS, TEST_PORTS)
  - `@browseros/shared/constants/timeouts` - Timeout values (TIMEOUTS)
  - `@browseros/shared/constants/limits` - Rate limits, pagination, content limits (RATE_LIMITS, AGENT_LIMITS, etc.)
  - `@browseros/shared/constants/urls` - External service URLs (EXTERNAL_URLS)
  - `@browseros/shared/constants/paths` - File system paths (PATHS)
  - `@browseros/shared/types/logger` - Logger interface types (LoggerInterface, LogLevel)

## File Naming Convention

Use **kebab-case** for all file and folder names:

| Type | Convention | Example |
|------|------------|---------|
| Multi-word files | kebab-case | `gemini-agent.ts`, `mcp-context.ts` |
| Single-word files | lowercase | `types.ts`, `browser.ts`, `index.ts` |
| Test files | `.test.ts` suffix | `mcp-context.test.ts` |
| Folders | kebab-case | `controller-server/`, `rate-limiter/` |

Classes remain PascalCase in code, but live in kebab-case files:
```typescript
// file: gemini-agent.ts
export class GeminiAgent { ... }
```

## Project Overview

**BrowserOS Server** - The automation engine inside BrowserOS. This MCP server powers the built-in AI agent and lets external tools like `claude-code` or `gemini-cli` control the browser. Starts automatically when BrowserOS launches.

## Bun Preferences

Default to using Bun instead of Node.js:

- Use `bun <file>` instead of `node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install`
- Use `bun run <script>` instead of `npm run <script>`
- Bun automatically loads .env (no dotenv needed)

## Common Commands

```bash
# Start server (development)
bun run start                    # Loads .env.dev automatically

# Testing
bun run test                     # Run controller-based and common tests
bun run test:cdp                 # Run CDP-based tests (requires CDP connection)
bun run test:controller          # Run controller-based tests only
bun run test:integration         # Run integration tests
bun run test:all                 # Run all tests

# Run a single test file
bun --env-file=.env.dev test apps/server/tests/path/to/file.test.ts

# Linting
bun run lint                     # Check with Biome
bun run lint:fix                 # Auto-fix with Biome

# Type checking
bun run typecheck                # TypeScript build check

# Build
bun run dev:server               # Build server for development
bun run dev:ext                  # Build extension for development
bun run dist:server              # Build server for production (all targets)
bun run dist:ext                 # Build extension for production

# Craft Agents (Electron desktop client)
bun run craft:dev                # Start Electron in development mode
bun run craft:start              # Start Electron
bun run craft:build              # Build Electron for production
```

## Architecture

This is a monorepo with three packages in `apps/`:

### Server (`apps/server`)
The main MCP server that exposes browser automation tools via HTTP/SSE.

**Entry point:** `apps/server/src/index.ts` → `apps/server/src/main.ts`

**Key components:**
- `src/tools/` - MCP tool definitions, split into:
  - `cdp-based/` - Tools using Chrome DevTools Protocol (network, console, emulation, input, etc.)
  - `controller-based/` - Tools using the browser extension (navigation, clicks, screenshots, tabs, history, bookmarks)
- `src/controller-server/` - WebSocket server that bridges to the browser extension
  - `ControllerBridge` handles WebSocket connections with extension clients
  - `ControllerContext` wraps the bridge for tool handlers
- `src/common/` - Shared utilities (McpContext, PageCollector, browser connection, identity, db)
- `src/agent/` - AI agent functionality (Gemini adapter, rate limiting, session management)
- `src/http/` - Hono HTTP server with MCP, health, and provider routes

**Tool types:**
- CDP tools require a direct CDP connection (`--cdp-port`)
- Controller tools work via the browser extension over WebSocket

### Shared (`packages/shared`)
Shared constants, types, and configuration used by both server and extension. Avoids magic numbers.

**Structure:**
- `src/constants/` - Configuration values (ports, timeouts, limits, urls, paths)
- `src/types/` - Shared type definitions (logger)

**Exports:** `@browseros/shared/constants/*`, `@browseros/shared/types/*`

### Controller Extension (`apps/controller-ext`)
Chrome extension that receives commands from the server via WebSocket.

**Entry point:** `src/background/index.ts` → `BrowserOSController`

**Structure:**
- `src/actions/` - Action handlers organized by domain (browser/, tab/, bookmark/, history/)
- `src/adapters/` - Chrome API adapters (TabAdapter, BookmarkAdapter, HistoryAdapter)
- `src/websocket/` - WebSocket client that connects to the server

### Communication Flow

```
AI Agent/MCP Client → HTTP Server (Hono) → Tool Handler
                                              ↓
                        CDP (direct) ←── or ──→ WebSocket → Extension → Chrome APIs
```

## Creating Packages

When creating new packages in this monorepo:

- **Location:** Packages go in `packages/`, apps go in `apps/`
- **No index.ts:** Don't create or export an `index.ts` - it inflates the bundle with all exports
- **Separate export files:** Keep exports in individual files (e.g., `logger.ts`, `ports.ts`)
- **Import pattern:** `import { X } from "@my-package/name/logger"` - only imports what's needed

**package.json exports:** Must include both `types` and `default` for TypeScript:
```json
"exports": {
  "./constants/ports": {
    "types": "./src/constants/ports.ts",
    "default": "./src/constants/ports.ts"
  },
  "./types/logger": {
    "types": "./src/types/logger.ts",
    "default": "./src/types/logger.ts"
  }
}
```

## Test Organization

Tests are in `apps/server/tests/`:
- `tools/cdp-based/` - Tests requiring CDP connection (browser must be running)
- `tools/controller-based/` - Tests using mocked controller context
- `common/` - Unit tests for common utilities
- `__helpers__/` - Test utilities and fixtures
