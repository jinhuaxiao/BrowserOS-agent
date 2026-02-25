/**
 * Autonomous Decision Engine
 *
 * Handles autonomous decisions about skill lifecycle:
 * - When to create a new skill from execution traces
 * - When to update an existing skill
 * - When to deprecate/delete a skill
 *
 * The agent makes these decisions automatically without user intervention.
 */

import type {
  BrowserSkill,
  ExecutionTrace,
  ExecutionResult,
  CreateSkillDecision,
  UpdateSkillDecision,
  DeprecateSkillDecision,
  BrowserSkillEvent,
  BrowserSkillEventListener,
} from './types.ts';
import {
  listSkills,
  getSkill,
  updateSkill,
  deprecateSkill as markDeprecated,
  deleteSkill,
  getSkillStats,
} from './skill-storage.ts';
import { analyzeTrace, type TraceAnalysis } from './execution-tracker.ts';
import { SkillMatcher } from './skill-matcher.ts';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for autonomous decision making
 */
export interface DecisionEngineConfig {
  /** Minimum steps for a task to be worth saving as a skill */
  minStepsForSkill?: number;

  /** Maximum steps for a skill (too complex to reliably automate) */
  maxStepsForSkill?: number;

  /** Minimum estimated DOM stability for skill creation */
  minDomStability?: number;

  /** Success rate threshold below which to consider deprecation */
  deprecateSuccessRateThreshold?: number;

  /** Consecutive failures before deprecation */
  deprecateConsecutiveFailures?: number;

  /** Days without use before considering cleanup */
  unusedDaysThreshold?: number;

  /** Whether to auto-delete deprecated skills after time */
  autoDeleteDeprecated?: boolean;

  /** Days before auto-deleting deprecated skills */
  autoDeleteAfterDays?: number;

  /** Similarity threshold for detecting duplicate skills */
  duplicateSimilarityThreshold?: number;
}

const DEFAULT_CONFIG: Required<DecisionEngineConfig> = {
  minStepsForSkill: 3,
  maxStepsForSkill: 30,
  minDomStability: 0.6,
  deprecateSuccessRateThreshold: 0.3,
  deprecateConsecutiveFailures: 3,
  unusedDaysThreshold: 90,
  autoDeleteDeprecated: true,
  autoDeleteAfterDays: 30,
  duplicateSimilarityThreshold: 0.85,
};

// ============================================================================
// Event System
// ============================================================================

const eventListeners = new Set<BrowserSkillEventListener>();

/**
 * Add event listener
 */
export function addDecisionEventListener(
  listener: BrowserSkillEventListener
): void {
  eventListeners.add(listener);
}

/**
 * Remove event listener
 */
export function removeDecisionEventListener(
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
      console.error('[DecisionEngine] Event listener error:', err);
    }
  }
}

// ============================================================================
// Autonomous Decision Engine
// ============================================================================

/**
 * Failure context for update decisions
 */
export interface FailureContext {
  /** Whether the failure was DOM-related */
  isDomRelated: boolean;

  /** The selector that failed */
  failedSelector?: string;

  /** The step that failed */
  failedStepId?: string;

  /** Error message */
  errorMessage: string;

  /** Current page URL when failure occurred */
  currentUrl?: string;

  /** Available selectors on the page */
  availableSelectors?: string[];
}

/**
 * Autonomous Decision Engine
 *
 * Makes autonomous decisions about skill lifecycle.
 */
export class AutonomousDecisionEngine {
  private config: Required<DecisionEngineConfig>;
  private matcher: SkillMatcher;

  constructor(config: DecisionEngineConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.matcher = new SkillMatcher();
  }

  // ==========================================================================
  // Skill Creation Decisions
  // ==========================================================================

  /**
   * Decide whether to create a skill from an execution trace
   */
  shouldCreateSkill(trace: ExecutionTrace): CreateSkillDecision {
    // Must be successful
    if (!trace.success) {
      return {
        shouldCreate: false,
        reason: 'Execution was not successful',
      };
    }

    // Check step count
    const stepCount = trace.actions.length;
    if (stepCount < this.config.minStepsForSkill) {
      return {
        shouldCreate: false,
        reason: `Too few steps (${stepCount} < ${this.config.minStepsForSkill})`,
      };
    }

    if (stepCount > this.config.maxStepsForSkill) {
      return {
        shouldCreate: false,
        reason: `Too many steps (${stepCount} > ${this.config.maxStepsForSkill})`,
      };
    }

    // Check for existing similar skill
    const existingSkill = this.findSimilarSkill(trace);
    if (existingSkill) {
      return {
        shouldCreate: false,
        reason: `Similar skill already exists: ${existingSkill.name}`,
      };
    }

    // Analyze the trace
    const analysis = analyzeTrace(trace);

    // Estimate DOM stability
    const domStability = this.estimateDomStability(trace, analysis);
    if (domStability < this.config.minDomStability) {
      return {
        shouldCreate: false,
        reason: `DOM stability too low (${Math.round(domStability * 100)}% < ${Math.round(this.config.minDomStability * 100)}%)`,
        domStability,
      };
    }

    // Check for meaningful interactions
    if (!this.hasMeaningfulInteractions(analysis)) {
      return {
        shouldCreate: false,
        reason: 'No meaningful interactions found',
      };
    }

    // Skill is worth creating
    return {
      shouldCreate: true,
      reason: 'Task is complex enough and appears automatable',
      proposedName: this.proposeName(trace),
      proposedDescription: this.proposeDescription(trace, analysis),
      detectedParams: analysis.potentialParams.map((p) => p.name),
      domStability,
    };
  }

  /**
   * Find a similar existing skill
   */
  private findSimilarSkill(trace: ExecutionTrace): BrowserSkill | null {
    const skills = listSkills();
    const domain = this.extractDomain(trace.startUrl);

    for (const skill of skills) {
      // Same domain
      if (!skill.domain.includes(domain) && !domain.includes(skill.domain)) {
        continue;
      }

      // Calculate similarity based on selectors
      const traceSelectors = new Set(
        trace.actions
          .filter((a) => a.selector)
          .map((a) => a.selector!)
      );

      const skillSelectors = new Set(
        skill.steps
          .filter((s) => s.selector)
          .map((s) => s.selector!)
      );

      const intersection = new Set(
        [...traceSelectors].filter((s) => skillSelectors.has(s))
      );

      const similarity =
        intersection.size /
        Math.max(Math.min(traceSelectors.size, skillSelectors.size), 1);

      if (similarity >= this.config.duplicateSimilarityThreshold) {
        return skill;
      }
    }

    return null;
  }

  /**
   * Estimate DOM stability for a trace
   */
  private estimateDomStability(
    trace: ExecutionTrace,
    analysis: TraceAnalysis
  ): number {
    let stabilityScore = 1.0;

    // Check for stable selectors (IDs, data-testid, aria-label)
    const actions = trace.actions.filter((a) => a.selector);
    let stableCount = 0;

    for (const action of actions) {
      const selector = action.selector!;
      if (
        selector.startsWith('#') ||
        selector.includes('data-testid') ||
        selector.includes('data-test-id') ||
        selector.includes('aria-label')
      ) {
        stableCount++;
      }
    }

    const stableRatio = stableCount / Math.max(actions.length, 1);
    stabilityScore *= 0.5 + stableRatio * 0.5;

    // Penalty for many different domains (might indicate unstable navigation)
    if (analysis.domains.length > 3) {
      stabilityScore *= 0.8;
    }

    // Penalty for very long traces (more chance of instability)
    if (trace.actions.length > 20) {
      stabilityScore *= 0.9;
    }

    // Bonus for having alternative selectors
    const actionsWithAlternatives = trace.actions.filter(
      (a) => a.alternativeSelectors && a.alternativeSelectors.length > 0
    ).length;
    const alternativeRatio = actionsWithAlternatives / Math.max(actions.length, 1);
    stabilityScore = Math.min(stabilityScore + alternativeRatio * 0.1, 1.0);

    return stabilityScore;
  }

  /**
   * Check if trace has meaningful interactions
   */
  private hasMeaningfulInteractions(analysis: TraceAnalysis): boolean {
    // Must have at least one interaction action
    const interactionTypes = ['click', 'type', 'select', 'navigate'];
    const hasInteraction = interactionTypes.some(
      (t) => (analysis.actionTypeCounts[t] || 0) > 0
    );

    if (!hasInteraction) {
      return false;
    }

    // Should have some diversity in actions (not just all clicks)
    const actionTypes = Object.keys(analysis.actionTypeCounts);
    return actionTypes.length >= 2;
  }

  /**
   * Propose a name for the skill
   */
  private proposeName(trace: ExecutionTrace): string {
    const domain = this.extractDomain(trace.startUrl);
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    // Extract key words from task description
    const words = trace.taskDescription
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const keyWords = words.slice(0, 3).map(capitalize).join(' ');
    const domainPart = domain.split('.')[0] || 'Unknown';
    return `${capitalize(domainPart)} ${keyWords || 'Task'}`;
  }

  /**
   * Propose a description for the skill
   */
  private proposeDescription(
    trace: ExecutionTrace,
    analysis: TraceAnalysis
  ): string {
    return `${trace.taskDescription}. Complexity: ${analysis.complexity}, Duration: ~${Math.round(analysis.estimatedDuration / 1000)}s`;
  }

  // ==========================================================================
  // Skill Update Decisions
  // ==========================================================================

  /**
   * Decide whether to update a skill after a failure
   */
  shouldUpdateSkill(
    skill: BrowserSkill,
    failure: FailureContext
  ): UpdateSkillDecision {
    // Don't update deprecated skills
    if (skill.tags?.includes('deprecated')) {
      return {
        shouldUpdate: false,
        reason: 'Skill is deprecated',
      };
    }

    // If not DOM related, don't auto-update
    if (!failure.isDomRelated) {
      return {
        shouldUpdate: false,
        reason: 'Failure is not DOM-related',
      };
    }

    // Check previous success rate
    if (skill.successRate < 0.5) {
      return {
        shouldUpdate: false,
        reason: 'Skill already has low success rate, consider deprecation instead',
      };
    }

    // Can we auto-fix the selector?
    if (failure.failedSelector && failure.availableSelectors) {
      const fixedSelector = this.findAlternativeSelector(
        failure.failedSelector,
        failure.availableSelectors
      );

      if (fixedSelector) {
        return {
          shouldUpdate: true,
          reason: 'Found alternative selector',
          updateType: 'selector',
          proposedChanges: this.createSelectorUpdate(
            skill,
            failure.failedStepId,
            fixedSelector
          ),
        };
      }
    }

    // Check if we should create a variant
    if (skill.successRate > 0.7) {
      return {
        shouldUpdate: true,
        reason: 'Previous high success rate suggests page variation',
        updateType: 'variant',
      };
    }

    return {
      shouldUpdate: false,
      reason: 'Cannot determine safe update',
    };
  }

  /**
   * Find an alternative selector from available selectors
   */
  private findAlternativeSelector(
    failedSelector: string,
    availableSelectors: string[]
  ): string | null {
    // Try to find a similar selector
    const failedParts = this.parseSelector(failedSelector);

    for (const selector of availableSelectors) {
      const parts = this.parseSelector(selector);

      // Match by tag and some attributes
      if (
        parts.tag === failedParts.tag &&
        (parts.id || parts.dataTestId || parts.ariaLabel)
      ) {
        return selector;
      }
    }

    return null;
  }

  /**
   * Parse a CSS selector into parts
   */
  private parseSelector(selector: string): {
    tag?: string;
    id?: string;
    classes?: string[];
    dataTestId?: string;
    ariaLabel?: string;
  } {
    const result: {
      tag?: string;
      id?: string;
      classes?: string[];
      dataTestId?: string;
      ariaLabel?: string;
    } = {};

    // Extract tag
    const tagMatch = selector.match(/^([a-z]+)/i);
    if (tagMatch && tagMatch[1]) {
      result.tag = tagMatch[1].toLowerCase();
    }

    // Extract ID
    const idMatch = selector.match(/#([a-z0-9_-]+)/i);
    if (idMatch) {
      result.id = idMatch[1];
    }

    // Extract classes
    const classMatches = selector.match(/\.([a-z0-9_-]+)/gi);
    if (classMatches) {
      result.classes = classMatches.map((c) => c.slice(1));
    }

    // Extract data-testid
    const testIdMatch = selector.match(/\[data-testid="([^"]+)"\]/);
    if (testIdMatch) {
      result.dataTestId = testIdMatch[1];
    }

    // Extract aria-label
    const ariaMatch = selector.match(/\[aria-label="([^"]+)"\]/);
    if (ariaMatch) {
      result.ariaLabel = ariaMatch[1];
    }

    return result;
  }

  /**
   * Create a selector update for a skill
   */
  private createSelectorUpdate(
    skill: BrowserSkill,
    failedStepId: string | undefined,
    newSelector: string
  ): Partial<BrowserSkill> {
    const updatedSteps = skill.steps.map((step) => {
      if (step.id === failedStepId) {
        return {
          ...step,
          selector: newSelector,
          alternativeSelectors: [
            step.selector!,
            ...(step.alternativeSelectors || []),
          ].slice(0, 5),
        };
      }
      return step;
    });

    return { steps: updatedSteps };
  }

  // ==========================================================================
  // Skill Deprecation Decisions
  // ==========================================================================

  /**
   * Decide whether to deprecate a skill
   */
  shouldDeprecateSkill(skill: BrowserSkill): DeprecateSkillDecision {
    // Already deprecated
    if (skill.tags?.includes('deprecated')) {
      return {
        shouldDeprecate: false,
        reason: 'Already deprecated',
      };
    }

    // Check consecutive failures
    if (skill.consecutiveFailures >= this.config.deprecateConsecutiveFailures) {
      return {
        shouldDeprecate: true,
        reason: `${skill.consecutiveFailures} consecutive failures`,
      };
    }

    // Check success rate (only if enough executions)
    if (
      skill.executionCount >= 5 &&
      skill.successRate < this.config.deprecateSuccessRateThreshold
    ) {
      return {
        shouldDeprecate: true,
        reason: `Success rate too low: ${Math.round(skill.successRate * 100)}%`,
      };
    }

    // Check if unused for too long
    const stats = getSkillStats(skill.id);
    if (stats && stats.daysSinceLastUse >= this.config.unusedDaysThreshold) {
      return {
        shouldDeprecate: true,
        reason: `Unused for ${stats.daysSinceLastUse} days`,
      };
    }

    return {
      shouldDeprecate: false,
      reason: 'Skill is performing adequately',
    };
  }

  /**
   * Check all skills and deprecate those that should be
   */
  runDeprecationCheck(): number {
    const skills = listSkills();
    let deprecatedCount = 0;

    for (const skill of skills) {
      const decision = this.shouldDeprecateSkill(skill);
      if (decision.shouldDeprecate) {
        markDeprecated(skill.id, decision.reason);
        emit({ type: 'skill_deprecated', skillId: skill.id, reason: decision.reason });
        deprecatedCount++;
      }
    }

    return deprecatedCount;
  }

  /**
   * Clean up old deprecated skills
   */
  runCleanup(): number {
    if (!this.config.autoDeleteDeprecated) {
      return 0;
    }

    const skills = listSkills();
    let deletedCount = 0;
    const cutoffTime =
      Date.now() - this.config.autoDeleteAfterDays * 24 * 60 * 60 * 1000;

    for (const skill of skills) {
      if (!skill.tags?.includes('deprecated')) continue;

      // Check if deprecated long enough
      if (skill.updatedAt < cutoffTime) {
        deleteSkill(skill.id);
        emit({ type: 'skill_deleted', skillId: skill.id });
        deletedCount++;
      }
    }

    return deletedCount;
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  /**
   * Evaluate a skill's health
   */
  evaluateSkillHealth(skillId: string): {
    health: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
    recommendations: string[];
  } {
    const skill = getSkill(skillId);
    if (!skill) {
      return {
        health: 'critical',
        score: 0,
        issues: ['Skill not found'],
        recommendations: ['Delete or recreate the skill'],
      };
    }

    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Check success rate
    if (skill.executionCount > 0) {
      if (skill.successRate < 0.5) {
        score -= 40;
        issues.push(`Low success rate: ${Math.round(skill.successRate * 100)}%`);
        recommendations.push('Review and update skill steps');
      } else if (skill.successRate < 0.8) {
        score -= 20;
        issues.push(`Moderate success rate: ${Math.round(skill.successRate * 100)}%`);
        recommendations.push('Consider adding fallback selectors');
      }
    }

    // Check consecutive failures
    if (skill.consecutiveFailures >= 2) {
      score -= 20 * skill.consecutiveFailures;
      issues.push(`${skill.consecutiveFailures} consecutive failures`);
      recommendations.push('Investigate recent failures');
    }

    // Check if unused
    const stats = getSkillStats(skillId);
    if (stats && stats.daysSinceLastUse > 30) {
      score -= 10;
      issues.push(`Unused for ${stats.daysSinceLastUse} days`);
      recommendations.push('Consider if skill is still needed');
    }

    // Check for deprecated tag
    if (skill.tags?.includes('deprecated')) {
      score -= 50;
      issues.push('Skill is deprecated');
      recommendations.push('Replace with updated skill or delete');
    }

    // Determine health status
    let health: 'healthy' | 'warning' | 'critical';
    if (score >= 70) {
      health = 'healthy';
    } else if (score >= 40) {
      health = 'warning';
    } else {
      health = 'critical';
    }

    return {
      health,
      score: Math.max(score, 0),
      issues,
      recommendations,
    };
  }

  /**
   * Get overall skill library health
   */
  getLibraryHealth(): {
    totalSkills: number;
    healthySkills: number;
    warningSkills: number;
    criticalSkills: number;
    averageSuccessRate: number;
    recommendations: string[];
  } {
    const skills = listSkills();
    let healthyCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    let totalSuccessRate = 0;
    let activeSkillCount = 0;
    const recommendations: string[] = [];

    for (const skill of skills) {
      const health = this.evaluateSkillHealth(skill.id);

      switch (health.health) {
        case 'healthy':
          healthyCount++;
          break;
        case 'warning':
          warningCount++;
          break;
        case 'critical':
          criticalCount++;
          break;
      }

      if (skill.executionCount > 0) {
        totalSuccessRate += skill.successRate;
        activeSkillCount++;
      }
    }

    const averageSuccessRate =
      activeSkillCount > 0 ? totalSuccessRate / activeSkillCount : 0;

    // Generate recommendations
    if (criticalCount > 0) {
      recommendations.push(
        `${criticalCount} skills need attention - run cleanup or update`
      );
    }

    if (averageSuccessRate < 0.7) {
      recommendations.push(
        'Overall success rate is low - review skill selectors'
      );
    }

    const deprecatedCount = skills.filter((s) =>
      s.tags?.includes('deprecated')
    ).length;
    if (deprecatedCount > skills.length * 0.2) {
      recommendations.push(
        `${deprecatedCount} deprecated skills - consider cleanup`
      );
    }

    return {
      totalSkills: skills.length,
      healthySkills: healthyCount,
      warningSkills: warningCount,
      criticalSkills: criticalCount,
      averageSuccessRate,
      recommendations,
    };
  }
}

// ============================================================================
// Singleton and Helpers
// ============================================================================

let defaultEngine: AutonomousDecisionEngine | null = null;

/**
 * Get the default decision engine
 */
export function getDefaultDecisionEngine(): AutonomousDecisionEngine {
  if (!defaultEngine) {
    defaultEngine = new AutonomousDecisionEngine();
  }
  return defaultEngine;
}

/**
 * Create a new decision engine with custom config
 */
export function createDecisionEngine(
  config?: DecisionEngineConfig
): AutonomousDecisionEngine {
  return new AutonomousDecisionEngine(config);
}

/**
 * Check if a trace should become a skill
 */
export function shouldCreateSkillFromTrace(
  trace: ExecutionTrace
): CreateSkillDecision {
  return getDefaultDecisionEngine().shouldCreateSkill(trace);
}

/**
 * Check all skills and run maintenance
 */
export function runSkillMaintenance(): {
  deprecated: number;
  deleted: number;
} {
  const engine = getDefaultDecisionEngine();
  return {
    deprecated: engine.runDeprecationCheck(),
    deleted: engine.runCleanup(),
  };
}
