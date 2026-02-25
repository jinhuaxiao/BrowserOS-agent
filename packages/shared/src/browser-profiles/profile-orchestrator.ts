/**
 * Profile Agent Orchestrator
 *
 * Manages multiple browser profiles with their MCP connections,
 * enabling parallel task execution across different browser instances.
 *
 * Use cases:
 * - Run multiple Amazon stores in isolated browser environments
 * - Execute tasks in parallel across different profiles
 * - Monitor and manage browser cluster health
 */

import type {
  BrowserProfileConfig,
  LaunchResult,
  LaunchWithMcpResult,
  OrchestratorConfig,
  ProfileMcpState,
  BatchLaunchOptions,
  BatchLaunchProgress,
  BatchLaunchResult,
  BrowserConfig,
} from './types.ts';
import {
  ProfileMcpConnectionManager,
  type ConnectionManagerConfig,
  type ConnectionEvent,
} from './mcp-connection-manager.ts';
import { launchBrowser, stopBrowser, isBrowserRunning } from './launcher.ts';
import { getProfile, listProfiles } from './storage.ts';
import {
  discoverMcpPort,
  waitForMcpServer,
  waitForMcpServerSmart,
  discoverMcpPortFast,
  calculatePortFromProfileId,
  findNextAvailablePort,
  DEFAULT_MCP_PORT_RANGE,
} from './mcp-port-discovery.ts';

/**
 * Profile state with browser and MCP information
 */
export interface ProfileState {
  /** Profile ID */
  profileId: string;

  /** Profile name */
  profileName: string;

  /** Whether browser process is running */
  browserRunning: boolean;

  /** Browser process ID */
  pid?: number;

  /** MCP connection state */
  mcpState?: ProfileMcpState;

  /** MCP port */
  mcpPort?: number;

  /** Last error */
  lastError?: string;
}

/**
 * Task execution result
 */
export interface TaskResult {
  /** Profile ID */
  profileId: string;

  /** Whether task completed successfully */
  success: boolean;

  /** Task result data */
  result?: unknown;

  /** Error message if failed */
  error?: string;

  /** Execution time in ms */
  executionTimeMs?: number;
}

/**
 * Parallel task definition
 */
export interface ParallelTask {
  /** Target profile ID */
  profileId: string;

  /** Task description/prompt */
  prompt: string;

  /** Optional task metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Orchestrator event types
 */
export type OrchestratorEvent =
  | { type: 'profile_launched'; profileId: string; mcpPort?: number }
  | { type: 'profile_stopped'; profileId: string }
  | { type: 'profile_error'; profileId: string; error: string }
  | { type: 'mcp_event'; event: ConnectionEvent }
  | { type: 'task_started'; profileId: string; taskId: string }
  | { type: 'task_completed'; profileId: string; taskId: string; result: TaskResult };

/**
 * Event listener type
 */
export type OrchestratorEventListener = (event: OrchestratorEvent) => void;

/**
 * Profile Agent Orchestrator
 *
 * Coordinates multiple browser profiles and their MCP connections.
 */
export class ProfileAgentOrchestrator {
  private mcpManager: ProfileMcpConnectionManager;
  private config: Required<OrchestratorConfig>;
  private launchedProfiles: Map<string, { pid?: number; mcpPort?: number }> = new Map();
  private allocatedPorts: Set<number> = new Set();
  private eventListeners: Set<OrchestratorEventListener> = new Set();
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      portConfig: config.portConfig || {
        basePort: DEFAULT_MCP_PORT_RANGE.min,
        maxPort: DEFAULT_MCP_PORT_RANGE.max,
        strategy: 'sequential',
      },
      healthCheckInterval: config.healthCheckInterval ?? 30000,
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 3,
      reconnectBackoffMs: config.reconnectBackoffMs ?? 1000,
    };

    // Create MCP connection manager
    const managerConfig: ConnectionManagerConfig = {
      healthCheckInterval: this.config.healthCheckInterval,
      autoReconnect: this.config.autoReconnect,
      maxReconnectAttempts: this.config.maxReconnectAttempts,
      defaultPortRange: {
        min: this.config.portConfig.basePort,
        max: this.config.portConfig.maxPort,
      },
    };

    this.mcpManager = new ProfileMcpConnectionManager(managerConfig);

    // Forward MCP events
    this.mcpManager.addEventListener((event) => {
      this.emit({ type: 'mcp_event', event });
    });

    // Start health check if enabled
    if (this.config.healthCheckInterval > 0) {
      this.startHealthCheck();
    }
  }

  /**
   * Add event listener
   */
  addEventListener(listener: OrchestratorEventListener): void {
    this.eventListeners.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: OrchestratorEventListener): void {
    this.eventListeners.delete(listener);
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: OrchestratorEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[Orchestrator] Event listener error:', err);
      }
    }
  }

  /**
   * Allocate a port for a profile
   */
  private async allocatePort(profileId: string): Promise<number | null> {
    const { basePort, maxPort, strategy } = this.config.portConfig;

    if (strategy === 'profile-hash') {
      // Use deterministic port based on profile ID
      const port = calculatePortFromProfileId(profileId, basePort, maxPort);

      // Check if port is available
      if (!this.allocatedPorts.has(port)) {
        this.allocatedPorts.add(port);
        return port;
      }

      // Fall back to sequential if hash port is taken
    }

    // Sequential allocation
    const port = await findNextAvailablePort(
      this.allocatedPorts,
      basePort,
      maxPort
    );

    if (port) {
      this.allocatedPorts.add(port);
    }

    return port;
  }

  /**
   * Release an allocated port
   */
  private releasePort(port: number): void {
    this.allocatedPorts.delete(port);
  }

  /**
   * Launch a browser profile and establish MCP connection
   */
  async launchProfile(
    profileOrId: BrowserProfileConfig | string,
    options?: {
      /** Wait for MCP connection */
      waitForMcp?: boolean;
      /** MCP connection timeout */
      mcpTimeout?: number;
      /** Specific port to use */
      mcpPort?: number;
    }
  ): Promise<LaunchWithMcpResult> {
    // Get profile
    const profile =
      typeof profileOrId === 'string'
        ? getProfile(profileOrId)
        : profileOrId;

    if (!profile) {
      return {
        success: false,
        error: `Profile not found: ${profileOrId}`,
        mcpConnected: false,
      };
    }

    const profileId = profile.id;
    const timeout = options?.mcpTimeout || 30000;

    // Check if already launched
    if (this.launchedProfiles.has(profileId)) {
      const existing = this.launchedProfiles.get(profileId)!;
      if (isBrowserRunning(profileId)) {
        return {
          success: true,
          pid: existing.pid,
          mcpConnected: this.mcpManager.getState(profileId)?.status === 'connected',
          mcpPort: existing.mcpPort,
        };
      }
      // Clean up stale entry
      this.launchedProfiles.delete(profileId);
      if (existing.mcpPort) {
        this.releasePort(existing.mcpPort);
      }
    }

    // Allocate MCP port (Phase 2: will be passed to browser)
    let mcpPort = options?.mcpPort;
    if (!mcpPort) {
      mcpPort = await this.allocatePort(profileId) || undefined;
    }

    // Launch browser
    const launchResult = await launchBrowser(profile);

    if (!launchResult.success) {
      if (mcpPort) {
        this.releasePort(mcpPort);
      }
      this.emit({
        type: 'profile_error',
        profileId,
        error: launchResult.error || 'Launch failed',
      });
      return {
        ...launchResult,
        mcpConnected: false,
      };
    }

    // Track launched profile
    this.launchedProfiles.set(profileId, {
      pid: launchResult.pid,
      mcpPort,
    });

    this.emit({ type: 'profile_launched', profileId, mcpPort });

    // Attempt MCP connection
    let mcpConnected = false;
    let actualMcpPort = mcpPort;

    if (options?.waitForMcp !== false) {
      // Wait for MCP server to start (BrowserOS needs time to initialize)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Try to discover MCP port using fast parallel scanning
      const discovery = await discoverMcpPortFast(
        this.config.portConfig.basePort,
        this.config.portConfig.maxPort,
        profile.mcp?.host || '127.0.0.1',
        { concurrency: 20, stopOnFirst: true }
      );

      // Fallback to file-based discovery if fast scan fails
      if (!discovery.success) {
        const fileDiscovery = await discoverMcpPort(profile.userDataDir, profile.mcp);
        if (fileDiscovery.success && fileDiscovery.port) {
          actualMcpPort = fileDiscovery.port;
        }
      } else {
        actualMcpPort = discovery.port;
      }

      if (actualMcpPort) {
        // Wait for server to be ready using smart exponential backoff
        const waitResult = await waitForMcpServerSmart(
          actualMcpPort,
          profile.mcp?.host || '127.0.0.1',
          timeout
        );

        if (waitResult.success) {
          mcpConnected = await this.mcpManager.connect(profile, {
            port: actualMcpPort,
          });
        }
      }

      // Update tracked port
      if (actualMcpPort) {
        const entry = this.launchedProfiles.get(profileId);
        if (entry) {
          entry.mcpPort = actualMcpPort;
        }
      }
    }

    return {
      success: true,
      pid: launchResult.pid,
      mcpConnected,
      mcpPort: actualMcpPort,
      mcpState: this.mcpManager.getState(profileId),
    };
  }

  /**
   * Stop a browser profile
   */
  async stopProfile(profileId: string): Promise<void> {
    // Disconnect MCP first
    await this.mcpManager.disconnect(profileId);

    // Stop browser
    stopBrowser(profileId);

    // Release port
    const entry = this.launchedProfiles.get(profileId);
    if (entry?.mcpPort) {
      this.releasePort(entry.mcpPort);
    }

    // Remove from tracking
    this.launchedProfiles.delete(profileId);

    this.emit({ type: 'profile_stopped', profileId });
  }

  /**
   * Get profile state
   */
  getProfileState(profileId: string): ProfileState | null {
    const profile = getProfile(profileId);
    if (!profile) return null;

    const entry = this.launchedProfiles.get(profileId);
    const mcpState = this.mcpManager.getState(profileId);

    return {
      profileId,
      profileName: profile.name,
      browserRunning: isBrowserRunning(profileId),
      pid: entry?.pid,
      mcpState,
      mcpPort: entry?.mcpPort,
      lastError: profile.lastError,
    };
  }

  /**
   * Get all profile states
   */
  getAllProfileStates(): Map<string, ProfileState> {
    const states = new Map<string, ProfileState>();

    // Include all launched profiles
    for (const profileId of this.launchedProfiles.keys()) {
      const state = this.getProfileState(profileId);
      if (state) {
        states.set(profileId, state);
      }
    }

    return states;
  }

  /**
   * Get MCP connection manager
   */
  getMcpManager(): ProfileMcpConnectionManager {
    return this.mcpManager;
  }

  /**
   * Execute a task on a specific profile
   */
  async executeOnProfile(
    profileId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<TaskResult> {
    const startTime = Date.now();
    const taskId = `${profileId}-${Date.now()}`;

    this.emit({ type: 'task_started', profileId, taskId });

    try {
      // Ensure profile is launched and connected
      const state = this.getProfileState(profileId);

      if (!state?.browserRunning) {
        throw new Error('Browser is not running');
      }

      if (state.mcpState?.status !== 'connected') {
        throw new Error('MCP is not connected');
      }

      // Execute tool
      const result = await this.mcpManager.callTool(profileId, toolName, args);

      const taskResult: TaskResult = {
        profileId,
        success: true,
        result,
        executionTimeMs: Date.now() - startTime,
      };

      this.emit({ type: 'task_completed', profileId, taskId, result: taskResult });
      return taskResult;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';

      const taskResult: TaskResult = {
        profileId,
        success: false,
        error,
        executionTimeMs: Date.now() - startTime,
      };

      this.emit({ type: 'task_completed', profileId, taskId, result: taskResult });
      return taskResult;
    }
  }

  /**
   * Execute tasks in parallel across multiple profiles
   */
  async executeParallel(
    tasks: ParallelTask[]
  ): Promise<Map<string, TaskResult>> {
    const results = new Map<string, TaskResult>();

    // Execute all tasks in parallel
    const promises = tasks.map(async (task) => {
      // For now, we use the prompt as a navigation action
      // In a full implementation, this would use the CraftAgent
      const result = await this.executeOnProfile(
        task.profileId,
        'navigate',
        { url: task.prompt }
      );

      results.set(task.profileId, result);
      return result;
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Launch multiple profiles in parallel
   */
  async launchMultipleProfiles(
    profileIds: string[],
    options?: {
      waitForMcp?: boolean;
      mcpTimeout?: number;
    }
  ): Promise<Map<string, LaunchWithMcpResult>> {
    const results = new Map<string, LaunchWithMcpResult>();

    // Launch all profiles in parallel
    const promises = profileIds.map(async (profileId) => {
      const result = await this.launchProfile(profileId, options);
      results.set(profileId, result);
      return result;
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Pre-allocate ports for a list of profiles
   *
   * Use this before batch launching to ensure port availability
   * and avoid conflicts during concurrent launches.
   *
   * @param profileIds - List of profile IDs to allocate ports for
   * @returns Map of profileId to allocated port
   */
  async preAllocatePorts(profileIds: string[]): Promise<Map<string, number>> {
    const allocatedMap = new Map<string, number>();
    const { basePort, maxPort, strategy } = this.config.portConfig;

    for (const profileId of profileIds) {
      let port: number | null = null;

      if (strategy === 'profile-hash') {
        // Use deterministic port based on profile ID
        const hashPort = calculatePortFromProfileId(profileId, basePort, maxPort);

        // Check if hash port is available
        if (!this.allocatedPorts.has(hashPort)) {
          port = hashPort;
        }
      }

      // Fallback to sequential allocation
      if (!port) {
        port = await findNextAvailablePort(this.allocatedPorts, basePort, maxPort);
      }

      if (port) {
        this.allocatedPorts.add(port);
        allocatedMap.set(profileId, port);
      } else {
        console.warn(`[Orchestrator] Could not allocate port for profile ${profileId}`);
      }
    }

    return allocatedMap;
  }

  /**
   * Release pre-allocated ports
   *
   * @param allocatedPorts - Map of profileId to port from preAllocatePorts
   */
  releasePreAllocatedPorts(allocatedPorts: Map<string, number>): void {
    for (const port of allocatedPorts.values()) {
      this.releasePort(port);
    }
  }

  /**
   * Launch multiple profiles with controlled concurrency
   *
   * Features:
   * - Configurable concurrency limit
   * - Stagger delay between launches
   * - Progress callback
   * - Continue on error option
   * - Pre-allocated port support
   *
   * @param profileIds - List of profile IDs to launch
   * @param options - Batch launch options
   * @returns Batch launch result
   */
  async launchMultipleProfilesControlled(
    profileIds: string[],
    options?: BatchLaunchOptions
  ): Promise<BatchLaunchResult> {
    const startTime = Date.now();
    const concurrency = options?.concurrency ?? 3;
    const staggerDelay = options?.staggerDelay ?? 500;
    const continueOnError = options?.continueOnError ?? true;
    const waitForMcp = options?.waitForMcp ?? true;
    const mcpTimeout = options?.mcpTimeout ?? 30000;

    const results = new Map<string, LaunchWithMcpResult>();
    const failures: Array<{ profileId: string; error: string }> = [];

    let completed = 0;
    let successful = 0;
    let failed = 0;

    // Pre-allocate ports if not provided
    const preallocatedPorts =
      options?.preallocatedPorts ?? (await this.preAllocatePorts(profileIds));

    // Report initial progress
    const reportProgress = (current?: string) => {
      if (options?.onProgress) {
        const progress: BatchLaunchProgress = {
          total: profileIds.length,
          completed,
          successful,
          failed,
          current,
        };

        // Estimate remaining time based on average time per profile
        if (completed > 0) {
          const elapsed = Date.now() - startTime;
          const avgTimePerProfile = elapsed / completed;
          const remaining = profileIds.length - completed;
          progress.estimatedRemainingMs = Math.round(avgTimePerProfile * remaining);
        }

        options.onProgress(progress);
      }
    };

    reportProgress();

    // Create a queue for concurrent execution
    const queue = [...profileIds];
    const executing: Promise<void>[] = [];

    const launchOne = async (profileId: string): Promise<void> => {
      reportProgress(profileId);

      try {
        const mcpPort = preallocatedPorts.get(profileId);

        const result = await this.launchProfile(profileId, {
          waitForMcp,
          mcpTimeout,
          mcpPort,
        });

        results.set(profileId, result);

        if (result.success) {
          successful++;
        } else {
          failed++;
          failures.push({
            profileId,
            error: result.error || 'Unknown error',
          });

          // Release the pre-allocated port on failure
          if (mcpPort) {
            this.releasePort(mcpPort);
            preallocatedPorts.delete(profileId);
          }
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        results.set(profileId, {
          success: false,
          error,
          mcpConnected: false,
        });
        failed++;
        failures.push({ profileId, error });

        // Release the pre-allocated port on failure
        const mcpPort = preallocatedPorts.get(profileId);
        if (mcpPort) {
          this.releasePort(mcpPort);
          preallocatedPorts.delete(profileId);
        }
      }

      completed++;
      reportProgress();
    };

    // Process queue with concurrency limit
    while (queue.length > 0 || executing.length > 0) {
      // Check if we should stop on error
      if (!continueOnError && failed > 0) {
        break;
      }

      // Fill up to concurrency limit
      while (queue.length > 0 && executing.length < concurrency) {
        const profileId = queue.shift()!;

        // Stagger delay between launches
        if (executing.length > 0 && staggerDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, staggerDelay));
        }

        const promise = launchOne(profileId).then(() => {
          // Remove from executing when done
          const index = executing.indexOf(promise);
          if (index > -1) {
            executing.splice(index, 1);
          }
        });

        executing.push(promise);
      }

      // Wait for at least one to complete if at capacity
      if (executing.length >= concurrency && executing.length > 0) {
        await Promise.race(executing);
      }
    }

    // Wait for any remaining
    await Promise.all(executing);

    return {
      results,
      allSuccessful: failed === 0,
      successCount: successful,
      failedCount: failed,
      totalTimeMs: Date.now() - startTime,
      failures,
    };
  }

  /**
   * Stop all launched profiles
   */
  async stopAllProfiles(): Promise<void> {
    const profileIds = Array.from(this.launchedProfiles.keys());
    await Promise.all(profileIds.map((id) => this.stopProfile(id)));
  }

  /**
   * List available tools for a profile
   */
  async listProfileTools(profileId: string): Promise<unknown[]> {
    return this.mcpManager.listTools(profileId);
  }

  /**
   * Start health check timer
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      // Check browser processes
      for (const profileId of this.launchedProfiles.keys()) {
        if (!isBrowserRunning(profileId)) {
          // Browser died, clean up
          const entry = this.launchedProfiles.get(profileId);
          if (entry?.mcpPort) {
            this.releasePort(entry.mcpPort);
          }
          this.launchedProfiles.delete(profileId);
          await this.mcpManager.disconnect(profileId);

          this.emit({
            type: 'profile_error',
            profileId,
            error: 'Browser process exited unexpectedly',
          });
        }
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Get orchestrator statistics
   */
  getStats(): {
    launchedProfiles: number;
    connectedProfiles: number;
    allocatedPorts: number[];
    mcpStats: ReturnType<ProfileMcpConnectionManager['getStats']>;
  } {
    const mcpActiveConnections = this.mcpManager.getActiveConnections();

    return {
      launchedProfiles: this.launchedProfiles.size,
      connectedProfiles: mcpActiveConnections.size,
      allocatedPorts: Array.from(this.allocatedPorts),
      mcpStats: this.mcpManager.getStats(),
    };
  }

  /**
   * Shutdown orchestrator
   */
  async shutdown(): Promise<void> {
    // Stop health check
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    // Stop all profiles
    await this.stopAllProfiles();

    // Shutdown MCP manager
    await this.mcpManager.shutdown();

    // Clear event listeners
    this.eventListeners.clear();

    // Clear state
    this.allocatedPorts.clear();
    this.launchedProfiles.clear();
  }
}

/**
 * Create and configure an orchestrator for Amazon store management
 */
export function createAmazonStoreOrchestrator(
  options?: Partial<OrchestratorConfig>
): ProfileAgentOrchestrator {
  return new ProfileAgentOrchestrator({
    healthCheckInterval: 30000,
    autoReconnect: true,
    maxReconnectAttempts: 3,
    portConfig: {
      basePort: 9100,
      maxPort: 9199,
      strategy: 'sequential',
    },
    ...options,
  });
}

/**
 * Get all Amazon profiles from storage
 */
export function getAmazonProfiles(): BrowserProfileConfig[] {
  return listProfiles().filter((p) => p.platform === 'amazon');
}

/**
 * Example usage:
 *
 * ```typescript
 * const orchestrator = createAmazonStoreOrchestrator();
 *
 * // Get Amazon profiles
 * const profiles = getAmazonProfiles();
 *
 * // Launch all profiles
 * const launchResults = await orchestrator.launchMultipleProfiles(
 *   profiles.map(p => p.id),
 *   { waitForMcp: true }
 * );
 *
 * // Execute parallel tasks
 * const tasks = profiles.map(p => ({
 *   profileId: p.id,
 *   prompt: 'Check today\'s orders'
 * }));
 *
 * const results = await orchestrator.executeParallel(tasks);
 *
 * // Cleanup
 * await orchestrator.shutdown();
 * ```
 */
