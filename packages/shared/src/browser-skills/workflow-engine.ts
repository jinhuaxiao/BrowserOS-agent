/**
 * Workflow Engine
 *
 * Executes browser workflows by traversing the node graph and
 * coordinating skill execution, parallel processing, conditions,
 * loops, and cluster execution across profiles.
 *
 * Key features:
 * - Graph-based workflow execution
 * - Parallel node execution with configurable concurrency
 * - Conditional branching based on expressions
 * - Loop support (count, while, for_each)
 * - Cluster execution across multiple profiles
 * - Error handling with retries and fallbacks
 */

import type {
  BrowserWorkflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowExecutionContext,
  WorkflowExecutionResult,
  NodeExecutionResult,
  ClusterExecutionResult,
  WorkflowEvent,
  WorkflowEventListener,
  SkillCallConfig,
  ParallelConfig,
  ConditionConfig,
  LoopNodeConfig,
  ClusterConfig,
  HandoffConfig,
  TransformConfig,
  WaitNodeConfig,
  WorkflowCallConfig,
} from './workflow-types.ts';
import type { ExecutionResult, DynamicValue, ExecutionContext } from './types.ts';
import {
  getWorkflow,
  recordWorkflowExecution,
} from './workflow-storage.ts';
import {
  HybridExecutor,
  createExecutor,
  type McpClientInterface,
} from './hybrid-executor.ts';
import { getSkill } from './skill-storage.ts';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for workflow engine
 */
export interface WorkflowEngineConfig {
  /** Default timeout for node execution in ms */
  defaultTimeout?: number;

  /** Maximum execution depth for nested workflows */
  maxExecutionDepth?: number;

  /** Maximum loop iterations */
  maxLoopIterations?: number;

  /** Default retry count */
  defaultRetries?: number;

  /** Default retry delay in ms */
  defaultRetryDelay?: number;

  /** Whether to enable parallel execution */
  enableParallelExecution?: boolean;

  /** Maximum concurrent nodes in parallel execution */
  maxConcurrentNodes?: number;
}

const DEFAULT_CONFIG: Required<WorkflowEngineConfig> = {
  defaultTimeout: 30000,
  maxExecutionDepth: 10,
  maxLoopIterations: 100,
  defaultRetries: 2,
  defaultRetryDelay: 1000,
  enableParallelExecution: true,
  maxConcurrentNodes: 5,
};

// ============================================================================
// Event System
// ============================================================================

const eventListeners = new Set<WorkflowEventListener>();

/**
 * Add workflow event listener
 */
export function addWorkflowEngineEventListener(listener: WorkflowEventListener): void {
  eventListeners.add(listener);
}

/**
 * Remove workflow event listener
 */
export function removeWorkflowEngineEventListener(listener: WorkflowEventListener): void {
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
      console.error('[WorkflowEngine] Event listener error:', err);
    }
  }
}

// ============================================================================
// MCP Client Provider
// ============================================================================

/**
 * Provides MCP clients for different profiles
 */
export interface McpClientProvider {
  /** Get MCP client for a profile */
  getClient(profileId: string): Promise<McpClientInterface | null>;

  /** Get default MCP client (no specific profile) */
  getDefaultClient(): Promise<McpClientInterface | null>;
}

// ============================================================================
// Workflow Engine Class
// ============================================================================

/**
 * Workflow execution engine
 *
 * Coordinates the execution of workflow nodes and manages
 * the execution context throughout the workflow lifecycle.
 */
export class WorkflowEngine {
  private config: Required<WorkflowEngineConfig>;
  private skillExecutor: HybridExecutor;
  private mcpProvider: McpClientProvider | null = null;

  constructor(config: WorkflowEngineConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.skillExecutor = createExecutor({
      defaultTimeout: this.config.defaultTimeout,
      maxRetries: this.config.defaultRetries,
      retryDelay: this.config.defaultRetryDelay,
    });
  }

  /**
   * Set the MCP client provider
   */
  setMcpProvider(provider: McpClientProvider): void {
    this.mcpProvider = provider;
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowOrId: BrowserWorkflow | string,
    options?: {
      parameters?: Record<string, unknown>;
      profileId?: string;
      mcpClient?: McpClientInterface;
      parentExecutionId?: string;
      depth?: number;
    }
  ): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    const executionId = this.generateExecutionId();

    // Get workflow
    const workflow =
      typeof workflowOrId === 'string'
        ? getWorkflow(workflowOrId)
        : workflowOrId;

    if (!workflow) {
      return {
        success: false,
        executionId,
        nodeResults: {},
        durationMs: Date.now() - startTime,
        error: `Workflow not found: ${workflowOrId}`,
      };
    }

    // Check execution depth
    const depth = options?.depth || 0;
    if (depth >= this.config.maxExecutionDepth) {
      return {
        success: false,
        executionId,
        nodeResults: {},
        durationMs: Date.now() - startTime,
        error: `Maximum execution depth exceeded: ${depth}`,
      };
    }

    // Create execution context
    const context: WorkflowExecutionContext = {
      workflowId: workflow.id,
      executionId,
      parameters: options?.parameters || {},
      variables: {},
      profileId: options?.profileId,
      startedAt: startTime,
      parentExecutionId: options?.parentExecutionId,
      depth,
      maxDepth: this.config.maxExecutionDepth,
    };

    emit({
      type: 'execution_started',
      workflowId: workflow.id,
      executionId,
    });

    const nodeResults: Record<string, NodeExecutionResult> = {};

    try {
      // Get MCP client
      let mcpClient: McpClientInterface | undefined = options?.mcpClient;
      if (!mcpClient && this.mcpProvider) {
        const providedClient = options?.profileId
          ? await this.mcpProvider.getClient(options.profileId)
          : await this.mcpProvider.getDefaultClient();
        mcpClient = providedClient ?? undefined;
      }

      if (!mcpClient) {
        throw new Error('No MCP client available');
      }

      // Find start node
      const startNode = workflow.nodes.find((n) => n.type === 'start');
      if (!startNode) {
        throw new Error('Workflow missing start node');
      }

      // Execute workflow graph starting from start node
      await this.executeNode(
        startNode,
        workflow,
        context,
        nodeResults,
        mcpClient
      );

      // Collect outputs
      const outputs = this.collectOutputs(workflow, context);

      // Record successful execution
      recordWorkflowExecution(workflow.id, true, Date.now() - startTime, {
        parameters: options?.parameters,
        nodeSummary: this.summarizeNodeResults(nodeResults),
      });

      const result: WorkflowExecutionResult = {
        success: true,
        executionId,
        nodeResults,
        outputs,
        durationMs: Date.now() - startTime,
      };

      emit({
        type: 'execution_completed',
        workflowId: workflow.id,
        executionId,
        result,
      });

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';

      // Record failed execution
      recordWorkflowExecution(workflow.id, false, Date.now() - startTime, {
        error,
        parameters: options?.parameters,
        nodeSummary: this.summarizeNodeResults(nodeResults),
      });

      emit({
        type: 'execution_failed',
        workflowId: workflow.id,
        executionId,
        error,
      });

      return {
        success: false,
        executionId,
        nodeResults,
        durationMs: Date.now() - startTime,
        error,
        failedNodeId: this.findFailedNode(nodeResults),
      };
    }
  }

  /**
   * Execute a single workflow node
   */
  private async executeNode(
    node: WorkflowNode,
    workflow: BrowserWorkflow,
    context: WorkflowExecutionContext,
    results: Record<string, NodeExecutionResult>,
    mcpClient: McpClientInterface
  ): Promise<void> {
    const startTime = Date.now();

    emit({
      type: 'node_started',
      workflowId: workflow.id,
      executionId: context.executionId,
      nodeId: node.id,
    });

    let nodeResult: NodeExecutionResult;

    try {
      // Execute based on node type
      switch (node.type) {
        case 'start':
          nodeResult = await this.executeStartNode(node, context);
          break;

        case 'end':
          nodeResult = await this.executeEndNode(node, context);
          break;

        case 'skill_call':
          nodeResult = await this.executeSkillCallNode(node, context, mcpClient);
          break;

        case 'condition':
          nodeResult = await this.executeConditionNode(
            node,
            workflow,
            context,
            results,
            mcpClient
          );
          break;

        case 'parallel':
          nodeResult = await this.executeParallelNode(
            node,
            workflow,
            context,
            results,
            mcpClient
          );
          break;

        case 'loop':
          nodeResult = await this.executeLoopNode(
            node,
            workflow,
            context,
            results,
            mcpClient
          );
          break;

        case 'cluster':
          nodeResult = await this.executeClusterNode(node, context);
          break;

        case 'handoff':
          nodeResult = await this.executeHandoffNode(node, context);
          break;

        case 'transform':
          nodeResult = await this.executeTransformNode(node, context);
          break;

        case 'wait':
          nodeResult = await this.executeWaitNode(node, context);
          break;

        case 'workflow_call':
          nodeResult = await this.executeWorkflowCallNode(node, context, mcpClient);
          break;

        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Node execution failed';

      // Handle retries
      if (node.retries && node.retries > 0) {
        for (let i = 0; i < node.retries; i++) {
          await this.sleep(node.retryDelay || this.config.defaultRetryDelay);
          try {
            // Re-execute node (simplified retry logic)
            nodeResult = await this.executeSkillCallNode(node, context, mcpClient);
            if (nodeResult.success) break;
          } catch {
            continue;
          }
        }
      }

      // If still failed, use error result
      nodeResult = nodeResult! || {
        nodeId: node.id,
        success: false,
        error,
        durationMs: Date.now() - startTime,
      };
    }

    nodeResult.durationMs = Date.now() - startTime;
    results[node.id] = nodeResult;

    emit({
      type: 'node_completed',
      workflowId: workflow.id,
      executionId: context.executionId,
      nodeId: node.id,
      result: nodeResult,
    });

    // Handle node failure
    if (!nodeResult.success && !node.optional) {
      if (node.onError?.strategy === 'skip') {
        // Continue to next node
      } else if (node.onError?.strategy === 'fallback' && node.onError.fallbackStepId) {
        // Jump to fallback node
        const fallbackNode = workflow.nodes.find((n) => n.id === node.onError!.fallbackStepId);
        if (fallbackNode) {
          await this.executeNode(fallbackNode, workflow, context, results, mcpClient);
          return;
        }
      } else {
        throw new Error(`Node ${node.id} failed: ${nodeResult.error}`);
      }
    }

    // Find and execute next nodes (unless we're at an end node or condition handled routing)
    if (node.type !== 'end' && node.type !== 'condition') {
      const nextEdges = workflow.edges.filter((e) => e.sourceNodeId === node.id);

      for (const edge of nextEdges) {
        // Check edge condition if present
        if (edge.condition && !this.evaluateExpression(edge.condition, context)) {
          continue;
        }

        const nextNode = workflow.nodes.find((n) => n.id === edge.targetNodeId);
        if (nextNode) {
          // Apply data mapping from edge
          if (edge.dataMapping) {
            for (const [target, source] of Object.entries(edge.dataMapping)) {
              context.variables[target] = this.resolveValue(source, context);
            }
          }

          await this.executeNode(nextNode, workflow, context, results, mcpClient);
        }
      }
    }
  }

  // ==========================================================================
  // Node Type Executors
  // ==========================================================================

  /**
   * Execute start node
   */
  private async executeStartNode(
    node: WorkflowNode,
    context: WorkflowExecutionContext
  ): Promise<NodeExecutionResult> {
    return {
      nodeId: node.id,
      success: true,
      durationMs: 0,
    };
  }

  /**
   * Execute end node
   */
  private async executeEndNode(
    node: WorkflowNode,
    context: WorkflowExecutionContext
  ): Promise<NodeExecutionResult> {
    return {
      nodeId: node.id,
      success: true,
      durationMs: 0,
    };
  }

  /**
   * Execute skill call node
   */
  private async executeSkillCallNode(
    node: WorkflowNode,
    context: WorkflowExecutionContext,
    mcpClient: McpClientInterface
  ): Promise<NodeExecutionResult> {
    const config = node.skillCall;
    if (!config) {
      throw new Error('Skill call node missing configuration');
    }

    // Get skill
    const skill = getSkill(config.skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${config.skillId}`);
    }

    // Map parameters
    const parameters = this.mapParameters(
      config.parameterMapping || {},
      context
    );

    // Execute skill
    const result = await this.skillExecutor.execute(skill.name, mcpClient, {
      parameters,
      profileId: context.profileId,
    });

    // Store output variable if specified
    if (config.outputVariable && result.data) {
      context.variables[config.outputVariable] = result.data;
    }

    return {
      nodeId: node.id,
      success: result.success,
      data: result.data,
      error: result.error,
      durationMs: result.durationMs,
    };
  }

  /**
   * Execute condition node
   */
  private async executeConditionNode(
    node: WorkflowNode,
    workflow: BrowserWorkflow,
    context: WorkflowExecutionContext,
    results: Record<string, NodeExecutionResult>,
    mcpClient: McpClientInterface
  ): Promise<NodeExecutionResult> {
    const config = node.condition;
    if (!config) {
      throw new Error('Condition node missing configuration');
    }

    // Evaluate branches in order
    let selectedBranch: string | undefined;
    for (const branch of config.branches) {
      if (this.evaluateExpression(branch.condition, context)) {
        selectedBranch = branch.targetNodeId;
        break;
      }
    }

    // Use default branch if no condition matched
    if (!selectedBranch) {
      selectedBranch = config.defaultBranch;
    }

    // Execute selected branch
    if (selectedBranch) {
      const targetNode = workflow.nodes.find((n) => n.id === selectedBranch);
      if (targetNode) {
        await this.executeNode(targetNode, workflow, context, results, mcpClient);
      }
    }

    return {
      nodeId: node.id,
      success: true,
      data: { selectedBranch },
      durationMs: 0,
    };
  }

  /**
   * Execute parallel node
   */
  private async executeParallelNode(
    node: WorkflowNode,
    workflow: BrowserWorkflow,
    context: WorkflowExecutionContext,
    results: Record<string, NodeExecutionResult>,
    mcpClient: McpClientInterface
  ): Promise<NodeExecutionResult> {
    const config = node.parallel;
    if (!config) {
      throw new Error('Parallel node missing configuration');
    }

    const childResults: NodeExecutionResult[] = [];
    const maxConcurrency = config.maxConcurrency || this.config.maxConcurrentNodes;

    // Execute nodes with concurrency control
    const queue = [...config.nodeIds];
    const running: Promise<void>[] = [];

    while (queue.length > 0 || running.length > 0) {
      // Fill up to max concurrency
      while (running.length < maxConcurrency && queue.length > 0) {
        const nodeId = queue.shift()!;
        const targetNode = workflow.nodes.find((n) => n.id === nodeId);

        if (targetNode) {
          const promise = this.executeNode(
            targetNode,
            workflow,
            context,
            results,
            mcpClient
          )
            .then(() => {
              if (results[nodeId]) {
                childResults.push(results[nodeId]);

                // Check fail-fast
                if (config.failFast && !results[nodeId].success) {
                  queue.length = 0; // Clear remaining
                }
              }
            })
            .catch((err) => {
              childResults.push({
                nodeId,
                success: false,
                error: err instanceof Error ? err.message : 'Unknown error',
                durationMs: 0,
              });
              if (config.failFast) {
                queue.length = 0;
              }
            });

          running.push(promise);
        }
      }

      // Wait for one to complete
      if (running.length > 0) {
        await Promise.race(running);
        // Remove completed promises (simplified - in production use better tracking)
        running.length = 0;
      }
    }

    // Wait for all if configured
    if (config.waitAll !== false) {
      // Already waited above
    }

    const allSuccess = childResults.every((r) => r.success);

    return {
      nodeId: node.id,
      success: allSuccess,
      childResults,
      durationMs: childResults.reduce((sum, r) => sum + r.durationMs, 0),
    };
  }

  /**
   * Execute loop node
   */
  private async executeLoopNode(
    node: WorkflowNode,
    workflow: BrowserWorkflow,
    context: WorkflowExecutionContext,
    results: Record<string, NodeExecutionResult>,
    mcpClient: McpClientInterface
  ): Promise<NodeExecutionResult> {
    const config = node.loop;
    if (!config) {
      throw new Error('Loop node missing configuration');
    }

    const childResults: NodeExecutionResult[] = [];
    const maxIterations = config.maxIterations || this.config.maxLoopIterations;
    let iteration = 0;

    // Execute loop based on type
    switch (config.type) {
      case 'count': {
        const count = config.count || 1;
        for (let i = 0; i < count && iteration < maxIterations; i++) {
          if (config.indexVariable) {
            context.variables[config.indexVariable] = i;
          }
          await this.executeLoopBody(
            config.bodyNodeIds,
            workflow,
            context,
            results,
            childResults,
            mcpClient
          );
          iteration++;
        }
        break;
      }

      case 'while': {
        while (
          iteration < maxIterations &&
          config.condition &&
          this.evaluateExpression(config.condition, context)
        ) {
          if (config.indexVariable) {
            context.variables[config.indexVariable] = iteration;
          }
          await this.executeLoopBody(
            config.bodyNodeIds,
            workflow,
            context,
            results,
            childResults,
            mcpClient
          );
          iteration++;
        }
        break;
      }

      case 'for_each': {
        const items = config.itemsVariable
          ? (context.variables[config.itemsVariable] as unknown[])
          : [];

        for (let i = 0; i < items.length && iteration < maxIterations; i++) {
          if (config.loopVariable) {
            context.variables[config.loopVariable] = items[i];
          }
          if (config.indexVariable) {
            context.variables[config.indexVariable] = i;
          }
          await this.executeLoopBody(
            config.bodyNodeIds,
            workflow,
            context,
            results,
            childResults,
            mcpClient
          );
          iteration++;
        }
        break;
      }
    }

    const allSuccess = childResults.every((r) => r.success);

    return {
      nodeId: node.id,
      success: allSuccess,
      data: { iterations: iteration },
      childResults,
      durationMs: childResults.reduce((sum, r) => sum + r.durationMs, 0),
    };
  }

  /**
   * Execute loop body nodes
   */
  private async executeLoopBody(
    bodyNodeIds: string[],
    workflow: BrowserWorkflow,
    context: WorkflowExecutionContext,
    results: Record<string, NodeExecutionResult>,
    childResults: NodeExecutionResult[],
    mcpClient: McpClientInterface
  ): Promise<void> {
    for (const nodeId of bodyNodeIds) {
      const targetNode = workflow.nodes.find((n) => n.id === nodeId);
      if (targetNode) {
        await this.executeNode(targetNode, workflow, context, results, mcpClient);
        if (results[nodeId]) {
          childResults.push(results[nodeId]);
        }
      }
    }
  }

  /**
   * Execute cluster node
   */
  private async executeClusterNode(
    node: WorkflowNode,
    context: WorkflowExecutionContext
  ): Promise<NodeExecutionResult> {
    const config = node.cluster;
    if (!config) {
      throw new Error('Cluster node missing configuration');
    }

    if (!this.mcpProvider) {
      throw new Error('MCP provider not available for cluster execution');
    }

    // Execute skill on each profile
    const profileResults: Record<string, ExecutionResult> = {};
    const maxConcurrency = config.maxConcurrency || this.config.maxConcurrentNodes;

    const queue = [...config.profileIds];
    const running: Promise<void>[] = [];

    while (queue.length > 0 || running.length > 0) {
      // Fill up to max concurrency
      while (running.length < maxConcurrency && queue.length > 0) {
        const profileId = queue.shift()!;

        const promise = (async () => {
          try {
            const mcpClient = await this.mcpProvider!.getClient(profileId);
            if (!mcpClient) {
              profileResults[profileId] = {
                success: false,
                error: 'No MCP client for profile',
                durationMs: 0,
              };
              return;
            }

            // Get skill
            const skill = getSkill(config.skillId);
            if (!skill) {
              profileResults[profileId] = {
                success: false,
                error: `Skill not found: ${config.skillId}`,
                durationMs: 0,
              };
              return;
            }

            // Map parameters with profile-specific overrides
            let parameters = this.mapParameters(
              config.parameterMapping || {},
              context
            );
            if (config.profileOverrides?.[profileId]) {
              parameters = { ...parameters, ...config.profileOverrides[profileId] };
            }

            const result = await this.skillExecutor.execute(skill.name, mcpClient, {
              parameters,
              profileId,
            });

            profileResults[profileId] = result;

            emit({
              type: 'cluster_profile_completed',
              workflowId: context.workflowId,
              executionId: context.executionId,
              profileId,
              success: result.success,
            });
          } catch (err) {
            profileResults[profileId] = {
              success: false,
              error: err instanceof Error ? err.message : 'Unknown error',
              durationMs: 0,
            };
          }
        })();

        running.push(promise);
      }

      // Wait for one to complete
      if (running.length > 0) {
        await Promise.race(running);
        running.length = 0;
      }
    }

    // Aggregate results
    const successCount = Object.values(profileResults).filter((r) => r.success).length;
    const aggregatedResult = this.aggregateClusterResults(profileResults, config.aggregation);

    const success = config.continueOnPartialFailure
      ? successCount > 0
      : successCount === config.profileIds.length;

    return {
      nodeId: node.id,
      success,
      data: {
        profileResults,
        aggregatedResult,
        successCount,
        totalProfiles: config.profileIds.length,
      },
      durationMs: Math.max(...Object.values(profileResults).map((r) => r.durationMs)),
    };
  }

  /**
   * Execute handoff node
   */
  private async executeHandoffNode(
    node: WorkflowNode,
    context: WorkflowExecutionContext
  ): Promise<NodeExecutionResult> {
    const config = node.handoff;
    if (!config) {
      throw new Error('Handoff node missing configuration');
    }

    // In a full implementation, this would trigger an agent handoff
    // For now, we emit an event and return
    emit({
      type: 'node_completed',
      workflowId: context.workflowId,
      executionId: context.executionId,
      nodeId: node.id,
      result: {
        nodeId: node.id,
        success: true,
        data: {
          handoffType: config.targetAgentType,
          context: config.context,
        },
        durationMs: 0,
      },
    });

    return {
      nodeId: node.id,
      success: true,
      data: { handoffInitiated: true, targetAgent: config.targetAgentType },
      durationMs: 0,
    };
  }

  /**
   * Execute transform node
   */
  private async executeTransformNode(
    node: WorkflowNode,
    context: WorkflowExecutionContext
  ): Promise<NodeExecutionResult> {
    const config = node.transform;
    if (!config) {
      throw new Error('Transform node missing configuration');
    }

    try {
      // Get input values
      const inputs = config.inputs.map((input) => this.resolveValue(input, context));

      // Apply transformation (simplified - in production, use safe expression evaluator)
      let result: unknown;
      switch (config.transformType) {
        case 'map':
          result = (inputs[0] as unknown[]).map((item) =>
            this.evaluateExpressionWithItem(config.expression, context, item)
          );
          break;

        case 'filter':
          result = (inputs[0] as unknown[]).filter((item) =>
            this.evaluateExpressionWithItem(config.expression, context, item)
          );
          break;

        case 'reduce':
          result = (inputs[0] as unknown[]).reduce((acc, item) =>
            this.evaluateExpressionWithItem(config.expression, context, { acc, item })
          );
          break;

        default:
          // Simple expression evaluation
          result = this.evaluateExpression(config.expression, {
            ...context,
            variables: { ...context.variables, inputs },
          });
      }

      // Store result
      context.variables[config.outputVariable] = result;

      return {
        nodeId: node.id,
        success: true,
        data: result,
        durationMs: 0,
      };
    } catch (err) {
      return {
        nodeId: node.id,
        success: false,
        error: err instanceof Error ? err.message : 'Transform failed',
        durationMs: 0,
      };
    }
  }

  /**
   * Execute wait node
   */
  private async executeWaitNode(
    node: WorkflowNode,
    context: WorkflowExecutionContext
  ): Promise<NodeExecutionResult> {
    const config = node.wait;
    if (!config) {
      // Default wait
      await this.sleep(1000);
      return {
        nodeId: node.id,
        success: true,
        durationMs: 1000,
      };
    }

    if (config.durationMs) {
      await this.sleep(config.durationMs);
      return {
        nodeId: node.id,
        success: true,
        durationMs: config.durationMs,
      };
    }

    if (config.condition) {
      const startTime = Date.now();
      const timeout = config.timeout || this.config.defaultTimeout;

      while (Date.now() - startTime < timeout) {
        if (this.evaluateExpression(config.condition, context)) {
          return {
            nodeId: node.id,
            success: true,
            durationMs: Date.now() - startTime,
          };
        }
        await this.sleep(500);
      }

      return {
        nodeId: node.id,
        success: false,
        error: 'Wait condition timeout',
        durationMs: timeout,
      };
    }

    return {
      nodeId: node.id,
      success: true,
      durationMs: 0,
    };
  }

  /**
   * Execute workflow call node
   */
  private async executeWorkflowCallNode(
    node: WorkflowNode,
    context: WorkflowExecutionContext,
    mcpClient: McpClientInterface
  ): Promise<NodeExecutionResult> {
    const config = node.workflowCall;
    if (!config) {
      throw new Error('Workflow call node missing configuration');
    }

    // Map parameters
    const parameters = this.mapParameters(
      config.parameterMapping || {},
      context
    );

    // Execute nested workflow
    const result = await this.executeWorkflow(config.workflowId, {
      parameters,
      profileId: context.profileId,
      mcpClient,
      parentExecutionId: context.executionId,
      depth: context.depth + 1,
    });

    // Store output if specified
    if (config.outputVariable && result.outputs) {
      context.variables[config.outputVariable] = result.outputs;
    }

    return {
      nodeId: node.id,
      success: result.success,
      data: result.outputs,
      error: result.error,
      durationMs: result.durationMs,
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Map parameters from context to skill parameters
   */
  private mapParameters(
    mapping: Record<string, string | DynamicValue>,
    context: WorkflowExecutionContext
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(mapping)) {
      if (typeof value === 'string') {
        params[key] = this.resolveValue(value, context);
      } else {
        // DynamicValue
        params[key] = this.resolveDynamicValue(value, context);
      }
    }

    return params;
  }

  /**
   * Resolve a value reference from context
   */
  private resolveValue(
    ref: string,
    context: WorkflowExecutionContext
  ): unknown {
    // Check if it's a parameter reference
    if (ref.startsWith('$params.')) {
      const paramName = ref.substring(8);
      return context.parameters[paramName];
    }

    // Check if it's a variable reference
    if (ref.startsWith('$vars.')) {
      const varName = ref.substring(6);
      return context.variables[varName];
    }

    // Check if it's a simple variable name
    if (context.variables[ref] !== undefined) {
      return context.variables[ref];
    }

    if (context.parameters[ref] !== undefined) {
      return context.parameters[ref];
    }

    // Return as literal value
    return ref;
  }

  /**
   * Resolve a dynamic value
   */
  private resolveDynamicValue(
    value: DynamicValue,
    context: WorkflowExecutionContext
  ): unknown {
    switch (value.type) {
      case 'parameter':
        return context.parameters[value.source] ?? value.defaultValue;

      case 'context':
        return context.variables[value.source] ?? value.defaultValue;

      case 'expression':
        return this.evaluateExpression(value.source, context);

      default:
        return value.defaultValue;
    }
  }

  /**
   * Evaluate an expression (simplified implementation)
   */
  private evaluateExpression(
    expression: string,
    context: WorkflowExecutionContext
  ): unknown {
    // Simple expression evaluation
    // In production, use a proper safe expression evaluator

    // Replace variable references
    let expr = expression;
    for (const [key, value] of Object.entries(context.variables)) {
      expr = expr.replace(new RegExp(`\\$vars\\.${key}`, 'g'), JSON.stringify(value));
    }
    for (const [key, value] of Object.entries(context.parameters)) {
      expr = expr.replace(new RegExp(`\\$params\\.${key}`, 'g'), JSON.stringify(value));
    }

    try {
      // Very simple evaluation (in production, use a sandboxed evaluator)
      if (expr === 'true') return true;
      if (expr === 'false') return false;
      if (!isNaN(Number(expr))) return Number(expr);
      return expr;
    } catch {
      return expression;
    }
  }

  /**
   * Evaluate expression with an item (for map/filter/reduce)
   */
  private evaluateExpressionWithItem(
    expression: string,
    context: WorkflowExecutionContext,
    item: unknown
  ): unknown {
    const extendedContext = {
      ...context,
      variables: { ...context.variables, item },
    };
    return this.evaluateExpression(expression, extendedContext);
  }

  /**
   * Aggregate cluster results
   */
  private aggregateClusterResults(
    results: Record<string, ExecutionResult>,
    aggregation?: string
  ): unknown {
    const successResults = Object.entries(results)
      .filter(([, r]) => r.success)
      .map(([id, r]) => ({ profileId: id, ...r }));

    switch (aggregation) {
      case 'first_success':
        return successResults[0] || null;

      case 'merge':
        const merged: Record<string, unknown> = {};
        for (const result of successResults) {
          if (result.data) {
            Object.assign(merged, result.data);
          }
        }
        return merged;

      case 'count':
        return {
          success: successResults.length,
          failure: Object.keys(results).length - successResults.length,
        };

      case 'all':
      default:
        return Object.entries(results).map(([id, r]) => ({
          profileId: id,
          ...r,
        }));
    }
  }

  /**
   * Collect workflow outputs
   */
  private collectOutputs(
    workflow: BrowserWorkflow,
    context: WorkflowExecutionContext
  ): Record<string, unknown> {
    const outputs: Record<string, unknown> = {};

    if (workflow.outputs) {
      for (const output of workflow.outputs) {
        if (context.variables[output.name] !== undefined) {
          outputs[output.name] = context.variables[output.name];
        }
      }
    }

    return outputs;
  }

  /**
   * Summarize node results for logging
   */
  private summarizeNodeResults(
    results: Record<string, NodeExecutionResult>
  ): Record<string, { success: boolean; durationMs: number }> {
    const summary: Record<string, { success: boolean; durationMs: number }> = {};

    for (const [nodeId, result] of Object.entries(results)) {
      summary[nodeId] = {
        success: result.success,
        durationMs: result.durationMs,
      };
    }

    return summary;
  }

  /**
   * Find the first failed node ID
   */
  private findFailedNode(
    results: Record<string, NodeExecutionResult>
  ): string | undefined {
    for (const [nodeId, result] of Object.entries(results)) {
      if (!result.success) {
        return nodeId;
      }
    }
    return undefined;
  }

  /**
   * Generate execution ID
   */
  private generateExecutionId(): string {
    return `wfexec_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
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

let defaultEngine: WorkflowEngine | null = null;

/**
 * Get the default workflow engine
 */
export function getDefaultWorkflowEngine(): WorkflowEngine {
  if (!defaultEngine) {
    defaultEngine = new WorkflowEngine();
  }
  return defaultEngine;
}

/**
 * Create a new workflow engine with custom config
 */
export function createWorkflowEngine(config?: WorkflowEngineConfig): WorkflowEngine {
  return new WorkflowEngine(config);
}

/**
 * Execute a workflow using the default engine
 */
export async function executeWorkflow(
  workflowOrId: BrowserWorkflow | string,
  options?: {
    parameters?: Record<string, unknown>;
    profileId?: string;
    mcpClient?: McpClientInterface;
  }
): Promise<WorkflowExecutionResult> {
  return getDefaultWorkflowEngine().executeWorkflow(workflowOrId, options);
}
