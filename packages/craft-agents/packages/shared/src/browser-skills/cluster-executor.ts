/**
 * Cluster Executor
 *
 * Executes tasks across multiple browser profiles in parallel.
 * Provides concurrency control, result aggregation, and error handling
 * for multi-profile execution scenarios.
 *
 * Use cases:
 * - Execute the same task on multiple e-commerce stores
 * - Parallel data collection across multiple accounts
 * - Batch operations across browser instances
 */

import type {
  ClusterExecutionResult,
  ClusterAggregation,
  WorkflowEventListener,
  WorkflowEvent,
} from './workflow-types.ts';
import type { ExecutionResult, BrowserSkill } from './types.ts';
import {
  HybridExecutor,
  createExecutor,
  type McpClientInterface,
} from './hybrid-executor.ts';
import { getSkill } from './skill-storage.ts';
import {
  getWorkflow,
  recordWorkflowExecution,
} from './workflow-storage.ts';
import type { ProfileAgentOrchestrator } from '../browser-profiles/profile-orchestrator.ts';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for cluster executor
 */
export interface ClusterExecutorConfig {
  /** Maximum concurrent profile executions */
  maxConcurrency?: number;

  /** Default timeout per profile in ms */
  defaultTimeout?: number;

  /** Whether to continue if some profiles fail */
  continueOnPartialFailure?: boolean;

  /** Retry configuration */
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
    retryableErrors?: string[];
  };

  /** Progress callback */
  onProgress?: (progress: ClusterProgress) => void;
}

const DEFAULT_CONFIG: Required<Omit<ClusterExecutorConfig, 'onProgress'>> = {
  maxConcurrency: 5,
  defaultTimeout: 60000,
  continueOnPartialFailure: true,
  retryConfig: {
    maxRetries: 1,
    retryDelay: 2000,
    retryableErrors: ['timeout', 'network', 'connection'],
  },
};

/**
 * Progress information for cluster execution
 */
export interface ClusterProgress {
  /** Total profiles to execute */
  total: number;

  /** Completed profiles */
  completed: number;

  /** Currently running profiles */
  running: number;

  /** Successful completions */
  succeeded: number;

  /** Failed completions */
  failed: number;

  /** Profiles yet to start */
  pending: number;

  /** Current profile being executed */
  currentProfiles: string[];
}

/**
 * Task definition for cluster execution
 */
export interface ClusterTask {
  /** Task type */
  type: 'skill' | 'workflow' | 'custom';

  /** Skill ID (for skill type) */
  skillId?: string;

  /** Workflow ID (for workflow type) */
  workflowId?: string;

  /** Custom task prompt (for custom type) */
  prompt?: string;

  /** Parameters for the task */
  parameters?: Record<string, unknown>;

  /** Profile-specific parameter overrides */
  profileOverrides?: Record<string, Record<string, unknown>>;
}

/**
 * Result for a single profile execution
 */
export interface ProfileExecutionResult extends ExecutionResult {
  /** Profile ID */
  profileId: string;

  /** Retry count */
  retryCount: number;

  /** Start time */
  startedAt: number;

  /** End time */
  endedAt: number;
}

// ============================================================================
// Event System
// ============================================================================

const eventListeners = new Set<WorkflowEventListener>();

/**
 * Add cluster event listener
 */
export function addClusterEventListener(listener: WorkflowEventListener): void {
  eventListeners.add(listener);
}

/**
 * Remove cluster event listener
 */
export function removeClusterEventListener(listener: WorkflowEventListener): void {
  eventListeners.delete(listener);
}

/**
 * Emit event to all listeners
 */
function emit(event: WorkflowEvent): void {
  for (const listener of eventListeners) {
    try {
      listener(event);
    } catch (err) {
      console.error('[ClusterExecutor] Event listener error:', err);
    }
  }
}

// ============================================================================
// Cluster Executor Class
// ============================================================================

/**
 * Cluster Executor
 *
 * Coordinates task execution across multiple browser profiles
 * with concurrency control and result aggregation.
 */
export class ClusterExecutor {
  private config: Required<Omit<ClusterExecutorConfig, 'onProgress'>>;
  private progressCallback: ((progress: ClusterProgress) => void) | null = null;
  private skillExecutor: HybridExecutor;
  private orchestrator: ProfileAgentOrchestrator | null = null;

  constructor(config: ClusterExecutorConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      retryConfig: { ...DEFAULT_CONFIG.retryConfig, ...config.retryConfig },
    };
    this.progressCallback = config.onProgress || null;
    this.skillExecutor = createExecutor({
      defaultTimeout: this.config.defaultTimeout,
    });
  }

  /**
   * Set the profile orchestrator for MCP client access
   */
  setOrchestrator(orchestrator: ProfileAgentOrchestrator): void {
    this.orchestrator = orchestrator;
  }

  /**
   * Execute a skill on multiple profiles
   */
  async executeSkillOnCluster(
    skillId: string,
    profileIds: string[],
    options?: {
      parameters?: Record<string, unknown>;
      profileOverrides?: Record<string, Record<string, unknown>>;
      aggregation?: ClusterAggregation;
    }
  ): Promise<ClusterExecutionResult> {
    const skill = getSkill(skillId);
    if (!skill) {
      return {
        totalProfiles: profileIds.length,
        successCount: 0,
        failureCount: profileIds.length,
        results: Object.fromEntries(
          profileIds.map((id) => [
            id,
            { success: false, error: `Skill not found: ${skillId}`, durationMs: 0 },
          ])
        ),
        durationMs: 0,
      };
    }

    return this.executeOnCluster(
      {
        type: 'skill',
        skillId,
        parameters: options?.parameters,
        profileOverrides: options?.profileOverrides,
      },
      profileIds,
      options?.aggregation
    );
  }

  /**
   * Execute a workflow on multiple profiles
   */
  async executeWorkflowOnCluster(
    workflowId: string,
    profileIds: string[],
    options?: {
      parameters?: Record<string, unknown>;
      profileOverrides?: Record<string, Record<string, unknown>>;
      aggregation?: ClusterAggregation;
    }
  ): Promise<ClusterExecutionResult> {
    const workflow = getWorkflow(workflowId);
    if (!workflow) {
      return {
        totalProfiles: profileIds.length,
        successCount: 0,
        failureCount: profileIds.length,
        results: Object.fromEntries(
          profileIds.map((id) => [
            id,
            { success: false, error: `Workflow not found: ${workflowId}`, durationMs: 0 },
          ])
        ),
        durationMs: 0,
      };
    }

    return this.executeOnCluster(
      {
        type: 'workflow',
        workflowId,
        parameters: options?.parameters,
        profileOverrides: options?.profileOverrides,
      },
      profileIds,
      options?.aggregation
    );
  }

  /**
   * Execute a custom task on multiple profiles
   */
  async executeTaskOnCluster(
    prompt: string,
    profileIds: string[],
    options?: {
      parameters?: Record<string, unknown>;
      profileOverrides?: Record<string, Record<string, unknown>>;
      aggregation?: ClusterAggregation;
    }
  ): Promise<ClusterExecutionResult> {
    return this.executeOnCluster(
      {
        type: 'custom',
        prompt,
        parameters: options?.parameters,
        profileOverrides: options?.profileOverrides,
      },
      profileIds,
      options?.aggregation
    );
  }

  /**
   * Core cluster execution logic
   */
  private async executeOnCluster(
    task: ClusterTask,
    profileIds: string[],
    aggregation?: ClusterAggregation
  ): Promise<ClusterExecutionResult> {
    const startTime = Date.now();
    const executionId = this.generateExecutionId();

    // Initialize progress tracking
    const progress: ClusterProgress = {
      total: profileIds.length,
      completed: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      pending: profileIds.length,
      currentProfiles: [],
    };

    const results: Record<string, ExecutionResult> = {};
    const queue = [...profileIds];
    const running = new Map<string, Promise<void>>();

    // Emit cluster started event
    if (task.type === 'workflow' && task.workflowId) {
      emit({
        type: 'cluster_started',
        workflowId: task.workflowId,
        executionId,
        profileIds,
      });
    }

    // Process queue with concurrency control
    while (queue.length > 0 || running.size > 0) {
      // Fill up to max concurrency
      while (running.size < this.config.maxConcurrency && queue.length > 0) {
        const profileId = queue.shift()!;
        progress.pending--;
        progress.running++;
        progress.currentProfiles = [...running.keys(), profileId];

        const promise = this.executeOnProfile(task, profileId, executionId)
          .then((result) => {
            results[profileId] = result;
            progress.completed++;
            progress.running--;
            progress.currentProfiles = progress.currentProfiles.filter(
              (p) => p !== profileId
            );

            if (result.success) {
              progress.succeeded++;
            } else {
              progress.failed++;
            }

            this.reportProgress(progress);

            // Emit profile completed event
            if (task.type === 'workflow' && task.workflowId) {
              emit({
                type: 'cluster_profile_completed',
                workflowId: task.workflowId,
                executionId,
                profileId,
                success: result.success,
              });
            }
          })
          .catch((err) => {
            const error = err instanceof Error ? err.message : 'Unknown error';
            results[profileId] = {
              success: false,
              error,
              durationMs: 0,
            };
            progress.completed++;
            progress.running--;
            progress.failed++;
            progress.currentProfiles = progress.currentProfiles.filter(
              (p) => p !== profileId
            );

            this.reportProgress(progress);
          })
          .finally(() => {
            running.delete(profileId);
          });

        running.set(profileId, promise);
        this.reportProgress(progress);
      }

      // Wait for at least one to complete
      if (running.size > 0) {
        await Promise.race(running.values());
      }
    }

    const totalDuration = Date.now() - startTime;

    // Aggregate results
    const aggregatedResult = this.aggregateResults(results, aggregation);

    // Record execution for workflow
    if (task.type === 'workflow' && task.workflowId) {
      recordWorkflowExecution(task.workflowId, progress.succeeded > 0, totalDuration, {
        parameters: task.parameters,
        profileIds,
      });
    }

    return {
      totalProfiles: profileIds.length,
      successCount: progress.succeeded,
      failureCount: progress.failed,
      results,
      aggregatedResult,
      durationMs: totalDuration,
    };
  }

  /**
   * Execute task on a single profile with retries
   */
  private async executeOnProfile(
    task: ClusterTask,
    profileId: string,
    executionId: string
  ): Promise<ExecutionResult> {
    const startedAt = Date.now();
    let lastError: string | undefined;
    let retryCount = 0;

    for (let attempt = 0; attempt <= this.config.retryConfig.maxRetries; attempt++) {
      try {
        // Get MCP client for profile
        const mcpClient = await this.getMcpClient(profileId);
        if (!mcpClient) {
          throw new Error('No MCP client available for profile');
        }

        // Build parameters with profile overrides
        let parameters = task.parameters || {};
        if (task.profileOverrides?.[profileId]) {
          parameters = { ...parameters, ...task.profileOverrides[profileId] };
        }

        // Execute based on task type
        let result: ExecutionResult;

        switch (task.type) {
          case 'skill': {
            const skill = getSkill(task.skillId!);
            if (!skill) {
              throw new Error(`Skill not found: ${task.skillId}`);
            }
            result = await this.skillExecutor.execute(skill.name, mcpClient, {
              parameters,
              profileId,
            });
            break;
          }

          case 'workflow': {
            // Import dynamically to avoid circular dependency
            const { executeWorkflow } = await import('./workflow-engine.ts');
            const wfResult = await executeWorkflow(task.workflowId!, {
              parameters,
              profileId,
              mcpClient,
            });
            result = {
              success: wfResult.success,
              data: wfResult.outputs,
              error: wfResult.error,
              durationMs: wfResult.durationMs,
            };
            break;
          }

          case 'custom':
          default: {
            result = await this.skillExecutor.execute(task.prompt || '', mcpClient, {
              parameters,
              profileId,
            });
            break;
          }
        }

        return {
          ...result,
          durationMs: Date.now() - startedAt,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Unknown error';
        retryCount++;

        // Check if error is retryable
        if (attempt < this.config.retryConfig.maxRetries) {
          const isRetryable = this.isRetryableError(lastError);
          if (isRetryable) {
            await this.sleep(this.config.retryConfig.retryDelay);
            continue;
          }
        }

        break;
      }
    }

    return {
      success: false,
      error: lastError || 'Execution failed',
      durationMs: Date.now() - startedAt,
    };
  }

  /**
   * Get MCP client for a profile
   */
  private async getMcpClient(profileId: string): Promise<McpClientInterface | null> {
    if (!this.orchestrator) {
      return null;
    }

    const mcpManager = this.orchestrator.getMcpManager();
    const state = mcpManager.getState(profileId);

    if (state?.status !== 'connected') {
      return null;
    }

    // Create an adapter that implements McpClientInterface
    return {
      callTool: async (name: string, args: Record<string, unknown>) => {
        return mcpManager.callTool(profileId, name, args);
      },
      getPageUrl: async () => {
        const result = await mcpManager.callTool(profileId, 'tabs_context_mcp', {});
        // Parse URL from result
        return (result as { url?: string })?.url || '';
      },
      getPageTitle: async () => {
        const result = await mcpManager.callTool(profileId, 'tabs_context_mcp', {});
        return (result as { title?: string })?.title || '';
      },
    };
  }

  /**
   * Aggregate results based on strategy
   */
  private aggregateResults(
    results: Record<string, ExecutionResult>,
    aggregation?: ClusterAggregation
  ): unknown {
    const successResults = Object.entries(results)
      .filter(([, r]) => r.success)
      .map(([id, r]) => ({ profileId: id, ...r }));

    switch (aggregation) {
      case 'first_success':
        return successResults[0] || null;

      case 'merge': {
        const merged: Record<string, unknown> = {};
        for (const result of successResults) {
          if (result.data && typeof result.data === 'object') {
            Object.assign(merged, result.data);
          }
        }
        return merged;
      }

      case 'count':
        return {
          success: successResults.length,
          failure: Object.keys(results).length - successResults.length,
          total: Object.keys(results).length,
        };

      case 'all':
      default:
        return Object.entries(results).map(([id, r]) => ({
          profileId: id,
          success: r.success,
          data: r.data,
          error: r.error,
          durationMs: r.durationMs,
        }));
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: string): boolean {
    const patterns = this.config.retryConfig.retryableErrors || [];
    return patterns.some((pattern) =>
      error.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Report progress to callback
   */
  private reportProgress(progress: ClusterProgress): void {
    if (this.progressCallback) {
      this.progressCallback({ ...progress });
    }
  }

  /**
   * Generate execution ID
   */
  private generateExecutionId(): string {
    return `cluster_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton and Helpers
// ============================================================================

let defaultClusterExecutor: ClusterExecutor | null = null;

/**
 * Get the default cluster executor
 */
export function getDefaultClusterExecutor(): ClusterExecutor {
  if (!defaultClusterExecutor) {
    defaultClusterExecutor = new ClusterExecutor();
  }
  return defaultClusterExecutor;
}

/**
 * Create a new cluster executor with custom config
 */
export function createClusterExecutor(config?: ClusterExecutorConfig): ClusterExecutor {
  return new ClusterExecutor(config);
}

/**
 * Execute a skill on a cluster of profiles
 */
export async function executeSkillOnCluster(
  skillId: string,
  profileIds: string[],
  options?: {
    parameters?: Record<string, unknown>;
    profileOverrides?: Record<string, Record<string, unknown>>;
    aggregation?: ClusterAggregation;
  }
): Promise<ClusterExecutionResult> {
  return getDefaultClusterExecutor().executeSkillOnCluster(
    skillId,
    profileIds,
    options
  );
}

/**
 * Execute a workflow on a cluster of profiles
 */
export async function executeWorkflowOnCluster(
  workflowId: string,
  profileIds: string[],
  options?: {
    parameters?: Record<string, unknown>;
    profileOverrides?: Record<string, Record<string, unknown>>;
    aggregation?: ClusterAggregation;
  }
): Promise<ClusterExecutionResult> {
  return getDefaultClusterExecutor().executeWorkflowOnCluster(
    workflowId,
    profileIds,
    options
  );
}
