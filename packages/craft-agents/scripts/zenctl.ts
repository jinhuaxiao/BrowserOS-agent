#!/usr/bin/env bun

import { runZenCtl } from '../packages/shared/src/browser-profiles/zenctl.ts'

const exitCode = await runZenCtl(process.argv.slice(2))
process.exit(exitCode)
