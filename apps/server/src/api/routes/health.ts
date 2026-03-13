/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Hono } from 'hono'

export function createHealthRoute(opts?: { extensionPort?: number }) {
  const extensionPort = opts?.extensionPort
  return new Hono().get('/', (c) => {
    return c.json(
      extensionPort ? { status: 'ok', extensionPort } : { status: 'ok' },
    )
  })
}
