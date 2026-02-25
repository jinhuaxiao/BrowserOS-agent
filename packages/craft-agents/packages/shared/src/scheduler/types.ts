/**
 * Scheduler Types
 *
 * Type definitions for the scheduled task and trigger system.
 * Supports cron expressions, intervals, events, and webhooks
 * to automatically execute workflows and skills.
 */

// ============================================================================
// Trigger Types
// ============================================================================

/**
 * Types of triggers that can start a scheduled task
 */
export type TriggerType = 'cron' | 'interval' | 'event' | 'webhook' | 'manual';

/**
 * Cron trigger configuration
 * Uses standard cron expression syntax
 *
 * @example
 * ```typescript
 * const trigger: CronTriggerConfig = {
 *   type: 'cron',
 *   expression: '0 9 * * 1-5',  // Every weekday at 9 AM
 *   timezone: 'America/New_York',
 * };
 * ```
 */
export interface CronTriggerConfig {
  type: 'cron';
  /** Cron expression (e.g., "0 9 * * 1-5" for every weekday at 9 AM) */
  expression: string;
  /** Timezone for the cron expression (default: system timezone) */
  timezone?: string;
}

/**
 * Interval trigger configuration
 * Executes at fixed time intervals
 *
 * @example
 * ```typescript
 * const trigger: IntervalTriggerConfig = {
 *   type: 'interval',
 *   intervalMs: 60 * 60 * 1000,  // Every hour
 *   startImmediately: true,
 * };
 * ```
 */
export interface IntervalTriggerConfig {
  type: 'interval';
  /** Interval in milliseconds between executions */
  intervalMs: number;
  /** Whether to execute immediately on start (default: false) */
  startImmediately?: boolean;
}

/**
 * Event trigger configuration
 * Executes when a specific event occurs
 *
 * @example
 * ```typescript
 * const trigger: EventTriggerConfig = {
 *   type: 'event',
 *   eventType: 'workflow_completed',
 *   filter: { workflowId: 'wf_abc123' },
 * };
 * ```
 */
export interface EventTriggerConfig {
  type: 'event';
  /** Type of event to listen for */
  eventType:
    | 'workflow_completed'
    | 'workflow_failed'
    | 'skill_completed'
    | 'skill_failed'
    | 'file_changed'
    | 'mcp_event'
    | 'schedule_completed';
  /** Filter conditions for the event */
  filter?: Record<string, unknown>;
}

/**
 * Webhook trigger configuration
 * Executes when an HTTP request is received
 *
 * @example
 * ```typescript
 * const trigger: WebhookTriggerConfig = {
 *   type: 'webhook',
 *   path: '/schedules/my-task/trigger',
 *   secret: 'my-secret-key',
 * };
 * ```
 */
export interface WebhookTriggerConfig {
  type: 'webhook';
  /** Webhook path (will be: /schedules/{id}/trigger) */
  path: string;
  /** Secret key for webhook verification */
  secret?: string;
  /** HTTP methods to accept (default: ['POST']) */
  methods?: Array<'GET' | 'POST' | 'PUT'>;
}

/**
 * Manual trigger configuration
 * Only executes when triggered manually
 */
export interface ManualTriggerConfig {
  type: 'manual';
}

/**
 * Union type for all trigger configurations
 */
export type TriggerConfig =
  | CronTriggerConfig
  | IntervalTriggerConfig
  | EventTriggerConfig
  | WebhookTriggerConfig
  | ManualTriggerConfig;

// ============================================================================
// Scheduled Task Types
// ============================================================================

/**
 * Target for scheduled execution - either a workflow or a skill
 */
export type ScheduleTarget =
  | { type: 'workflow'; workflowId: string; parameters?: Record<string, unknown> }
  | { type: 'skill'; skillId: string; parameters?: Record<string, unknown> };

/**
 * Execution configuration for scheduled tasks
 */
export interface ScheduleExecutionConfig {
  /** Execution timeout in milliseconds (default: 300000 = 5 minutes) */
  timeout?: number;
  /** Number of retry attempts on failure (default: 2) */
  retries?: number;
  /** Delay between retries in milliseconds (default: 5000) */
  retryDelay?: number;
  /** Browser profile ID to use for execution */
  profileId?: string;
  /** Whether to notify on failure (default: true) */
  notifyOnFailure?: boolean;
  /** Whether to notify on success (default: false) */
  notifyOnSuccess?: boolean;
  /** Maximum concurrent executions of this schedule (default: 1) */
  maxConcurrent?: number;
  /** Whether to skip execution if previous is still running (default: true) */
  skipIfRunning?: boolean;
}

/**
 * Metadata for tracking schedule statistics
 */
export interface ScheduleMetadata {
  /** Total number of executions */
  executionCount: number;
  /** Success rate from 0 to 1 */
  successRate: number;
  /** Number of consecutive failures */
  consecutiveFailures: number;
  /** Average execution duration in milliseconds */
  averageDurationMs: number;
  /** Timestamp of last execution */
  lastExecutedAt?: number;
  /** Timestamp of last successful execution */
  lastSuccessAt?: number;
  /** Timestamp of next scheduled execution */
  nextScheduledAt?: number;
  /** Last error message if any */
  lastError?: string;
}

/**
 * A scheduled task definition
 */
export interface ScheduledTask {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this schedule does */
  description?: string;
  /** Whether the schedule is enabled */
  enabled: boolean;

  /** Trigger configuration */
  trigger: TriggerConfig;

  /** Execution target (workflow or skill) */
  target: ScheduleTarget;

  /** Execution configuration */
  config: ScheduleExecutionConfig;

  /** Statistics metadata */
  metadata: ScheduleMetadata;

  /** Tags for organization */
  tags?: string[];

  /** Creation timestamp */
  createdAt: number;

  /** Last update timestamp */
  updatedAt: number;
}

// ============================================================================
// Execution Types
// ============================================================================

/**
 * Status of a schedule execution
 */
export type ScheduleExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'cancelled'
  | 'skipped';

/**
 * A single execution record of a scheduled task
 */
export interface ScheduleExecution {
  /** Unique execution ID */
  id: string;
  /** ID of the schedule that was executed */
  scheduleId: string;
  /** How this execution was triggered */
  triggeredBy: TriggerType;
  /** Execution start timestamp */
  startedAt: number;
  /** Execution completion timestamp */
  completedAt?: number;
  /** Current status */
  status: ScheduleExecutionStatus;
  /** Result data from execution */
  result?: unknown;
  /** Error message if failed */
  error?: string;
  /** Execution duration in milliseconds */
  durationMs?: number;
  /** Number of retry attempts made */
  retryCount?: number;
  /** Profile ID used for execution */
  profileId?: string;
  /** Additional execution metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Events emitted by the scheduler system
 */
export type ScheduleEvent =
  | { type: 'schedule_created'; schedule: ScheduledTask }
  | { type: 'schedule_updated'; schedule: ScheduledTask; changes: string[] }
  | { type: 'schedule_deleted'; scheduleId: string }
  | { type: 'schedule_enabled'; scheduleId: string }
  | { type: 'schedule_disabled'; scheduleId: string }
  | { type: 'execution_scheduled'; scheduleId: string; nextRunAt: number }
  | { type: 'execution_started'; scheduleId: string; executionId: string }
  | { type: 'execution_completed'; scheduleId: string; executionId: string; result: unknown }
  | { type: 'execution_failed'; scheduleId: string; executionId: string; error: string }
  | { type: 'execution_timeout'; scheduleId: string; executionId: string }
  | { type: 'execution_cancelled'; scheduleId: string; executionId: string }
  | { type: 'execution_skipped'; scheduleId: string; reason: string };

/**
 * Event listener function type
 */
export type ScheduleEventListener = (event: ScheduleEvent) => void;

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Entry in the schedule index for fast lookup
 */
export interface ScheduleIndexEntry {
  /** Schedule ID */
  id: string;
  /** Schedule name */
  name: string;
  /** Whether enabled */
  enabled: boolean;
  /** Type of trigger */
  triggerType: TriggerType;
  /** Target type (workflow or skill) */
  targetType: 'workflow' | 'skill';
  /** Target ID */
  targetId: string;
  /** Next scheduled execution timestamp */
  nextScheduledAt?: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Schedule index file structure
 */
export interface ScheduleIndex {
  /** Index format version */
  version: number;
  /** Map of schedule ID to index entry */
  schedules: ScheduleIndexEntry[];
  /** Last update timestamp */
  updatedAt: number;
}

// ============================================================================
// Engine Types
// ============================================================================

/**
 * Configuration for the schedule engine
 */
export interface ScheduleEngineConfig {
  /** Interval for checking schedules in milliseconds (default: 1000) */
  checkIntervalMs?: number;
  /** Maximum concurrent executions across all schedules (default: 5) */
  maxConcurrentExecutions?: number;
  /** Default execution timeout in milliseconds (default: 300000 = 5 minutes) */
  defaultTimeout?: number;
  /** Default number of retries (default: 2) */
  defaultRetries?: number;
  /** Default retry delay in milliseconds (default: 5000) */
  defaultRetryDelay?: number;
  /** Whether to persist schedules (default: true) */
  persistSchedules?: boolean;
  /** Whether to auto-start on initialization (default: true) */
  autoStart?: boolean;
}

/**
 * Summary of engine status
 */
export interface ScheduleEngineStatus {
  /** Whether the engine is running */
  running: boolean;
  /** Number of registered schedules */
  totalSchedules: number;
  /** Number of enabled schedules */
  enabledSchedules: number;
  /** Number of currently running executions */
  runningExecutions: number;
  /** Upcoming executions (next N) */
  upcomingExecutions: Array<{
    scheduleId: string;
    scheduleName: string;
    nextRunAt: number;
  }>;
}
