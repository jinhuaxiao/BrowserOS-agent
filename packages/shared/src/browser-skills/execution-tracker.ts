/**
 * Execution Tracker
 *
 * Records all browser operations during task execution for later
 * conversion into reusable skills. Captures MCP tool calls, DOM
 * interactions, and navigation events.
 *
 * Key features:
 * - Records all MCP tool calls with arguments and results
 * - Tracks DOM element interactions with multiple selector strategies
 * - Captures before/after screenshots at key moments
 * - Generates execution traces for skill creation
 */

import type {
  RecordedAction,
  RecordedActionType,
  ElementInfo,
  ExecutionTrace,
  DomSnapshot,
  BrowserSkillEvent,
  BrowserSkillEventListener,
} from './types.ts';

// ============================================================================
// Event System
// ============================================================================

const eventListeners = new Set<BrowserSkillEventListener>();

/**
 * Add event listener
 */
export function addTrackerEventListener(listener: BrowserSkillEventListener): void {
  eventListeners.add(listener);
}

/**
 * Remove event listener
 */
export function removeTrackerEventListener(listener: BrowserSkillEventListener): void {
  eventListeners.delete(listener);
}

/**
 * Emit event to all listeners
 */
function emit(event: BrowserSkillEvent): void {
  for (const listener of eventListeners) {
    try {
      listener(event);
    } catch (err) {
      console.error('[ExecutionTracker] Event listener error:', err);
    }
  }
}

// ============================================================================
// Execution Tracker Class
// ============================================================================

/**
 * Configuration for execution tracker
 */
export interface ExecutionTrackerConfig {
  /** Whether to capture screenshots */
  captureScreenshots?: boolean;

  /** Whether to capture DOM snapshots */
  captureDomSnapshots?: boolean;

  /** Maximum number of actions to record */
  maxActions?: number;

  /** Selector generation strategies to use */
  selectorStrategies?: SelectorStrategy[];
}

/**
 * Selector generation strategy
 */
export type SelectorStrategy =
  | 'id'
  | 'data-testid'
  | 'aria-label'
  | 'class'
  | 'tag-text'
  | 'xpath'
  | 'nth-child';

/**
 * Default selector strategies in priority order
 */
const DEFAULT_SELECTOR_STRATEGIES: SelectorStrategy[] = [
  'id',
  'data-testid',
  'aria-label',
  'class',
  'tag-text',
  'xpath',
];

/**
 * Execution Tracker
 *
 * Records browser operations for skill generation.
 */
export class ExecutionTracker {
  private traceId: string;
  private taskDescription: string;
  private startUrl: string;
  private actions: RecordedAction[] = [];
  private domSnapshots: DomSnapshot[] = [];
  private isRecording: boolean = false;
  private startTime: number = 0;
  private config: Required<ExecutionTrackerConfig>;
  private profileId?: string;

  constructor(config: ExecutionTrackerConfig = {}) {
    this.traceId = this.generateTraceId();
    this.taskDescription = '';
    this.startUrl = '';
    this.config = {
      captureScreenshots: config.captureScreenshots ?? false,
      captureDomSnapshots: config.captureDomSnapshots ?? true,
      maxActions: config.maxActions ?? 500,
      selectorStrategies: config.selectorStrategies ?? DEFAULT_SELECTOR_STRATEGIES,
    };
  }

  /**
   * Generate a unique trace ID
   */
  private generateTraceId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `trace_${timestamp}_${random}`;
  }

  /**
   * Generate a unique action ID
   */
  private generateActionId(): string {
    return `action_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  }

  /**
   * Start recording a new execution trace
   */
  startRecording(taskDescription: string, startUrl: string, profileId?: string): void {
    this.traceId = this.generateTraceId();
    this.taskDescription = taskDescription;
    this.startUrl = startUrl;
    this.profileId = profileId;
    this.actions = [];
    this.domSnapshots = [];
    this.startTime = Date.now();
    this.isRecording = true;

    emit({ type: 'recording_started', traceId: this.traceId });
  }

  /**
   * Stop recording and return the execution trace
   */
  stopRecording(success: boolean): ExecutionTrace {
    this.isRecording = false;

    const lastAction = this.actions[this.actions.length - 1];
    const endUrl = lastAction ? lastAction.url : this.startUrl;

    const trace: ExecutionTrace = {
      id: this.traceId,
      taskDescription: this.taskDescription,
      startUrl: this.startUrl,
      endUrl,
      actions: this.actions,
      durationMs: Date.now() - this.startTime,
      success,
      profileId: this.profileId,
      timestamp: this.startTime,
      domSnapshots: this.domSnapshots,
    };

    emit({ type: 'recording_completed', traceId: this.traceId, trace });

    return trace;
  }

  /**
   * Check if currently recording
   */
  isActive(): boolean {
    return this.isRecording;
  }

  /**
   * Get current trace ID
   */
  getTraceId(): string {
    return this.traceId;
  }

  /**
   * Get recorded action count
   */
  getActionCount(): number {
    return this.actions.length;
  }

  /**
   * Record a click action
   */
  recordClick(
    url: string,
    selector: string,
    elementInfo?: ElementInfo,
    options?: {
      alternativeSelectors?: string[];
      title?: string;
      screenshotBefore?: string;
      screenshotAfter?: string;
    }
  ): RecordedAction {
    return this.recordAction({
      type: 'click',
      url,
      selector,
      elementInfo,
      ...options,
    });
  }

  /**
   * Record a type action
   */
  recordType(
    url: string,
    selector: string,
    value: string,
    elementInfo?: ElementInfo,
    options?: {
      alternativeSelectors?: string[];
      title?: string;
    }
  ): RecordedAction {
    return this.recordAction({
      type: 'type',
      url,
      selector,
      value,
      elementInfo,
      ...options,
    });
  }

  /**
   * Record a select action
   */
  recordSelect(
    url: string,
    selector: string,
    value: string,
    elementInfo?: ElementInfo,
    options?: {
      alternativeSelectors?: string[];
      title?: string;
    }
  ): RecordedAction {
    return this.recordAction({
      type: 'select',
      url,
      selector,
      value,
      elementInfo,
      ...options,
    });
  }

  /**
   * Record a scroll action
   */
  recordScroll(
    url: string,
    direction: 'up' | 'down' | 'left' | 'right',
    amount?: number,
    options?: { title?: string }
  ): RecordedAction {
    return this.recordAction({
      type: 'scroll',
      url,
      value: `${direction}:${amount || 'page'}`,
      ...options,
    });
  }

  /**
   * Record a navigation action
   */
  recordNavigation(
    url: string,
    targetUrl: string,
    options?: { title?: string }
  ): RecordedAction {
    return this.recordAction({
      type: 'navigate',
      url,
      value: targetUrl,
      ...options,
    });
  }

  /**
   * Record a wait action
   */
  recordWait(
    url: string,
    waitType: 'time' | 'selector' | 'navigation',
    value: string,
    options?: { title?: string; durationMs?: number }
  ): RecordedAction {
    return this.recordAction({
      type: 'wait',
      url,
      value: `${waitType}:${value}`,
      durationMs: options?.durationMs,
      ...options,
    });
  }

  /**
   * Record an MCP tool call
   */
  recordMcpCall(
    url: string,
    toolName: string,
    args: Record<string, unknown>,
    result?: unknown,
    options?: {
      success?: boolean;
      error?: string;
      durationMs?: number;
      title?: string;
    }
  ): RecordedAction {
    return this.recordAction({
      type: 'mcp_call',
      url,
      mcpTool: toolName,
      mcpArgs: args,
      mcpResult: result,
      success: options?.success ?? true,
      error: options?.error,
      durationMs: options?.durationMs,
      title: options?.title,
    });
  }

  /**
   * Record a data extraction action
   */
  recordExtract(
    url: string,
    selector: string,
    extractedValue: string,
    options?: {
      elementInfo?: ElementInfo;
      alternativeSelectors?: string[];
      title?: string;
    }
  ): RecordedAction {
    return this.recordAction({
      type: 'extract',
      url,
      selector,
      value: extractedValue,
      ...options,
    });
  }

  /**
   * Record a download action
   */
  recordDownload(
    url: string,
    downloadUrl: string,
    filename?: string,
    options?: { title?: string }
  ): RecordedAction {
    return this.recordAction({
      type: 'download',
      url,
      value: downloadUrl,
      ...options,
    });
  }

  /**
   * Record an upload action
   */
  recordUpload(
    url: string,
    selector: string,
    filePath: string,
    options?: {
      elementInfo?: ElementInfo;
      title?: string;
    }
  ): RecordedAction {
    return this.recordAction({
      type: 'upload',
      url,
      selector,
      value: filePath,
      ...options,
    });
  }

  /**
   * Record a screenshot action
   */
  recordScreenshot(
    url: string,
    screenshotPath: string,
    options?: { title?: string }
  ): RecordedAction {
    return this.recordAction({
      type: 'screenshot',
      url,
      value: screenshotPath,
      ...options,
    });
  }

  /**
   * Record a generic action
   */
  private recordAction(action: {
    type: RecordedActionType;
    url: string;
    selector?: string;
    value?: string;
    elementInfo?: ElementInfo;
    alternativeSelectors?: string[];
    title?: string;
    screenshotBefore?: string;
    screenshotAfter?: string;
    mcpTool?: string;
    mcpArgs?: Record<string, unknown>;
    mcpResult?: unknown;
    success?: boolean;
    error?: string;
    durationMs?: number;
  }): RecordedAction {
    if (!this.isRecording) {
      throw new Error('ExecutionTracker is not recording');
    }

    if (this.actions.length >= this.config.maxActions) {
      throw new Error(`Maximum actions (${this.config.maxActions}) reached`);
    }

    const recordedAction: RecordedAction = {
      id: this.generateActionId(),
      type: action.type,
      timestamp: Date.now(),
      url: action.url,
      selector: action.selector,
      alternativeSelectors: action.alternativeSelectors,
      value: action.value,
      title: action.title,
      elementInfo: action.elementInfo,
      mcpTool: action.mcpTool,
      mcpArgs: action.mcpArgs,
      mcpResult: action.mcpResult,
      screenshotBefore: action.screenshotBefore,
      screenshotAfter: action.screenshotAfter,
      durationMs: action.durationMs,
      success: action.success ?? true,
      error: action.error,
    };

    this.actions.push(recordedAction);
    emit({ type: 'recording_action', traceId: this.traceId, action: recordedAction });

    return recordedAction;
  }

  /**
   * Add a DOM snapshot
   */
  addDomSnapshot(snapshot: Omit<DomSnapshot, 'id' | 'timestamp'>): DomSnapshot {
    const fullSnapshot: DomSnapshot = {
      ...snapshot,
      id: `snapshot_${Date.now().toString(36)}`,
      timestamp: Date.now(),
    };

    this.domSnapshots.push(fullSnapshot);
    return fullSnapshot;
  }

  /**
   * Get the current execution trace (in progress)
   */
  getCurrentTrace(): Partial<ExecutionTrace> {
    return {
      id: this.traceId,
      taskDescription: this.taskDescription,
      startUrl: this.startUrl,
      actions: this.actions,
      durationMs: Date.now() - this.startTime,
      profileId: this.profileId,
      timestamp: this.startTime,
      domSnapshots: this.domSnapshots,
    };
  }

  /**
   * Get all recorded actions
   */
  getActions(): RecordedAction[] {
    return [...this.actions];
  }

  /**
   * Get actions by type
   */
  getActionsByType(type: RecordedActionType): RecordedAction[] {
    return this.actions.filter((a) => a.type === type);
  }

  /**
   * Get MCP calls
   */
  getMcpCalls(): RecordedAction[] {
    return this.getActionsByType('mcp_call');
  }

  /**
   * Clear all recorded data
   */
  clear(): void {
    this.actions = [];
    this.domSnapshots = [];
    this.isRecording = false;
  }
}

// ============================================================================
// Selector Generation Utilities
// ============================================================================

/**
 * Generate multiple selector strategies for an element
 */
export function generateSelectors(
  elementInfo: ElementInfo,
  strategies: SelectorStrategy[] = DEFAULT_SELECTOR_STRATEGIES
): string[] {
  const selectors: string[] = [];

  for (const strategy of strategies) {
    const selector = generateSelector(elementInfo, strategy);
    if (selector && !selectors.includes(selector)) {
      selectors.push(selector);
    }
  }

  return selectors;
}

/**
 * Generate a single selector using a specific strategy
 */
export function generateSelector(
  elementInfo: ElementInfo,
  strategy: SelectorStrategy
): string | null {
  switch (strategy) {
    case 'id':
      if (elementInfo.id) {
        return `#${escapeSelector(elementInfo.id)}`;
      }
      break;

    case 'data-testid':
      if (elementInfo.dataAttributes?.['testid']) {
        return `[data-testid="${elementInfo.dataAttributes['testid']}"]`;
      }
      if (elementInfo.dataAttributes?.['test-id']) {
        return `[data-test-id="${elementInfo.dataAttributes['test-id']}"]`;
      }
      break;

    case 'aria-label':
      if (elementInfo.ariaLabel) {
        return `[aria-label="${escapeAttributeValue(elementInfo.ariaLabel)}"]`;
      }
      break;

    case 'class':
      if (elementInfo.classNames && elementInfo.classNames.length > 0) {
        // Use the most specific class (longest, non-generated looking)
        const goodClasses = elementInfo.classNames
          .filter((c) => !looksGenerated(c))
          .sort((a, b) => b.length - a.length);

        const firstGoodClass = goodClasses[0];
        if (firstGoodClass) {
          const tagName = elementInfo.tagName.toLowerCase();
          return `${tagName}.${escapeSelector(firstGoodClass)}`;
        }
      }
      break;

    case 'tag-text':
      if (elementInfo.textContent && elementInfo.textContent.length < 50) {
        const tagName = elementInfo.tagName.toLowerCase();
        const text = elementInfo.textContent.trim();
        // Use contains for partial match
        return `${tagName}:contains("${escapeAttributeValue(text)}")`;
      }
      break;

    case 'xpath':
      // Generate basic XPath
      if (elementInfo.id) {
        return `//*[@id="${elementInfo.id}"]`;
      }
      if (elementInfo.ariaLabel) {
        return `//*[@aria-label="${elementInfo.ariaLabel}"]`;
      }
      break;

    case 'nth-child':
      // This strategy requires parent context, skip for now
      break;
  }

  return null;
}

/**
 * Check if a class name looks auto-generated
 */
function looksGenerated(className: string): boolean {
  // Heuristics for generated class names
  return (
    /^[a-z]{1,2}[0-9]+$/i.test(className) || // e.g., "a1b2c3"
    /^[a-f0-9]{8,}$/i.test(className) || // Hash-like
    /^css-[a-z0-9]+$/i.test(className) || // CSS-in-JS
    /^sc-[a-z0-9]+$/i.test(className) || // Styled components
    /^_[a-z0-9]+$/i.test(className) || // Private-looking
    /^[A-Z][a-z]+_[a-z0-9]+$/i.test(className) // Module CSS
  );
}

/**
 * Escape a selector string
 */
function escapeSelector(str: string): string {
  return str.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

/**
 * Escape an attribute value
 */
function escapeAttributeValue(str: string): string {
  return str.replace(/"/g, '\\"');
}

// ============================================================================
// DOM Fingerprinting
// ============================================================================

/**
 * Generate a DOM fingerprint for a page
 */
export function generateDomFingerprint(keySelectors: string[]): string {
  // Simple hash based on key selectors
  const content = keySelectors.sort().join('|');
  return simpleHash(content);
}

/**
 * Simple string hash function
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Compare DOM fingerprints to estimate stability
 */
export function compareDomFingerprints(
  fingerprint1: string,
  fingerprint2: string
): number {
  // Returns 1 if identical, 0 if completely different
  return fingerprint1 === fingerprint2 ? 1 : 0;
}

// ============================================================================
// Trace Analysis
// ============================================================================

/**
 * Analyze an execution trace for patterns
 */
export function analyzeTrace(trace: ExecutionTrace): TraceAnalysis {
  const actions = trace.actions;

  // Count action types
  const actionTypeCounts: Record<string, number> = {};
  for (const action of actions) {
    actionTypeCounts[action.type] = (actionTypeCounts[action.type] || 0) + 1;
  }

  // Identify repeated patterns
  const patterns = identifyPatterns(actions);

  // Identify potential parameters (typed values that look like user input)
  const potentialParams = identifyPotentialParameters(actions);

  // Extract unique domains
  const domains = new Set(actions.map((a) => new URL(a.url).hostname));

  // Calculate complexity score
  const complexity = calculateComplexity(actions);

  return {
    actionCount: actions.length,
    actionTypeCounts,
    patterns,
    potentialParams,
    domains: Array.from(domains),
    complexity,
    estimatedDuration: trace.durationMs,
    success: trace.success,
  };
}

/**
 * Trace analysis result
 */
export interface TraceAnalysis {
  actionCount: number;
  actionTypeCounts: Record<string, number>;
  patterns: ActionPattern[];
  potentialParams: PotentialParameter[];
  domains: string[];
  complexity: number;
  estimatedDuration: number;
  success: boolean;
}

/**
 * Identified action pattern
 */
export interface ActionPattern {
  /** Pattern type */
  type: 'sequence' | 'loop' | 'conditional';

  /** Starting index */
  startIndex: number;

  /** Ending index */
  endIndex: number;

  /** Number of repetitions (for loops) */
  repetitions?: number;

  /** Description */
  description: string;
}

/**
 * Potential parameter identified from trace
 */
export interface PotentialParameter {
  /** Action ID where parameter was used */
  actionId: string;

  /** Suggested parameter name */
  name: string;

  /** Value used in the trace */
  value: string;

  /** Suggested type */
  type: 'string' | 'number' | 'date' | 'email' | 'url';

  /** Confidence score */
  confidence: number;
}

/**
 * Identify repeated patterns in actions
 */
function identifyPatterns(actions: RecordedAction[]): ActionPattern[] {
  const patterns: ActionPattern[] = [];

  // Look for simple sequences that repeat
  for (let windowSize = 2; windowSize <= Math.min(10, actions.length / 2); windowSize++) {
    for (let i = 0; i < actions.length - windowSize * 2 + 1; i++) {
      const pattern = actions.slice(i, i + windowSize);
      let repetitions = 1;
      let j = i + windowSize;

      while (j + windowSize <= actions.length) {
        const candidate = actions.slice(j, j + windowSize);
        if (patternsMatch(pattern, candidate)) {
          repetitions++;
          j += windowSize;
        } else {
          break;
        }
      }

      if (repetitions >= 2) {
        patterns.push({
          type: 'loop',
          startIndex: i,
          endIndex: i + windowSize * repetitions - 1,
          repetitions,
          description: `Loop of ${windowSize} actions repeated ${repetitions} times`,
        });
        // Skip over this pattern
        break;
      }
    }
  }

  return patterns;
}

/**
 * Check if two action sequences match (structurally)
 */
function patternsMatch(
  pattern1: RecordedAction[],
  pattern2: RecordedAction[]
): boolean {
  if (pattern1.length !== pattern2.length) return false;

  for (let i = 0; i < pattern1.length; i++) {
    const p1 = pattern1[i];
    const p2 = pattern2[i];
    if (!p1 || !p2) return false;
    if (p1.type !== p2.type) return false;
    if (p1.selector !== p2.selector) return false;
  }

  return true;
}

/**
 * Identify potential parameters from typed values
 */
function identifyPotentialParameters(
  actions: RecordedAction[]
): PotentialParameter[] {
  const params: PotentialParameter[] = [];

  for (const action of actions) {
    if (action.type === 'type' && action.value) {
      const param = analyzeTypedValue(action.id, action.value, action.elementInfo);
      if (param) {
        params.push(param);
      }
    }
  }

  return params;
}

/**
 * Analyze a typed value to determine if it should be a parameter
 */
function analyzeTypedValue(
  actionId: string,
  value: string,
  elementInfo?: ElementInfo
): PotentialParameter | null {
  // Check for email pattern
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return {
      actionId,
      name: suggestParamName(elementInfo, 'email'),
      value,
      type: 'email',
      confidence: 0.9,
    };
  }

  // Check for URL pattern
  if (/^https?:\/\//.test(value)) {
    return {
      actionId,
      name: suggestParamName(elementInfo, 'url'),
      value,
      type: 'url',
      confidence: 0.9,
    };
  }

  // Check for date pattern
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(value)) {
    return {
      actionId,
      name: suggestParamName(elementInfo, 'date'),
      value,
      type: 'date',
      confidence: 0.8,
    };
  }

  // Check for number pattern
  if (/^\d+(\.\d+)?$/.test(value)) {
    return {
      actionId,
      name: suggestParamName(elementInfo, 'number'),
      value,
      type: 'number',
      confidence: 0.7,
    };
  }

  // Generic text - only parameterize if it looks like user input
  if (value.length > 3 && value.length < 100) {
    // Check if the element looks like a search/input field
    if (
      elementInfo?.placeholder ||
      elementInfo?.ariaLabel?.toLowerCase().includes('search') ||
      elementInfo?.ariaLabel?.toLowerCase().includes('input')
    ) {
      return {
        actionId,
        name: suggestParamName(elementInfo, 'text'),
        value,
        type: 'string',
        confidence: 0.6,
      };
    }
  }

  return null;
}

/**
 * Suggest a parameter name based on element info
 */
function suggestParamName(
  elementInfo: ElementInfo | undefined,
  fallbackType: string
): string {
  if (elementInfo?.ariaLabel) {
    return toCamelCase(elementInfo.ariaLabel);
  }
  if (elementInfo?.placeholder) {
    return toCamelCase(elementInfo.placeholder);
  }
  if (elementInfo?.id) {
    return toCamelCase(elementInfo.id);
  }
  return fallbackType;
}

/**
 * Convert string to camelCase
 */
function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Calculate complexity score for a trace
 */
function calculateComplexity(actions: RecordedAction[]): number {
  // Base complexity from action count
  let complexity = actions.length;

  // Add complexity for different action types
  const typeWeights: Record<string, number> = {
    click: 1,
    type: 1.5,
    select: 1.5,
    navigate: 2,
    wait: 0.5,
    scroll: 0.5,
    extract: 2,
    mcp_call: 2,
    download: 3,
    upload: 3,
  };

  for (const action of actions) {
    complexity += (typeWeights[action.type] || 1) - 1;
  }

  // Add complexity for multiple domains
  const domains = new Set(actions.map((a) => new URL(a.url).hostname));
  complexity += (domains.size - 1) * 3;

  return Math.round(complexity);
}

// ============================================================================
// Singleton Tracker
// ============================================================================

let defaultTracker: ExecutionTracker | null = null;

/**
 * Get the default execution tracker
 */
export function getDefaultTracker(): ExecutionTracker {
  if (!defaultTracker) {
    defaultTracker = new ExecutionTracker();
  }
  return defaultTracker;
}

/**
 * Create a new execution tracker with custom config
 */
export function createTracker(config?: ExecutionTrackerConfig): ExecutionTracker {
  return new ExecutionTracker(config);
}

/**
 * Reset the default tracker
 */
export function resetDefaultTracker(): void {
  if (defaultTracker) {
    defaultTracker.clear();
  }
  defaultTracker = null;
}
