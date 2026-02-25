/**
 * Schedule Storage
 *
 * CRUD operations for scheduled tasks with persistence.
 * Schedules are stored in ~/.craft-agent/browser-skills/schedules/
 *
 * Storage structure:
 * ~/.craft-agent/browser-skills/
 * ├── schedules/
 * │   ├── index.json           # Schedule index for fast lookup
 * │   ├── {schedule-id}.json   # Individual schedule files
 * │   └── logs/
 * │       └── executions.jsonl  # Execution log (JSONL format)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, appendFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type {
  ScheduledTask,
  ScheduleIndex,
  ScheduleIndexEntry,
  ScheduleExecution,
  ScheduleMetadata,
  ScheduleEvent,
  ScheduleEventListener,
  TriggerType,
} from './types.ts';
import { getNextCronTime } from './triggers/cron-trigger.ts';
import { getNextIntervalTime } from './triggers/interval-trigger.ts';

// ============================================================================
// Configuration
// ============================================================================

const BROWSER_SKILLS_DIR = join(homedir(), '.craft-agent', 'browser-skills');
const SCHEDULES_DIR = join(BROWSER_SKILLS_DIR, 'schedules');
const LOGS_DIR = join(SCHEDULES_DIR, 'logs');
const SCHEDULE_INDEX_FILE = join(SCHEDULES_DIR, 'index.json');
const EXECUTION_LOG_FILE = join(LOGS_DIR, 'executions.jsonl');

const INDEX_VERSION = 1;

// ============================================================================
// Event System
// ============================================================================

const eventListeners = new Set<ScheduleEventListener>();

/**
 * Add schedule event listener
 */
export function addScheduleEventListener(listener: ScheduleEventListener): void {
  eventListeners.add(listener);
}

/**
 * Remove schedule event listener
 */
export function removeScheduleEventListener(listener: ScheduleEventListener): void {
  eventListeners.delete(listener);
}

/**
 * Emit event to all listeners
 */
function emit(event: ScheduleEvent): void {
  eventListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.error('[ScheduleStorage] Event listener error:', err);
    }
  });
}

// ============================================================================
// Directory Management
// ============================================================================

/**
 * Ensure all required directories exist
 */
export function ensureScheduleDirectories(): void {
  if (!existsSync(BROWSER_SKILLS_DIR)) {
    mkdirSync(BROWSER_SKILLS_DIR, { recursive: true });
  }
  if (!existsSync(SCHEDULES_DIR)) {
    mkdirSync(SCHEDULES_DIR, { recursive: true });
  }
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }
}

/**
 * Get the schedules directory
 */
export function getSchedulesDir(): string {
  return SCHEDULES_DIR;
}

// ============================================================================
// Index Management
// ============================================================================

/**
 * Load schedule index
 */
export function loadScheduleIndex(): ScheduleIndex {
  ensureScheduleDirectories();

  if (!existsSync(SCHEDULE_INDEX_FILE)) {
    return {
      version: INDEX_VERSION,
      schedules: [],
      updatedAt: Date.now(),
    };
  }

  try {
    const content = readFileSync(SCHEDULE_INDEX_FILE, 'utf-8');
    return JSON.parse(content) as ScheduleIndex;
  } catch {
    return {
      version: INDEX_VERSION,
      schedules: [],
      updatedAt: Date.now(),
    };
  }
}

/**
 * Save schedule index
 */
export function saveScheduleIndex(index: ScheduleIndex): void {
  ensureScheduleDirectories();
  index.updatedAt = Date.now();
  writeFileSync(SCHEDULE_INDEX_FILE, JSON.stringify(index, null, 2));
}

/**
 * Update index entry for a schedule
 */
function updateScheduleIndexEntry(schedule: ScheduledTask): void {
  const index = loadScheduleIndex();

  // Remove existing entry if any
  index.schedules = index.schedules.filter(s => s.id !== schedule.id);

  // Add new entry
  index.schedules.push({
    id: schedule.id,
    name: schedule.name,
    enabled: schedule.enabled,
    triggerType: schedule.trigger.type,
    targetType: schedule.target.type,
    targetId: schedule.target.type === 'workflow'
      ? schedule.target.workflowId
      : schedule.target.skillId,
    nextScheduledAt: schedule.metadata.nextScheduledAt,
    updatedAt: schedule.updatedAt,
  });

  saveScheduleIndex(index);
}

/**
 * Remove index entry for a schedule
 */
function removeScheduleIndexEntry(scheduleId: string): void {
  const index = loadScheduleIndex();
  index.schedules = index.schedules.filter(s => s.id !== scheduleId);
  saveScheduleIndex(index);
}

/**
 * Rebuild schedule index from files
 */
export function rebuildScheduleIndex(): ScheduleIndex {
  ensureScheduleDirectories();

  const index: ScheduleIndex = {
    version: INDEX_VERSION,
    schedules: [],
    updatedAt: Date.now(),
  };

  try {
    const files = readdirSync(SCHEDULES_DIR);
    for (const file of files) {
      if (!file.endsWith('.json') || file === 'index.json') continue;

      const schedulePath = join(SCHEDULES_DIR, file);
      try {
        const content = readFileSync(schedulePath, 'utf-8');
        const schedule = JSON.parse(content) as ScheduledTask;
        index.schedules.push({
          id: schedule.id,
          name: schedule.name,
          enabled: schedule.enabled,
          triggerType: schedule.trigger.type,
          targetType: schedule.target.type,
          targetId: schedule.target.type === 'workflow'
            ? schedule.target.workflowId
            : schedule.target.skillId,
          nextScheduledAt: schedule.metadata.nextScheduledAt,
          updatedAt: schedule.updatedAt,
        });
      } catch {
        // Skip invalid schedule files
      }
    }
  } catch {
    // Schedules directory doesn't exist or can't be read
  }

  saveScheduleIndex(index);
  return index;
}

// ============================================================================
// Schedule CRUD Operations
// ============================================================================

/**
 * Generate a unique schedule ID
 */
export function generateScheduleId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `sch_${timestamp}_${random}`;
}

/**
 * Get schedule file path
 */
function getSchedulePath(scheduleId: string): string {
  return join(SCHEDULES_DIR, `${scheduleId}.json`);
}

/**
 * Calculate next scheduled time for a trigger
 */
function calculateNextScheduledAt(trigger: ScheduledTask['trigger']): number | undefined {
  switch (trigger.type) {
    case 'cron':
      return getNextCronTime(trigger.expression, trigger.timezone).getTime();
    case 'interval':
      return getNextIntervalTime(trigger);
    case 'event':
    case 'webhook':
    case 'manual':
      return undefined; // No scheduled time for event-based triggers
    default:
      return undefined;
  }
}

/**
 * Create a new scheduled task
 */
export function createSchedule(
  schedule: Omit<ScheduledTask, 'id' | 'metadata' | 'createdAt' | 'updatedAt'>
): ScheduledTask {
  ensureScheduleDirectories();

  const now = Date.now();
  const nextScheduledAt = schedule.enabled
    ? calculateNextScheduledAt(schedule.trigger)
    : undefined;

  const defaultMetadata: ScheduleMetadata = {
    executionCount: 0,
    successRate: 1.0,
    consecutiveFailures: 0,
    averageDurationMs: 0,
    nextScheduledAt,
  };

  const newSchedule: ScheduledTask = {
    ...schedule,
    id: generateScheduleId(),
    metadata: defaultMetadata,
    createdAt: now,
    updatedAt: now,
  };

  const schedulePath = getSchedulePath(newSchedule.id);
  writeFileSync(schedulePath, JSON.stringify(newSchedule, null, 2));

  updateScheduleIndexEntry(newSchedule);
  emit({ type: 'schedule_created', schedule: newSchedule });

  if (newSchedule.enabled && nextScheduledAt) {
    emit({ type: 'execution_scheduled', scheduleId: newSchedule.id, nextRunAt: nextScheduledAt });
  }

  return newSchedule;
}

/**
 * Get a schedule by ID
 */
export function getSchedule(scheduleId: string): ScheduledTask | null {
  const schedulePath = getSchedulePath(scheduleId);

  if (!existsSync(schedulePath)) {
    return null;
  }

  try {
    const content = readFileSync(schedulePath, 'utf-8');
    return JSON.parse(content) as ScheduledTask;
  } catch {
    return null;
  }
}

/**
 * Update a schedule
 */
export function updateSchedule(
  scheduleId: string,
  updates: Partial<Omit<ScheduledTask, 'id' | 'createdAt'>>
): ScheduledTask | null {
  const schedule = getSchedule(scheduleId);
  if (!schedule) return null;

  // Recalculate next scheduled time if trigger or enabled state changed
  let nextScheduledAt = schedule.metadata.nextScheduledAt;
  const newTrigger = updates.trigger || schedule.trigger;
  const newEnabled = updates.enabled !== undefined ? updates.enabled : schedule.enabled;

  if (updates.trigger || updates.enabled !== undefined) {
    nextScheduledAt = newEnabled
      ? calculateNextScheduledAt(newTrigger)
      : undefined;
  }

  const updatedSchedule: ScheduledTask = {
    ...schedule,
    ...updates,
    id: schedule.id,
    createdAt: schedule.createdAt,
    updatedAt: Date.now(),
    metadata: {
      ...schedule.metadata,
      ...updates.metadata,
      nextScheduledAt,
    },
  };

  const schedulePath = getSchedulePath(scheduleId);
  writeFileSync(schedulePath, JSON.stringify(updatedSchedule, null, 2));

  updateScheduleIndexEntry(updatedSchedule);

  const changes = Object.keys(updates);
  emit({ type: 'schedule_updated', schedule: updatedSchedule, changes });

  if (updatedSchedule.enabled && nextScheduledAt) {
    emit({ type: 'execution_scheduled', scheduleId, nextRunAt: nextScheduledAt });
  }

  return updatedSchedule;
}

/**
 * Delete a schedule
 */
export function deleteSchedule(scheduleId: string): boolean {
  const schedulePath = getSchedulePath(scheduleId);

  if (!existsSync(schedulePath)) {
    return false;
  }

  try {
    rmSync(schedulePath);
    removeScheduleIndexEntry(scheduleId);
    emit({ type: 'schedule_deleted', scheduleId });
    return true;
  } catch {
    return false;
  }
}

/**
 * List all schedules
 */
export function listSchedules(filter?: {
  enabled?: boolean;
  triggerType?: TriggerType;
  targetType?: 'workflow' | 'skill';
  tags?: string[];
}): ScheduledTask[] {
  ensureScheduleDirectories();

  const schedules: ScheduledTask[] = [];

  try {
    const files = readdirSync(SCHEDULES_DIR);
    for (const file of files) {
      if (!file.endsWith('.json') || file === 'index.json') continue;

      const schedulePath = join(SCHEDULES_DIR, file);
      try {
        const content = readFileSync(schedulePath, 'utf-8');
        const schedule = JSON.parse(content) as ScheduledTask;

        // Apply filters
        if (filter) {
          if (filter.enabled !== undefined && schedule.enabled !== filter.enabled) continue;
          if (filter.triggerType && schedule.trigger.type !== filter.triggerType) continue;
          if (filter.targetType && schedule.target.type !== filter.targetType) continue;
          if (filter.tags && !filter.tags.some(tag => schedule.tags?.includes(tag))) continue;
        }

        schedules.push(schedule);
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Schedules directory doesn't exist
  }

  return schedules;
}

/**
 * Enable a schedule
 */
export function enableSchedule(scheduleId: string): boolean {
  const schedule = getSchedule(scheduleId);
  if (!schedule || schedule.enabled) return false;

  const updated = updateSchedule(scheduleId, { enabled: true });
  if (updated) {
    emit({ type: 'schedule_enabled', scheduleId });
    return true;
  }
  return false;
}

/**
 * Disable a schedule
 */
export function disableSchedule(scheduleId: string): boolean {
  const schedule = getSchedule(scheduleId);
  if (!schedule || !schedule.enabled) return false;

  const updated = updateSchedule(scheduleId, { enabled: false });
  if (updated) {
    emit({ type: 'schedule_disabled', scheduleId });
    return true;
  }
  return false;
}

// ============================================================================
// Execution Recording
// ============================================================================

/**
 * Record a schedule execution
 */
export function recordExecution(execution: ScheduleExecution): void {
  ensureScheduleDirectories();

  const line = JSON.stringify(execution) + '\n';

  try {
    appendFileSync(EXECUTION_LOG_FILE, line);
  } catch {
    // Ignore logging errors
  }

  // Update schedule metadata
  const schedule = getSchedule(execution.scheduleId);
  if (schedule && execution.status !== 'running') {
    updateScheduleMetadata(execution.scheduleId, execution);
  }
}

/**
 * Update schedule metadata based on execution
 */
export function updateScheduleMetadata(
  scheduleId: string,
  execution: ScheduleExecution
): void {
  const schedule = getSchedule(scheduleId);
  if (!schedule) return;

  const success = execution.status === 'completed';
  const durationMs = execution.durationMs || 0;

  // Calculate new statistics
  const executionCount = schedule.metadata.executionCount + 1;
  const consecutiveFailures = success ? 0 : schedule.metadata.consecutiveFailures + 1;

  // Exponential moving average for success rate
  const alpha = 0.3;
  const newSuccessRate = alpha * (success ? 1 : 0) + (1 - alpha) * schedule.metadata.successRate;

  // Moving average for duration
  const newAverageDuration =
    (schedule.metadata.averageDurationMs * schedule.metadata.executionCount + durationMs) /
    executionCount;

  // Calculate next scheduled time
  const nextScheduledAt = schedule.enabled
    ? calculateNextScheduledAt(schedule.trigger)
    : undefined;

  updateSchedule(scheduleId, {
    metadata: {
      ...schedule.metadata,
      executionCount,
      consecutiveFailures,
      successRate: newSuccessRate,
      averageDurationMs: newAverageDuration,
      lastExecutedAt: execution.startedAt,
      lastSuccessAt: success ? Date.now() : schedule.metadata.lastSuccessAt,
      lastError: success ? undefined : execution.error,
      nextScheduledAt,
    },
  });
}

/**
 * Get execution logs for a schedule
 */
export function getExecutionLogs(
  scheduleId?: string,
  options?: {
    limit?: number;
    offset?: number;
    startTime?: number;
    endTime?: number;
    status?: ScheduleExecution['status'];
  }
): ScheduleExecution[] {
  if (!existsSync(EXECUTION_LOG_FILE)) {
    return [];
  }

  try {
    const content = readFileSync(EXECUTION_LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    let entries = lines
      .map((line) => {
        try {
          return JSON.parse(line) as ScheduleExecution;
        } catch {
          return null;
        }
      })
      .filter((e): e is ScheduleExecution => e !== null);

    // Apply filters
    if (scheduleId) {
      entries = entries.filter((e) => e.scheduleId === scheduleId);
    }
    if (options?.startTime) {
      entries = entries.filter((e) => e.startedAt >= options.startTime!);
    }
    if (options?.endTime) {
      entries = entries.filter((e) => e.startedAt <= options.endTime!);
    }
    if (options?.status) {
      entries = entries.filter((e) => e.status === options.status);
    }

    // Sort by timestamp descending (newest first)
    entries.sort((a, b) => b.startedAt - a.startedAt);

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return entries.slice(offset, offset + limit);
  } catch {
    return [];
  }
}

/**
 * Clean old execution logs
 */
export function cleanOldExecutionLogs(keepDays: number = 30): number {
  const cutoffTime = Date.now() - keepDays * 24 * 60 * 60 * 1000;

  if (!existsSync(EXECUTION_LOG_FILE)) {
    return 0;
  }

  try {
    const content = readFileSync(EXECUTION_LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    const filteredLines = lines.filter((line) => {
      try {
        const entry = JSON.parse(line) as ScheduleExecution;
        return entry.startedAt >= cutoffTime;
      } catch {
        return false;
      }
    });

    const removed = lines.length - filteredLines.length;
    writeFileSync(
      EXECUTION_LOG_FILE,
      filteredLines.join('\n') + (filteredLines.length > 0 ? '\n' : '')
    );
    return removed;
  } catch {
    return 0;
  }
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get schedule statistics
 */
export function getScheduleStats(scheduleId: string): {
  executionCount: number;
  successRate: number;
  consecutiveFailures: number;
  averageDurationMs: number;
  lastExecutedAt?: number;
  lastSuccessAt?: number;
  nextScheduledAt?: number;
  daysSinceLastRun: number;
} | null {
  const schedule = getSchedule(scheduleId);
  if (!schedule) return null;

  const now = Date.now();
  const daysSinceLastRun = schedule.metadata.lastExecutedAt
    ? Math.floor((now - schedule.metadata.lastExecutedAt) / (1000 * 60 * 60 * 24))
    : Infinity;

  return {
    executionCount: schedule.metadata.executionCount,
    successRate: schedule.metadata.successRate,
    consecutiveFailures: schedule.metadata.consecutiveFailures,
    averageDurationMs: schedule.metadata.averageDurationMs,
    lastExecutedAt: schedule.metadata.lastExecutedAt,
    lastSuccessAt: schedule.metadata.lastSuccessAt,
    nextScheduledAt: schedule.metadata.nextScheduledAt,
    daysSinceLastRun,
  };
}

/**
 * Get execution summary for a schedule
 */
export function getExecutionSummary(
  scheduleId: string,
  days: number = 30
): {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDurationMs: number;
  successRate: number;
  mostCommonError?: string;
} {
  const startTime = Date.now() - days * 24 * 60 * 60 * 1000;
  const logs = getExecutionLogs(scheduleId, { startTime });

  if (logs.length === 0) {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDurationMs: 0,
      successRate: 0,
    };
  }

  const totalExecutions = logs.length;
  const successfulExecutions = logs.filter((l) => l.status === 'completed').length;
  const failedExecutions = totalExecutions - successfulExecutions;
  const averageDurationMs =
    logs.reduce((sum, l) => sum + (l.durationMs || 0), 0) / totalExecutions;
  const successRate = successfulExecutions / totalExecutions;

  // Find most common error
  const errorCounts = new Map<string, number>();
  logs.forEach((log) => {
    if (log.error) {
      errorCounts.set(log.error, (errorCounts.get(log.error) || 0) + 1);
    }
  });
  let mostCommonError: string | undefined;
  let maxCount = 0;
  errorCounts.forEach((count, error) => {
    if (count > maxCount) {
      mostCommonError = error;
      maxCount = count;
    }
  });

  return {
    totalExecutions,
    successfulExecutions,
    failedExecutions,
    averageDurationMs,
    successRate,
    mostCommonError,
  };
}

// ============================================================================
// Import/Export
// ============================================================================

/**
 * Export all schedules to JSON
 */
export function exportSchedules(): ScheduledTask[] {
  return listSchedules();
}

/**
 * Import schedules from exported data
 */
export function importSchedules(
  schedules: ScheduledTask[],
  options?: { overwrite?: boolean }
): { imported: number; skipped: number } {
  let imported = 0;
  let skipped = 0;

  for (const schedule of schedules) {
    const existing = getSchedule(schedule.id);
    if (existing && !options?.overwrite) {
      skipped++;
      continue;
    }

    const schedulePath = getSchedulePath(schedule.id);
    writeFileSync(schedulePath, JSON.stringify(schedule, null, 2));
    updateScheduleIndexEntry(schedule);
    imported++;
  }

  return { imported, skipped };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Get schedules targeting a specific workflow
 */
export function getSchedulesForWorkflow(workflowId: string): ScheduledTask[] {
  return listSchedules().filter(
    (s) => s.target.type === 'workflow' && s.target.workflowId === workflowId
  );
}

/**
 * Get schedules targeting a specific skill
 */
export function getSchedulesForSkill(skillId: string): ScheduledTask[] {
  return listSchedules().filter(
    (s) => s.target.type === 'skill' && s.target.skillId === skillId
  );
}

/**
 * Clone a schedule with a new ID
 */
export function cloneSchedule(
  scheduleId: string,
  newName?: string
): ScheduledTask | null {
  const original = getSchedule(scheduleId);
  if (!original) return null;

  const { id, createdAt, updatedAt, metadata, ...rest } = original;

  return createSchedule({
    ...rest,
    name: newName || `${original.name} (Copy)`,
    enabled: false, // Start disabled to avoid immediate execution
  });
}
