/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Hono } from 'hono'

export function createHealthRoute(opts?: {
  extensionPort?: number
  profileId?: string
}) {
  const { extensionPort, profileId } = opts ?? {}
  return new Hono().get('/', (c) => {
    return c.json({
      status: 'ok',
      ...(extensionPort != null && { extensionPort }),
      ...(profileId && { profileId }),
    })
  })
}
