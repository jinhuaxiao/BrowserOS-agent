/**
 * Cron Trigger
 *
 * Handles cron expression parsing and next execution time calculation.
 * Uses a simple cron parser implementation that supports standard 5-field expressions.
 *
 * Cron Expression Format:
 * ┌───────────── minute (0 - 59)
 * │ ┌───────────── hour (0 - 23)
 * │ │ ┌───────────── day of month (1 - 31)
 * │ │ │ ┌───────────── month (1 - 12)
 * │ │ │ │ ┌───────────── day of week (0 - 6) (Sunday = 0)
 * │ │ │ │ │
 * * * * * *
 *
 * Special characters:
 * - *: any value
 * - ,: value list separator
 * - -: range of values
 * - /: step values
 */

import type { CronTriggerConfig } from '../types.ts'

// ============================================================================
// Types
// ============================================================================

interface CronField {
  values: number[]
  any: boolean
}

interface ParsedCron {
  minute: CronField
  hour: CronField
  dayOfMonth: CronField
  month: CronField
  dayOfWeek: CronField
}

// Field constraints
const FIELD_CONSTRAINTS = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dayOfMonth: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  dayOfWeek: { min: 0, max: 6 },
} as const

// Named values
const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

const DAY_NAMES: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

// ============================================================================
// Parsing
// ============================================================================

/**
 * Parse a single cron field
 */
function parseField(
  field: string,
  fieldName: keyof typeof FIELD_CONSTRAINTS,
  names?: Record<string, number>,
): CronField {
  const { min, max } = FIELD_CONSTRAINTS[fieldName]
  const values: Set<number> = new Set()

  // Handle any value
  if (field === '*') {
    return { values: [], any: true }
  }

  // Split by comma for value lists
  const parts = field.split(',')

  for (const part of parts) {
    let valuePart = part
    let step = 1

    // Handle step values (e.g., */5, 0-30/5)
    if (part.includes('/')) {
      const [range, stepStr] = part.split('/')
      if (range === undefined || stepStr === undefined) {
        throw new Error(`Invalid step format in field "${fieldName}": ${part}`)
      }
      valuePart = range
      step = parseInt(stepStr, 10)
      if (Number.isNaN(step) || step < 1) {
        throw new Error(`Invalid step value in field "${fieldName}": ${part}`)
      }
    }

    // Handle range or single value
    if (valuePart === '*') {
      // All values with step
      for (let i = min; i <= max; i += step) {
        values.add(i)
      }
    } else if (valuePart.includes('-')) {
      // Range (e.g., 1-5, mon-fri)
      const [startStr, endStr] = valuePart.split('-')
      if (startStr === undefined || endStr === undefined) {
        throw new Error(
          `Invalid range format in field "${fieldName}": ${valuePart}`,
        )
      }
      const start = parseValue(startStr, min, max, names)
      const end = parseValue(endStr, min, max, names)

      if (start > end) {
        // Wrap around (e.g., 11-2 for hours means 11, 12, 0, 1, 2)
        for (let i = start; i <= max; i += step) values.add(i)
        for (let i = min; i <= end; i += step) values.add(i)
      } else {
        for (let i = start; i <= end; i += step) {
          values.add(i)
        }
      }
    } else {
      // Single value
      const value = parseValue(valuePart, min, max, names)
      values.add(value)
    }
  }

  return { values: Array.from(values).sort((a, b) => a - b), any: false }
}

/**
 * Parse a single value (number or name)
 */
function parseValue(
  str: string,
  min: number,
  max: number,
  names?: Record<string, number>,
): number {
  const lower = str.toLowerCase()

  // Check named values
  if (names && lower in names) {
    const namedValue = names[lower]
    if (namedValue !== undefined) {
      return namedValue
    }
  }

  // Parse as number
  const num = parseInt(str, 10)
  if (Number.isNaN(num) || num < min || num > max) {
    throw new Error(`Invalid value "${str}" (expected ${min}-${max})`)
  }

  return num
}

/**
 * Parse a cron expression into structured fields
 */
function parseCronExpression(expression: string): ParsedCron {
  const fields = expression.trim().split(/\s+/)

  if (fields.length !== 5) {
    throw new Error(
      `Invalid cron expression: expected 5 fields, got ${fields.length}. ` +
        `Format: "minute hour dayOfMonth month dayOfWeek"`,
    )
  }

  const [minuteField, hourField, dayOfMonthField, monthField, dayOfWeekField] =
    fields
  if (
    minuteField === undefined ||
    hourField === undefined ||
    dayOfMonthField === undefined ||
    monthField === undefined ||
    dayOfWeekField === undefined
  ) {
    throw new Error(`Invalid cron expression: missing required fields`)
  }

  return {
    minute: parseField(minuteField, 'minute'),
    hour: parseField(hourField, 'hour'),
    dayOfMonth: parseField(dayOfMonthField, 'dayOfMonth'),
    month: parseField(monthField, 'month', MONTH_NAMES),
    dayOfWeek: parseField(dayOfWeekField, 'dayOfWeek', DAY_NAMES),
  }
}

// ============================================================================
// Next Time Calculation
// ============================================================================

/**
 * Check if a value matches a cron field
 */
function matchesField(value: number, field: CronField): boolean {
  return field.any || field.values.includes(value)
}

/**
 * Get the next value that matches a field, starting from current
 */
function getNextValue(
  current: number,
  field: CronField,
  _min: number,
  _max: number,
): number | null {
  if (field.any) {
    return current
  }

  // Find next matching value >= current
  for (const val of field.values) {
    if (val >= current) {
      return val
    }
  }

  // Wrap around - return first value (will need to increment higher field)
  return null
}

function getFirstValue(field: CronField, fallback: number): number {
  return field.values[0] ?? fallback
}

/**
 * Get the next execution time for a cron expression
 *
 * @param expression - Cron expression (5 fields)
 * @param timezone - Optional timezone (not yet implemented, uses local)
 * @param from - Starting point (default: now)
 * @returns Next execution time as Date
 */
export function getNextCronTime(
  expression: string,
  _timezone?: string,
  from?: Date,
): Date {
  const parsed = parseCronExpression(expression)
  const now = from || new Date()

  // Start from the next minute
  const next = new Date(now)
  next.setSeconds(0)
  next.setMilliseconds(0)
  next.setMinutes(next.getMinutes() + 1)

  // Safety limit to prevent infinite loops
  const maxIterations = 366 * 24 * 60 // 1 year of minutes
  let iterations = 0

  while (iterations < maxIterations) {
    iterations++

    const month = next.getMonth() + 1 // JavaScript months are 0-indexed
    const dayOfMonth = next.getDate()
    const dayOfWeek = next.getDay()
    const hour = next.getHours()
    const minute = next.getMinutes()

    // Check month
    if (!matchesField(month, parsed.month)) {
      // Move to next matching month
      const nextMonth = getNextValue(month, parsed.month, 1, 12)
      if (nextMonth === null || nextMonth < month) {
        // Wrap to next year
        next.setFullYear(next.getFullYear() + 1)
        next.setMonth(parsed.month.any ? 0 : getFirstValue(parsed.month, 1) - 1)
      } else {
        next.setMonth(nextMonth - 1)
      }
      next.setDate(1)
      next.setHours(0)
      next.setMinutes(0)
      continue
    }

    // Check day (both dayOfMonth and dayOfWeek must match if both are specified)
    const dayOfMonthMatches = matchesField(dayOfMonth, parsed.dayOfMonth)
    const dayOfWeekMatches = matchesField(dayOfWeek, parsed.dayOfWeek)

    // Standard cron: if both are restricted, either can match (OR logic)
    // If one is *, it's ignored (AND logic with the other)
    const dayMatches =
      (parsed.dayOfMonth.any && parsed.dayOfWeek.any) ||
      (parsed.dayOfMonth.any && dayOfWeekMatches) ||
      (parsed.dayOfWeek.any && dayOfMonthMatches) ||
      (!parsed.dayOfMonth.any &&
        !parsed.dayOfWeek.any &&
        (dayOfMonthMatches || dayOfWeekMatches))

    if (!dayMatches) {
      // Move to next day
      next.setDate(next.getDate() + 1)
      next.setHours(0)
      next.setMinutes(0)
      continue
    }

    // Check hour
    if (!matchesField(hour, parsed.hour)) {
      const nextHour = getNextValue(hour, parsed.hour, 0, 23)
      if (nextHour === null || nextHour < hour) {
        // Wrap to next day
        next.setDate(next.getDate() + 1)
        next.setHours(parsed.hour.any ? 0 : getFirstValue(parsed.hour, 0))
      } else {
        next.setHours(nextHour)
      }
      next.setMinutes(parsed.minute.any ? 0 : getFirstValue(parsed.minute, 0))
      continue
    }

    // Check minute
    if (!matchesField(minute, parsed.minute)) {
      const nextMinute = getNextValue(minute, parsed.minute, 0, 59)
      if (nextMinute === null || nextMinute < minute) {
        // Wrap to next hour
        next.setHours(next.getHours() + 1)
        next.setMinutes(parsed.minute.any ? 0 : getFirstValue(parsed.minute, 0))
      } else {
        next.setMinutes(nextMinute)
      }
      continue
    }

    // All fields match!
    return next
  }

  throw new Error(
    `Could not find next execution time for "${expression}" within 1 year`,
  )
}

/**
 * Validate a cron expression
 *
 * @param expression - Cron expression to validate
 * @returns True if valid, false otherwise
 */
export function isValidCronExpression(expression: string): boolean {
  try {
    parseCronExpression(expression)
    return true
  } catch {
    return false
  }
}

/**
 * Get a human-readable description of a cron expression
 *
 * @param expression - Cron expression to describe
 * @returns Human-readable description
 */
export function describeCronExpression(expression: string): string {
  try {
    const parsed = parseCronExpression(expression)
    const parts: string[] = []

    // Describe minute
    if (parsed.minute.any) {
      parts.push('every minute')
    } else if (parsed.minute.values.length === 1) {
      parts.push(`at minute ${parsed.minute.values[0]}`)
    } else {
      parts.push(`at minutes ${parsed.minute.values.join(', ')}`)
    }

    // Describe hour
    if (!parsed.hour.any) {
      if (parsed.hour.values.length === 1) {
        const hour = parsed.hour.values[0] ?? 0
        const period = hour >= 12 ? 'PM' : 'AM'
        const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
        parts.push(`at ${hour12}${period}`)
      } else {
        parts.push(`during hours ${parsed.hour.values.join(', ')}`)
      }
    }

    // Describe day of month
    if (!parsed.dayOfMonth.any) {
      if (parsed.dayOfMonth.values.length === 1) {
        parts.push(`on day ${parsed.dayOfMonth.values[0]}`)
      } else {
        parts.push(`on days ${parsed.dayOfMonth.values.join(', ')}`)
      }
    }

    // Describe day of week
    if (!parsed.dayOfWeek.any) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const days = parsed.dayOfWeek.values.map((d) => dayNames[d] ?? String(d))
      if (days.length === 5 && days.includes('Mon') && days.includes('Fri')) {
        parts.push('on weekdays')
      } else if (
        days.length === 2 &&
        days.includes('Sat') &&
        days.includes('Sun')
      ) {
        parts.push('on weekends')
      } else {
        parts.push(`on ${days.join(', ')}`)
      }
    }

    // Describe month
    if (!parsed.month.any) {
      const monthNames = [
        '',
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ]
      const months = parsed.month.values.map((m) => monthNames[m] ?? String(m))
      parts.push(`in ${months.join(', ')}`)
    }

    return parts.join(' ')
  } catch (err) {
    return `Invalid expression: ${err instanceof Error ? err.message : 'unknown error'}`
  }
}

/**
 * Calculate the next N execution times
 *
 * @param expression - Cron expression
 * @param count - Number of execution times to calculate
 * @param from - Starting point (default: now)
 * @returns Array of next execution times
 */
export function getNextCronTimes(
  expression: string,
  count: number,
  from?: Date,
): Date[] {
  const times: Date[] = []
  let current = from || new Date()

  for (let i = 0; i < count; i++) {
    const next = getNextCronTime(expression, undefined, current)
    times.push(next)
    current = new Date(next.getTime() + 60000) // Move 1 minute forward
  }

  return times
}

/**
 * Check if current time matches a cron expression
 *
 * @param expression - Cron expression
 * @param now - Time to check (default: now)
 * @returns True if the cron expression matches the given time
 */
export function matchesCron(expression: string, now?: Date): boolean {
  const parsed = parseCronExpression(expression)
  const date = now || new Date()

  const month = date.getMonth() + 1
  const dayOfMonth = date.getDate()
  const dayOfWeek = date.getDay()
  const hour = date.getHours()
  const minute = date.getMinutes()

  // Check all fields
  if (!matchesField(month, parsed.month)) return false
  if (!matchesField(hour, parsed.hour)) return false
  if (!matchesField(minute, parsed.minute)) return false

  // Day matching (OR logic if both specified)
  const dayOfMonthMatches = matchesField(dayOfMonth, parsed.dayOfMonth)
  const dayOfWeekMatches = matchesField(dayOfWeek, parsed.dayOfWeek)

  if (parsed.dayOfMonth.any && parsed.dayOfWeek.any) return true
  if (parsed.dayOfMonth.any) return dayOfWeekMatches
  if (parsed.dayOfWeek.any) return dayOfMonthMatches
  return dayOfMonthMatches || dayOfWeekMatches
}

/**
 * Create a cron trigger check function
 *
 * @param config - Cron trigger configuration
 * @returns Function that returns next execution time
 */
export function createCronTrigger(
  config: CronTriggerConfig,
): () => { nextRunAt: Date } {
  return () => {
    const nextRunAt = getNextCronTime(config.expression, config.timezone)
    return { nextRunAt }
  }
}
