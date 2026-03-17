/**
 * Cookie Storage
 *
 * Import/export cookies for browser profiles.
 * Supports JSON and Netscape format parsing/serialization.
 * Provides CDP-based injection for running browsers.
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CookieFormat, CookieItem } from './cookie-types.ts'
import { getProfilePath } from './storage.ts'

/**
 * Parse cookies from text input
 */
export function parseCookies(text: string, format: CookieFormat): CookieItem[] {
  if (format === 'json') {
    return parseJsonCookies(text)
  }
  return parseNetscapeCookies(text)
}

function parseJsonCookies(text: string): CookieItem[] {
  const parsed = JSON.parse(text)
  const items = Array.isArray(parsed) ? parsed : []

  return items
    .filter(
      (item: Record<string, unknown>) =>
        typeof item.name === 'string' && typeof item.domain === 'string',
    )
    .map((item: Record<string, unknown>) => ({
      name: String(item.name),
      value: String(item.value ?? ''),
      domain: String(item.domain),
      path: String(item.path ?? '/'),
      expires:
        typeof item.expires === 'number'
          ? item.expires
          : typeof item.expirationDate === 'number'
            ? item.expirationDate
            : undefined,
      httpOnly: Boolean(item.httpOnly),
      secure: Boolean(item.secure),
      sameSite: normalizeSameSite(item.sameSite),
    }))
}

function normalizeSameSite(
  value: unknown,
): 'Strict' | 'Lax' | 'None' | undefined {
  if (typeof value !== 'string') return undefined
  const lower = value.toLowerCase()
  if (lower === 'strict') return 'Strict'
  if (lower === 'lax') return 'Lax'
  if (lower === 'none' || lower === 'no_restriction') return 'None'
  return undefined
}

function parseNetscapeCookies(text: string): CookieItem[] {
  const cookies: CookieItem[] = []
  const lines = text.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const parts = trimmed.split('\t')
    if (parts.length < 7) continue

    const [domain, , path, secure, expires, name, value] = parts
    cookies.push({
      name: name || '',
      value: value || '',
      domain: domain || '',
      path: path || '/',
      expires: expires ? Number(expires) : undefined,
      httpOnly: false,
      secure: secure?.toUpperCase() === 'TRUE',
    })
  }

  return cookies
}

/**
 * Serialize cookies to text output
 */
export function serializeCookies(
  cookies: CookieItem[],
  format: CookieFormat,
): string {
  if (format === 'json') {
    return JSON.stringify(cookies, null, 2)
  }
  return serializeNetscapeCookies(cookies)
}

function serializeNetscapeCookies(cookies: CookieItem[]): string {
  const lines = ['# Netscape HTTP Cookie File', '']

  for (const cookie of cookies) {
    const includeSubdomains = cookie.domain.startsWith('.') ? 'TRUE' : 'FALSE'
    const secure = cookie.secure ? 'TRUE' : 'FALSE'
    const expires = cookie.expires ? String(Math.floor(cookie.expires)) : '0'

    lines.push(
      [
        cookie.domain,
        includeSubdomains,
        cookie.path,
        secure,
        expires,
        cookie.name,
        cookie.value,
      ].join('\t'),
    )
  }

  return lines.join('\n')
}

/**
 * Get cookie file path for a profile
 */
function getCookieFilePath(profileId: string): string {
  return join(getProfilePath(profileId), 'cookies.json')
}

/**
 * Save cookies to a profile's cookie file
 */
export function saveCookiesToProfile(
  profileId: string,
  cookies: CookieItem[],
): void {
  const cookiePath = getCookieFilePath(profileId)
  writeFileSync(cookiePath, JSON.stringify(cookies, null, 2))
}

/**
 * Load cookies from a profile's cookie file
 */
export function loadCookiesFromProfile(profileId: string): CookieItem[] {
  const cookiePath = getCookieFilePath(profileId)
  if (!existsSync(cookiePath)) return []

  try {
    return JSON.parse(readFileSync(cookiePath, 'utf-8')) as CookieItem[]
  } catch {
    return []
  }
}

/**
 * Check if a profile has stored cookies
 */
export function profileHasCookies(profileId: string): boolean {
  return existsSync(getCookieFilePath(profileId))
}

/**
 * Delete cookies file for a profile
 */
export function deleteCookiesFromProfile(profileId: string): void {
  const cookiePath = getCookieFilePath(profileId)
  if (existsSync(cookiePath)) {
    unlinkSync(cookiePath)
  }
}

/**
 * Inject cookies into a running browser via CDP
 * Only works for Chromium-based browsers
 */
export async function injectCookiesViaCDP(
  cdpPort: number,
  cookies: CookieItem[],
): Promise<{ success: number; failed: number }> {
  const result = { success: 0, failed: 0 }

  // Get a page target's WebSocket URL for CDP commands
  const wsUrl = await getCdpWebSocketUrl(cdpPort)

  // Batch set cookies using Network.setCookies (single CDP call)
  const cdpCookies = cookies.map((cookie) => {
    const c: Record<string, unknown> = {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || '/',
    }
    if (cookie.expires) c.expires = cookie.expires
    if (cookie.httpOnly !== undefined) c.httpOnly = cookie.httpOnly
    if (cookie.secure !== undefined) c.secure = cookie.secure
    if (cookie.sameSite) c.sameSite = cookie.sameSite
    return c
  })

  try {
    await cdpCommand(wsUrl, 'Network.setCookies', { cookies: cdpCookies })
    result.success = cookies.length
  } catch {
    // Fallback: set one by one
    for (const cookie of cookies) {
      try {
        const params: Record<string, unknown> = {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
        }
        if (cookie.expires) params.expires = cookie.expires
        if (cookie.httpOnly !== undefined) params.httpOnly = cookie.httpOnly
        if (cookie.secure !== undefined) params.secure = cookie.secure
        if (cookie.sameSite) params.sameSite = cookie.sameSite
        await cdpCommand(wsUrl, 'Network.setCookie', params)
        result.success++
      } catch {
        result.failed++
      }
    }
  }

  return result
}

/**
 * Export cookies from a running browser via CDP
 */
export async function exportCookiesViaCDP(
  cdpPort: number,
  domains?: string[],
): Promise<CookieItem[]> {
  const wsUrl = await getCdpWebSocketUrl(cdpPort)

  const cdpResult = await cdpCommand(wsUrl, 'Network.getAllCookies', {})
  const allCookies = (
    (cdpResult as { cookies?: Array<Record<string, unknown>> })?.cookies || []
  ).map(
    (c: Record<string, unknown>): CookieItem => ({
      name: String(c.name ?? ''),
      value: String(c.value ?? ''),
      domain: String(c.domain ?? ''),
      path: String(c.path ?? '/'),
      expires: typeof c.expires === 'number' ? c.expires : undefined,
      httpOnly: Boolean(c.httpOnly),
      secure: Boolean(c.secure),
      sameSite: normalizeSameSite(c.sameSite),
    }),
  )

  if (domains && domains.length > 0) {
    return allCookies.filter((c) =>
      domains.some(
        (d) =>
          c.domain === d || c.domain === `.${d}` || c.domain.endsWith(`.${d}`),
      ),
    )
  }

  return allCookies
}

/**
 * Get the CDP WebSocket debugger URL for a browser
 */
async function getCdpWebSocketUrl(cdpPort: number): Promise<string> {
  // Try page target first, then browser endpoint
  try {
    const pagesRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`, {
      signal: AbortSignal.timeout(5000),
    })
    const pages = (await pagesRes.json()) as Array<{
      webSocketDebuggerUrl?: string
    }>
    const pageWs = pages[0]?.webSocketDebuggerUrl
    if (pageWs) return pageWs
  } catch {}

  const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`, {
    signal: AbortSignal.timeout(5000),
  })
  const info = (await res.json()) as { webSocketDebuggerUrl?: string }
  if (!info.webSocketDebuggerUrl) {
    throw new Error(`No CDP WebSocket endpoint on port ${cdpPort}`)
  }
  return info.webSocketDebuggerUrl
}

/**
 * Execute a CDP command via raw WebSocket using Node.js http module
 * No external WebSocket library needed
 */
async function cdpCommand(
  wsUrl: string,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const http = await import('node:http')
  const crypto = await import('node:crypto')
  const url = new URL(wsUrl)

  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000)
    let settled = false
    const key = crypto.randomBytes(16).toString('base64')

    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      fn()
    }

    const timer = setTimeout(() => {
      settle(() => reject(new Error(`CDP command ${method} timed out`)))
    }, 10000)

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'GET',
        headers: {
          Upgrade: 'websocket',
          Connection: 'Upgrade',
          'Sec-WebSocket-Key': key,
          'Sec-WebSocket-Version': '13',
        },
      },
      () => {
        settle(() => {
          clearTimeout(timer)
          reject(new Error('Unexpected HTTP response'))
        })
      },
    )

    req.on('upgrade', (_res, socket) => {
      // Send CDP command
      const payload = JSON.stringify({ id, method, params })
      const payloadBuf = Buffer.from(payload, 'utf-8')

      // Build WebSocket frame (unmasked, text)
      let header: Buffer
      if (payloadBuf.length < 126) {
        header = Buffer.alloc(6)
        header[0] = 0x81 // FIN + text
        header[1] = 0x80 | payloadBuf.length // masked + length
      } else if (payloadBuf.length < 65536) {
        header = Buffer.alloc(8)
        header[0] = 0x81
        header[1] = 0x80 | 126
        header.writeUInt16BE(payloadBuf.length, 2)
      } else {
        header = Buffer.alloc(14)
        header[0] = 0x81
        header[1] = 0x80 | 127
        header.writeBigUInt64BE(BigInt(payloadBuf.length), 2)
      }

      // Mask key (4 bytes)
      const maskKey = crypto.randomBytes(4)
      const maskedPayload = Buffer.alloc(payloadBuf.length)
      for (let i = 0; i < payloadBuf.length; i++) {
        maskedPayload[i] = payloadBuf[i]! ^ maskKey[i % 4]!
      }

      // Write mask key at the end of header
      const maskOffset = header.length - 4
      maskKey.copy(header, maskOffset)

      socket.write(Buffer.concat([header, maskedPayload]))

      // Read response frames
      let buf = Buffer.alloc(0)

      socket.on('data', (chunk: Buffer) => {
        buf = Buffer.concat([buf, chunk])

        // Parse WebSocket frame(s)
        while (buf.length >= 2) {
          const secondByte = buf[1]!
          const masked = (secondByte & 0x80) !== 0
          let payloadLen = secondByte & 0x7f
          let offset = 2

          if (payloadLen === 126) {
            if (buf.length < 4) return
            payloadLen = buf.readUInt16BE(2)
            offset = 4
          } else if (payloadLen === 127) {
            if (buf.length < 10) return
            payloadLen = Number(buf.readBigUInt64BE(2))
            offset = 10
          }

          if (masked) offset += 4

          if (buf.length < offset + payloadLen) return

          const framePayload = buf.subarray(offset, offset + payloadLen)
          buf = buf.subarray(offset + payloadLen)

          try {
            const msg = JSON.parse(framePayload.toString()) as {
              id?: number
              result?: unknown
              error?: { message?: string }
            }
            if (msg.id === id) {
              settle(() => {
                clearTimeout(timer)
                socket.destroy()
                if (msg.error) {
                  reject(new Error(msg.error.message || 'CDP error'))
                } else {
                  resolve(msg.result)
                }
              })
              return
            }
          } catch {}
        }
      })

      socket.on('error', (err: Error) => {
        settle(() => {
          clearTimeout(timer)
          reject(err)
        })
      })

      socket.on('close', () => {
        settle(() => {
          clearTimeout(timer)
          reject(new Error('WebSocket closed'))
        })
      })
    })

    req.on('error', (err) => {
      settle(() => {
        clearTimeout(timer)
        reject(err)
      })
    })

    req.end()
  })
}
