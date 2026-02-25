/**
 * Scheduler Module
 *
 * Automated task scheduling system for browser skills and workflows.
 * Supports cron expressions, intervals, events, and manual triggers.
 *
 * Features:
 * - Cron-based scheduling (e.g., "0 9 * * 1-5" for weekdays at 9 AM)
 * - Fixed interval scheduling (e.g., every hour)
 * - Event-based triggers (e.g., when workflow completes)
 * - Manual execution on demand
 * - Retry logic with exponential backoff
 * - Concurrent execution limits
 * - Execution history and statistics
 *
 * Usage:
 * ```typescript
 * import {
 *   createSchedule,
 *   initializeScheduleEngine,
 *   triggerSchedule,
 * } from '@craft-agent/shared/scheduler';
 *
 * // Create a schedule
 * const schedule = createSchedule({
 *   name: 'Daily Report',
 *   enabled: true,
 *   trigger: {
 *     type: 'cron',
 *     expression: '0 9 * * 1-5',  // Weekdays at 9 AM
 *   },
 *   target: {
 *     type: 'workflow',
 *     workflowId: 'wf_abc123',
 *     parameters: { reportType: 'daily' },
 *   },
 *   config: {
 *     timeout: 300000,
 *     retries: 2,
 *     notifyOnFailure: true,
 *   },
 * });
 *
 * // Initialize the engine
 * const engine = initializeScheduleEngine();
 *
 * // Manual trigger
 * const execution = await triggerSchedule(schedule.id);
 * ```
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Trigger types
  TriggerType,
  TriggerConfig,
  CronTriggerConfig,
  IntervalTriggerConfig,
  EventTriggerConfig,
  WebhookTriggerConfig,
  ManualTriggerConfig,

  // Schedule types
  ScheduledTask,
  ScheduleTarget,
  ScheduleExecutionConfig,
  ScheduleMetadata,

  // Execution types
  ScheduleExecution,
  ScheduleExecutionStatus,

  // Event types
  ScheduleEvent,
  ScheduleEventListener,

  // Storage types
  ScheduleIndex,
  ScheduleIndexEntry,

  // Engine types
  ScheduleEngineConfig,
  ScheduleEngineStatus,
} from './types.ts';

// ============================================================================
// Storage Exports
// ============================================================================

export {
  // Directory management
  ensureScheduleDirectories,
  getSchedulesDir,

  // Index management
  loadScheduleIndex,
  saveScheduleIndex,
  rebuildScheduleIndex,

  // Schedule CRUD
  generateScheduleId,
  createSchedule,
  getSchedule,
  updateSchedule,
  deleteSchedule,
  listSchedules,
  enableSchedule,
  disableSchedule,

  // Execution recording
  recordExecution,
  updateScheduleMetadata,
  getExecutionLogs,
  cleanOldExecutionLogs,

  // Statistics
  getScheduleStats,
  getExecutionSummary,

  // Import/Export
  exportSchedules,
  importSchedules,

  // Utilities
  getSchedulesForWorkflow,
  getSchedulesForSkill,
  cloneSchedule,

  // Events
  addScheduleEventListener,
  removeScheduleEventListener,
} from './schedule-storage.ts';

// ============================================================================
// Engine Exports
// ============================================================================

export {
  // Engine class
  ScheduleEngine,
  createScheduleEngine,
  getDefaultScheduleEngine,
  initializeScheduleEngine,
  shutdownScheduleEngine,

  // Execution
  triggerSchedule,

  // Events
  addScheduleEngineEventListener,
  removeScheduleEngineEventListener,

  // Types
  type WorkflowExecutor,
  type SkillExecutor,
} from './schedule-engine.ts';

// ============================================================================
// Cron Trigger Exports
// ============================================================================

export {
  // Time calculation
  getNextCronTime,
  getNextCronTimes,
  matchesCron,

  // Validation
  isValidCronExpression,
  describeCronExpression,

  // Factory
  createCronTrigger,
} from './triggers/cron-trigger.ts';

// ============================================================================
// Interval Trigger Exports
// ============================================================================

export {
  // Time calculation
  getNextIntervalTime,

  // Validation
  isValidIntervalConfig,
  describeInterval,

  // Factory
  createIntervalTrigger,
  createIntervalConfig,
  parseInterval,

  // Types
  type IntervalTriggerState,
} from './triggers/interval-trigger.ts';

// ============================================================================
// Event Trigger Exports
// ============================================================================

export {
  // Subscription
  subscribeToEvent,
  unsubscribeFromEvent,
  emitEvent,
  getActiveSubscriptions,
  clearAllSubscriptions,

  // Matching
  matchesFilter,

  // Validation
  isValidEventConfig,
  describeEventTrigger,

  // Factory
  createEventConfig,

  // Events
  addEventTriggerListener,
  removeEventTriggerListener,

  // Types
  type TriggerEvent,
  type EventSubscription,
} from './triggers/event-trigger.ts';

// ============================================================================
// Convenience Functions
// ============================================================================

import { createSchedule as _createSchedule, listSchedules } from './schedule-storage.ts';
import type { ScheduledTask, CronTriggerConfig, IntervalTriggerConfig } from './types.ts';

/**
 * Create a cron-based schedule
 *
 * @example
 * ```typescript
 * const schedule = createCronSchedule({
 *   name: 'Morning Report',
 *   expression: '0 9 * * 1-5',  // Weekdays at 9 AM
 *   workflowId: 'wf_report',
 * });
 * ```
 */
export function createCronSchedule(options: {
  name: string;
  description?: string;
  expression: string;
  timezone?: string;
  workflowId?: string;
  skillId?: string;
  parameters?: Record<string, unknown>;
  profileId?: string;
  enabled?: boolean;
  tags?: string[];
}): ScheduledTask {
  if (!options.workflowId && !options.skillId) {
    throw new Error('Either workflowId or skillId must be provided');
  }

  const trigger: CronTriggerConfig = {
    type: 'cron',
    expression: options.expression,
    timezone: options.timezone,
  };

  return _createSchedule({
    name: options.name,
    description: options.description,
    enabled: options.enabled ?? true,
    trigger,
    target: options.workflowId
      ? { type: 'workflow', workflowId: options.workflowId, parameters: options.parameters }
      : { type: 'skill', skillId: options.skillId!, parameters: options.parameters },
    config: {
      profileId: options.profileId,
      notifyOnFailure: true,
    },
    tags: options.tags,
  });
}

/**
 * Create an interval-based schedule
 *
 * @example
 * ```typescript
 * const schedule = createIntervalSchedule({
 *   name: 'Hourly Check',
 *   intervalMs: 60 * 60 * 1000,  // Every hour
 *   skillId: 'sk_check',
 * });
 * ```
 */
export function createIntervalSchedule(options: {
  name: string;
  description?: string;
  intervalMs: number;
  startImmediately?: boolean;
  workflowId?: string;
  skillId?: string;
  parameters?: Record<string, unknown>;
  profileId?: string;
  enabled?: boolean;
  tags?: string[];
}): ScheduledTask {
  if (!options.workflowId && !options.skillId) {
    throw new Error('Either workflowId or skillId must be provided');
  }

  const trigger: IntervalTriggerConfig = {
    type: 'interval',
    intervalMs: options.intervalMs,
    startImmediately: options.startImmediately,
  };

  return _createSchedule({
    name: options.name,
    description: options.description,
    enabled: options.enabled ?? true,
    trigger,
    target: options.workflowId
      ? { type: 'workflow', workflowId: options.workflowId, parameters: options.parameters }
      : { type: 'skill', skillId: options.skillId!, parameters: options.parameters },
    config: {
      profileId: options.profileId,
      notifyOnFailure: true,
    },
    tags: options.tags,
  });
}

/**
 * Get all enabled schedules with their next run times
 */
export function getUpcomingSchedules(limit = 10): Array<{
  id: string;
  name: string;
  nextRunAt: number;
  triggerType: string;
}> {
  return listSchedules({ enabled: true })
    .filter((s) => s.metadata.nextScheduledAt)
    .map((s) => ({
      id: s.id,
      name: s.name,
      nextRunAt: s.metadata.nextScheduledAt!,
      triggerType: s.trigger.type,
    }))
    .sort((a, b) => a.nextRunAt - b.nextRunAt)
    .slice(0, limit);
}

/**
 * Get schedules that have failed recently
 */
export function getFailingSchedules(maxFailures = 3): ScheduledTask[] {
  return listSchedules({ enabled: true }).filter(
    (s) => s.metadata.consecutiveFailures >= maxFailures
  );
}
