/**
 * Profile REST API Server
 *
 * Provides an AdsPower-compatible HTTP REST API for managing browser profiles.
 * Allows external tools (Selenium, Playwright, scripts) to integrate with
 * Craft Agents for multi-profile browser management.
 *
 * Default port: 50325 (similar to AdsPower's API port)
 */

import {
  getProfileMcpPort,
  isBrowserRunning,
  launchBrowserWithMcp,
  stopBrowser,
} from '../browser-profiles/launcher'
import {
  createProfile,
  deleteProfile,
  getProfile,
  listProfiles,
  updateProfile,
} from '../browser-profiles/storage'
import type {
  CreateProfileInput,
  UpdateProfileInput,
} from '../browser-profiles/types'

const DEFAULT_API_PORT = 50325

interface ApiResponse<T = unknown> {
  code: number
  msg: string
  data?: T
}

function jsonResponse<T>(data: ApiResponse<T>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function success<T>(data: T): Response {
  return jsonResponse({ code: 0, msg: 'success', data })
}

function error(msg: string, code = -1, status = 400): Response {
  return jsonResponse({ code, msg }, status)
}

function getPathSegments(url: URL): string[] {
  return url.pathname.replace(/^\/+|\/+$/g, '').split('/')
}

async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const method = request.method.toUpperCase()
  const segments = getPathSegments(url)

  // CORS headers
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  // Route: GET /api/profiles
  if (segments[0] === 'api' && segments[1] === 'profiles') {
    // GET /api/profiles — list all profiles
    if (!segments[2] && method === 'GET') {
      const profiles = listProfiles()
      const enriched = profiles.map((p) => ({
        ...p,
        isRunning: isBrowserRunning(p.id),
      }))
      return success({ list: enriched, total: enriched.length })
    }

    // POST /api/profiles — create profile
    if (!segments[2] && method === 'POST') {
      const body = await parseJsonBody<CreateProfileInput>(request)
      if (!body?.name) {
        return error('name is required')
      }
      try {
        const profile = await createProfile(body)
        return success(profile)
      } catch (err) {
        return error(String(err))
      }
    }

    const profileId = segments[2]
    if (!profileId) {
      return error('profile id required', -1, 404)
    }

    // POST /api/profiles/:id/launch
    if (segments[3] === 'launch' && method === 'POST') {
      const profile = getProfile(profileId)
      if (!profile) return error('profile not found', -1, 404)
      if (isBrowserRunning(profileId)) {
        const mcpPort = getProfileMcpPort(profileId)
        return success({
          success: true,
          mcpPort,
          mcpUrl: mcpPort ? `http://127.0.0.1:${mcpPort}/mcp` : undefined,
          message: 'browser already running',
        })
      }
      try {
        const result = await launchBrowserWithMcp(profile, {
          waitForMcp: true,
          mcpTimeout: 30000,
        })
        return success({
          ...result,
          mcpUrl: result.mcpPort
            ? `http://127.0.0.1:${result.mcpPort}/mcp`
            : undefined,
        })
      } catch (err) {
        return error(String(err))
      }
    }

    // POST /api/profiles/:id/close
    if (segments[3] === 'close' && method === 'POST') {
      if (!isBrowserRunning(profileId)) {
        return error('browser not running')
      }
      const stopped = stopBrowser(profileId)
      return success({ stopped })
    }

    // GET /api/profiles/:id/status
    if (segments[3] === 'status' && method === 'GET') {
      const profile = getProfile(profileId)
      if (!profile) return error('profile not found', -1, 404)
      const isRunning = isBrowserRunning(profileId)
      const mcpPort = isRunning ? getProfileMcpPort(profileId) : undefined
      return success({
        id: profileId,
        status: profile.status,
        isRunning,
        mcpPort,
        mcpUrl: mcpPort ? `http://127.0.0.1:${mcpPort}/mcp` : undefined,
      })
    }

    // No sub-route — CRUD on profile
    if (!segments[3]) {
      // GET /api/profiles/:id
      if (method === 'GET') {
        const profile = getProfile(profileId)
        if (!profile) return error('profile not found', -1, 404)
        return success({
          ...profile,
          isRunning: isBrowserRunning(profileId),
        })
      }

      // PUT /api/profiles/:id
      if (method === 'PUT') {
        const body = await parseJsonBody<UpdateProfileInput>(request)
        if (!body) return error('invalid JSON body')
        try {
          const updated = updateProfile(profileId, body)
          if (!updated) return error('profile not found', -1, 404)
          return success(updated)
        } catch (err) {
          return error(String(err))
        }
      }

      // DELETE /api/profiles/:id
      if (method === 'DELETE') {
        if (isBrowserRunning(profileId)) {
          stopBrowser(profileId)
        }
        const deleted = deleteProfile(profileId)
        if (!deleted) return error('profile not found', -1, 404)
        return success({ deleted: true })
      }
    }
  }

  // Health check
  if (segments[0] === 'api' && segments[1] === 'health') {
    return success({ status: 'ok', version: '1.0.0' })
  }

  return error('not found', -1, 404)
}

let server: ReturnType<typeof Bun.serve> | null = null

/**
 * Start the Profile REST API server
 */
export function startProfileApi(port = DEFAULT_API_PORT): {
  port: number
  stop: () => void
} {
  if (server) {
    throw new Error('Profile API server is already running')
  }

  server = Bun.serve({
    port,
    fetch(request) {
      return handleRequest(request).then((response) => {
        // Add CORS header to all responses
        response.headers.set('Access-Control-Allow-Origin', '*')
        return response
      })
    },
  })

  const actualPort = server.port ?? port
  console.log(`Profile API server started on http://localhost:${actualPort}`)

  return {
    port: actualPort as number,
    stop() {
      if (server) {
        server.stop()
        server = null
        console.log('Profile API server stopped')
      }
    },
  }
}

/**
 * Stop the Profile REST API server
 */
export function stopProfileApi(): void {
  if (server) {
    server.stop()
    server = null
  }
}

export { DEFAULT_API_PORT }
