/**
 * Schedule Engine
 *
 * Manages the execution of scheduled tasks by:
 * - Monitoring triggers (cron, interval, event)
 * - Executing workflows and skills
 * - Handling retries and failures
 * - Managing concurrent executions
 *
 * Key features:
 * - Automatic schedule registration on startup
 * - Concurrent execution limits
 * - Timeout handling
 * - Retry logic with exponential backoff
 * - Event emission for monitoring
 */

import type {
  ScheduledTask,
  ScheduleExecution,
  ScheduleExecutionStatus,
  ScheduleEngineConfig,
  ScheduleEngineStatus,
  ScheduleEvent,
  ScheduleEventListener,
  TriggerConfig,
} from './types.ts';
import {
  listSchedules,
  getSchedule,
  updateSchedule,
  recordExecution,
  addScheduleEventListener,
  removeScheduleEventListener,
} from './schedule-storage.ts';
import { getNextCronTime, matchesCron } from './triggers/cron-trigger.ts';
import { getNextIntervalTime } from './triggers/interval-trigger.ts';
import {
  subscribeToEvent,
  unsubscribeFromEvent,
  emitEvent,
  type TriggerEvent,
} from './triggers/event-trigger.ts';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: Required<ScheduleEngineConfig> = {
  checkIntervalMs: 1000,
  maxConcurrentExecutions: 5,
  defaultTimeout: 300000, // 5 minutes
  defaultRetries: 2,
  defaultRetryDelay: 5000,
  persistSchedules: true,
  autoStart: true,
};

// ============================================================================
// Event System
// ============================================================================

const engineEventListeners = new Set<ScheduleEventListener>();

/**
 * Add engine event listener
 */
export function addScheduleEngineEventListener(listener: ScheduleEventListener): void {
  engineEventListeners.add(listener);
}

/**
 * Remove engine event listener
 */
export function removeScheduleEngineEventListener(listener: ScheduleEventListener): void {
  engineEventListeners.delete(listener);
}

/**
 * Emit event to all listeners
 */
function emit(event: ScheduleEvent): void {
  engineEventListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.error('[ScheduleEngine] Event listener error:', err);
    }
  });
}

// ============================================================================
// Execution Target Interface
// ============================================================================

/**
 * Interface for workflow execution
 */
export interface WorkflowExecutor {
  executeWorkflow(
    workflowId: string,
    options?: {
      parameters?: Record<string, unknown>;
      profileId?: string;
      timeout?: number;
    }
  ): Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
    durationMs: number;
  }>;
}

/**
 * Interface for skill execution
 */
export interface SkillExecutor {
  executeSkill(
    skillId: string,
    options?: {
      parameters?: Record<string, unknown>;
      profileId?: string;
      timeout?: number;
    }
  ): Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
    durationMs: number;
  }>;
}

// ============================================================================
// Schedule Engine Class
// ============================================================================

/**
 * Schedule execution engine
 */
export class ScheduleEngine {
  private config: Required<ScheduleEngineConfig>;
  private running = false;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private scheduledTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private eventSubscriptions = new Map<string, string>();
  private runningExecutions = new Map<string, ScheduleExecution>();
  private workflowExecutor: WorkflowExecutor | null = null;
  private skillExecutor: SkillExecutor | null = null;
  private storageListener: ScheduleEventListener;

  constructor(config: ScheduleEngineConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Listen for storage events to update timers
    this.storageListener = (event) => {
      this.handleStorageEvent(event);
    };
    addScheduleEventListener(this.storageListener);
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Set the workflow executor
   */
  setWorkflowExecutor(executor: WorkflowExecutor): void {
    this.workflowExecutor = executor;
  }

  /**
   * Set the skill executor
   */
  setSkillExecutor(executor: SkillExecutor): void {
    this.skillExecutor = executor;
  }

  /**
   * Initialize and start the engine
   */
  initialize(): void {
    if (this.running) return;

    console.log('[ScheduleEngine] Initializing...');

    // Load and register all enabled schedules
    const schedules = listSchedules({ enabled: true });
    for (const schedule of schedules) {
      this.registerSchedule(schedule);
    }

    // Start the check timer
    this.running = true;
    this.checkTimer = setInterval(() => {
      this.checkSchedules();
    }, this.config.checkIntervalMs);

    console.log(`[ScheduleEngine] Started with ${schedules.length} enabled schedules`);
  }

  /**
   * Shutdown the engine
   */
  shutdown(): void {
    if (!this.running) return;

    console.log('[ScheduleEngine] Shutting down...');

    // Stop the check timer
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    // Clear all scheduled timers
    this.scheduledTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.scheduledTimers.clear();

    // Unsubscribe from all events
    this.eventSubscriptions.forEach((subscriptionId) => {
      unsubscribeFromEvent(subscriptionId);
    });
    this.eventSubscriptions.clear();

    // Cancel running executions
    this.runningExecutions.forEach((execution) => {
      this.cancelExecution(execution.id);
    });

    // Remove storage listener
    removeScheduleEventListener(this.storageListener);

    this.running = false;
    console.log('[ScheduleEngine] Shutdown complete');
  }

  // ==========================================================================
  // Schedule Management
  // ==========================================================================

  /**
   * Register a schedule for execution
   */
  registerSchedule(schedule: ScheduledTask): void {
    if (!schedule.enabled) return;

    // Clear existing timer/subscription
    this.unregisterSchedule(schedule.id);

    switch (schedule.trigger.type) {
      case 'cron':
      case 'interval':
        this.scheduleNextExecution(schedule);
        break;

      case 'event':
        this.registerEventTrigger(schedule);
        break;

      case 'webhook':
        // Webhook triggers are handled externally
        break;

      case 'manual':
        // Manual triggers don't need registration
        break;
    }
  }

  /**
   * Unregister a schedule
   */
  unregisterSchedule(scheduleId: string): void {
    // Clear timer
    const timer = this.scheduledTimers.get(scheduleId);
    if (timer) {
      clearTimeout(timer);
      this.scheduledTimers.delete(scheduleId);
    }

    // Unsubscribe from events
    const subscriptionId = this.eventSubscriptions.get(scheduleId);
    if (subscriptionId) {
      unsubscribeFromEvent(subscriptionId);
      this.eventSubscriptions.delete(scheduleId);
    }
  }

  /**
   * Schedule the next execution for cron/interval triggers
   */
  private scheduleNextExecution(schedule: ScheduledTask): void {
    const nextRunAt = this.calculateNextRunTime(schedule.trigger);
    if (!nextRunAt) return;

    const delay = Math.max(0, nextRunAt - Date.now());

    const timer = setTimeout(() => {
      this.executeDueSchedule(schedule.id);
    }, delay);

    this.scheduledTimers.set(schedule.id, timer);

    // Update metadata with next run time
    updateSchedule(schedule.id, {
      metadata: {
        ...schedule.metadata,
        nextScheduledAt: nextRunAt,
      },
    });

    emit({ type: 'execution_scheduled', scheduleId: schedule.id, nextRunAt });
  }

  /**
   * Register event trigger subscription
   */
  private registerEventTrigger(schedule: ScheduledTask): void {
    if (schedule.trigger.type !== 'event') return;

    const subscriptionId = subscribeToEvent(schedule.trigger, (event) => {
      this.executeSchedule(schedule.id, 'event');
    });

    this.eventSubscriptions.set(schedule.id, subscriptionId);
  }

  /**
   * Calculate next run time for a trigger
   */
  private calculateNextRunTime(trigger: TriggerConfig): number | null {
    switch (trigger.type) {
      case 'cron':
        return getNextCronTime(trigger.expression, trigger.timezone).getTime();

      case 'interval':
        return getNextIntervalTime(trigger);

      default:
        return null;
    }
  }

  // ==========================================================================
  // Execution
  // ==========================================================================

  /**
   * Execute a schedule that is due
   */
  private executeDueSchedule(scheduleId: string): void {
    // Remove from scheduled timers
    this.scheduledTimers.delete(scheduleId);

    // Get fresh schedule data
    const schedule = getSchedule(scheduleId);
    if (!schedule || !schedule.enabled) return;

    // Execute
    this.executeSchedule(scheduleId, schedule.trigger.type);
  }

  /**
   * Execute a schedule (main entry point)
   */
  async executeSchedule(
    scheduleId: string,
    triggeredBy: ScheduledTask['trigger']['type']
  ): Promise<ScheduleExecution | null> {
    const schedule = getSchedule(scheduleId);
    if (!schedule) {
      console.error(`[ScheduleEngine] Schedule not found: ${scheduleId}`);
      return null;
    }

    // Check concurrent execution limit
    if (this.runningExecutions.size >= this.config.maxConcurrentExecutions) {
      emit({
        type: 'execution_skipped',
        scheduleId,
        reason: 'Max concurrent executions reached',
      });
      return null;
    }

    // Check if already running (and skipIfRunning is true)
    if (
      schedule.config.skipIfRunning !== false &&
      Array.from(this.runningExecutions.values()).some((e) => e.scheduleId === scheduleId)
    ) {
      emit({
        type: 'execution_skipped',
        scheduleId,
        reason: 'Previous execution still running',
      });

      // Re-schedule for cron/interval triggers
      if (schedule.trigger.type === 'cron' || schedule.trigger.type === 'interval') {
        this.scheduleNextExecution(schedule);
      }

      return null;
    }

    // Create execution record
    const execution: ScheduleExecution = {
      id: `exec_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      scheduleId,
      triggeredBy,
      startedAt: Date.now(),
      status: 'running',
      profileId: schedule.config.profileId,
    };

    this.runningExecutions.set(execution.id, execution);
    recordExecution(execution);
    emit({ type: 'execution_started', scheduleId, executionId: execution.id });

    try {
      // Execute with timeout and retries
      const result = await this.executeWithRetries(schedule, execution);

      // Update execution record
      execution.completedAt = Date.now();
      execution.durationMs = execution.completedAt - execution.startedAt;
      execution.status = result.success ? 'completed' : 'failed';
      execution.result = result.data;
      execution.error = result.error;

      recordExecution(execution);

      if (result.success) {
        emit({
          type: 'execution_completed',
          scheduleId,
          executionId: execution.id,
          result: result.data,
        });

        // Emit event for event triggers
        emitEvent({
          type: 'schedule_completed',
          data: {
            scheduleId,
            executionId: execution.id,
            result: result.data,
          },
          timestamp: Date.now(),
        });
      } else {
        emit({
          type: 'execution_failed',
          scheduleId,
          executionId: execution.id,
          error: result.error || 'Unknown error',
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Execution failed';

      execution.completedAt = Date.now();
      execution.durationMs = execution.completedAt - execution.startedAt;
      execution.status = 'failed';
      execution.error = error;

      recordExecution(execution);
      emit({
        type: 'execution_failed',
        scheduleId,
        executionId: execution.id,
        error,
      });
    } finally {
      this.runningExecutions.delete(execution.id);

      // Re-schedule for cron/interval triggers
      if (schedule.trigger.type === 'cron' || schedule.trigger.type === 'interval') {
        const freshSchedule = getSchedule(scheduleId);
        if (freshSchedule && freshSchedule.enabled) {
          this.scheduleNextExecution(freshSchedule);
        }
      }
    }

    return execution;
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetries(
    schedule: ScheduledTask,
    execution: ScheduleExecution
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    const maxRetries = schedule.config.retries ?? this.config.defaultRetries;
    const retryDelay = schedule.config.retryDelay ?? this.config.defaultRetryDelay;
    const timeout = schedule.config.timeout ?? this.config.defaultTimeout;

    let lastError: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        execution.retryCount = attempt;
        await this.sleep(retryDelay * attempt); // Exponential backoff
      }

      try {
        const result = await this.executeTarget(schedule, timeout);

        if (result.success) {
          return result;
        }

        lastError = result.error;
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Execution error';
      }
    }

    return { success: false, error: lastError };
  }

  /**
   * Execute the target (workflow or skill)
   */
  private async executeTarget(
    schedule: ScheduledTask,
    timeout: number
  ): Promise<{ success: boolean; data?: unknown; error?: string; durationMs: number }> {
    const startTime = Date.now();

    if (schedule.target.type === 'workflow') {
      if (!this.workflowExecutor) {
        return {
          success: false,
          error: 'Workflow executor not configured',
          durationMs: Date.now() - startTime,
        };
      }

      return this.workflowExecutor.executeWorkflow(schedule.target.workflowId, {
        parameters: schedule.target.parameters,
        profileId: schedule.config.profileId,
        timeout,
      });
    }

    if (schedule.target.type === 'skill') {
      if (!this.skillExecutor) {
        return {
          success: false,
          error: 'Skill executor not configured',
          durationMs: Date.now() - startTime,
        };
      }

      return this.skillExecutor.executeSkill(schedule.target.skillId, {
        parameters: schedule.target.parameters,
        profileId: schedule.config.profileId,
        timeout,
      });
    }

    return {
      success: false,
      error: 'Unknown target type',
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Trigger a schedule manually
   */
  async triggerNow(scheduleId: string): Promise<ScheduleExecution | null> {
    return this.executeSchedule(scheduleId, 'manual');
  }

  /**
   * Cancel a running execution
   */
  cancelExecution(executionId: string): boolean {
    const execution = this.runningExecutions.get(executionId);
    if (!execution) return false;

    execution.status = 'cancelled';
    execution.completedAt = Date.now();
    execution.durationMs = execution.completedAt - execution.startedAt;

    recordExecution(execution);
    this.runningExecutions.delete(executionId);

    emit({
      type: 'execution_cancelled',
      scheduleId: execution.scheduleId,
      executionId,
    });

    return true;
  }

  // ==========================================================================
  // Check & Status
  // ==========================================================================

  /**
   * Check schedules (called periodically)
   */
  private checkSchedules(): void {
    // Check for cron schedules that might have been missed
    const now = new Date();
    const schedules = listSchedules({ enabled: true });

    for (const schedule of schedules) {
      if (schedule.trigger.type === 'cron') {
        // Check if this minute matches the cron expression
        if (
          matchesCron(schedule.trigger.expression, now) &&
          !this.scheduledTimers.has(schedule.id) &&
          !Array.from(this.runningExecutions.values()).some(
            (e) => e.scheduleId === schedule.id
          )
        ) {
          // Execute if we don't have a timer and not already running
          this.executeSchedule(schedule.id, 'cron');
        }
      }
    }
  }

  /**
   * Handle storage events
   */
  private handleStorageEvent(event: ScheduleEvent): void {
    switch (event.type) {
      case 'schedule_created':
        if (event.schedule.enabled) {
          this.registerSchedule(event.schedule);
        }
        break;

      case 'schedule_updated':
        this.unregisterSchedule(event.schedule.id);
        if (event.schedule.enabled) {
          this.registerSchedule(event.schedule);
        }
        break;

      case 'schedule_deleted':
        this.unregisterSchedule(event.scheduleId);
        break;

      case 'schedule_enabled':
        const enabledSchedule = getSchedule(event.scheduleId);
        if (enabledSchedule) {
          this.registerSchedule(enabledSchedule);
        }
        break;

      case 'schedule_disabled':
        this.unregisterSchedule(event.scheduleId);
        break;
    }
  }

  /**
   * Get currently running executions
   */
  getRunningExecutions(): ScheduleExecution[] {
    return Array.from(this.runningExecutions.values());
  }

  /**
   * Get next scheduled run time for a schedule
   */
  getNextScheduledRun(scheduleId: string): number | null {
    const schedule = getSchedule(scheduleId);
    if (!schedule) return null;
    return schedule.metadata.nextScheduledAt || null;
  }

  /**
   * Get engine status
   */
  getStatus(): ScheduleEngineStatus {
    const allSchedules = listSchedules();
    const enabledSchedules = allSchedules.filter((s) => s.enabled);

    // Get upcoming executions
    const upcomingExecutions = enabledSchedules
      .filter((s) => s.metadata.nextScheduledAt)
      .map((s) => ({
        scheduleId: s.id,
        scheduleName: s.name,
        nextRunAt: s.metadata.nextScheduledAt!,
      }))
      .sort((a, b) => a.nextRunAt - b.nextRunAt)
      .slice(0, 10);

    return {
      running: this.running,
      totalSchedules: allSchedules.length,
      enabledSchedules: enabledSchedules.length,
      runningExecutions: this.runningExecutions.size,
      upcomingExecutions,
    };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton and Helpers
// ============================================================================

let defaultEngine: ScheduleEngine | null = null;

/**
 * Get the default schedule engine
 */
export function getDefaultScheduleEngine(): ScheduleEngine {
  if (!defaultEngine) {
    defaultEngine = new ScheduleEngine();
  }
  return defaultEngine;
}

/**
 * Create a new schedule engine with custom config
 */
export function createScheduleEngine(config?: ScheduleEngineConfig): ScheduleEngine {
  return new ScheduleEngine(config);
}

/**
 * Initialize the default engine
 */
export function initializeScheduleEngine(
  config?: ScheduleEngineConfig
): ScheduleEngine {
  if (defaultEngine) {
    defaultEngine.shutdown();
  }
  defaultEngine = new ScheduleEngine(config);
  defaultEngine.initialize();
  return defaultEngine;
}

/**
 * Shutdown the default engine
 */
export function shutdownScheduleEngine(): void {
  if (defaultEngine) {
    defaultEngine.shutdown();
    defaultEngine = null;
  }
}

/**
 * Trigger a schedule manually
 */
export async function triggerSchedule(
  scheduleId: string
): Promise<ScheduleExecution | null> {
  return getDefaultScheduleEngine().triggerNow(scheduleId);
}
