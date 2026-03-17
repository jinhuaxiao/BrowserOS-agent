/**
 * Cookie Types
 *
 * Types for cookie import/export functionality.
 */

export interface CookieItem {
  name: string
  value: string
  domain: string
  path: string
  expires?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

export type CookieFormat = 'json' | 'netscape'
