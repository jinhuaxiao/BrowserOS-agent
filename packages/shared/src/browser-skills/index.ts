/**
 * Browser Skills Module
 *
 * Self-evolving browser automation system that learns from user interactions
 * and converts them into reusable, efficient skills.
 *
 * Three-Layer Execution Model:
 * - L1: Atomic scripts (pure JS, fastest)
 * - L2: Skills (parameterized step sequences)
 * - L3: Vision (fallback for unknown scenarios)
 *
 * Key Features:
 * - Automatic skill generation from execution traces
 * - Semantic intent matching to find best execution method
 * - Autonomous skill lifecycle management (create/update/deprecate)
 * - Fallback handling when primary methods fail
 *
 * Usage:
 * ```typescript
 * import {
 *   HybridExecutor,
 *   ExecutionTracker,
 *   SkillMatcher,
 *   createSkillGenerator,
 * } from '@craft-agent/shared/browser-skills';
 *
 * // Create executor
 * const executor = new HybridExecutor();
 *
 * // Execute a task (automatically selects best method)
 * const result = await executor.execute(
 *   "Download last 7 days ad report",
 *   mcpClient,
 *   { profileId: 'amazon-store-1' }
 * );
 *
 * // The system will:
 * // 1. Check if a matching skill exists
 * // 2. Execute the skill if found
 * // 3. Fall back to vision if no skill matches
 * // 4. Automatically generate a new skill if successful
 * ```
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Core skill types
  BrowserSkill,
  SkillStep,
  SkillStepType,
  SkillTriggers,
  SkillParameter,
  SkillOutput,
  SkillVariant,

  // Step configuration types
  DynamicValue,
  WaitCondition,
  ErrorHandler,
  StepCondition,
  LoopConfig,
  ExtractConfig,

  // Script types (L1)
  BrowserScript,
  ScriptParam,
  ScriptReturn,

  // Execution types
  ExecutionContext,
  ExecutionResult,
  StepResult,

  // Tracking types
  RecordedAction,
  RecordedActionType,
  ElementInfo,
  ExecutionTrace,
  DomSnapshot,

  // Matching types
  SkillMatch,
  ExecutionPlan,

  // Decision types
  CreateSkillDecision,
  UpdateSkillDecision,
  DeprecateSkillDecision,

  // Storage types
  SkillIndex,
  SkillIndexEntry,
  ExecutionLogEntry,

  // Event types
  BrowserSkillEvent,
  BrowserSkillEventListener,
} from './types.ts';

// ============================================================================
// Skill Storage
// ============================================================================

export {
  // Directory management
  ensureDirectories,
  getBrowserSkillsDir,
  getSkillsDir,
  getScriptsDir,

  // Index management
  loadIndex,
  saveIndex,
  rebuildIndex,

  // Skill CRUD
  generateSkillId,
  createSkill,
  getSkill,
  updateSkill,
  deleteSkill,
  listSkills,
  listSkillsByDomain,
  listSkillsByTag,
  searchSkills,

  // Skill statistics
  recordExecution,
  deprecateSkill,
  getSkillStats,

  // Script CRUD
  generateScriptId,
  createScript,
  getScript,
  updateScript,
  deleteScript,
  listScripts,
  listScriptsByDomain,

  // Execution logging
  logExecution,
  readExecutionLogs,
  getExecutionSummary,
  cleanOldLogs,

  // Import/Export
  exportSkills,
  importSkills,

  // Events
  addEventListener as addStorageEventListener,
  removeEventListener as removeStorageEventListener,
} from './skill-storage.ts';

// ============================================================================
// Execution Tracker
// ============================================================================

export {
  // Tracker class
  ExecutionTracker,
  createTracker,
  getDefaultTracker,
  resetDefaultTracker,

  // Selector generation
  generateSelectors,
  generateSelector,

  // DOM fingerprinting
  generateDomFingerprint,
  compareDomFingerprints,

  // Trace analysis
  analyzeTrace,

  // Events
  addTrackerEventListener,
  removeTrackerEventListener,

  // Types
  type ExecutionTrackerConfig,
  type SelectorStrategy,
  type TraceAnalysis,
  type ActionPattern,
  type PotentialParameter,
} from './execution-tracker.ts';

// ============================================================================
// Skill Generator
// ============================================================================

export {
  // Generator class
  SkillGenerator,
  createSkillGenerator,
  getDefaultSkillGenerator,

  // Generation helpers
  generateSkillFromTrace,
  validateTraceForSkillGeneration,
  estimateSkillComplexity,

  // Types
  type SkillGeneratorConfig,
} from './skill-generator.ts';

// ============================================================================
// Skill Matcher
// ============================================================================

export {
  // Matcher class
  SkillMatcher,
  createSkillMatcher,
  getDefaultSkillMatcher,
  resetDefaultMatcher,

  // Matching helpers
  matchIntent,
  findMatchingSkills,

  // Types
  type SkillMatcherConfig,
  type PageContext,
} from './skill-matcher.ts';

// ============================================================================
// Autonomous Decision Engine
// ============================================================================

export {
  // Engine class
  AutonomousDecisionEngine,
  createDecisionEngine,
  getDefaultDecisionEngine,

  // Decision helpers
  shouldCreateSkillFromTrace,
  runSkillMaintenance,

  // Events
  addDecisionEventListener,
  removeDecisionEventListener,

  // Types
  type DecisionEngineConfig,
  type FailureContext,
} from './autonomous-decision.ts';

// ============================================================================
// Hybrid Executor
// ============================================================================

export {
  // Executor class
  HybridExecutor,
  createExecutor,
  getDefaultExecutor,

  // Execution helpers
  executeTask,

  // Events
  addExecutorEventListener,
  removeExecutorEventListener,

  // Types
  type HybridExecutorConfig,
  type McpClientInterface,
} from './hybrid-executor.ts';

// ============================================================================
// Workflow Types
// ============================================================================

export type {
  // Core workflow types
  BrowserWorkflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  WorkflowMetadata,

  // Node configuration types
  SkillCallConfig,
  ConditionConfig,
  ConditionBranch,
  ParallelConfig,
  LoopNodeConfig,
  ClusterConfig,
  ClusterAggregation,
  HandoffConfig,
  TransformConfig,
  WaitNodeConfig,
  WorkflowCallConfig,

  // Execution types
  WorkflowExecutionContext,
  WorkflowExecutionResult,
  NodeExecutionResult,
  ClusterExecutionResult,

  // Generation types
  WorkflowSuggestion,
  SkillCallRecord,
  SimilarSkillGroup,
  EvolutionReport,

  // Storage types
  WorkflowIndex,
  WorkflowIndexEntry,
  WorkflowExecutionLogEntry,

  // Event types
  WorkflowEvent,
  WorkflowEventListener,
} from './workflow-types.ts';

// ============================================================================
// Workflow Storage
// ============================================================================

export {
  // Directory management
  ensureWorkflowDirectories,
  getWorkflowsDir,

  // Index management
  loadWorkflowIndex,
  saveWorkflowIndex,
  rebuildWorkflowIndex,

  // Workflow CRUD
  generateWorkflowId,
  createWorkflow,
  getWorkflow,
  updateWorkflow,
  deleteWorkflow,
  listWorkflows,
  listWorkflowsByTag,
  searchWorkflows,
  findMatchingWorkflows,

  // Statistics
  recordWorkflowExecution,
  deprecateWorkflow,
  getWorkflowStats,

  // Logging
  logWorkflowExecution,
  readWorkflowExecutionLogs,
  getWorkflowExecutionSummary,
  cleanOldWorkflowLogs,

  // Import/Export
  exportWorkflows,
  importWorkflows,

  // Utilities
  getWorkflowsUsingSkill,
  getWorkflowsForProfiles,
  cloneWorkflow,

  // Events
  addWorkflowEventListener,
  removeWorkflowEventListener,
} from './workflow-storage.ts';

// ============================================================================
// Workflow Engine
// ============================================================================

export {
  // Engine class
  WorkflowEngine,
  createWorkflowEngine,
  getDefaultWorkflowEngine,

  // Execution
  executeWorkflow,

  // Events
  addWorkflowEngineEventListener,
  removeWorkflowEngineEventListener,

  // Types
  type WorkflowEngineConfig,
  type McpClientProvider,
} from './workflow-engine.ts';

// ============================================================================
// Cluster Executor
// ============================================================================

export {
  // Executor class
  ClusterExecutor,
  createClusterExecutor,
  getDefaultClusterExecutor,

  // Execution
  executeSkillOnCluster,
  executeWorkflowOnCluster,

  // Events
  addClusterEventListener,
  removeClusterEventListener,

  // Types
  type ClusterExecutorConfig,
  type ClusterProgress,
  type ClusterTask,
  type ProfileExecutionResult,
} from './cluster-executor.ts';

// ============================================================================
// Workflow Generator
// ============================================================================

export {
  // Generator class
  WorkflowGenerator,
  createWorkflowGenerator,
  getDefaultWorkflowGenerator,

  // Generation
  analyzePatterns,
  generateWorkflowFromTrace as generateWorkflowFromExecutionTrace,

  // AI Creator - Natural Language to Workflow
  type WorkflowCreationContext,
  type WorkflowCreationResult,

  // Types
  type WorkflowGeneratorConfig,
} from './workflow-generator.ts';

// ============================================================================
// Expert Agents
// ============================================================================

export {
  // Expert configuration
  type ExpertAgentConfig,
  type ExpertKnowledge,
  type ExpertPattern,
  type PageSignature,
  type ErrorPattern,
  type ExpertUIConfig,
  type ExpertMatch,

  // Built-in experts
  BUILT_IN_EXPERTS,
  AMAZON_SELLER_EXPERT,
  SHOPEE_SELLER_EXPERT,
  DATA_ANALYST_EXPERT,
  SOCIAL_MEDIA_EXPERT,
  GENERAL_WEB_EXPERT,

  // Expert registry
  initializeExpertRegistry,
  getExpert,
  getAllExperts,
  registerExpert,
  unregisterExpert,

  // Expert matching
  findBestExpert,
  findApplicableExperts,

  // Expert system prompt
  generateExpertSystemPrompt,

  // Custom expert creation
  createCustomExpert,
  associateSkillsWithExpert,
  associateWorkflowsWithExpert,
} from './expert-agents.ts';

// ============================================================================
// Self-Evolving Agent
// ============================================================================

export {
  // Agent class
  SelfEvolvingAgent,
  createSelfEvolvingAgent,
  getDefaultSelfEvolvingAgent,

  // Evolution control
  startEvolution,
  stopEvolution,
  runEvolutionCycle,

  // Learning
  learnFromExecution,

  // Health
  getLibraryHealth,

  // Events
  addEvolutionEventListener,
  removeEvolutionEventListener,

  // Types
  type SelfEvolvingAgentConfig,
} from './self-evolving-agent.ts';

// ============================================================================
// Product Research Module
// ============================================================================

export {
  // Types
  type ProductData,
  type PartsData,
  type PartInfo,
  type ReviewData,
  type ReviewInfo,
  type QuestionInfo,
  type KeywordData,
  type KeywordSuggestion,
  type AnalysisReport,
  type PartOpportunity,
  type PainPoint,
  type KeywordRecommendation,
  type CompetitionSummary,
  type ResearchSession,
  type ResearchResults,
  type ResearchStats,
  type ResearchPlatform,

  // Directory utilities
  ensureResearchDirectories,
  getResearchDataDir,

  // Session management
  createResearchSession,
  getResearchSession,
  getSessionDir,
  updateSessionStatus,
  saveSessionConfig,
  loadSessionConfig,
  listResearchSessions,

  // Products
  saveProducts,
  loadProducts,

  // Parts
  saveParts,
  loadParts,

  // Reviews
  saveReviews,
  loadReviews,

  // Keywords
  saveKeywords,
  loadKeywords,

  // Analysis
  saveAnalysisReport,
  loadAnalysisReport,
  generateReportMarkdown,

  // CSV Export
  exportProductsToCSV,
  exportPartsMatrixToCSV,
  exportKeywordsToCSV,
  exportCompetitionToCSV,

  // Statistics
  calculateResearchStats,

  // Expert agent
  PRODUCT_RESEARCH_EXPERT,

  // Skills
  HOMEDEPOT_SEARCH_SKILL,
  HOMEDEPOT_PRODUCT_DETAIL_SKILL,
  HOMEDEPOT_EXTRACT_REVIEWS_SKILL,
  HOMEDEPOT_SKILLS,
  GOOGLE_SEARCH_SUGGESTIONS_SKILL,
  GOOGLE_PEOPLE_ALSO_ASK_SKILL,
  GOOGLE_KEYWORD_SKILLS,
  AMAZON_SEARCH_SUGGESTIONS_SKILL,
  AMAZON_SEARCH_PRODUCTS_SKILL,
  AMAZON_KEYWORD_SKILLS,
  ALL_RESEARCH_SKILLS,

  // Data analyzer
  generateAnalysisPrompt,
  generateFocusedPrompt,
  parseAnalysisResponse,
  createFallbackReport,

  // Workflows
  PRODUCT_RESEARCH_WORKFLOW,
  PARTS_RESEARCH_WORKFLOW,
  KEYWORD_MINING_WORKFLOW,
  RESEARCH_WORKFLOWS,
  ALL_RESEARCH_WORKFLOWS,
} from './research/index.ts';

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Initialize the browser skills system
 * Creates necessary directories and loads the index
 */
export function initializeBrowserSkills(): void {
  const { ensureDirectories, loadIndex } = require('./skill-storage.ts');
  ensureDirectories();
  loadIndex();
}

/**
 * Get the health of the browser skills library
 */
export function getBrowserSkillsHealth(): {
  totalSkills: number;
  healthySkills: number;
  warningSkills: number;
  criticalSkills: number;
  averageSuccessRate: number;
  recommendations: string[];
} {
  const { getDefaultDecisionEngine } = require('./autonomous-decision.ts');
  return getDefaultDecisionEngine().getLibraryHealth();
}

/**
 * Run maintenance on the browser skills library
 * Deprecates failing skills and cleans up old ones
 */
export function runBrowserSkillsMaintenance(): {
  deprecated: number;
  deleted: number;
} {
  const { runSkillMaintenance } = require('./autonomous-decision.ts');
  return runSkillMaintenance();
}

/**
 * Create a workflow from natural language description (AI Creator)
 *
 * This is the primary entry point for the "AI Creator" functionality
 * that allows users to describe workflows in plain language.
 *
 * @example
 * ```typescript
 * const result = await createWorkflowFromDescription(
 *   "Download last 7 days advertising report from all my Amazon stores",
 *   { profiles: ['amazon-us', 'amazon-uk', 'amazon-de'] }
 * );
 *
 * if (result.success) {
 *   console.log('Created workflow:', result.workflow.name);
 * }
 * ```
 */
export async function createWorkflowFromDescription(
  description: string,
  context?: {
    profiles?: string[];
    domain?: string;
    saveToStorage?: boolean;
  }
): Promise<{
  success: boolean;
  workflow?: import('./workflow-types.ts').BrowserWorkflow;
  error?: string;
  suggestions?: string[];
}> {
  const { getDefaultWorkflowGenerator } = require('./workflow-generator.ts');
  return getDefaultWorkflowGenerator().createFromDescription(description, context);
}

/**
 * Get the best expert agent for a given URL and intent
 *
 * @example
 * ```typescript
 * const expert = getExpertForContext(
 *   'https://sellercentral.amazon.com/inventory',
 *   'download inventory report'
 * );
 *
 * if (expert) {
 *   console.log('Using expert:', expert.expert.name);
 *   const enhancedPrompt = generateExpertSystemPrompt(expert.expert);
 * }
 * ```
 */
export function getExpertForContext(
  url: string,
  intent?: string
): import('./expert-agents.ts').ExpertMatch | null {
  const { findBestExpert } = require('./expert-agents.ts');
  return findBestExpert(url, intent);
}

// ============================================================================
// Scheduler Re-exports
// ============================================================================

export {
  // Types
  type TriggerType,
  type TriggerConfig,
  type CronTriggerConfig,
  type IntervalTriggerConfig,
  type EventTriggerConfig,
  type ScheduledTask,
  type ScheduleExecution,
  type ScheduleEvent,
  type ScheduleEventListener,
  type ScheduleEngineConfig,
  type ScheduleEngineStatus,

  // Storage
  createSchedule,
  getSchedule,
  updateSchedule,
  deleteSchedule,
  listSchedules,
  enableSchedule,
  disableSchedule,
  getScheduleStats,
  getExecutionLogs,

  // Engine
  ScheduleEngine,
  createScheduleEngine,
  getDefaultScheduleEngine,
  initializeScheduleEngine,
  shutdownScheduleEngine,
  triggerSchedule,

  // Triggers
  getNextCronTime,
  isValidCronExpression,
  describeCronExpression,
  createIntervalConfig,
  parseInterval,
  createEventConfig,

  // Convenience
  createCronSchedule,
  createIntervalSchedule,
  getUpcomingSchedules,
  getFailingSchedules,
} from '../scheduler/index.ts';
