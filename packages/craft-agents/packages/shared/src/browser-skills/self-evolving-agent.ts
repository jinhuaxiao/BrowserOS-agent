/**
 * Self-Evolving Agent
 *
 * Manages the autonomous evolution of the skill and workflow library.
 * Periodically analyzes execution patterns, creates new workflows,
 * merges similar skills, and deprecates ineffective ones.
 *
 * Key responsibilities:
 * - Run periodic evolution cycles
 * - Learn from executions in real-time
 * - Maintain skill/workflow library health
 * - Generate optimization suggestions
 */

import type {
  EvolutionReport,
  WorkflowSuggestion,
  SimilarSkillGroup,
  WorkflowEvent,
  WorkflowEventListener,
  BrowserWorkflow,
} from './workflow-types.ts';
import type { ExecutionTrace, BrowserSkill, CreateSkillDecision } from './types.ts';
import {
  WorkflowGenerator,
  getDefaultWorkflowGenerator,
} from './workflow-generator.ts';
import {
  listWorkflows,
  getWorkflow,
  updateWorkflow,
  deprecateWorkflow,
  deleteWorkflow,
  getWorkflowStats,
  recordWorkflowExecution,
} from './workflow-storage.ts';
import {
  listSkills,
  getSkill,
  updateSkill,
  deprecateSkill,
  deleteSkill,
  getSkillStats,
  readExecutionLogs,
} from './skill-storage.ts';
import {
  AutonomousDecisionEngine,
  getDefaultDecisionEngine,
} from './autonomous-decision.ts';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for self-evolving agent
 */
export interface SelfEvolvingAgentConfig {
  /** Interval for evolution cycles (ms) */
  evolutionInterval?: number;

  /** Whether to auto-start evolution cycles */
  autoStart?: boolean;

  /** Minimum workflow frequency to auto-create */
  minWorkflowFrequency?: number;

  /** Days of inactivity before deprecating */
  inactivityDaysThreshold?: number;

  /** Minimum success rate before deprecating */
  minSuccessRate?: number;

  /** Maximum consecutive failures before deprecating */
  maxConsecutiveFailures?: number;

  /** Whether to auto-create workflows from patterns */
  autoCreateWorkflows?: boolean;

  /** Whether to auto-merge similar skills */
  autoMergeSkills?: boolean;

  /** Whether to auto-deprecate failing items */
  autoDeprecate?: boolean;

  /** Whether to auto-delete deprecated items after period */
  autoDelete?: boolean;

  /** Days to keep deprecated items before deletion */
  deprecationRetentionDays?: number;
}

const DEFAULT_CONFIG: Required<SelfEvolvingAgentConfig> = {
  evolutionInterval: 3600000, // 1 hour
  autoStart: false,
  minWorkflowFrequency: 5,
  inactivityDaysThreshold: 90,
  minSuccessRate: 0.3,
  maxConsecutiveFailures: 3,
  autoCreateWorkflows: true,
  autoMergeSkills: false, // Conservative default
  autoDeprecate: true,
  autoDelete: false, // Conservative default
  deprecationRetentionDays: 30,
};

// ============================================================================
// Event System
// ============================================================================

const eventListeners = new Set<WorkflowEventListener>();

/**
 * Add evolution event listener
 */
export function addEvolutionEventListener(listener: WorkflowEventListener): void {
  eventListeners.add(listener);
}

/**
 * Remove evolution event listener
 */
export function removeEvolutionEventListener(listener: WorkflowEventListener): void {
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
      console.error('[SelfEvolvingAgent] Event listener error:', err);
    }
  }
}

// ============================================================================
// Self-Evolving Agent Class
// ============================================================================

/**
 * Self-Evolving Agent
 *
 * Orchestrates the continuous improvement of the skill/workflow library.
 */
export class SelfEvolvingAgent {
  private config: Required<SelfEvolvingAgentConfig>;
  private workflowGenerator: WorkflowGenerator;
  private decisionEngine: AutonomousDecisionEngine;
  private evolutionTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastEvolutionTime: number = 0;
  private evolutionHistory: EvolutionReport[] = [];

  constructor(config: SelfEvolvingAgentConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.workflowGenerator = getDefaultWorkflowGenerator();
    this.decisionEngine = getDefaultDecisionEngine();

    if (this.config.autoStart) {
      this.start();
    }
  }

  /**
   * Start the evolution cycle
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;

    // Run initial cycle
    this.runEvolutionCycle().catch(console.error);

    // Schedule periodic cycles
    this.evolutionTimer = setInterval(() => {
      this.runEvolutionCycle().catch(console.error);
    }, this.config.evolutionInterval);
  }

  /**
   * Stop the evolution cycle
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.evolutionTimer) {
      clearInterval(this.evolutionTimer);
      this.evolutionTimer = null;
    }
  }

  /**
   * Run a single evolution cycle
   */
  async runEvolutionCycle(): Promise<EvolutionReport> {
    const startTime = Date.now();
    const report: EvolutionReport = {
      analyzedExecutions: 0,
      newWorkflowsCreated: 0,
      skillsMerged: 0,
      skillsDeprecated: 0,
      workflowsUpdated: 0,
      workflowsDeprecated: 0,
      suggestions: [],
      timestamp: startTime,
      durationMs: 0,
    };

    try {
      // 1. Analyze skill patterns and create workflows
      if (this.config.autoCreateWorkflows) {
        const patterns = await this.analyzeAndCreateWorkflows(report);
        report.suggestions.push(...patterns);
      }

      // 2. Find and optionally merge similar skills
      if (this.config.autoMergeSkills) {
        await this.findAndMergeSkills(report);
      }

      // 3. Deprecate failing skills and workflows
      if (this.config.autoDeprecate) {
        await this.deprecateFailingItems(report);
      }

      // 4. Clean up old deprecated items
      if (this.config.autoDelete) {
        await this.cleanupDeprecatedItems(report);
      }

      // 5. Run decision engine maintenance
      const deprecated = this.decisionEngine.runDeprecationCheck();
      const deleted = this.decisionEngine.runCleanup();
      report.skillsDeprecated += deprecated;

      // Count analyzed executions
      const recentLogs = readExecutionLogs({
        startTime: this.lastEvolutionTime || startTime - this.config.evolutionInterval,
        limit: 10000,
      });
      report.analyzedExecutions = recentLogs.length;

      report.durationMs = Date.now() - startTime;
      this.lastEvolutionTime = startTime;

      // Store in history
      this.evolutionHistory.push(report);
      if (this.evolutionHistory.length > 100) {
        this.evolutionHistory.shift();
      }

      emit({ type: 'evolution_cycle_completed', report });

      return report;
    } catch (err) {
      console.error('[SelfEvolvingAgent] Evolution cycle error:', err);
      report.durationMs = Date.now() - startTime;
      return report;
    }
  }

  /**
   * Learn from an execution trace in real-time
   */
  async learnFromExecution(trace: ExecutionTrace): Promise<void> {
    // Check if we should create a workflow
    const existingWorkflows = await this.findMatchingWorkflows(trace);

    if (existingWorkflows.length === 0 && trace.success) {
      // Consider creating a new workflow
      const shouldCreate = this.shouldCreateWorkflow(trace);

      if (shouldCreate) {
        const workflow = await this.workflowGenerator.generateWorkflowFromTrace(
          trace,
          { saveToStorage: true }
        );

        if (workflow) {
          emit({ type: 'workflow_created', workflow });
        }
      }
    }

    // Check if we can optimize existing skills
    for (const action of trace.actions) {
      if (action.type === 'mcp_call' && action.mcpArgs?.skillId) {
        const skillId = action.mcpArgs.skillId as string;
        await this.optimizeSkillFromAction(skillId, action, trace);
      }
    }
  }

  /**
   * Get suggestions for manual review
   */
  async getSuggestions(): Promise<WorkflowSuggestion[]> {
    return this.workflowGenerator.analyzeSkillPatterns();
  }

  /**
   * Get library health summary
   */
  getLibraryHealth(): {
    skills: {
      total: number;
      healthy: number;
      warning: number;
      critical: number;
    };
    workflows: {
      total: number;
      healthy: number;
      warning: number;
      critical: number;
    };
    recommendations: string[];
  } {
    const skills = listSkills();
    const workflows = listWorkflows();

    const skillHealth = this.categorizeByHealth(skills.map((s) => ({
      successRate: s.successRate,
      consecutiveFailures: s.consecutiveFailures,
      daysSinceLastUse: s.lastUsedAt
        ? Math.floor((Date.now() - s.lastUsedAt) / (1000 * 60 * 60 * 24))
        : Infinity,
    })));

    const workflowHealth = this.categorizeByHealth(workflows.map((w) => ({
      successRate: w.metadata.successRate,
      consecutiveFailures: w.metadata.consecutiveFailures,
      daysSinceLastUse: w.metadata.lastUsedAt
        ? Math.floor((Date.now() - w.metadata.lastUsedAt) / (1000 * 60 * 60 * 24))
        : Infinity,
    })));

    const recommendations: string[] = [];

    if (skillHealth.critical > 0) {
      recommendations.push(
        `${skillHealth.critical} skills have critical issues and may need attention`
      );
    }

    if (workflowHealth.critical > 0) {
      recommendations.push(
        `${workflowHealth.critical} workflows have critical issues and may need attention`
      );
    }

    if (skillHealth.warning > skillHealth.healthy) {
      recommendations.push(
        'Consider reviewing skills with low success rates'
      );
    }

    if (workflows.length < skills.length / 3) {
      recommendations.push(
        'Consider creating more workflows to combine related skills'
      );
    }

    return {
      skills: {
        total: skills.length,
        ...skillHealth,
      },
      workflows: {
        total: workflows.length,
        ...workflowHealth,
      },
      recommendations,
    };
  }

  /**
   * Get evolution history
   */
  getEvolutionHistory(): EvolutionReport[] {
    return [...this.evolutionHistory];
  }

  /**
   * Force create a workflow from a suggestion
   */
  async createWorkflowFromSuggestion(
    suggestion: WorkflowSuggestion
  ): Promise<BrowserWorkflow | null> {
    return this.workflowGenerator.createWorkflowFromSuggestion(suggestion);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Analyze patterns and create workflows
   */
  private async analyzeAndCreateWorkflows(
    report: EvolutionReport
  ): Promise<WorkflowSuggestion[]> {
    const suggestions = await this.workflowGenerator.analyzeSkillPatterns();

    for (const suggestion of suggestions) {
      // Only auto-create high-confidence patterns
      if (
        suggestion.frequency >= this.config.minWorkflowFrequency &&
        suggestion.confidence >= 0.7
      ) {
        const workflow = await this.workflowGenerator.createWorkflowFromSuggestion(
          suggestion
        );

        if (workflow) {
          report.newWorkflowsCreated++;
          emit({ type: 'workflow_created', workflow });
        }
      } else {
        // Emit as suggestion for manual review
        emit({ type: 'workflow_suggestion', suggestion });
      }
    }

    return suggestions;
  }

  /**
   * Find and merge similar skills
   */
  private async findAndMergeSkills(report: EvolutionReport): Promise<void> {
    const similarGroups = await this.workflowGenerator.findSimilarSkills();

    for (const group of similarGroups) {
      if (group.similarity >= 0.9) {
        // High similarity - safe to merge
        await this.mergeSkillGroup(group);
        report.skillsMerged += group.skillIds.length - 1;
      }
    }
  }

  /**
   * Merge a group of similar skills
   */
  private async mergeSkillGroup(group: SimilarSkillGroup): Promise<void> {
    // Find the best skill to keep (highest success rate)
    const skills = group.skillIds.map((id) => getSkill(id)).filter(Boolean) as BrowserSkill[];

    if (skills.length < 2) return;

    const bestSkill = skills.reduce((best, current) =>
      current.successRate > best.successRate ? current : best
    );

    // Update the best skill with merged info
    updateSkill(bestSkill.id, {
      description: `${bestSkill.description} (merged from ${skills.length} similar skills)`,
      tags: [...new Set([...(bestSkill.tags || []), 'merged'])],
    });

    // Deprecate the others
    for (const skill of skills) {
      if (skill.id !== bestSkill.id) {
        deprecateSkill(skill.id, `Merged into ${bestSkill.id}`);
      }
    }
  }

  /**
   * Deprecate failing skills and workflows
   */
  private async deprecateFailingItems(report: EvolutionReport): Promise<void> {
    // Check skills
    const skills = listSkills();
    for (const skill of skills) {
      if (this.shouldDeprecate(skill)) {
        deprecateSkill(skill.id, this.getDeprecationReason(skill));
        report.skillsDeprecated++;
      }
    }

    // Check workflows
    const workflows = listWorkflows();
    for (const workflow of workflows) {
      if (this.shouldDeprecateWorkflow(workflow)) {
        deprecateWorkflow(workflow.id, this.getWorkflowDeprecationReason(workflow));
        report.workflowsDeprecated++;
      }
    }
  }

  /**
   * Clean up old deprecated items
   */
  private async cleanupDeprecatedItems(report: EvolutionReport): Promise<void> {
    const cutoffTime = Date.now() - this.config.deprecationRetentionDays * 24 * 60 * 60 * 1000;

    // Clean deprecated skills
    const skills = listSkills();
    for (const skill of skills) {
      if (
        skill.tags?.includes('deprecated') &&
        skill.updatedAt < cutoffTime
      ) {
        deleteSkill(skill.id);
      }
    }

    // Clean deprecated workflows
    const workflows = listWorkflows();
    for (const workflow of workflows) {
      if (
        workflow.tags?.includes('deprecated') &&
        workflow.updatedAt < cutoffTime
      ) {
        deleteWorkflow(workflow.id);
      }
    }
  }

  /**
   * Check if a skill should be deprecated
   */
  private shouldDeprecate(skill: BrowserSkill): boolean {
    // Already deprecated
    if (skill.tags?.includes('deprecated')) return false;

    // Too many consecutive failures
    if (skill.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      return true;
    }

    // Very low success rate
    if (skill.executionCount >= 5 && skill.successRate < this.config.minSuccessRate) {
      return true;
    }

    // Long inactivity
    if (skill.lastUsedAt) {
      const daysSinceUse = Math.floor(
        (Date.now() - skill.lastUsedAt) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceUse > this.config.inactivityDaysThreshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a workflow should be deprecated
   */
  private shouldDeprecateWorkflow(workflow: BrowserWorkflow): boolean {
    // Already deprecated
    if (workflow.tags?.includes('deprecated')) return false;

    const { metadata } = workflow;

    // Too many consecutive failures
    if (metadata.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      return true;
    }

    // Very low success rate
    if (metadata.executionCount >= 5 && metadata.successRate < this.config.minSuccessRate) {
      return true;
    }

    // Long inactivity
    if (metadata.lastUsedAt) {
      const daysSinceUse = Math.floor(
        (Date.now() - metadata.lastUsedAt) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceUse > this.config.inactivityDaysThreshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get deprecation reason for a skill
   */
  private getDeprecationReason(skill: BrowserSkill): string {
    if (skill.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      return `${skill.consecutiveFailures} consecutive failures`;
    }
    if (skill.successRate < this.config.minSuccessRate) {
      return `Low success rate: ${(skill.successRate * 100).toFixed(1)}%`;
    }
    if (skill.lastUsedAt) {
      const daysSinceUse = Math.floor(
        (Date.now() - skill.lastUsedAt) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceUse > this.config.inactivityDaysThreshold) {
        return `Inactive for ${daysSinceUse} days`;
      }
    }
    return 'Auto-deprecated';
  }

  /**
   * Get deprecation reason for a workflow
   */
  private getWorkflowDeprecationReason(workflow: BrowserWorkflow): string {
    const { metadata } = workflow;

    if (metadata.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      return `${metadata.consecutiveFailures} consecutive failures`;
    }
    if (metadata.successRate < this.config.minSuccessRate) {
      return `Low success rate: ${(metadata.successRate * 100).toFixed(1)}%`;
    }
    if (metadata.lastUsedAt) {
      const daysSinceUse = Math.floor(
        (Date.now() - metadata.lastUsedAt) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceUse > this.config.inactivityDaysThreshold) {
        return `Inactive for ${daysSinceUse} days`;
      }
    }
    return 'Auto-deprecated';
  }

  /**
   * Check if a workflow should be created from a trace
   */
  private shouldCreateWorkflow(trace: ExecutionTrace): boolean {
    // Need at least 3 successful actions
    const successfulActions = trace.actions.filter((a) => a.success);
    if (successfulActions.length < 3) return false;

    // Check if there are skill calls in the trace
    const skillCalls = trace.actions.filter(
      (a) => a.type === 'mcp_call' && a.mcpArgs?.skillId
    );
    if (skillCalls.length < 2) return false;

    // Check execution time (long enough to be worth optimizing)
    if (trace.durationMs < 5000) return false;

    return true;
  }

  /**
   * Find workflows matching a trace
   */
  private async findMatchingWorkflows(
    trace: ExecutionTrace
  ): Promise<BrowserWorkflow[]> {
    // Import to avoid circular dependency
    const { findMatchingWorkflows } = await import('./workflow-storage.ts');

    return findMatchingWorkflows(trace.taskDescription, {
      url: trace.startUrl,
    });
  }

  /**
   * Optimize a skill based on action execution
   */
  private async optimizeSkillFromAction(
    skillId: string,
    action: { success: boolean; durationMs?: number; mcpResult?: unknown },
    trace: ExecutionTrace
  ): Promise<void> {
    const skill = getSkill(skillId);
    if (!skill) return;

    // If action succeeded but was slower than average, note it
    if (action.success && action.durationMs && skill.executionCount > 0) {
      // Could add optimization hints here
    }

    // If action failed, check if we need to update selectors
    if (!action.success && this.decisionEngine) {
      const decision = this.decisionEngine.shouldUpdateSkill(skill, {
        isDomRelated: true,
        errorMessage: 'Action failed during trace execution',
      });

      if (decision.shouldUpdate && decision.proposedChanges) {
        updateSkill(skillId, decision.proposedChanges);
      }
    }
  }

  /**
   * Categorize items by health status
   */
  private categorizeByHealth(
    items: Array<{
      successRate: number;
      consecutiveFailures: number;
      daysSinceLastUse: number;
    }>
  ): { healthy: number; warning: number; critical: number } {
    let healthy = 0;
    let warning = 0;
    let critical = 0;

    for (const item of items) {
      if (
        item.consecutiveFailures >= this.config.maxConsecutiveFailures ||
        item.successRate < this.config.minSuccessRate
      ) {
        critical++;
      } else if (
        item.consecutiveFailures > 0 ||
        item.successRate < 0.7 ||
        item.daysSinceLastUse > this.config.inactivityDaysThreshold / 2
      ) {
        warning++;
      } else {
        healthy++;
      }
    }

    return { healthy, warning, critical };
  }
}

// ============================================================================
// Singleton and Helpers
// ============================================================================

let defaultAgent: SelfEvolvingAgent | null = null;

/**
 * Get the default self-evolving agent
 */
export function getDefaultSelfEvolvingAgent(): SelfEvolvingAgent {
  if (!defaultAgent) {
    defaultAgent = new SelfEvolvingAgent();
  }
  return defaultAgent;
}

/**
 * Create a new self-evolving agent with custom config
 */
export function createSelfEvolvingAgent(
  config?: SelfEvolvingAgentConfig
): SelfEvolvingAgent {
  return new SelfEvolvingAgent(config);
}

/**
 * Start the default agent's evolution cycle
 */
export function startEvolution(): void {
  getDefaultSelfEvolvingAgent().start();
}

/**
 * Stop the default agent's evolution cycle
 */
export function stopEvolution(): void {
  getDefaultSelfEvolvingAgent().stop();
}

/**
 * Run a single evolution cycle
 */
export async function runEvolutionCycle(): Promise<EvolutionReport> {
  return getDefaultSelfEvolvingAgent().runEvolutionCycle();
}

/**
 * Learn from an execution trace
 */
export async function learnFromExecution(trace: ExecutionTrace): Promise<void> {
  return getDefaultSelfEvolvingAgent().learnFromExecution(trace);
}

/**
 * Get library health summary
 */
export function getLibraryHealth(): ReturnType<SelfEvolvingAgent['getLibraryHealth']> {
  return getDefaultSelfEvolvingAgent().getLibraryHealth();
}
