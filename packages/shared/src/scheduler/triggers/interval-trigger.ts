/**
 * Interval Trigger
 *
 * Handles fixed-interval execution scheduling.
 * Executes tasks at regular time intervals.
 */

import type { IntervalTriggerConfig } from '../types.ts';

// ============================================================================
// Types
// ============================================================================

export interface IntervalTriggerState {
  /** Last execution timestamp */
  lastExecutedAt?: number;
  /** Next scheduled execution timestamp */
  nextRunAt: number;
  /** Interval timer ID */
  timerId?: ReturnType<typeof setTimeout>;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Calculate the next execution time for an interval trigger
 *
 * @param config - Interval trigger configuration
 * @param lastExecutedAt - Last execution timestamp (optional)
 * @returns Next execution timestamp
 */
export function getNextIntervalTime(
  config: IntervalTriggerConfig,
  lastExecutedAt?: number
): number {
  const now = Date.now();

  if (!lastExecutedAt) {
    // First execution
    if (config.startImmediately) {
      return now;
    }
    return now + config.intervalMs;
  }

  // Calculate next based on last execution
  const nextTime = lastExecutedAt + config.intervalMs;

  // If we're past the next time, schedule for now + interval
  // This prevents rapid fire if execution was delayed
  if (nextTime <= now) {
    return now + config.intervalMs;
  }

  return nextTime;
}

/**
 * Validate an interval trigger configuration
 *
 * @param config - Interval trigger configuration
 * @returns True if valid, false otherwise
 */
export function isValidIntervalConfig(config: IntervalTriggerConfig): boolean {
  // Minimum interval: 1 second
  if (config.intervalMs < 1000) {
    return false;
  }

  // Maximum interval: 1 year
  if (config.intervalMs > 365 * 24 * 60 * 60 * 1000) {
    return false;
  }

  return true;
}

/**
 * Get a human-readable description of an interval
 *
 * @param intervalMs - Interval in milliseconds
 * @returns Human-readable description
 */
export function describeInterval(intervalMs: number): string {
  const seconds = Math.floor(intervalMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    if (remainingHours > 0) {
      return `every ${days} day${days > 1 ? 's' : ''} and ${remainingHours} hour${remainingHours > 1 ? 's' : ''}`;
    }
    return `every ${days} day${days > 1 ? 's' : ''}`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    if (remainingMinutes > 0) {
      return `every ${hours} hour${hours > 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
    }
    return `every ${hours} hour${hours > 1 ? 's' : ''}`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    if (remainingSeconds > 0) {
      return `every ${minutes} minute${minutes > 1 ? 's' : ''} and ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''}`;
    }
    return `every ${minutes} minute${minutes > 1 ? 's' : ''}`;
  }

  return `every ${seconds} second${seconds > 1 ? 's' : ''}`;
}

/**
 * Create an interval trigger manager
 *
 * @param config - Interval trigger configuration
 * @param onTrigger - Callback when interval fires
 * @returns Trigger controller
 */
export function createIntervalTrigger(
  config: IntervalTriggerConfig,
  onTrigger: () => void
): {
  start: () => void;
  stop: () => void;
  getState: () => IntervalTriggerState;
} {
  let state: IntervalTriggerState = {
    nextRunAt: getNextIntervalTime(config),
  };

  function scheduleNext() {
    const delay = Math.max(0, state.nextRunAt - Date.now());

    state.timerId = setTimeout(() => {
      state.lastExecutedAt = Date.now();
      state.nextRunAt = getNextIntervalTime(config, state.lastExecutedAt);

      // Trigger the callback
      onTrigger();

      // Schedule next execution
      scheduleNext();
    }, delay);
  }

  return {
    start() {
      if (state.timerId) {
        clearTimeout(state.timerId);
      }

      // If startImmediately, trigger now then schedule
      if (config.startImmediately && !state.lastExecutedAt) {
        state.lastExecutedAt = Date.now();
        state.nextRunAt = getNextIntervalTime(config, state.lastExecutedAt);
        onTrigger();
      }

      scheduleNext();
    },

    stop() {
      if (state.timerId) {
        clearTimeout(state.timerId);
        state.timerId = undefined;
      }
    },

    getState() {
      return { ...state };
    },
  };
}

/**
 * Parse a human-readable interval string to milliseconds
 *
 * @param intervalStr - Interval string (e.g., "5m", "1h", "2d")
 * @returns Interval in milliseconds
 */
export function parseInterval(intervalStr: string): number {
  const match = intervalStr.match(/^(\d+(?:\.\d+)?)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours|d|day|days|w|week|weeks)?$/i);

  if (!match) {
    throw new Error(`Invalid interval format: "${intervalStr}". Use formats like "5m", "1h", "2d", or milliseconds.`);
  }

  const value = parseFloat(match[1]);
  const unit = (match[2] || 'ms').toLowerCase();

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    sec: 1000,
    second: 1000,
    seconds: 1000,
    m: 60 * 1000,
    min: 60 * 1000,
    minute: 60 * 1000,
    minutes: 60 * 1000,
    h: 60 * 60 * 1000,
    hr: 60 * 60 * 1000,
    hour: 60 * 60 * 1000,
    hours: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
  };

  const multiplier = multipliers[unit];
  if (multiplier === undefined) {
    throw new Error(`Unknown time unit: "${unit}"`);
  }

  return Math.floor(value * multiplier);
}

/**
 * Create an interval trigger configuration from a string
 *
 * @param intervalStr - Interval string (e.g., "5m", "1h", "2d")
 * @param startImmediately - Whether to start immediately
 * @returns Interval trigger configuration
 */
export function createIntervalConfig(
  intervalStr: string,
  startImmediately = false
): IntervalTriggerConfig {
  return {
    type: 'interval',
    intervalMs: parseInterval(intervalStr),
    startImmediately,
  };
}
