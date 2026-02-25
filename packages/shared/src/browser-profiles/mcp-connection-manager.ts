/**
 * MCP Connection Manager
 *
 * Manages MCP connections for multiple browser profiles.
 * Each profile can have its own MCP server (from BrowserOS),
 * and this manager tracks all connections and their states.
 */

import { CraftMcpClient, type HttpMcpClientConfig } from '../mcp/client.ts';
import type {
  BrowserProfileConfig,
  ProfileMcpState,
  ProfileMcpConfig,
  McpConnectionStatus,
} from './types.ts';
import {
  discoverMcpPort,
  waitForMcpServer,
  DEFAULT_MCP_PORT_RANGE,
} from './mcp-port-discovery.ts';

/**
 * Connection manager configuration
 */
export interface ConnectionManagerConfig {
  /** Default host for MCP connections */
  defaultHost?: string;

  /** Default port range for discovery */
  defaultPortRange?: {
    min: number;
    max: number;
  };

  /** Health check interval in ms (0 to disable) */
  healthCheckInterval?: number;

  /** Connection timeout in ms */
  connectionTimeout?: number;

  /** Auto-reconnect on connection loss */
  autoReconnect?: boolean;

  /** Max reconnection attempts */
  maxReconnectAttempts?: number;
}

/**
 * Connection entry with client and metadata
 */
interface ConnectionEntry {
  /** MCP client instance */
  client: CraftMcpClient;

  /** Current state */
  state: ProfileMcpState;

  /** Profile configuration */
  profile: BrowserProfileConfig;

  /** Reconnection attempt count */
  reconnectAttempts: number;

  /** Health check timer */
  healthCheckTimer?: NodeJS.Timeout;
}

/**
 * Connection event types
 */
export type ConnectionEvent =
  | { type: 'connected'; profileId: string; port: number }
  | { type: 'disconnected'; profileId: string; reason?: string }
  | { type: 'error'; profileId: string; error: string }
  | { type: 'reconnecting'; profileId: string; attempt: number }
  | { type: 'health_check'; profileId: string; healthy: boolean };

/**
 * Event listener type
 */
export type ConnectionEventListener = (event: ConnectionEvent) => void;

/**
 * Profile MCP Connection Manager
 *
 * Manages connections to multiple BrowserOS MCP servers,
 * one for each browser profile.
 */
export class ProfileMcpConnectionManager {
  private connections: Map<string, ConnectionEntry> = new Map();
  private config: Required<ConnectionManagerConfig>;
  private eventListeners: Set<ConnectionEventListener> = new Set();
  private globalHealthCheckTimer?: NodeJS.Timeout;

  constructor(config: ConnectionManagerConfig = {}) {
    this.config = {
      defaultHost: config.defaultHost || '127.0.0.1',
      defaultPortRange: config.defaultPortRange || DEFAULT_MCP_PORT_RANGE,
      healthCheckInterval: config.healthCheckInterval ?? 30000,
      connectionTimeout: config.connectionTimeout ?? 30000,
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 3,
    };

    // Start global health check if enabled
    if (this.config.healthCheckInterval > 0) {
      this.startGlobalHealthCheck();
    }
  }

  /**
   * Add event listener
   */
  addEventListener(listener: ConnectionEventListener): void {
    this.eventListeners.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: ConnectionEventListener): void {
    this.eventListeners.delete(listener);
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: ConnectionEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[MCP Manager] Event listener error:', err);
      }
    }
  }

  /**
   * Build MCP URL from configuration
   */
  private buildMcpUrl(mcpConfig: ProfileMcpConfig, port?: number): string {
    if (mcpConfig.url) {
      return mcpConfig.url;
    }

    const host = mcpConfig.host || this.config.defaultHost;
    const mcpPort = port || mcpConfig.port;

    if (!mcpPort) {
      throw new Error('MCP port is required');
    }

    return `http://${host}:${mcpPort}`;
  }

  /**
   * Create initial state for a profile
   */
  private createInitialState(profileId: string): ProfileMcpState {
    return {
      status: 'disconnected',
      profileId,
    };
  }

  /**
   * Update connection state
   */
  private updateState(
    profileId: string,
    updates: Partial<ProfileMcpState>
  ): void {
    const entry = this.connections.get(profileId);
    if (entry) {
      entry.state = { ...entry.state, ...updates };
    }
  }

  /**
   * Connect to a profile's MCP server
   *
   * @param profile - Browser profile configuration
   * @param options - Connection options
   * @returns true if connection successful
   */
  async connect(
    profile: BrowserProfileConfig,
    options?: {
      /** Specific port to use (overrides discovery) */
      port?: number;
      /** Wait for MCP server to start */
      waitForServer?: boolean;
      /** Timeout for connection */
      timeout?: number;
    }
  ): Promise<boolean> {
    const profileId = profile.id;
    const timeout = options?.timeout || this.config.connectionTimeout;

    // Check if already connected
    const existing = this.connections.get(profileId);
    if (existing?.state.status === 'connected') {
      return true;
    }

    // Update state to connecting
    const mcpConfig: ProfileMcpConfig = profile.mcp || {
      transport: 'http',
      autoDiscover: true,
      portRange: this.config.defaultPortRange,
    };

    let state = existing?.state || this.createInitialState(profileId);
    state.status = 'connecting';

    // Discover or use provided port
    let port = options?.port || mcpConfig.port;

    if (!port) {
      // Try to discover port
      const discovery = await discoverMcpPort(profile.userDataDir, mcpConfig);

      if (discovery.success && discovery.port) {
        port = discovery.port;
      } else if (options?.waitForServer) {
        // Wait for server to appear
        const defaultPort = mcpConfig.portRange?.min || this.config.defaultPortRange.min;
        const serverReady = await waitForMcpServer(
          defaultPort,
          mcpConfig.host || this.config.defaultHost,
          timeout
        );

        if (serverReady) {
          port = defaultPort;
        }
      }
    }

    if (!port) {
      const error = 'Could not discover MCP port';
      state.status = 'error';
      state.error = error;

      this.emit({ type: 'error', profileId, error });
      return false;
    }

    // Wait for server if requested
    if (options?.waitForServer) {
      const serverReady = await waitForMcpServer(
        port,
        mcpConfig.host || this.config.defaultHost,
        timeout
      );

      if (!serverReady) {
        const error = `MCP server not responding on port ${port}`;
        state.status = 'error';
        state.error = error;

        this.emit({ type: 'error', profileId, error });
        return false;
      }
    }

    // Create MCP client
    try {
      const url = this.buildMcpUrl(mcpConfig, port);
      const clientConfig: HttpMcpClientConfig = {
        transport: 'http',
        url,
      };

      const client = new CraftMcpClient(clientConfig);
      await client.connect();

      // Update state
      state = {
        status: 'connected',
        port,
        lastConnectedAt: Date.now(),
        profileId,
      };

      // Store connection
      this.connections.set(profileId, {
        client,
        state,
        profile,
        reconnectAttempts: 0,
      });

      this.emit({ type: 'connected', profileId, port });
      return true;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Connection failed';
      state.status = 'error';
      state.error = error;

      // Store failed state
      if (existing) {
        existing.state = state;
      }

      this.emit({ type: 'error', profileId, error });
      return false;
    }
  }

  /**
   * Get MCP client for a profile
   */
  getClient(profileId: string): CraftMcpClient | null {
    const entry = this.connections.get(profileId);
    if (entry?.state.status === 'connected') {
      return entry.client;
    }
    return null;
  }

  /**
   * Get connection state for a profile
   */
  getState(profileId: string): ProfileMcpState | undefined {
    return this.connections.get(profileId)?.state;
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): Map<string, ProfileMcpState> {
    const active = new Map<string, ProfileMcpState>();

    for (const [profileId, entry] of this.connections) {
      if (entry.state.status === 'connected') {
        active.set(profileId, entry.state);
      }
    }

    return active;
  }

  /**
   * Get all connection states
   */
  getAllStates(): Map<string, ProfileMcpState> {
    const states = new Map<string, ProfileMcpState>();

    for (const [profileId, entry] of this.connections) {
      states.set(profileId, entry.state);
    }

    return states;
  }

  /**
   * Perform health check on a connection
   */
  async healthCheck(profileId: string): Promise<boolean> {
    const entry = this.connections.get(profileId);
    if (!entry || entry.state.status !== 'connected') {
      return false;
    }

    try {
      // Try to list tools as a health check
      await entry.client.listTools();

      entry.state.lastHealthCheckAt = Date.now();
      this.emit({ type: 'health_check', profileId, healthy: true });
      return true;
    } catch (err) {
      // Connection is unhealthy
      const error = err instanceof Error ? err.message : 'Health check failed';
      entry.state.status = 'error';
      entry.state.error = error;

      this.emit({ type: 'health_check', profileId, healthy: false });
      this.emit({ type: 'error', profileId, error });

      // Attempt reconnection if enabled
      if (this.config.autoReconnect) {
        this.attemptReconnect(profileId);
      }

      return false;
    }
  }

  /**
   * Attempt to reconnect to a profile's MCP server
   */
  private async attemptReconnect(profileId: string): Promise<void> {
    const entry = this.connections.get(profileId);
    if (!entry) return;

    if (entry.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.log(
        `[MCP Manager] Max reconnection attempts reached for ${profileId}`
      );
      return;
    }

    entry.reconnectAttempts++;
    this.emit({
      type: 'reconnecting',
      profileId,
      attempt: entry.reconnectAttempts,
    });

    // Close existing client
    try {
      await entry.client.close();
    } catch {
      // Ignore close errors
    }

    // Wait before reconnecting (exponential backoff)
    const delay = Math.min(1000 * Math.pow(2, entry.reconnectAttempts - 1), 30000);
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Attempt reconnection
    const success = await this.connect(entry.profile, {
      port: entry.state.port,
      waitForServer: true,
    });

    if (success) {
      // Reset reconnect attempts on success
      const newEntry = this.connections.get(profileId);
      if (newEntry) {
        newEntry.reconnectAttempts = 0;
      }
    }
  }

  /**
   * Disconnect from a profile's MCP server
   */
  async disconnect(profileId: string): Promise<void> {
    const entry = this.connections.get(profileId);
    if (!entry) return;

    // Clear health check timer
    if (entry.healthCheckTimer) {
      clearInterval(entry.healthCheckTimer);
    }

    // Close client
    try {
      await entry.client.close();
    } catch {
      // Ignore close errors
    }

    // Update state
    entry.state.status = 'disconnected';

    // Remove from map
    this.connections.delete(profileId);

    this.emit({ type: 'disconnected', profileId });
  }

  /**
   * Start global health check for all connections
   */
  private startGlobalHealthCheck(): void {
    if (this.globalHealthCheckTimer) {
      clearInterval(this.globalHealthCheckTimer);
    }

    this.globalHealthCheckTimer = setInterval(async () => {
      for (const [profileId] of this.connections) {
        await this.healthCheck(profileId);
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Shutdown manager and close all connections
   */
  async shutdown(): Promise<void> {
    // Stop global health check
    if (this.globalHealthCheckTimer) {
      clearInterval(this.globalHealthCheckTimer);
      this.globalHealthCheckTimer = undefined;
    }

    // Disconnect all
    const profileIds = Array.from(this.connections.keys());
    await Promise.all(profileIds.map((id) => this.disconnect(id)));

    // Clear listeners
    this.eventListeners.clear();
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    total: number;
    connected: number;
    connecting: number;
    disconnected: number;
    error: number;
  } {
    const stats = {
      total: this.connections.size,
      connected: 0,
      connecting: 0,
      disconnected: 0,
      error: 0,
    };

    for (const [, entry] of this.connections) {
      switch (entry.state.status) {
        case 'connected':
          stats.connected++;
          break;
        case 'connecting':
          stats.connecting++;
          break;
        case 'disconnected':
          stats.disconnected++;
          break;
        case 'error':
          stats.error++;
          break;
      }
    }

    return stats;
  }

  /**
   * Call a tool on a specific profile's MCP server
   */
  async callTool(
    profileId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const client = this.getClient(profileId);
    if (!client) {
      throw new Error(`No active MCP connection for profile ${profileId}`);
    }

    return client.callTool(toolName, args);
  }

  /**
   * List tools available on a profile's MCP server
   */
  async listTools(profileId: string): Promise<unknown[]> {
    const client = this.getClient(profileId);
    if (!client) {
      throw new Error(`No active MCP connection for profile ${profileId}`);
    }

    return client.listTools();
  }
}

/**
 * Create a singleton connection manager
 */
let defaultManager: ProfileMcpConnectionManager | null = null;

export function getDefaultConnectionManager(): ProfileMcpConnectionManager {
  if (!defaultManager) {
    defaultManager = new ProfileMcpConnectionManager();
  }
  return defaultManager;
}

export function resetDefaultConnectionManager(): void {
  if (defaultManager) {
    defaultManager.shutdown();
    defaultManager = null;
  }
}
