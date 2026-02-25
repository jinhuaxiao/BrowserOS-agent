/**
 * Workflow Types
 *
 * Type definitions for the workflow orchestration system.
 * Workflows combine multiple skills into complex automation flows
 * with support for parallel execution, conditions, loops, and
 * cluster execution across multiple profiles.
 *
 * Key concepts:
 * - Workflow: A directed graph of nodes representing a complete automation flow
 * - WorkflowNode: A single step in the workflow (skill call, condition, parallel, etc.)
 * - WorkflowEdge: Connection between nodes with optional conditions
 * - ClusterExecution: Execute across multiple browser profiles in parallel
 */

import type {
  SkillTriggers,
  SkillParameter,
  SkillOutput,
  DynamicValue,
  ErrorHandler,
  ExecutionResult,
} from './types.ts';

// ============================================================================
// Core Workflow Types
// ============================================================================

/**
 * Browser workflow - a composed automation flow from multiple skills
 */
export interface BrowserWorkflow {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what this workflow does */
  description: string;

  /** Trigger conditions (similar to skills) */
  triggers: SkillTriggers;

  /** Workflow nodes */
  nodes: WorkflowNode[];

  /** Edges connecting nodes */
  edges: WorkflowEdge[];

  /** Input parameters the workflow accepts */
  parameters?: SkillParameter[];

  /** Expected outputs from workflow execution */
  outputs?: SkillOutput[];

  /** Who created this workflow */
  createdBy: 'user' | 'agent';

  /** Workflow metadata */
  metadata: WorkflowMetadata;

  /** Tags for organization */
  tags?: string[];

  /** Version for tracking updates */
  version: number;

  /** Creation timestamp */
  createdAt: number;

  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Workflow metadata for tracking usage and performance
 */
export interface WorkflowMetadata {
  /** Historical success rate (0-1) */
  successRate: number;

  /** Total number of executions */
  executionCount: number;

  /** Average execution duration in ms */
  averageDurationMs: number;

  /** Last used timestamp */
  lastUsedAt?: number;

  /** Last successful execution timestamp */
  lastSuccessAt?: number;

  /** Number of consecutive failures */
  consecutiveFailures: number;

  /** Estimated DOM stability across all skills */
  estimatedDomStability?: number;

  /** Source trace IDs that generated this workflow */
  sourceTraceIds?: string[];
}

// ============================================================================
// Workflow Node Types
// ============================================================================

/**
 * Types of workflow nodes
 */
export type WorkflowNodeType =
  | 'start'          // Entry point of workflow
  | 'end'            // Exit point of workflow
  | 'skill_call'     // Call a single skill
  | 'condition'      // Conditional branching
  | 'parallel'       // Parallel execution of multiple nodes
  | 'loop'           // Loop execution
  | 'cluster'        // Execute across multiple profiles
  | 'handoff'        // Hand off to another agent type
  | 'transform'      // Transform/process data
  | 'wait'           // Wait/delay
  | 'workflow_call'  // Call another workflow
  | 'script';        // Execute custom script

/**
 * A node in the workflow graph
 */
export interface WorkflowNode {
  /** Node identifier */
  id: string;

  /** Node type */
  type: WorkflowNodeType;

  /** Human-readable name for display */
  name?: string;

  /** Description of what this node does */
  description?: string;

  // Type-specific configurations

  /** Skill call configuration (for skill_call type) */
  skillCall?: SkillCallConfig;

  /** Condition configuration (for condition type) */
  condition?: ConditionConfig;

  /** Parallel execution configuration (for parallel type) */
  parallel?: ParallelConfig;

  /** Loop configuration (for loop type) */
  loop?: LoopNodeConfig;

  /** Cluster execution configuration (for cluster type) */
  cluster?: ClusterConfig;

  /** Agent handoff configuration (for handoff type) */
  handoff?: HandoffConfig;

  /** Transform configuration (for transform type) */
  transform?: TransformConfig;

  /** Wait configuration (for wait type) */
  wait?: WaitNodeConfig;

  /** Workflow call configuration (for workflow_call type) */
  workflowCall?: WorkflowCallConfig;

  /** Script configuration (for script type) */
  script?: ScriptNodeConfig;

  // Common node properties

  /** Error handling */
  onError?: ErrorHandler;

  /** Timeout in ms */
  timeout?: number;

  /** Number of retries */
  retries?: number;

  /** Retry delay in ms */
  retryDelay?: number;

  /** Whether this node is optional (continue on failure) */
  optional?: boolean;

  /** Node-level metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Value for parameter mapping - can be a literal or dynamic reference
 */
export type ParameterValue = string | number | boolean | null | DynamicValue;

/**
 * Configuration for calling a skill
 */
export interface SkillCallConfig {
  /** ID of the skill to call */
  skillId: string;

  /** Map workflow parameters to skill parameters */
  parameterMapping?: Record<string, ParameterValue>;

  /** Output variable name to store result */
  outputVariable?: string;
}

/**
 * Configuration for conditional branching
 */
export interface ConditionConfig {
  /** Condition expression to evaluate */
  expression: string;

  /** Branches based on condition results */
  branches: ConditionBranch[];

  /** Default branch if no conditions match */
  defaultBranch?: string;
}

/**
 * A branch in a condition node
 */
export interface ConditionBranch {
  /** Condition expression for this branch */
  condition: string;

  /** Target node ID to execute if condition is true */
  targetNodeId: string;

  /** Human-readable label for this branch */
  label?: string;
}

/**
 * Configuration for parallel execution
 */
export interface ParallelConfig {
  /** Node IDs to execute in parallel */
  nodeIds: string[];

  /** Whether to wait for all nodes to complete (default: true) */
  waitAll?: boolean;

  /** Whether to fail fast if any node fails (default: false) */
  failFast?: boolean;

  /** Maximum concurrent executions */
  maxConcurrency?: number;
}

/**
 * Configuration for loop execution
 */
export interface LoopNodeConfig {
  /** Type of loop */
  type: 'count' | 'while' | 'for_each';

  /** Number of iterations (for count type) */
  count?: number;

  /** Condition expression (for while type) */
  condition?: string;

  /** Variable containing items to iterate (for for_each type) */
  itemsVariable?: string;

  /** Node IDs that make up the loop body */
  bodyNodeIds: string[];

  /** Maximum iterations (safety limit) */
  maxIterations?: number;

  /** Loop variable name (for accessing current item) */
  loopVariable?: string;

  /** Index variable name (for accessing current index) */
  indexVariable?: string;
}

/**
 * Configuration for cluster execution across profiles
 */
export interface ClusterConfig {
  /** Profile IDs to execute on */
  profileIds: string[];

  /** Skill ID to execute on each profile */
  skillId: string;

  /** Parameter mapping for the skill */
  parameterMapping?: Record<string, string | DynamicValue>;

  /** How to aggregate results */
  aggregation?: ClusterAggregation;

  /** Maximum concurrent profile executions */
  maxConcurrency?: number;

  /** Whether to continue if some profiles fail */
  continueOnPartialFailure?: boolean;

  /** Profile-specific parameter overrides */
  profileOverrides?: Record<string, Record<string, unknown>>;
}

/**
 * Aggregation strategy for cluster execution results
 */
export type ClusterAggregation =
  | 'all'           // Return all results as array
  | 'first_success' // Return first successful result
  | 'merge'         // Merge all results into single object
  | 'count';        // Return success/failure counts

/**
 * Configuration for agent handoff
 */
export interface HandoffConfig {
  /** Target agent type to hand off to */
  targetAgentType: string;

  /** Context to pass to the target agent */
  context?: Record<string, unknown>;

  /** Whether to wait for handoff to complete and return result */
  returnOnComplete?: boolean;

  /** Instructions for the target agent */
  instructions?: string;

  /** Timeout for handoff completion */
  timeout?: number;
}

/**
 * Configuration for data transformation
 */
export interface TransformConfig {
  /** Input variable(s) to transform */
  inputs: string[];

  /** Transformation expression or function name */
  expression: string;

  /** Output variable name */
  outputVariable: string;

  /** Transform type */
  transformType?: 'expression' | 'map' | 'filter' | 'reduce' | 'custom';
}

/**
 * Configuration for wait nodes
 */
export interface WaitNodeConfig {
  /** Wait duration in ms */
  durationMs?: number;

  /** Condition to wait for */
  condition?: string;

  /** Maximum wait time */
  timeout?: number;
}

/**
 * Configuration for script nodes
 */
export interface ScriptNodeConfig {
  /** JavaScript code to execute */
  code: string;

  /** Output variable name to store result */
  outputVariable?: string;

  /** Whether to run in isolated context */
  isolated?: boolean;

  /** Timeout for script execution in ms */
  timeout?: number;
}

/**
 * Configuration for calling another workflow
 */
export interface WorkflowCallConfig {
  /** ID of the workflow to call */
  workflowId: string;

  /** Parameter mapping */
  parameterMapping?: Record<string, string | DynamicValue>;

  /** Output variable name */
  outputVariable?: string;
}

// ============================================================================
// Workflow Edge Types
// ============================================================================

/**
 * An edge connecting two nodes in the workflow
 */
export interface WorkflowEdge {
  /** Edge identifier */
  id: string;

  /** Source node ID */
  sourceNodeId: string;

  /** Target node ID */
  targetNodeId: string;

  /** Condition for traversing this edge (optional) */
  condition?: string;

  /** Data mapping from source to target */
  dataMapping?: Record<string, string>;

  /** Human-readable label */
  label?: string;

  /** Edge priority (for deterministic ordering) */
  priority?: number;
}

// ============================================================================
// Execution Types
// ============================================================================

/**
 * Context for workflow execution
 */
export interface WorkflowExecutionContext {
  /** Current workflow being executed */
  workflowId: string;

  /** Execution ID */
  executionId: string;

  /** Input parameters */
  parameters: Record<string, unknown>;

  /** Variables accumulated during execution */
  variables: Record<string, unknown>;

  /** Profile ID (for single-profile execution) */
  profileId?: string;

  /** Execution start time */
  startedAt: number;

  /** Parent execution ID (for nested workflows) */
  parentExecutionId?: string;

  /** Execution depth (for recursion protection) */
  depth: number;

  /** Maximum execution depth */
  maxDepth: number;
}

/**
 * Result of executing a single node
 */
export interface NodeExecutionResult {
  /** Node ID */
  nodeId: string;

  /** Whether execution succeeded */
  success: boolean;

  /** Result data */
  data?: unknown;

  /** Error message if failed */
  error?: string;

  /** Execution duration in ms */
  durationMs: number;

  /** Whether retry was used */
  retried?: boolean;

  /** Number of retries attempted */
  retryCount?: number;

  /** Child results (for parallel/loop nodes) */
  childResults?: NodeExecutionResult[];
}

/**
 * Result of executing a complete workflow
 */
export interface WorkflowExecutionResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Execution ID */
  executionId: string;

  /** Individual node results */
  nodeResults: Record<string, NodeExecutionResult>;

  /** Final output data */
  outputs?: Record<string, unknown>;

  /** Total execution duration in ms */
  durationMs: number;

  /** Error message if failed */
  error?: string;

  /** ID of the node that failed (if any) */
  failedNodeId?: string;

  /** Whether any fallbacks were used */
  usedFallback?: boolean;
}

/**
 * Result of cluster execution
 */
export interface ClusterExecutionResult {
  /** Total number of profiles executed on */
  totalProfiles: number;

  /** Number of successful executions */
  successCount: number;

  /** Number of failed executions */
  failureCount: number;

  /** Results per profile */
  results: Record<string, ExecutionResult>;

  /** Aggregated result (based on aggregation strategy) */
  aggregatedResult?: unknown;

  /** Total execution duration in ms */
  durationMs: number;
}

// ============================================================================
// Workflow Generation Types
// ============================================================================

/**
 * Suggestion for creating a workflow
 */
export interface WorkflowSuggestion {
  /** Type of workflow pattern detected */
  type: 'sequential' | 'parallel' | 'cluster' | 'conditional';

  /** Skill IDs involved */
  skills: string[];

  /** Profile IDs (for cluster type) */
  profiles?: string[];

  /** How often this pattern was detected */
  frequency: number;

  /** Suggested workflow name */
  suggestedName: string;

  /** Suggested description */
  suggestedDescription?: string;

  /** Confidence score (0-1) */
  confidence: number;

  /** Estimated time savings */
  estimatedTimeSavingsMs?: number;
}

/**
 * Record of a skill call during execution
 */
export interface SkillCallRecord {
  /** Skill ID that was called */
  skillId: string;

  /** Skill name */
  skillName: string;

  /** Domain */
  domain: string;

  /** Profile ID used */
  profileId?: string;

  /** Timestamp */
  timestamp: number;

  /** Duration in ms */
  durationMs: number;

  /** Whether call succeeded */
  success: boolean;

  /** Parameters used */
  parameters?: Record<string, unknown>;

  /** Result data */
  result?: unknown;
}

// ============================================================================
// Evolution Types
// ============================================================================

/**
 * Report from an evolution cycle
 */
export interface EvolutionReport {
  /** Number of executions analyzed */
  analyzedExecutions: number;

  /** Number of new workflows created */
  newWorkflowsCreated: number;

  /** Number of skills merged */
  skillsMerged: number;

  /** Number of skills deprecated */
  skillsDeprecated: number;

  /** Number of workflows updated */
  workflowsUpdated: number;

  /** Number of workflows deprecated */
  workflowsDeprecated: number;

  /** Suggestions for manual review */
  suggestions: WorkflowSuggestion[];

  /** Timestamp of evolution cycle */
  timestamp: number;

  /** Duration of evolution cycle in ms */
  durationMs: number;
}

/**
 * Group of similar skills that could be merged
 */
export interface SimilarSkillGroup {
  /** Skill IDs in this group */
  skillIds: string[];

  /** Similarity score (0-1) */
  similarity: number;

  /** Suggested merged skill name */
  suggestedName?: string;

  /** Differences between skills */
  differences: string[];
}

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Workflow storage index
 */
export interface WorkflowIndex {
  /** Version of the index format */
  version: number;

  /** Map of workflow ID to metadata */
  workflows: Record<string, WorkflowIndexEntry>;

  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Entry in the workflow index
 */
export interface WorkflowIndexEntry {
  /** Workflow ID */
  id: string;

  /** Workflow name */
  name: string;

  /** Description */
  description: string;

  /** Tags */
  tags?: string[];

  /** Success rate */
  successRate: number;

  /** Last used timestamp */
  lastUsedAt?: number;

  /** Number of skills involved */
  skillCount: number;

  /** File path */
  filePath: string;
}

/**
 * Workflow execution log entry
 */
export interface WorkflowExecutionLogEntry {
  /** Log ID */
  id: string;

  /** Workflow ID */
  workflowId: string;

  /** Execution timestamp */
  timestamp: number;

  /** Whether succeeded */
  success: boolean;

  /** Duration in ms */
  durationMs: number;

  /** Error message if failed */
  error?: string;

  /** Parameters used */
  parameters?: Record<string, unknown>;

  /** Node execution summary */
  nodeSummary?: Record<string, { success: boolean; durationMs: number }>;

  /** Profile IDs involved (for cluster execution) */
  profileIds?: string[];
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Workflow system events
 */
export type WorkflowEvent =
  | { type: 'workflow_created'; workflow: BrowserWorkflow }
  | { type: 'workflow_updated'; workflow: BrowserWorkflow; changes: string[] }
  | { type: 'workflow_deprecated'; workflowId: string; reason: string }
  | { type: 'workflow_deleted'; workflowId: string }
  | { type: 'execution_started'; workflowId: string; executionId: string }
  | { type: 'node_started'; workflowId: string; executionId: string; nodeId: string }
  | { type: 'node_completed'; workflowId: string; executionId: string; nodeId: string; result: NodeExecutionResult }
  | { type: 'execution_completed'; workflowId: string; executionId: string; result: WorkflowExecutionResult }
  | { type: 'execution_failed'; workflowId: string; executionId: string; error: string }
  | { type: 'cluster_started'; workflowId: string; executionId: string; profileIds: string[] }
  | { type: 'cluster_profile_completed'; workflowId: string; executionId: string; profileId: string; success: boolean }
  | { type: 'evolution_cycle_completed'; report: EvolutionReport }
  | { type: 'workflow_suggestion'; suggestion: WorkflowSuggestion };

/**
 * Workflow event listener type
 */
export type WorkflowEventListener = (event: WorkflowEvent) => void;
