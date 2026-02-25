/**
 * Browser Skills Types
 *
 * Type definitions for the self-evolving browser agent system.
 * Skills are learned, reusable automation workflows that can be
 * executed faster than vision-based approaches.
 *
 * Three-layer execution model:
 * - L1: Atomic scripts (pure JS, fastest)
 * - L2: Skills (parameterized step sequences)
 * - L3: Vision (fallback for unknown scenarios)
 */

// ============================================================================
// Core Skill Types
// ============================================================================

/**
 * Browser skill - a learned, reusable automation workflow
 */
export interface BrowserSkill {
  /** Unique identifier */
  id: string;

  /** Human-readable name (e.g., "Amazon Login", "Download Ad Report") */
  name: string;

  /** Semantic description for matching user intents */
  description: string;

  /** Domain this skill operates on (e.g., "amazon.com") */
  domain: string;

  /** Trigger conditions for skill activation */
  triggers: SkillTriggers;

  /** Execution steps */
  steps: SkillStep[];

  /** Input parameters the skill accepts */
  parameters?: SkillParameter[];

  /** Expected outputs from skill execution */
  outputs?: SkillOutput[];

  /** Who created this skill */
  createdBy: 'user' | 'agent';

  /** Historical success rate (0-1) */
  successRate: number;

  /** Total number of executions */
  executionCount: number;

  /** Number of consecutive failures */
  consecutiveFailures: number;

  /** Last used timestamp */
  lastUsedAt?: number;

  /** Last successful execution timestamp */
  lastSuccessAt?: number;

  /** Skill variants for handling page variations */
  variants?: SkillVariant[];

  /** Whether to fallback to vision on failure (defaults to true) */
  fallbackToVision?: boolean;

  /** Tags for organization */
  tags?: string[];

  /** Version for tracking updates */
  version: number;

  /** DOM fingerprint at creation time */
  domFingerprint?: string;

  /** Creation timestamp */
  createdAt: number;

  /** Last update timestamp */
  updatedAt: number;

  /** Additional metadata */
  metadata?: SkillMetadata;
}

/**
 * Skill metadata for tracking and analytics
 */
export interface SkillMetadata {
  /** Historical success rate */
  successRate?: number;

  /** Average duration in ms */
  averageDurationMs?: number;

  /** Last updated timestamp */
  lastUpdated?: number;

  /** Additional arbitrary metadata */
  [key: string]: unknown;
}

/**
 * Skill trigger conditions
 */
export interface SkillTriggers {
  /** URL pattern matching (regex) */
  urlPattern?: string;

  /** Page signature - DOM selectors that must exist */
  pageSignature?: string[];

  /** User intent patterns for NLP matching */
  intentPatterns?: string[];

  /** Required page title pattern */
  titlePattern?: string;

  /** Minimum confidence threshold for matching (0-1) */
  minConfidence?: number;
}

/**
 * A single step in a skill workflow
 */
export interface SkillStep {
  /** Step identifier for debugging */
  id: string;

  /** Step type */
  type: SkillStepType;

  /** Human-readable name (short display name) */
  name?: string;

  /** Human-readable description */
  description?: string;

  /** CSS or XPath selector for target element */
  selector?: string;

  /** Alternative selectors (fallback order) */
  alternativeSelectors?: string[];

  /** Value for type/select actions (can be dynamic) */
  value?: string | DynamicValue;

  /** URL to navigate to (for navigate type) */
  url?: string | DynamicValue;

  /** Condition to wait for before proceeding */
  waitFor?: WaitCondition;

  /** Maximum wait time in ms */
  timeout?: number;

  /** What to do on error */
  onError?: ErrorHandler;

  /** Condition for conditional steps */
  condition?: StepCondition;

  /** Steps to execute if condition is true (for condition type) */
  ifTrue?: SkillStep[];

  /** Steps to execute if condition is false (for condition type) */
  ifFalse?: SkillStep[];

  /** Loop configuration for repeated steps */
  loop?: LoopConfig;

  /** Nested steps for compound actions */
  nestedSteps?: SkillStep[];

  /** MCP tool to call (for mcp_call type) */
  mcpTool?: string;

  /** MCP tool arguments */
  mcpArgs?: Record<string, unknown>;

  /** JavaScript code (for script type) */
  script?: string;

  /** Alias for script - JavaScript code to execute */
  code?: string;

  /** Data to extract (for extract type) */
  extractConfig?: ExtractConfig;

  /** Alias for extractConfig - extraction configuration */
  extract?: ExtractConfig;

  /** Variable name to store the step output */
  outputVariable?: string;

  /** Whether this step is optional (won't fail the workflow) */
  optional?: boolean;

  /** Delay between keystrokes in ms (for type action) */
  typeDelay?: number;

  /** Clear input field before typing (for type action) */
  clearFirst?: boolean;

  // Scroll-related properties

  /** Scroll direction (for scroll type) */
  direction?: 'up' | 'down' | 'left' | 'right';

  /** Scroll amount in pixels (for scroll type) */
  amount?: number;

  /** Target element to scroll to (for scroll type) */
  target?: string;

  // Workflow-related properties

  /** Skill call configuration (for skill_call type) */
  skillCall?: {
    /** ID of the skill to call */
    skillId: string;
    /** Map step parameters to skill parameters */
    parameterMapping?: Record<string, string | DynamicValue>;
  };

  /** Parallel steps configuration (for parallel type) */
  parallelSteps?: SkillStep[];

  /** Agent handoff configuration (for handoff type) */
  handoff?: {
    /** Target agent type to hand off to */
    targetAgentType: string;
    /** Context to pass to the target agent */
    context?: Record<string, unknown>;
    /** Whether to wait for the handoff to complete */
    returnOnComplete?: boolean;
  };

  /** Workflow ID to execute (for workflow type) */
  workflowId?: string;
}

/**
 * Supported step types
 */
export type SkillStepType =
  | 'click'
  | 'type'
  | 'select'
  | 'hover'
  | 'scroll'
  | 'wait'
  | 'navigate'
  | 'extract'
  | 'condition'
  | 'loop'
  | 'script'
  | 'mcp_call'
  | 'screenshot'
  | 'download'
  | 'upload'
  // Workflow-related step types
  | 'skill_call'   // Call another skill
  | 'workflow'     // Execute a workflow
  | 'parallel'     // Execute multiple steps in parallel
  | 'handoff';     // Agent handoff to another agent type

/**
 * Dynamic value that can reference parameters or context
 */
export interface DynamicValue {
  /** Type of dynamic value */
  type: 'parameter' | 'context' | 'expression';

  /** Parameter name or context path */
  source: string;

  /** Default value if source is not available */
  defaultValue?: string;

  /** Transform function name */
  transform?: string;

  /** Suffix to append to the value */
  suffix?: string;

  /** Prefix to prepend to the value */
  prefix?: string;
}

/**
 * Condition to wait for
 */
export interface WaitCondition {
  /** Type of wait */
  type: 'selector' | 'url' | 'network' | 'time' | 'expression' | 'navigation' | 'idle' | 'networkIdle';

  /** Value to wait for (selector, URL pattern, or expression) - optional for idle/networkIdle types */
  value?: string;

  /** Maximum wait time in ms */
  timeout?: number;

  /** Whether element should be visible */
  visible?: boolean;
}

/**
 * Error handling configuration
 */
export interface ErrorHandler {
  /** Strategy for handling errors */
  strategy: 'retry' | 'skip' | 'fallback' | 'abort';

  /** Number of retries */
  retries?: number;

  /** Delay between retries in ms */
  retryDelay?: number;

  /** Fallback step ID to jump to */
  fallbackStepId?: string;

  /** Whether to log the error */
  logError?: boolean;
}

/**
 * Condition for conditional step execution
 */
export interface StepCondition {
  /** Type of condition */
  type: 'selector_exists' | 'selector_visible' | 'url_matches' | 'expression';

  /** Condition value */
  value?: string;

  /** Expression to evaluate (for expression type) - alias for value */
  expression?: string;

  /** Negate the condition */
  negate?: boolean;
}

/**
 * Loop configuration
 */
export interface LoopConfig {
  /** Type of loop */
  type: 'count' | 'while' | 'for_each';

  /** Number of iterations (for count) */
  count?: number;

  /** Condition to continue (for while) */
  condition?: StepCondition;

  /** Selector to iterate over (for for_each) */
  itemsSelector?: string;

  /** Maximum iterations (safety limit) */
  maxIterations?: number;
}

/**
 * Configuration for data extraction
 */
export interface ExtractConfig {
  /** Type of extraction: single item or list */
  type?: 'single' | 'list';

  /** Name for the extracted data */
  name?: string;

  /** Selector for the data element (for single extraction) */
  selector?: string;

  /** Container selector for list extraction */
  containerSelector?: string;

  /** What to extract */
  extractType?: 'text' | 'attribute' | 'html' | 'value';

  /** Attribute name (for attribute extraction) */
  attribute?: string;

  /** Whether to extract multiple elements */
  multiple?: boolean;

  /** Maximum items to extract (for list type) */
  maxItems?: number | DynamicValue;

  /** Transform to apply to extracted data */
  transform?: string;

  /** Fields to extract (for structured extraction) */
  fields?: Record<string, ExtractFieldConfig>;
}

/**
 * Configuration for extracting a single field
 */
export interface ExtractFieldConfig {
  /** Selector within the item */
  selector: string;

  /** What attribute to extract */
  attribute: string;

  /** Transform to apply to the extracted value */
  transform?: string;

  /** Default value if extraction fails */
  defaultValue?: string | number | boolean;
}

/**
 * Skill input parameter
 */
export interface SkillParameter {
  /** Parameter name */
  name: string;

  /** Human-readable label */
  label: string;

  /** Description */
  description?: string;

  /** Parameter type */
  type: 'string' | 'number' | 'boolean' | 'date' | 'select';

  /** Whether parameter is required */
  required?: boolean;

  /** Default value */
  defaultValue?: unknown;

  /** Allowed values (for select type) */
  options?: Array<{ label: string; value: string }>;

  /** Validation pattern (regex) */
  pattern?: string;
}

/**
 * Skill output definition
 */
export interface SkillOutput {
  /** Output name */
  name: string;

  /** Description */
  description?: string;

  /** Output type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'file';
}

/**
 * Skill variant for handling page variations
 */
export interface SkillVariant {
  /** Variant identifier */
  id: string;

  /** Description of when this variant applies */
  description: string;

  /** Condition for selecting this variant */
  condition: StepCondition;

  /** Steps that differ from the main skill */
  steps: SkillStep[];

  /** Success rate for this variant */
  successRate: number;

  /** Usage count */
  usageCount: number;
}

// ============================================================================
// Script Types (L1 - Atomic Scripts)
// ============================================================================

/**
 * Browser script - pure JavaScript for direct execution
 */
export interface BrowserScript {
  /** Unique identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description */
  description: string;

  /** Domain this script operates on */
  domain: string;

  /** JavaScript code to execute */
  code: string;

  /** Whether script requires authentication */
  requiresAuth?: boolean;

  /** Required cookies for execution */
  requiredCookies?: string[];

  /** Script parameters */
  params: ScriptParam[];

  /** Return value definition */
  returns: ScriptReturn;

  /** Script version */
  version: string;

  /** DOM fingerprint for detecting page changes */
  domFingerprint: string;

  /** Creation timestamp */
  createdAt: number;

  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Script parameter definition
 */
export interface ScriptParam {
  /** Parameter name */
  name: string;

  /** Parameter type */
  type: 'string' | 'number' | 'boolean';

  /** Whether required */
  required?: boolean;

  /** Default value */
  defaultValue?: unknown;

  /** Description */
  description?: string;
}

/**
 * Script return value definition
 */
export interface ScriptReturn {
  /** Return type */
  type: 'void' | 'string' | 'number' | 'boolean' | 'object' | 'array';

  /** Description */
  description?: string;

  /** Schema for object/array types */
  schema?: Record<string, unknown>;
}

// ============================================================================
// Execution Types
// ============================================================================

/**
 * Execution context passed to skills and scripts
 */
export interface ExecutionContext {
  /** Current page URL */
  url: string;

  /** Page title */
  title: string;

  /** Provided parameters */
  parameters: Record<string, unknown>;

  /** Extracted data from previous steps */
  extractedData: Record<string, unknown>;

  /** MCP client for browser control */
  mcpClient?: unknown;

  /** Browser profile ID */
  profileId?: string;

  /** Start timestamp */
  startedAt: number;

  /** Parent execution ID (for nested executions) */
  parentExecutionId?: string;
}

/**
 * Result of executing a skill or script
 */
export interface ExecutionResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Result data */
  data?: Record<string, unknown>;

  /** Error message if failed */
  error?: string;

  /** Error details */
  errorDetails?: {
    stepId?: string;
    selector?: string;
    type: string;
    message: string;
    stack?: string;
  };

  /** Execution duration in ms */
  durationMs: number;

  /** Individual step results */
  stepResults?: StepResult[];

  /** Whether fallback to vision was used */
  usedVisionFallback?: boolean;

  /** Screenshots captured during execution */
  screenshots?: string[];
}

/**
 * Result of a single step execution
 */
export interface StepResult {
  /** Step ID */
  stepId: string;

  /** Whether step succeeded */
  success: boolean;

  /** Step duration in ms */
  durationMs: number;

  /** Error if failed */
  error?: string;

  /** Extracted data (for extract steps) */
  extractedData?: unknown;

  /** Retry count */
  retries?: number;
}

// ============================================================================
// Tracking Types
// ============================================================================

/**
 * Recorded action during task execution
 */
export interface RecordedAction {
  /** Action ID */
  id: string;

  /** Action type */
  type: RecordedActionType;

  /** Timestamp */
  timestamp: number;

  /** Target element selector */
  selector?: string;

  /** Alternative selectors */
  alternativeSelectors?: string[];

  /** Action value (text typed, option selected, etc.) */
  value?: string;

  /** Page URL at time of action */
  url: string;

  /** Page title */
  title?: string;

  /** Element metadata */
  elementInfo?: ElementInfo;

  /** MCP tool called */
  mcpTool?: string;

  /** MCP tool arguments */
  mcpArgs?: Record<string, unknown>;

  /** MCP tool result */
  mcpResult?: unknown;

  /** Screenshot before action */
  screenshotBefore?: string;

  /** Screenshot after action */
  screenshotAfter?: string;

  /** Duration of action in ms */
  durationMs?: number;

  /** Whether action succeeded */
  success: boolean;

  /** Error if failed */
  error?: string;
}

/**
 * Types of recorded actions
 */
export type RecordedActionType =
  | 'click'
  | 'type'
  | 'select'
  | 'scroll'
  | 'navigate'
  | 'wait'
  | 'mcp_call'
  | 'extract'
  | 'download'
  | 'upload'
  | 'screenshot';

/**
 * Information about an interacted element
 */
export interface ElementInfo {
  /** Tag name */
  tagName: string;

  /** Element ID */
  id?: string;

  /** Class names */
  classNames?: string[];

  /** Text content (truncated) */
  textContent?: string;

  /** ARIA label */
  ariaLabel?: string;

  /** Placeholder text */
  placeholder?: string;

  /** Element role */
  role?: string;

  /** Data attributes */
  dataAttributes?: Record<string, string>;

  /** Element rect */
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Complete execution trace for skill generation
 */
export interface ExecutionTrace {
  /** Trace ID */
  id: string;

  /** Task description/prompt */
  taskDescription: string;

  /** Start URL */
  startUrl: string;

  /** End URL */
  endUrl: string;

  /** Recorded actions */
  actions: RecordedAction[];

  /** Total duration in ms */
  durationMs: number;

  /** Whether task completed successfully */
  success: boolean;

  /** Browser profile used */
  profileId?: string;

  /** Timestamp */
  timestamp: number;

  /** DOM snapshots at key points */
  domSnapshots?: DomSnapshot[];
}

/**
 * DOM snapshot for change detection
 */
export interface DomSnapshot {
  /** Snapshot ID */
  id: string;

  /** URL at snapshot time */
  url: string;

  /** Key selectors and their content */
  keyElements: Record<string, string>;

  /** Page structure hash */
  structureHash: string;

  /** Timestamp */
  timestamp: number;
}

// ============================================================================
// Matching Types
// ============================================================================

/**
 * Result of matching user intent to skills
 */
export interface SkillMatch {
  /** Matched skill */
  skill: BrowserSkill;

  /** Match confidence (0-1) */
  confidence: number;

  /** Which trigger matched */
  matchedTrigger: 'url' | 'signature' | 'intent' | 'title';

  /** Extracted parameters from intent */
  extractedParams?: Record<string, unknown>;

  /** Matched variant (if any) */
  variantId?: string;
}

/**
 * Execution plan from intent matching
 */
export interface ExecutionPlan {
  /** Execution type */
  type: 'script' | 'skill' | 'vision';

  /** Script to execute (for script type) */
  script?: BrowserScript;

  /** Skill to execute (for skill type) */
  skill?: BrowserSkill;

  /** Match confidence */
  confidence: number;

  /** Reason for choosing this execution type */
  reason: string;

  /** Variant to use */
  variantId?: string;

  /** Parameters for execution */
  parameters?: Record<string, unknown>;
}

// ============================================================================
// Decision Types
// ============================================================================

/**
 * Decision to create a new skill
 */
export interface CreateSkillDecision {
  /** Whether to create */
  shouldCreate: boolean;

  /** Reason for decision */
  reason: string;

  /** Proposed skill name */
  proposedName?: string;

  /** Proposed description */
  proposedDescription?: string;

  /** Detected parameters */
  detectedParams?: string[];

  /** Estimated DOM stability */
  domStability?: number;
}

/**
 * Decision to update an existing skill
 */
export interface UpdateSkillDecision {
  /** Whether to update */
  shouldUpdate: boolean;

  /** Reason for decision */
  reason: string;

  /** What to update */
  updateType?: 'selector' | 'steps' | 'variant';

  /** Proposed changes */
  proposedChanges?: Partial<BrowserSkill>;
}

/**
 * Decision to deprecate a skill
 */
export interface DeprecateSkillDecision {
  /** Whether to deprecate */
  shouldDeprecate: boolean;

  /** Reason for decision */
  reason: string;

  /** Suggested replacement skill ID */
  replacementSkillId?: string;
}

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Skill storage index
 */
export interface SkillIndex {
  /** Version of the index format */
  version: number;

  /** Map of skill ID to metadata */
  skills: Record<string, SkillIndexEntry>;

  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Entry in the skill index
 */
export interface SkillIndexEntry {
  /** Skill ID */
  id: string;

  /** Skill name */
  name: string;

  /** Description for search */
  description: string;

  /** Domain */
  domain: string;

  /** Tags */
  tags?: string[];

  /** Success rate */
  successRate: number;

  /** Last used timestamp */
  lastUsedAt?: number;

  /** File path */
  filePath: string;
}

/**
 * Execution log entry
 */
export interface ExecutionLogEntry {
  /** Log ID */
  id: string;

  /** Skill ID */
  skillId: string;

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

  /** Browser profile ID */
  profileId?: string;

  /** Vision fallback used */
  usedVisionFallback?: boolean;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Browser skill system events
 */
export type BrowserSkillEvent =
  | { type: 'skill_created'; skill: BrowserSkill }
  | { type: 'skill_updated'; skill: BrowserSkill; changes: string[] }
  | { type: 'skill_deprecated'; skillId: string; reason: string }
  | { type: 'skill_deleted'; skillId: string }
  | { type: 'execution_started'; skillId: string; executionId: string }
  | { type: 'execution_completed'; skillId: string; executionId: string; result: ExecutionResult }
  | { type: 'execution_failed'; skillId: string; executionId: string; error: string }
  | { type: 'recording_started'; traceId: string }
  | { type: 'recording_action'; traceId: string; action: RecordedAction }
  | { type: 'recording_completed'; traceId: string; trace: ExecutionTrace }
  | { type: 'vision_fallback'; skillId: string; reason: string };

/**
 * Event listener type
 */
export type BrowserSkillEventListener = (event: BrowserSkillEvent) => void;
