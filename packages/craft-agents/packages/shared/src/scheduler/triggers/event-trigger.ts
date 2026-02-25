/**
 * Event Trigger
 *
 * Handles event-based scheduling.
 * Executes tasks when specific events occur.
 */

import type { EventTriggerConfig } from '../types.ts';

// ============================================================================
// Types
// ============================================================================

/**
 * Event data structure for triggering
 */
export interface TriggerEvent {
  /** Type of event */
  type: EventTriggerConfig['eventType'];
  /** Event payload data */
  data: Record<string, unknown>;
  /** Timestamp when event occurred */
  timestamp: number;
}

/**
 * Event trigger subscription
 */
export interface EventSubscription {
  /** Subscription ID */
  id: string;
  /** Event filter configuration */
  config: EventTriggerConfig;
  /** Callback when event matches */
  onEvent: (event: TriggerEvent) => void;
}

// ============================================================================
// Event Registry
// ============================================================================

const subscriptions = new Map<string, EventSubscription>();
const eventListeners = new Set<(event: TriggerEvent) => void>();

/**
 * Add a global event listener (for debugging/logging)
 */
export function addEventTriggerListener(
  listener: (event: TriggerEvent) => void
): void {
  eventListeners.add(listener);
}

/**
 * Remove a global event listener
 */
export function removeEventTriggerListener(
  listener: (event: TriggerEvent) => void
): void {
  eventListeners.delete(listener);
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Check if an event matches a filter configuration
 *
 * @param event - Event to check
 * @param filter - Filter conditions
 * @returns True if event matches all filter conditions
 */
export function matchesFilter(
  event: TriggerEvent,
  filter?: Record<string, unknown>
): boolean {
  if (!filter) return true;

  for (const [key, expectedValue] of Object.entries(filter)) {
    const actualValue = event.data[key];

    // Handle different comparison types
    if (typeof expectedValue === 'object' && expectedValue !== null) {
      // Complex filter (e.g., { $gt: 5, $contains: "foo" })
      if (!matchesComplexFilter(actualValue, expectedValue as Record<string, unknown>)) {
        return false;
      }
    } else if (expectedValue !== actualValue) {
      // Simple equality check
      return false;
    }
  }

  return true;
}

/**
 * Handle complex filter operators
 */
function matchesComplexFilter(
  value: unknown,
  operators: Record<string, unknown>
): boolean {
  for (const [op, expected] of Object.entries(operators)) {
    switch (op) {
      case '$eq':
        if (value !== expected) return false;
        break;

      case '$ne':
        if (value === expected) return false;
        break;

      case '$gt':
        if (typeof value !== 'number' || value <= (expected as number)) return false;
        break;

      case '$gte':
        if (typeof value !== 'number' || value < (expected as number)) return false;
        break;

      case '$lt':
        if (typeof value !== 'number' || value >= (expected as number)) return false;
        break;

      case '$lte':
        if (typeof value !== 'number' || value > (expected as number)) return false;
        break;

      case '$in':
        if (!Array.isArray(expected) || !expected.includes(value)) return false;
        break;

      case '$nin':
        if (!Array.isArray(expected) || expected.includes(value)) return false;
        break;

      case '$contains':
        if (typeof value !== 'string' || !value.includes(expected as string)) return false;
        break;

      case '$startsWith':
        if (typeof value !== 'string' || !value.startsWith(expected as string)) return false;
        break;

      case '$endsWith':
        if (typeof value !== 'string' || !value.endsWith(expected as string)) return false;
        break;

      case '$regex':
        if (typeof value !== 'string') return false;
        try {
          const regex = new RegExp(expected as string);
          if (!regex.test(value)) return false;
        } catch {
          return false;
        }
        break;

      case '$exists':
        if ((expected === true && value === undefined) ||
            (expected === false && value !== undefined)) {
          return false;
        }
        break;

      default:
        // Unknown operator - treat as nested path
        if (typeof value === 'object' && value !== null) {
          const nested = (value as Record<string, unknown>)[op];
          if (nested !== expected) return false;
        } else {
          return false;
        }
    }
  }

  return true;
}

/**
 * Subscribe to events matching a configuration
 *
 * @param config - Event trigger configuration
 * @param onEvent - Callback when matching event occurs
 * @returns Subscription ID for unsubscribing
 */
export function subscribeToEvent(
  config: EventTriggerConfig,
  onEvent: (event: TriggerEvent) => void
): string {
  const id = `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

  subscriptions.set(id, {
    id,
    config,
    onEvent,
  });

  return id;
}

/**
 * Unsubscribe from events
 *
 * @param subscriptionId - Subscription ID to remove
 * @returns True if subscription was found and removed
 */
export function unsubscribeFromEvent(subscriptionId: string): boolean {
  return subscriptions.delete(subscriptionId);
}

/**
 * Emit an event to all matching subscribers
 *
 * @param event - Event to emit
 * @returns Number of subscribers that matched
 */
export function emitEvent(event: TriggerEvent): number {
  let matchCount = 0;

  // Notify global listeners first
  eventListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.error('[EventTrigger] Global listener error:', err);
    }
  });

  // Check each subscription
  subscriptions.forEach((subscription) => {
    // Check event type
    if (subscription.config.eventType !== event.type) {
      return; // Skip this subscription
    }

    // Check filter
    if (!matchesFilter(event, subscription.config.filter)) {
      return; // Skip this subscription
    }

    // Trigger the callback
    try {
      subscription.onEvent(event);
      matchCount++;
    } catch (err) {
      console.error('[EventTrigger] Subscription callback error:', err);
    }
  });

  return matchCount;
}

/**
 * Get all active subscriptions (for debugging)
 */
export function getActiveSubscriptions(): EventSubscription[] {
  return Array.from(subscriptions.values());
}

/**
 * Clear all subscriptions
 */
export function clearAllSubscriptions(): void {
  subscriptions.clear();
}

/**
 * Get a human-readable description of an event trigger
 *
 * @param config - Event trigger configuration
 * @returns Human-readable description
 */
export function describeEventTrigger(config: EventTriggerConfig): string {
  let description = `when ${config.eventType.replace(/_/g, ' ')}`;

  if (config.filter && Object.keys(config.filter).length > 0) {
    const conditions = Object.entries(config.filter)
      .map(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          const ops = Object.entries(value as Record<string, unknown>)
            .map(([op, val]) => `${op} ${JSON.stringify(val)}`)
            .join(' and ');
          return `${key} ${ops}`;
        }
        return `${key} = ${JSON.stringify(value)}`;
      })
      .join(' and ');

    description += ` with ${conditions}`;
  }

  return description;
}

/**
 * Validate an event trigger configuration
 *
 * @param config - Event trigger configuration
 * @returns True if valid
 */
export function isValidEventConfig(config: EventTriggerConfig): boolean {
  const validEventTypes: EventTriggerConfig['eventType'][] = [
    'workflow_completed',
    'workflow_failed',
    'skill_completed',
    'skill_failed',
    'file_changed',
    'mcp_event',
    'schedule_completed',
  ];

  if (!validEventTypes.includes(config.eventType)) {
    return false;
  }

  return true;
}

/**
 * Create an event trigger configuration
 *
 * @param eventType - Type of event to listen for
 * @param filter - Optional filter conditions
 * @returns Event trigger configuration
 */
export function createEventConfig(
  eventType: EventTriggerConfig['eventType'],
  filter?: Record<string, unknown>
): EventTriggerConfig {
  return {
    type: 'event',
    eventType,
    filter,
  };
}
