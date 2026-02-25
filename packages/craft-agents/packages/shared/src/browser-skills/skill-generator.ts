/**
 * Skill Generator
 *
 * Converts recorded execution traces into reusable BrowserSkill definitions.
 * Optimizes selectors, identifies parameters, and creates robust step sequences.
 *
 * Key features:
 * - Converts execution traces to skill definitions
 * - Optimizes selectors for stability
 * - Parameterizes dynamic values
 * - Detects and handles loops
 * - Generates fallback selectors
 */

import type {
  BrowserSkill,
  SkillStep,
  SkillParameter,
  SkillTriggers,
  SkillStepType,
  DynamicValue,
  WaitCondition,
  ErrorHandler,
  ExecutionTrace,
  RecordedAction,
  ElementInfo,
} from './types.ts';
import {
  analyzeTrace,
  generateSelectors,
  generateDomFingerprint,
  type TraceAnalysis,
  type PotentialParameter,
  type ActionPattern,
} from './execution-tracker.ts';
import { createSkill, generateSkillId } from './skill-storage.ts';

// ============================================================================
// Skill Generator Configuration
// ============================================================================

/**
 * Configuration for skill generation
 */
export interface SkillGeneratorConfig {
  /** Minimum confidence for parameter extraction */
  minParamConfidence?: number;

  /** Whether to include wait steps between actions */
  includeWaitSteps?: boolean;

  /** Default timeout for wait conditions */
  defaultTimeout?: number;

  /** Error handling strategy */
  defaultErrorHandler?: ErrorHandler;

  /** Whether to generate alternative selectors */
  generateAlternatives?: boolean;

  /** Maximum alternative selectors per step */
  maxAlternativeSelectors?: number;
}

const DEFAULT_CONFIG: Required<SkillGeneratorConfig> = {
  minParamConfidence: 0.6,
  includeWaitSteps: true,
  defaultTimeout: 10000,
  defaultErrorHandler: {
    strategy: 'retry',
    retries: 2,
    retryDelay: 1000,
    logError: true,
  },
  generateAlternatives: true,
  maxAlternativeSelectors: 3,
};

// ============================================================================
// Skill Generator Class
// ============================================================================

/**
 * Skill Generator
 *
 * Transforms execution traces into reusable skills.
 */
export class SkillGenerator {
  private config: Required<SkillGeneratorConfig>;

  constructor(config: SkillGeneratorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate a skill from an execution trace
   */
  generateSkill(
    trace: ExecutionTrace,
    options?: {
      name?: string;
      description?: string;
      tags?: string[];
      saveToStorage?: boolean;
    }
  ): BrowserSkill {
    // Analyze the trace
    const analysis = analyzeTrace(trace);

    // Extract domain
    const domain = this.extractDomain(trace);

    // Generate triggers
    const triggers = this.generateTriggers(trace, analysis);

    // Generate parameters
    const parameters = this.generateParameters(analysis.potentialParams);

    // Generate steps
    const steps = this.generateSteps(trace, analysis, parameters);

    // Generate DOM fingerprint
    const domFingerprint = this.generateFingerprint(trace);

    // Create skill definition
    const skillData: Omit<BrowserSkill, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'executionCount' | 'consecutiveFailures' | 'successRate'> = {
      name: options?.name || this.generateName(trace),
      description: options?.description || this.generateDescription(trace, analysis),
      domain,
      triggers,
      steps,
      parameters: parameters.length > 0 ? parameters : undefined,
      createdBy: 'agent',
      fallbackToVision: true,
      tags: options?.tags,
      domFingerprint,
    };

    // Optionally save to storage
    if (options?.saveToStorage !== false) {
      return createSkill(skillData);
    }

    // Return without saving
    const now = Date.now();
    return {
      ...skillData,
      id: generateSkillId(),
      version: 1,
      successRate: 1.0,
      executionCount: 0,
      consecutiveFailures: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Extract primary domain from trace
   */
  private extractDomain(trace: ExecutionTrace): string {
    try {
      const url = new URL(trace.startUrl);
      return url.hostname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Generate skill triggers from trace
   */
  private generateTriggers(
    trace: ExecutionTrace,
    analysis: TraceAnalysis
  ): SkillTriggers {
    const triggers: SkillTriggers = {};

    // URL pattern trigger
    try {
      const url = new URL(trace.startUrl);
      // Create a pattern that matches the domain and path structure
      const pathPattern = url.pathname
        .replace(/\/\d+/g, '/\\d+') // Replace numeric IDs with pattern
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape special chars
      triggers.urlPattern = `^https?://${url.hostname}${pathPattern}`;
    } catch {
      // Skip URL pattern if URL parsing fails
    }

    // Intent patterns from task description
    if (trace.taskDescription) {
      triggers.intentPatterns = this.extractIntentPatterns(trace.taskDescription);
    }

    // Page signature from key selectors
    const keySelectors = this.extractKeySelectors(trace);
    if (keySelectors.length > 0) {
      triggers.pageSignature = keySelectors.slice(0, 5);
    }

    triggers.minConfidence = 0.7;

    return triggers;
  }

  /**
   * Extract intent patterns from task description
   */
  private extractIntentPatterns(description: string): string[] {
    const patterns: string[] = [];

    // Extract key action words
    const actionWords = [
      'download', 'upload', 'login', 'logout', 'search', 'filter',
      'sort', 'create', 'delete', 'edit', 'update', 'submit', 'save',
      'export', 'import', 'refresh', 'check', 'verify', 'navigate',
    ];

    const lowerDesc = description.toLowerCase();
    for (const action of actionWords) {
      if (lowerDesc.includes(action)) {
        patterns.push(`.*${action}.*`);
      }
    }

    // Add the full description as a pattern
    const simplifiedDesc = description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
    if (simplifiedDesc.length > 5) {
      patterns.push(`.*${simplifiedDesc.split(/\s+/).join('.*')}.*`);
    }

    return patterns.slice(0, 5);
  }

  /**
   * Extract key selectors that identify the page
   */
  private extractKeySelectors(trace: ExecutionTrace): string[] {
    const selectors = new Set<string>();

    // Get selectors from first few actions
    for (const action of trace.actions.slice(0, 10)) {
      if (action.selector) {
        selectors.add(action.selector);
      }
    }

    return Array.from(selectors);
  }

  /**
   * Generate parameters from potential parameters
   */
  private generateParameters(
    potentialParams: PotentialParameter[]
  ): SkillParameter[] {
    const parameters: SkillParameter[] = [];
    const usedNames = new Set<string>();

    for (const param of potentialParams) {
      if (param.confidence < this.config.minParamConfidence) continue;

      // Ensure unique name
      let name = param.name;
      let counter = 1;
      while (usedNames.has(name)) {
        name = `${param.name}${counter}`;
        counter++;
      }
      usedNames.add(name);

      parameters.push({
        name,
        label: this.formatLabel(name),
        description: `Value for ${name}`,
        type: param.type === 'email' || param.type === 'url' ? 'string' : param.type,
        required: true,
        defaultValue: param.value,
        pattern: this.getValidationPattern(param.type),
      });
    }

    return parameters;
  }

  /**
   * Format a label from a parameter name
   */
  private formatLabel(name: string): string {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
  }

  /**
   * Get validation pattern for a type
   */
  private getValidationPattern(type: string): string | undefined {
    switch (type) {
      case 'email':
        return '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$';
      case 'url':
        return '^https?://.*';
      case 'date':
        return '^\\d{4}-\\d{2}-\\d{2}$';
      default:
        return undefined;
    }
  }

  /**
   * Generate steps from execution trace
   */
  private generateSteps(
    trace: ExecutionTrace,
    analysis: TraceAnalysis,
    parameters: SkillParameter[]
  ): SkillStep[] {
    const steps: SkillStep[] = [];
    const paramMap = new Map(parameters.map((p) => [p.defaultValue as string, p.name]));

    // Process actions, handling patterns
    let i = 0;
    while (i < trace.actions.length) {
      const action = trace.actions[i];
      if (!action) {
        i++;
        continue;
      }

      // Check if this action is part of a loop pattern
      const loopPattern = analysis.patterns.find(
        (p) => p.type === 'loop' && p.startIndex === i
      );

      if (loopPattern && loopPattern.repetitions) {
        // Generate loop step
        const loopSteps = this.generateStepsFromActions(
          trace.actions.slice(i, i + Math.ceil((loopPattern.endIndex - loopPattern.startIndex + 1) / loopPattern.repetitions)),
          paramMap
        );

        steps.push({
          id: this.generateStepId(),
          type: 'loop',
          description: loopPattern.description,
          loop: {
            type: 'count',
            count: loopPattern.repetitions,
            maxIterations: loopPattern.repetitions * 2,
          },
          nestedSteps: loopSteps,
          onError: this.config.defaultErrorHandler,
        });

        i = loopPattern.endIndex + 1;
        continue;
      }

      // Generate regular step
      const step = this.actionToStep(action, paramMap);
      if (step) {
        steps.push(step);
      }

      // Add wait step if needed
      const nextAction = trace.actions[i + 1];
      if (this.config.includeWaitSteps && this.needsWait(action, nextAction)) {
        steps.push(this.generateWaitStep(action, nextAction));
      }

      i++;
    }

    return steps;
  }

  /**
   * Generate steps from a subset of actions
   */
  private generateStepsFromActions(
    actions: RecordedAction[],
    paramMap: Map<string, string>
  ): SkillStep[] {
    return actions
      .map((action) => this.actionToStep(action, paramMap))
      .filter((step): step is SkillStep => step !== null);
  }

  /**
   * Convert a recorded action to a skill step
   */
  private actionToStep(
    action: RecordedAction,
    paramMap: Map<string, string>
  ): SkillStep | null {
    const stepId = this.generateStepId();

    // Get alternative selectors
    const alternativeSelectors = this.config.generateAlternatives && action.elementInfo
      ? generateSelectors(action.elementInfo).slice(0, this.config.maxAlternativeSelectors)
      : action.alternativeSelectors;

    // Check if value should be parameterized
    const value = action.value && paramMap.has(action.value)
      ? this.createDynamicValue(paramMap.get(action.value)!)
      : action.value;

    switch (action.type) {
      case 'click':
        return {
          id: stepId,
          type: 'click',
          description: this.describeAction(action),
          selector: action.selector,
          alternativeSelectors,
          timeout: this.config.defaultTimeout,
          onError: this.config.defaultErrorHandler,
        };

      case 'type':
        return {
          id: stepId,
          type: 'type',
          description: this.describeAction(action),
          selector: action.selector,
          alternativeSelectors,
          value,
          timeout: this.config.defaultTimeout,
          onError: this.config.defaultErrorHandler,
        };

      case 'select':
        return {
          id: stepId,
          type: 'select',
          description: this.describeAction(action),
          selector: action.selector,
          alternativeSelectors,
          value,
          timeout: this.config.defaultTimeout,
          onError: this.config.defaultErrorHandler,
        };

      case 'scroll':
        return {
          id: stepId,
          type: 'scroll',
          description: this.describeAction(action),
          value: action.value,
          timeout: this.config.defaultTimeout,
        };

      case 'navigate':
        return {
          id: stepId,
          type: 'navigate',
          description: this.describeAction(action),
          value: action.value,
          waitFor: {
            type: 'network',
            value: 'idle',
            timeout: this.config.defaultTimeout * 2,
          },
          timeout: this.config.defaultTimeout * 2,
        };

      case 'wait':
        // Parse wait value
        const waitParts = (action.value || 'time:1000').split(':');
        const waitType = waitParts[0] || 'time';
        const waitValue = waitParts[1] || '1000';
        return {
          id: stepId,
          type: 'wait',
          description: this.describeAction(action),
          waitFor: {
            type: waitType as 'time' | 'selector' | 'network',
            value: waitValue,
            timeout: this.config.defaultTimeout,
          },
          timeout: this.config.defaultTimeout,
        };

      case 'mcp_call':
        return {
          id: stepId,
          type: 'mcp_call',
          description: this.describeAction(action),
          mcpTool: action.mcpTool,
          mcpArgs: action.mcpArgs,
          timeout: this.config.defaultTimeout * 2,
          onError: this.config.defaultErrorHandler,
        };

      case 'extract':
        return {
          id: stepId,
          type: 'extract',
          description: this.describeAction(action),
          selector: action.selector,
          alternativeSelectors,
          extractConfig: {
            name: action.value || 'extractedData',
            selector: action.selector || '',
            extractType: 'text',
          },
          timeout: this.config.defaultTimeout,
        };

      case 'download':
        return {
          id: stepId,
          type: 'download',
          description: this.describeAction(action),
          value: action.value,
          timeout: this.config.defaultTimeout * 3,
        };

      case 'upload':
        return {
          id: stepId,
          type: 'upload',
          description: this.describeAction(action),
          selector: action.selector,
          alternativeSelectors,
          value,
          timeout: this.config.defaultTimeout * 2,
        };

      case 'screenshot':
        return {
          id: stepId,
          type: 'screenshot',
          description: this.describeAction(action),
          timeout: this.config.defaultTimeout,
        };

      default:
        return null;
    }
  }

  /**
   * Create a dynamic value reference
   */
  private createDynamicValue(paramName: string): DynamicValue {
    return {
      type: 'parameter',
      source: paramName,
    };
  }

  /**
   * Generate a step description from action
   */
  private describeAction(action: RecordedAction): string {
    const elementDesc = this.describeElement(action.elementInfo);

    switch (action.type) {
      case 'click':
        return `Click on ${elementDesc}`;
      case 'type':
        return `Type "${action.value?.substring(0, 20)}..." into ${elementDesc}`;
      case 'select':
        return `Select "${action.value}" in ${elementDesc}`;
      case 'scroll':
        return `Scroll ${action.value}`;
      case 'navigate':
        return `Navigate to ${action.value}`;
      case 'wait':
        return `Wait for ${action.value}`;
      case 'mcp_call':
        return `Call MCP tool: ${action.mcpTool}`;
      case 'extract':
        return `Extract data from ${elementDesc}`;
      case 'download':
        return `Download file`;
      case 'upload':
        return `Upload file to ${elementDesc}`;
      case 'screenshot':
        return `Take screenshot`;
      default:
        return `Perform ${action.type}`;
    }
  }

  /**
   * Generate element description
   */
  private describeElement(elementInfo?: ElementInfo): string {
    if (!elementInfo) return 'element';

    if (elementInfo.ariaLabel) {
      return `"${elementInfo.ariaLabel}"`;
    }
    if (elementInfo.textContent) {
      const text = elementInfo.textContent.substring(0, 30);
      return `"${text}${elementInfo.textContent.length > 30 ? '...' : ''}"`;
    }
    if (elementInfo.placeholder) {
      return `${elementInfo.tagName.toLowerCase()} with placeholder "${elementInfo.placeholder}"`;
    }
    if (elementInfo.id) {
      return `#${elementInfo.id}`;
    }

    return elementInfo.tagName.toLowerCase();
  }

  /**
   * Check if a wait step is needed between actions
   */
  private needsWait(current: RecordedAction, next?: RecordedAction): boolean {
    if (!next) return false;

    // Wait after navigation
    if (current.type === 'navigate') return true;

    // Wait after clicks that might trigger navigation or loading
    if (current.type === 'click') {
      const buttonKeywords = ['submit', 'next', 'continue', 'search', 'load'];
      const elementText = current.elementInfo?.textContent?.toLowerCase() || '';
      const ariaLabel = current.elementInfo?.ariaLabel?.toLowerCase() || '';

      if (buttonKeywords.some((k) => elementText.includes(k) || ariaLabel.includes(k))) {
        return true;
      }
    }

    // Wait if URL changed between actions
    if (current.url !== next.url) return true;

    return false;
  }

  /**
   * Generate a wait step
   */
  private generateWaitStep(
    afterAction: RecordedAction,
    beforeAction?: RecordedAction
  ): SkillStep {
    let waitFor: WaitCondition;

    if (afterAction.type === 'navigate' || afterAction.url !== beforeAction?.url) {
      // Wait for navigation
      waitFor = {
        type: 'network',
        value: 'idle',
        timeout: this.config.defaultTimeout,
      };
    } else if (beforeAction?.selector) {
      // Wait for next element to appear
      waitFor = {
        type: 'selector',
        value: beforeAction.selector,
        timeout: this.config.defaultTimeout,
        visible: true,
      };
    } else {
      // Default wait
      waitFor = {
        type: 'time',
        value: '1000',
        timeout: this.config.defaultTimeout,
      };
    }

    return {
      id: this.generateStepId(),
      type: 'wait',
      description: 'Wait for page to stabilize',
      waitFor,
      timeout: this.config.defaultTimeout,
    };
  }

  /**
   * Generate a unique step ID
   */
  private generateStepId(): string {
    return `step_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  }

  /**
   * Generate DOM fingerprint from trace
   */
  private generateFingerprint(trace: ExecutionTrace): string {
    const selectors = trace.actions
      .filter((a) => a.selector)
      .map((a) => a.selector!)
      .slice(0, 20);

    return generateDomFingerprint(selectors);
  }

  /**
   * Generate skill name from trace
   */
  private generateName(trace: ExecutionTrace): string {
    // Extract key words from task description
    const words = trace.taskDescription
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    // Get domain
    let domain = 'Unknown';
    try {
      const hostnameParts = new URL(trace.startUrl).hostname.replace('www.', '').split('.');
      domain = hostnameParts[0] || 'Unknown';
    } catch {
      // Use default
    }

    // Capitalize first letters
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    // Build name
    const keyWords = words.slice(0, 3).map(capitalize).join(' ');
    return `${capitalize(domain)} ${keyWords || 'Task'}`;
  }

  /**
   * Generate skill description from trace
   */
  private generateDescription(
    trace: ExecutionTrace,
    analysis: TraceAnalysis
  ): string {
    const actionSummary = Object.entries(analysis.actionTypeCounts)
      .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
      .join(', ');

    const domainText = analysis.domains.length > 1
      ? `across ${analysis.domains.join(', ')}`
      : `on ${analysis.domains[0] || 'unknown domain'}`;

    return `${trace.taskDescription}. Performs ${actionSummary} ${domainText}.`;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a skill generator with default config
 */
export function createSkillGenerator(
  config?: SkillGeneratorConfig
): SkillGenerator {
  return new SkillGenerator(config);
}

/**
 * Generate a skill from a trace using default generator
 */
export function generateSkillFromTrace(
  trace: ExecutionTrace,
  options?: {
    name?: string;
    description?: string;
    tags?: string[];
    saveToStorage?: boolean;
  }
): BrowserSkill {
  const generator = new SkillGenerator();
  return generator.generateSkill(trace, options);
}

/**
 * Validate that a trace is suitable for skill generation
 */
export function validateTraceForSkillGeneration(
  trace: ExecutionTrace
): { valid: boolean; reason?: string } {
  // Check minimum actions
  if (trace.actions.length < 2) {
    return { valid: false, reason: 'Too few actions (minimum 2)' };
  }

  // Check maximum actions
  if (trace.actions.length > 100) {
    return { valid: false, reason: 'Too many actions (maximum 100)' };
  }

  // Check success
  if (!trace.success) {
    return { valid: false, reason: 'Execution was not successful' };
  }

  // Check for at least one interaction action
  const hasInteraction = trace.actions.some((a) =>
    ['click', 'type', 'select', 'navigate'].includes(a.type)
  );
  if (!hasInteraction) {
    return { valid: false, reason: 'No interaction actions found' };
  }

  return { valid: true };
}

/**
 * Estimate skill complexity from trace
 */
export function estimateSkillComplexity(
  trace: ExecutionTrace
): 'simple' | 'moderate' | 'complex' {
  const analysis = analyzeTrace(trace);

  if (analysis.complexity <= 10) return 'simple';
  if (analysis.complexity <= 30) return 'moderate';
  return 'complex';
}

// ============================================================================
// Singleton
// ============================================================================

let defaultGenerator: SkillGenerator | null = null;

/**
 * Get the default skill generator
 */
export function getDefaultSkillGenerator(): SkillGenerator {
  if (!defaultGenerator) {
    defaultGenerator = new SkillGenerator();
  }
  return defaultGenerator;
}
