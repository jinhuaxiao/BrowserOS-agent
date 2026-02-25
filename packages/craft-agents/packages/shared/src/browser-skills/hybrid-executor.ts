/**
 * Hybrid Executor
 *
 * Executes tasks using the optimal method from the three-layer model:
 * - L1: Atomic scripts (pure JS, fastest)
 * - L2: Skills (parameterized step sequences)
 * - L3: Vision (fallback for unknown scenarios)
 *
 * Key features:
 * - Automatic selection of execution method
 * - Fallback handling when primary method fails
 * - Execution tracking for skill generation
 * - Integration with MCP for browser control
 */

import type {
  BrowserSkill,
  BrowserScript,
  SkillStep,
  ExecutionContext,
  ExecutionResult,
  StepResult,
  ExecutionPlan,
  BrowserSkillEvent,
  BrowserSkillEventListener,
} from './types.ts';
import {
  SkillMatcher,
  type PageContext,
} from './skill-matcher.ts';
import {
  ExecutionTracker,
  createTracker,
} from './execution-tracker.ts';
import {
  AutonomousDecisionEngine,
  getDefaultDecisionEngine,
  type FailureContext,
} from './autonomous-decision.ts';
import {
  recordExecution,
  getSkill,
  updateSkill,
} from './skill-storage.ts';
import {
  generateSkillFromTrace,
  validateTraceForSkillGeneration,
} from './skill-generator.ts';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for hybrid executor
 */
export interface HybridExecutorConfig {
  /** Default timeout for step execution in ms */
  defaultTimeout?: number;

  /** Whether to enable automatic skill generation */
  enableSkillGeneration?: boolean;

  /** Whether to track executions for analysis */
  enableTracking?: boolean;

  /** Whether to fallback to vision on skill failure */
  enableVisionFallback?: boolean;

  /** Maximum retries for failed steps */
  maxRetries?: number;

  /** Delay between retries in ms */
  retryDelay?: number;
}

const DEFAULT_CONFIG: Required<HybridExecutorConfig> = {
  defaultTimeout: 10000,
  enableSkillGeneration: true,
  enableTracking: true,
  enableVisionFallback: true,
  maxRetries: 2,
  retryDelay: 1000,
};

// ============================================================================
// Event System
// ============================================================================

const eventListeners = new Set<BrowserSkillEventListener>();

/**
 * Add event listener
 */
export function addExecutorEventListener(
  listener: BrowserSkillEventListener
): void {
  eventListeners.add(listener);
}

/**
 * Remove event listener
 */
export function removeExecutorEventListener(
  listener: BrowserSkillEventListener
): void {
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
      console.error('[HybridExecutor] Event listener error:', err);
    }
  }
}

// ============================================================================
// MCP Client Interface
// ============================================================================

/**
 * Interface for MCP client operations
 * This should be implemented by the actual MCP client
 */
export interface McpClientInterface {
  /** Call an MCP tool */
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;

  /** Get current page URL */
  getPageUrl(): Promise<string>;

  /** Get current page title */
  getPageTitle(): Promise<string>;

  /** Get available selectors on page */
  getAvailableSelectors?(): Promise<string[]>;

  /** Take a screenshot */
  screenshot?(): Promise<string>;

  /** Execute JavaScript on page */
  executeScript?(code: string): Promise<unknown>;

  /** Navigate to URL */
  navigate?(url: string): Promise<void>;

  /** Click element */
  click?(selector: string): Promise<void>;

  /** Type text into element */
  type?(selector: string, text: string): Promise<void>;

  /** Select option in select element */
  select?(selector: string, value: string): Promise<void>;

  /** Wait for selector */
  waitForSelector?(selector: string, timeout?: number): Promise<void>;

  /** Wait for navigation */
  waitForNavigation?(timeout?: number): Promise<void>;

  /** Scroll page */
  scroll?(direction: string, amount?: number): Promise<void>;
}

// ============================================================================
// Hybrid Executor Class
// ============================================================================

/**
 * Hybrid Executor
 *
 * Coordinates execution across the three-layer model.
 */
export class HybridExecutor {
  private config: Required<HybridExecutorConfig>;
  private matcher: SkillMatcher;
  private decisionEngine: AutonomousDecisionEngine;
  private tracker: ExecutionTracker | null = null;

  constructor(config: HybridExecutorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.matcher = new SkillMatcher();
    this.decisionEngine = getDefaultDecisionEngine();
  }

  /**
   * Execute a task using the best available method
   */
  async execute(
    intent: string,
    mcpClient: McpClientInterface,
    options?: {
      parameters?: Record<string, unknown>;
      profileId?: string;
      forceMethod?: 'script' | 'skill' | 'vision';
    }
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executionId = this.generateExecutionId();

    // Get page context
    const context = await this.getPageContext(mcpClient);

    // Start tracking if enabled
    if (this.config.enableTracking) {
      this.tracker = createTracker();
      this.tracker.startRecording(intent, context.url, options?.profileId);
    }

    try {
      // Determine execution method
      let plan: ExecutionPlan;
      if (options?.forceMethod) {
        plan = this.createForcedPlan(options.forceMethod, intent, context);
      } else {
        plan = await this.matcher.matchIntent(intent, context);
      }

      // Execute based on plan type
      let result: ExecutionResult;

      switch (plan.type) {
        case 'script':
          result = await this.executeScript(
            plan.script!,
            mcpClient,
            options?.parameters
          );
          break;

        case 'skill':
          emit({
            type: 'execution_started',
            skillId: plan.skill!.id,
            executionId,
          });
          result = await this.executeSkill(
            plan.skill!,
            mcpClient,
            { ...plan.parameters, ...options?.parameters },
            executionId
          );
          break;

        case 'vision':
        default:
          result = await this.executeVision(intent, mcpClient, options?.parameters);
          break;
      }

      // Handle skill generation for vision execution
      if (
        plan.type === 'vision' &&
        result.success &&
        this.config.enableSkillGeneration &&
        this.tracker
      ) {
        await this.maybeGenerateSkill();
      }

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      return {
        success: false,
        error,
        durationMs: Date.now() - startTime,
      };
    } finally {
      // Stop tracking
      if (this.tracker) {
        this.tracker.stopRecording(true);
        this.tracker = null;
      }
    }
  }

  /**
   * Execute a script (L1)
   */
  private async executeScript(
    script: BrowserScript,
    mcpClient: McpClientInterface,
    parameters?: Record<string, unknown>
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Validate required parameters
      for (const param of script.params) {
        if (param.required && !parameters?.[param.name]) {
          throw new Error(`Missing required parameter: ${param.name}`);
        }
      }

      // Build parameter values
      const params: Record<string, unknown> = {};
      for (const param of script.params) {
        params[param.name] = parameters?.[param.name] ?? param.defaultValue;
      }

      // Execute script
      if (mcpClient.executeScript) {
        const result = await mcpClient.executeScript(
          this.injectParameters(script.code, params)
        );

        return {
          success: true,
          data: { result },
          durationMs: Date.now() - startTime,
        };
      }

      // Fallback: use MCP tool
      const result = await mcpClient.callTool('javascript_tool', {
        action: 'javascript_exec',
        text: this.injectParameters(script.code, params),
      });

      return {
        success: true,
        data: { result },
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Script execution failed',
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a skill (L2)
   */
  private async executeSkill(
    skill: BrowserSkill,
    mcpClient: McpClientInterface,
    parameters?: Record<string, unknown>,
    executionId?: string
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const stepResults: StepResult[] = [];
    let usedVisionFallback = false;

    // Build execution context
    const context: ExecutionContext = {
      url: await mcpClient.getPageUrl(),
      title: await mcpClient.getPageTitle(),
      parameters: parameters || {},
      extractedData: {},
      mcpClient,
      profileId: undefined,
      startedAt: startTime,
    };

    try {
      // Execute each step
      for (const step of skill.steps) {
        const stepResult = await this.executeStep(step, context, mcpClient);
        stepResults.push(stepResult);

        if (!stepResult.success) {
          // Handle step failure
          if (
            this.config.enableVisionFallback &&
            skill.fallbackToVision
          ) {
            // Try vision fallback for this step
            usedVisionFallback = true;
            emit({
              type: 'vision_fallback',
              skillId: skill.id,
              reason: stepResult.error || 'Step failed',
            });

            // For now, just mark as failed
            // In a full implementation, we would invoke the vision system
            throw new Error(
              `Step ${step.id} failed: ${stepResult.error}. Vision fallback not yet implemented.`
            );
          }

          throw new Error(`Step ${step.id} failed: ${stepResult.error}`);
        }

        // Store extracted data
        if (stepResult.extractedData) {
          if (step.extractConfig?.name) {
            context.extractedData[step.extractConfig.name] = stepResult.extractedData;
          }
        }
      }

      // Record successful execution
      recordExecution(skill.id, true, Date.now() - startTime, {
        parameters,
        usedVisionFallback,
      });

      emit({
        type: 'execution_completed',
        skillId: skill.id,
        executionId: executionId || '',
        result: {
          success: true,
          data: context.extractedData,
          durationMs: Date.now() - startTime,
          stepResults,
          usedVisionFallback,
        },
      });

      return {
        success: true,
        data: context.extractedData,
        durationMs: Date.now() - startTime,
        stepResults,
        usedVisionFallback,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Skill execution failed';

      // Record failed execution
      recordExecution(skill.id, false, Date.now() - startTime, {
        error,
        parameters,
        usedVisionFallback,
      });

      // Check if skill should be updated or deprecated
      const failureContext: FailureContext = {
        isDomRelated: this.isDomRelatedError(error),
        errorMessage: error,
        failedStepId: stepResults.find((r) => !r.success)?.stepId,
      };

      const updateDecision = this.decisionEngine.shouldUpdateSkill(
        skill,
        failureContext
      );
      if (updateDecision.shouldUpdate && updateDecision.proposedChanges) {
        updateSkill(skill.id, updateDecision.proposedChanges);
      }

      const deprecateDecision = this.decisionEngine.shouldDeprecateSkill(
        await this.matcher.getSkillById(skill.id) || skill
      );
      // Deprecation is handled by the decision engine during maintenance

      emit({
        type: 'execution_failed',
        skillId: skill.id,
        executionId: executionId || '',
        error,
      });

      return {
        success: false,
        error,
        durationMs: Date.now() - startTime,
        stepResults,
        usedVisionFallback,
      };
    }
  }

  /**
   * Execute a single skill step
   */
  private async executeStep(
    step: SkillStep,
    context: ExecutionContext,
    mcpClient: McpClientInterface
  ): Promise<StepResult> {
    const startTime = Date.now();
    let retries = 0;

    while (retries <= (step.onError?.retries || this.config.maxRetries)) {
      try {
        // Resolve dynamic values
        const resolvedStep = this.resolveStepValues(step, context);

        // Execute based on step type
        switch (step.type) {
          case 'click':
            await this.executeClick(resolvedStep, mcpClient);
            break;

          case 'type':
            await this.executeType(resolvedStep, mcpClient);
            break;

          case 'select':
            await this.executeSelect(resolvedStep, mcpClient);
            break;

          case 'navigate':
            await this.executeNavigate(resolvedStep, mcpClient);
            break;

          case 'wait':
            await this.executeWait(resolvedStep, mcpClient);
            break;

          case 'scroll':
            await this.executeScroll(resolvedStep, mcpClient);
            break;

          case 'extract':
            const extracted = await this.executeExtract(resolvedStep, mcpClient);
            return {
              stepId: step.id,
              success: true,
              durationMs: Date.now() - startTime,
              extractedData: extracted,
              retries,
            };

          case 'mcp_call':
            await this.executeMcpCall(resolvedStep, mcpClient);
            break;

          case 'screenshot':
            await this.executeScreenshot(mcpClient);
            break;

          case 'loop':
            await this.executeLoop(resolvedStep, context, mcpClient);
            break;

          case 'condition':
            await this.executeCondition(resolvedStep, context, mcpClient);
            break;

          default:
            throw new Error(`Unknown step type: ${step.type}`);
        }

        // Track action if tracking is enabled
        if (this.tracker && step.selector) {
          const valueStr = typeof resolvedStep.value === 'string' ? resolvedStep.value : undefined;
          const stepType = step.type;
          if (stepType === 'click') {
            this.tracker.recordClick(context.url, step.selector);
          } else if (stepType === 'type' && valueStr) {
            this.tracker.recordType(context.url, step.selector, valueStr);
          } else if (stepType === 'select' && valueStr) {
            this.tracker.recordSelect(context.url, step.selector, valueStr);
          }
        }

        return {
          stepId: step.id,
          success: true,
          durationMs: Date.now() - startTime,
          retries,
        };
      } catch (err) {
        retries++;

        if (retries > (step.onError?.retries || this.config.maxRetries)) {
          return {
            stepId: step.id,
            success: false,
            durationMs: Date.now() - startTime,
            error: err instanceof Error ? err.message : 'Step failed',
            retries,
          };
        }

        // Wait before retry
        await this.sleep(step.onError?.retryDelay || this.config.retryDelay);
      }
    }

    return {
      stepId: step.id,
      success: false,
      durationMs: Date.now() - startTime,
      error: 'Max retries exceeded',
      retries,
    };
  }

  /**
   * Execute click step
   */
  private async executeClick(
    step: SkillStep,
    mcpClient: McpClientInterface
  ): Promise<void> {
    const selector = step.selector;
    if (!selector) throw new Error('Click step requires selector');

    // Try primary selector first, then alternatives
    const selectors = [selector, ...(step.alternativeSelectors || [])];

    for (const sel of selectors) {
      try {
        if (mcpClient.click) {
          await mcpClient.click(sel);
          return;
        }

        // Fallback to MCP tool
        await mcpClient.callTool('computer', {
          action: 'left_click',
          ref: sel,
        });
        return;
      } catch {
        // Try next selector
        continue;
      }
    }

    throw new Error(`Click failed for all selectors: ${selectors.join(', ')}`);
  }

  /**
   * Execute type step
   */
  private async executeType(
    step: SkillStep,
    mcpClient: McpClientInterface
  ): Promise<void> {
    const selector = step.selector;
    const value = typeof step.value === 'string' ? step.value : '';

    if (!selector) throw new Error('Type step requires selector');

    if (mcpClient.type) {
      await mcpClient.type(selector, value);
      return;
    }

    // Fallback to MCP tool
    await mcpClient.callTool('form_input', {
      ref: selector,
      value,
    });
  }

  /**
   * Execute select step
   */
  private async executeSelect(
    step: SkillStep,
    mcpClient: McpClientInterface
  ): Promise<void> {
    const selector = step.selector;
    const value = typeof step.value === 'string' ? step.value : '';

    if (!selector) throw new Error('Select step requires selector');

    if (mcpClient.select) {
      await mcpClient.select(selector, value);
      return;
    }

    // Fallback to MCP tool
    await mcpClient.callTool('form_input', {
      ref: selector,
      value,
    });
  }

  /**
   * Execute navigate step
   */
  private async executeNavigate(
    step: SkillStep,
    mcpClient: McpClientInterface
  ): Promise<void> {
    const url = typeof step.value === 'string' ? step.value : '';
    if (!url) throw new Error('Navigate step requires URL');

    if (mcpClient.navigate) {
      await mcpClient.navigate(url);
      return;
    }

    await mcpClient.callTool('navigate', { url });
  }

  /**
   * Execute wait step
   */
  private async executeWait(
    step: SkillStep,
    mcpClient: McpClientInterface
  ): Promise<void> {
    const waitFor = step.waitFor;
    if (!waitFor) {
      await this.sleep(1000);
      return;
    }

    switch (waitFor.type) {
      case 'time':
        await this.sleep(parseInt(waitFor.value, 10) || 1000);
        break;

      case 'selector':
        if (mcpClient.waitForSelector) {
          await mcpClient.waitForSelector(waitFor.value, waitFor.timeout);
        } else {
          // Poll for selector
          await this.pollForSelector(waitFor.value, mcpClient, waitFor.timeout);
        }
        break;

      case 'navigation':
        if (mcpClient.waitForNavigation) {
          await mcpClient.waitForNavigation(waitFor.timeout);
        } else {
          await this.sleep(2000);
        }
        break;

      case 'network':
        // Wait for network to be idle
        await this.sleep(2000);
        break;
    }
  }

  /**
   * Execute scroll step
   */
  private async executeScroll(
    step: SkillStep,
    mcpClient: McpClientInterface
  ): Promise<void> {
    const value = typeof step.value === 'string' ? step.value : 'down:page';
    const parts = value.split(':');
    const direction = parts[0] || 'down';
    const amount = parts[1] || 'page';

    if (mcpClient.scroll) {
      await mcpClient.scroll(direction, amount === 'page' ? undefined : parseInt(amount, 10));
      return;
    }

    await mcpClient.callTool('computer', {
      action: 'scroll',
      scroll_direction: direction,
      scroll_amount: amount === 'page' ? 3 : parseInt(amount, 10),
    });
  }

  /**
   * Execute extract step
   */
  private async executeExtract(
    step: SkillStep,
    mcpClient: McpClientInterface
  ): Promise<unknown> {
    const config = step.extractConfig;
    if (!config) throw new Error('Extract step requires extractConfig');

    // Use MCP to get element content
    const result = await mcpClient.callTool('read_page', {
      ref_id: config.selector,
    });

    return result;
  }

  /**
   * Execute MCP call step
   */
  private async executeMcpCall(
    step: SkillStep,
    mcpClient: McpClientInterface
  ): Promise<void> {
    if (!step.mcpTool) throw new Error('MCP call step requires mcpTool');

    await mcpClient.callTool(step.mcpTool, step.mcpArgs || {});
  }

  /**
   * Execute screenshot step
   */
  private async executeScreenshot(
    mcpClient: McpClientInterface
  ): Promise<string | undefined> {
    if (mcpClient.screenshot) {
      return mcpClient.screenshot();
    }

    await mcpClient.callTool('computer', { action: 'screenshot' });
    return undefined;
  }

  /**
   * Execute loop step
   */
  private async executeLoop(
    step: SkillStep,
    context: ExecutionContext,
    mcpClient: McpClientInterface
  ): Promise<void> {
    const loop = step.loop;
    if (!loop || !step.nestedSteps) return;

    const maxIterations = loop.maxIterations || 100;
    let iterations = 0;

    switch (loop.type) {
      case 'count':
        const count = loop.count || 1;
        for (let i = 0; i < count && iterations < maxIterations; i++) {
          for (const nestedStep of step.nestedSteps) {
            await this.executeStep(nestedStep, context, mcpClient);
          }
          iterations++;
        }
        break;

      case 'while':
        while (iterations < maxIterations) {
          if (loop.condition && !await this.evaluateCondition(loop.condition, mcpClient)) {
            break;
          }
          for (const nestedStep of step.nestedSteps) {
            await this.executeStep(nestedStep, context, mcpClient);
          }
          iterations++;
        }
        break;
    }
  }

  /**
   * Execute condition step
   */
  private async executeCondition(
    step: SkillStep,
    context: ExecutionContext,
    mcpClient: McpClientInterface
  ): Promise<void> {
    if (!step.condition || !step.nestedSteps) return;

    const conditionMet = await this.evaluateCondition(step.condition, mcpClient);

    if (conditionMet) {
      for (const nestedStep of step.nestedSteps) {
        await this.executeStep(nestedStep, context, mcpClient);
      }
    }
  }

  /**
   * Evaluate a condition
   */
  private async evaluateCondition(
    condition: { type: string; value: string; negate?: boolean },
    mcpClient: McpClientInterface
  ): Promise<boolean> {
    let result = false;

    switch (condition.type) {
      case 'selector_exists':
        try {
          await mcpClient.callTool('find', { query: condition.value });
          result = true;
        } catch {
          result = false;
        }
        break;

      case 'url_matches':
        const url = await mcpClient.getPageUrl();
        const regex = new RegExp(condition.value);
        result = regex.test(url);
        break;
    }

    return condition.negate ? !result : result;
  }

  /**
   * Execute using vision fallback (L3)
   */
  private async executeVision(
    intent: string,
    mcpClient: McpClientInterface,
    parameters?: Record<string, unknown>
  ): Promise<ExecutionResult> {
    // In a full implementation, this would:
    // 1. Take screenshots
    // 2. Send to vision model for analysis
    // 3. Execute actions based on vision output
    // 4. Track all actions for potential skill generation

    // For now, return a placeholder result
    return {
      success: false,
      error: 'Vision execution not yet implemented. Use skill or script execution.',
      durationMs: 0,
    };
  }

  /**
   * Attempt to generate a skill from tracked execution
   */
  private async maybeGenerateSkill(): Promise<void> {
    if (!this.tracker) return;

    const trace = this.tracker.stopRecording(true);

    // Validate trace
    const validation = validateTraceForSkillGeneration(trace);
    if (!validation.valid) {
      return;
    }

    // Check if we should create a skill
    const decision = this.decisionEngine.shouldCreateSkill(trace);
    if (!decision.shouldCreate) {
      return;
    }

    // Generate and save skill
    const skill = generateSkillFromTrace(trace, {
      name: decision.proposedName,
      description: decision.proposedDescription,
      saveToStorage: true,
    });

    emit({ type: 'skill_created', skill });
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Get current page context
   */
  private async getPageContext(
    mcpClient: McpClientInterface
  ): Promise<PageContext> {
    const url = await mcpClient.getPageUrl();
    const title = await mcpClient.getPageTitle();

    let availableSelectors: string[] | undefined;
    if (mcpClient.getAvailableSelectors) {
      availableSelectors = await mcpClient.getAvailableSelectors();
    }

    return {
      url,
      title,
      availableSelectors,
      domain: this.extractDomain(url),
    };
  }

  /**
   * Create a forced execution plan
   */
  private createForcedPlan(
    method: 'script' | 'skill' | 'vision',
    intent: string,
    context: PageContext
  ): ExecutionPlan {
    return {
      type: method,
      confidence: 1,
      reason: `Forced ${method} execution`,
    };
  }

  /**
   * Resolve dynamic values in a step
   */
  private resolveStepValues(
    step: SkillStep,
    context: ExecutionContext
  ): SkillStep {
    if (!step.value || typeof step.value === 'string') {
      return step;
    }

    const dynamicValue = step.value;
    let resolvedValue: string;

    switch (dynamicValue.type) {
      case 'parameter':
        resolvedValue = String(
          context.parameters[dynamicValue.source] ??
            dynamicValue.defaultValue ??
            ''
        );
        break;

      case 'context':
        resolvedValue = String(
          context.extractedData[dynamicValue.source] ??
            dynamicValue.defaultValue ??
            ''
        );
        break;

      case 'expression':
        // Simple expression evaluation (in production, use a safe evaluator)
        resolvedValue = dynamicValue.source;
        break;

      default:
        resolvedValue = dynamicValue.defaultValue ?? '';
    }

    return { ...step, value: resolvedValue };
  }

  /**
   * Inject parameters into script code
   */
  private injectParameters(
    code: string,
    params: Record<string, unknown>
  ): string {
    let result = code;

    for (const [key, value] of Object.entries(params)) {
      const placeholder = new RegExp(`\\$\\{${key}\\}`, 'g');
      result = result.replace(placeholder, JSON.stringify(value));
    }

    return result;
  }

  /**
   * Poll for a selector to appear
   */
  private async pollForSelector(
    selector: string,
    mcpClient: McpClientInterface,
    timeout: number = 10000
  ): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 500;

    while (Date.now() - startTime < timeout) {
      try {
        await mcpClient.callTool('find', { query: selector });
        return;
      } catch {
        await this.sleep(pollInterval);
      }
    }

    throw new Error(`Timeout waiting for selector: ${selector}`);
  }

  /**
   * Check if an error is DOM-related
   */
  private isDomRelatedError(error: string): boolean {
    const domErrorPatterns = [
      /selector/i,
      /element/i,
      /not found/i,
      /no such/i,
      /timeout/i,
      /stale/i,
      /detached/i,
    ];

    return domErrorPatterns.some((pattern) => pattern.test(error));
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  /**
   * Generate execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  }

  /**
   * Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get execution tracker (for testing/debugging)
   */
  getTracker(): ExecutionTracker | null {
    return this.tracker;
  }
}

// ============================================================================
// Singleton and Helpers
// ============================================================================

let defaultExecutor: HybridExecutor | null = null;

/**
 * Get the default hybrid executor
 */
export function getDefaultExecutor(): HybridExecutor {
  if (!defaultExecutor) {
    defaultExecutor = new HybridExecutor();
  }
  return defaultExecutor;
}

/**
 * Create a new hybrid executor with custom config
 */
export function createExecutor(config?: HybridExecutorConfig): HybridExecutor {
  return new HybridExecutor(config);
}

/**
 * Execute a task using the default executor
 */
export async function executeTask(
  intent: string,
  mcpClient: McpClientInterface,
  options?: {
    parameters?: Record<string, unknown>;
    profileId?: string;
    forceMethod?: 'script' | 'skill' | 'vision';
  }
): Promise<ExecutionResult> {
  return getDefaultExecutor().execute(intent, mcpClient, options);
}
