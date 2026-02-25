/**
 * Workflow Generator
 *
 * Automatically generates workflows from execution patterns.
 * Analyzes execution history to detect skill sequences that
 * could be combined into reusable workflows.
 *
 * Key features:
 * - Pattern detection for sequential skill execution
 * - Cluster pattern detection (same skill across profiles)
 * - Parallel execution opportunity detection
 * - Automatic workflow creation suggestions
 */

import type {
  BrowserWorkflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowSuggestion,
  SkillCallRecord,
  SimilarSkillGroup,
} from './workflow-types.ts';
import type { ExecutionTrace, ExecutionLogEntry, BrowserSkill } from './types.ts';
import {
  createWorkflow,
  getWorkflow,
  listWorkflows,
  findMatchingWorkflows,
} from './workflow-storage.ts';
import {
  listSkills,
  getSkill,
  readExecutionLogs,
} from './skill-storage.ts';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for workflow generator
 */
export interface WorkflowGeneratorConfig {
  /** Minimum frequency for pattern detection */
  minPatternFrequency?: number;

  /** Time window for sequence detection (ms) */
  sequenceTimeWindow?: number;

  /** Minimum similarity threshold for skill grouping */
  similarityThreshold?: number;

  /** Maximum workflow complexity (number of nodes) */
  maxWorkflowComplexity?: number;

  /** Whether to auto-save generated workflows */
  autoSaveWorkflows?: boolean;
}

const DEFAULT_CONFIG: Required<WorkflowGeneratorConfig> = {
  minPatternFrequency: 3,
  sequenceTimeWindow: 300000, // 5 minutes
  similarityThreshold: 0.8,
  maxWorkflowComplexity: 20,
  autoSaveWorkflows: false,
};

// ============================================================================
// Workflow Generator Class
// ============================================================================

/**
 * Workflow Generator
 *
 * Analyzes execution patterns and generates workflow suggestions.
 */
export class WorkflowGenerator {
  private config: Required<WorkflowGeneratorConfig>;

  constructor(config: WorkflowGeneratorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyze recent executions and find workflow patterns
   */
  async analyzeSkillPatterns(options?: {
    days?: number;
    limit?: number;
  }): Promise<WorkflowSuggestion[]> {
    const days = options?.days || 30;
    const limit = options?.limit || 1000;

    // Get execution logs
    const startTime = Date.now() - days * 24 * 60 * 60 * 1000;
    const logs = readExecutionLogs({ startTime, limit });

    if (logs.length < this.config.minPatternFrequency) {
      return [];
    }

    const suggestions: WorkflowSuggestion[] = [];

    // Find sequential patterns
    const sequentialPatterns = this.findSequentialPatterns(logs);
    for (const pattern of sequentialPatterns) {
      if (pattern.frequency >= this.config.minPatternFrequency) {
        suggestions.push({
          type: 'sequential',
          skills: pattern.skillIds,
          frequency: pattern.frequency,
          suggestedName: this.generateWorkflowName(pattern.skillIds, 'sequential'),
          suggestedDescription: this.generateWorkflowDescription(pattern.skillIds),
          confidence: this.calculatePatternConfidence(pattern),
          estimatedTimeSavingsMs: pattern.averageDurationMs * 0.3, // Estimate 30% savings
        });
      }
    }

    // Find cluster patterns (same skill across profiles)
    const clusterPatterns = this.findClusterPatterns(logs);
    for (const pattern of clusterPatterns) {
      if (pattern.profileCount >= 2) {
        const skill = getSkill(pattern.skillId);
        suggestions.push({
          type: 'cluster',
          skills: [pattern.skillId],
          profiles: pattern.profileIds,
          frequency: pattern.frequency,
          suggestedName: `Batch: ${skill?.name || pattern.skillId}`,
          suggestedDescription: `Execute ${skill?.name || pattern.skillId} across ${pattern.profileCount} profiles`,
          confidence: this.calculateClusterConfidence(pattern),
          estimatedTimeSavingsMs: pattern.averageDurationMs * (pattern.profileCount - 1) * 0.7,
        });
      }
    }

    // Find parallel execution opportunities
    const parallelPatterns = this.findParallelPatterns(logs);
    for (const pattern of parallelPatterns) {
      if (pattern.frequency >= this.config.minPatternFrequency) {
        suggestions.push({
          type: 'parallel',
          skills: pattern.skillIds,
          frequency: pattern.frequency,
          suggestedName: this.generateWorkflowName(pattern.skillIds, 'parallel'),
          suggestedDescription: `Execute ${pattern.skillIds.length} skills in parallel`,
          confidence: this.calculateParallelConfidence(pattern),
          estimatedTimeSavingsMs: pattern.averageDurationMs * 0.5,
        });
      }
    }

    // Sort by confidence and frequency
    suggestions.sort((a, b) => {
      const scoreA = a.confidence * 0.6 + (a.frequency / 10) * 0.4;
      const scoreB = b.confidence * 0.6 + (b.frequency / 10) * 0.4;
      return scoreB - scoreA;
    });

    return suggestions;
  }

  /**
   * Generate a workflow from an execution trace
   */
  async generateWorkflowFromTrace(
    trace: ExecutionTrace,
    options?: {
      name?: string;
      description?: string;
      saveToStorage?: boolean;
    }
  ): Promise<BrowserWorkflow | null> {
    // Extract skill calls from trace
    const skillCalls = this.extractSkillCalls(trace);

    if (skillCalls.length < 2) {
      return null; // Single skill doesn't need workflow
    }

    if (skillCalls.length > this.config.maxWorkflowComplexity) {
      return null; // Too complex
    }

    // Detect parallel execution opportunities
    const parallelGroups = this.detectParallelOpportunities(skillCalls);

    // Build workflow nodes
    const nodes: WorkflowNode[] = [
      { id: 'start', type: 'start', name: 'Start' },
    ];
    const edges: WorkflowEdge[] = [];

    let prevNodeId = 'start';
    let nodeIndex = 0;

    for (let i = 0; i < skillCalls.length; i++) {
      const call = skillCalls[i];

      // Check if this is part of a parallel group
      const parallelGroup = parallelGroups.find((g) => g.includes(i));

      if (parallelGroup && parallelGroup[0] === i) {
        // Create parallel node
        const parallelNodeId = `parallel_${nodeIndex++}`;
        const parallelChildIds: string[] = [];

        for (const idx of parallelGroup) {
          const childCall = skillCalls[idx];
          if (!childCall) continue;

          const childNodeId = `skill_${nodeIndex++}`;

          parallelChildIds.push(childNodeId);

          nodes.push({
            id: childNodeId,
            type: 'skill_call',
            name: childCall.skillName,
            skillCall: {
              skillId: childCall.skillId,
              parameterMapping: this.inferParameterMapping(childCall),
            },
          });
        }

        nodes.push({
          id: parallelNodeId,
          type: 'parallel',
          name: 'Parallel Execution',
          parallel: {
            nodeIds: parallelChildIds,
            waitAll: true,
          },
        });

        edges.push({
          id: `edge_${edges.length}`,
          sourceNodeId: prevNodeId,
          targetNodeId: parallelNodeId,
        });

        prevNodeId = parallelNodeId;

        // Skip the rest of the parallel group
        i = parallelGroup[parallelGroup.length - 1] ?? i;
      } else if (!parallelGroups.some((g) => g.includes(i))) {
        // Regular sequential node
        const call = skillCalls[i];
        if (!call) continue;

        const nodeId = `skill_${nodeIndex++}`;

        nodes.push({
          id: nodeId,
          type: 'skill_call',
          name: call.skillName,
          skillCall: {
            skillId: call.skillId,
            parameterMapping: this.inferParameterMapping(call),
          },
        });

        edges.push({
          id: `edge_${edges.length}`,
          sourceNodeId: prevNodeId,
          targetNodeId: nodeId,
        });

        prevNodeId = nodeId;
      }
    }

    // Add end node
    nodes.push({ id: 'end', type: 'end', name: 'End' });
    edges.push({
      id: `edge_${edges.length}`,
      sourceNodeId: prevNodeId,
      targetNodeId: 'end',
    });

    // Create workflow
    const workflowDef = {
      name: options?.name || this.generateWorkflowName(
        skillCalls.map((c) => c.skillId),
        'sequential'
      ),
      description: options?.description ||
        `Auto-generated from: ${trace.taskDescription}`,
      triggers: this.inferTriggers(skillCalls),
      nodes,
      edges,
      createdBy: 'agent' as const,
      metadata: {
        successRate: 1.0,
        executionCount: 0,
        averageDurationMs: trace.durationMs,
        consecutiveFailures: 0,
        sourceTraceIds: [trace.id],
      },
    };

    if (options?.saveToStorage) {
      return createWorkflow(workflowDef);
    }

    return {
      ...workflowDef,
      id: `wf_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Create a workflow from a suggestion
   */
  async createWorkflowFromSuggestion(
    suggestion: WorkflowSuggestion
  ): Promise<BrowserWorkflow | null> {
    const nodes: WorkflowNode[] = [
      { id: 'start', type: 'start', name: 'Start' },
    ];
    const edges: WorkflowEdge[] = [];

    let prevNodeId = 'start';
    let nodeIndex = 0;

    switch (suggestion.type) {
      case 'sequential': {
        for (const skillId of suggestion.skills) {
          const skill = getSkill(skillId);
          const nodeId = `skill_${nodeIndex++}`;

          nodes.push({
            id: nodeId,
            type: 'skill_call',
            name: skill?.name || skillId,
            skillCall: { skillId },
          });

          edges.push({
            id: `edge_${edges.length}`,
            sourceNodeId: prevNodeId,
            targetNodeId: nodeId,
          });

          prevNodeId = nodeId;
        }
        break;
      }

      case 'parallel': {
        const parallelNodeId = `parallel_${nodeIndex++}`;
        const childIds: string[] = [];

        for (const skillId of suggestion.skills) {
          const skill = getSkill(skillId);
          const nodeId = `skill_${nodeIndex++}`;

          childIds.push(nodeId);

          nodes.push({
            id: nodeId,
            type: 'skill_call',
            name: skill?.name || skillId,
            skillCall: { skillId },
          });
        }

        nodes.push({
          id: parallelNodeId,
          type: 'parallel',
          name: 'Parallel Execution',
          parallel: {
            nodeIds: childIds,
            waitAll: true,
          },
        });

        edges.push({
          id: `edge_${edges.length}`,
          sourceNodeId: prevNodeId,
          targetNodeId: parallelNodeId,
        });

        prevNodeId = parallelNodeId;
        break;
      }

      case 'cluster': {
        const skillId = suggestion.skills[0] ?? '';
        const skill = getSkill(skillId);
        const clusterNodeId = `cluster_${nodeIndex++}`;

        nodes.push({
          id: clusterNodeId,
          type: 'cluster',
          name: `Cluster: ${skill?.name || skillId}`,
          cluster: {
            profileIds: suggestion.profiles || [],
            skillId,
          },
        });

        edges.push({
          id: `edge_${edges.length}`,
          sourceNodeId: prevNodeId,
          targetNodeId: clusterNodeId,
        });

        prevNodeId = clusterNodeId;
        break;
      }
    }

    // Add end node
    nodes.push({ id: 'end', type: 'end', name: 'End' });
    edges.push({
      id: `edge_${edges.length}`,
      sourceNodeId: prevNodeId,
      targetNodeId: 'end',
    });

    return createWorkflow({
      name: suggestion.suggestedName,
      description: suggestion.suggestedDescription || '',
      triggers: {
        intentPatterns: [suggestion.suggestedName.toLowerCase()],
      },
      nodes,
      edges,
      createdBy: 'agent',
    });
  }

  /**
   * Find similar skills that could be merged
   */
  async findSimilarSkills(): Promise<SimilarSkillGroup[]> {
    const skills = listSkills();
    const groups: SimilarSkillGroup[] = [];
    const processed = new Set<string>();

    for (const skill of skills) {
      if (processed.has(skill.id)) continue;

      const similar: BrowserSkill[] = [skill];

      for (const other of skills) {
        if (other.id === skill.id || processed.has(other.id)) continue;

        const similarity = this.calculateSkillSimilarity(skill, other);
        if (similarity >= this.config.similarityThreshold) {
          similar.push(other);
          processed.add(other.id);
        }
      }

      if (similar.length > 1) {
        processed.add(skill.id);
        groups.push({
          skillIds: similar.map((s) => s.id),
          similarity: this.calculateGroupSimilarity(similar),
          suggestedName: this.suggestMergedName(similar),
          differences: this.identifyDifferences(similar),
        });
      }
    }

    return groups;
  }

  // ==========================================================================
  // Pattern Detection Helpers
  // ==========================================================================

  /**
   * Find sequential patterns in execution logs
   */
  private findSequentialPatterns(
    logs: ExecutionLogEntry[]
  ): Array<{
    skillIds: string[];
    frequency: number;
    averageDurationMs: number;
  }> {
    const patterns = new Map<string, {
      skillIds: string[];
      count: number;
      totalDurationMs: number;
    }>();

    // Group logs by time window
    const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < sortedLogs.length - 1; i++) {
      const currentLog = sortedLogs[i];
      if (!currentLog) continue;

      const sequence: string[] = [currentLog.skillId];
      let totalDuration = currentLog.durationMs;

      // Look ahead for skills within time window
      for (let j = i + 1; j < sortedLogs.length; j++) {
        const nextLog = sortedLogs[j];
        if (!nextLog) continue;

        const timeDiff = nextLog.timestamp - currentLog.timestamp;

        if (timeDiff > this.config.sequenceTimeWindow) break;

        sequence.push(nextLog.skillId);
        totalDuration += nextLog.durationMs;

        if (sequence.length >= 2) {
          const key = sequence.join('->');
          const existing = patterns.get(key);
          if (existing) {
            existing.count++;
            existing.totalDurationMs += totalDuration;
          } else {
            patterns.set(key, {
              skillIds: [...sequence],
              count: 1,
              totalDurationMs: totalDuration,
            });
          }
        }
      }
    }

    return Array.from(patterns.values())
      .filter((p) => p.count >= this.config.minPatternFrequency)
      .map((p) => ({
        skillIds: p.skillIds,
        frequency: p.count,
        averageDurationMs: p.totalDurationMs / p.count,
      }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Find cluster patterns (same skill across profiles)
   */
  private findClusterPatterns(
    logs: ExecutionLogEntry[]
  ): Array<{
    skillId: string;
    profileIds: string[];
    profileCount: number;
    frequency: number;
    averageDurationMs: number;
  }> {
    const patterns = new Map<string, {
      skillId: string;
      profiles: Set<string>;
      count: number;
      totalDurationMs: number;
    }>();

    for (const log of logs) {
      if (!log.profileId) continue;

      const existing = patterns.get(log.skillId);
      if (existing) {
        existing.profiles.add(log.profileId);
        existing.count++;
        existing.totalDurationMs += log.durationMs;
      } else {
        patterns.set(log.skillId, {
          skillId: log.skillId,
          profiles: new Set([log.profileId]),
          count: 1,
          totalDurationMs: log.durationMs,
        });
      }
    }

    return Array.from(patterns.values())
      .filter((p) => p.profiles.size >= 2)
      .map((p) => ({
        skillId: p.skillId,
        profileIds: Array.from(p.profiles),
        profileCount: p.profiles.size,
        frequency: p.count,
        averageDurationMs: p.totalDurationMs / p.count,
      }))
      .sort((a, b) => b.profileCount - a.profileCount);
  }

  /**
   * Find parallel execution opportunities
   */
  private findParallelPatterns(
    logs: ExecutionLogEntry[]
  ): Array<{
    skillIds: string[];
    frequency: number;
    averageDurationMs: number;
  }> {
    const patterns = new Map<string, {
      skillIds: string[];
      count: number;
      totalDurationMs: number;
    }>();

    // Group logs that executed very close together (within 1 second)
    const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < sortedLogs.length; i++) {
      const firstLog = sortedLogs[i];
      if (!firstLog) continue;

      const group: ExecutionLogEntry[] = [firstLog];
      let maxDuration = firstLog.durationMs;

      for (let j = i + 1; j < sortedLogs.length; j++) {
        const nextLog = sortedLogs[j];
        if (!nextLog) continue;

        const timeDiff = nextLog.timestamp - firstLog.timestamp;
        if (timeDiff > 1000) break; // Within 1 second

        // Different skills executed together
        if (!group.some((g) => g.skillId === nextLog.skillId)) {
          group.push(nextLog);
          maxDuration = Math.max(maxDuration, nextLog.durationMs);
        }
      }

      if (group.length >= 2) {
        const skillIds = group.map((g) => g.skillId).sort();
        const key = skillIds.join('||');

        const existing = patterns.get(key);
        if (existing) {
          existing.count++;
          existing.totalDurationMs += maxDuration;
        } else {
          patterns.set(key, {
            skillIds,
            count: 1,
            totalDurationMs: maxDuration,
          });
        }
      }
    }

    return Array.from(patterns.values())
      .filter((p) => p.count >= this.config.minPatternFrequency)
      .map((p) => ({
        skillIds: p.skillIds,
        frequency: p.count,
        averageDurationMs: p.totalDurationMs / p.count,
      }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Extract skill calls from an execution trace
   */
  private extractSkillCalls(trace: ExecutionTrace): SkillCallRecord[] {
    const calls: SkillCallRecord[] = [];

    for (const action of trace.actions) {
      if (action.type === 'mcp_call' && action.mcpTool) {
        // Check if this was a skill execution
        const skillId = action.mcpArgs?.skillId as string | undefined;
        if (skillId) {
          const skill = getSkill(skillId);
          calls.push({
            skillId,
            skillName: skill?.name || skillId,
            domain: skill?.domain || '',
            profileId: trace.profileId,
            timestamp: action.timestamp,
            durationMs: action.durationMs || 0,
            success: action.success,
            parameters: action.mcpArgs as Record<string, unknown>,
            result: action.mcpResult,
          });
        }
      }
    }

    return calls;
  }

  /**
   * Detect parallel execution opportunities in skill calls
   */
  private detectParallelOpportunities(
    skillCalls: SkillCallRecord[]
  ): number[][] {
    const groups: number[][] = [];
    const visited = new Set<number>();

    for (let i = 0; i < skillCalls.length; i++) {
      if (visited.has(i)) continue;

      const group = [i];

      for (let j = i + 1; j < skillCalls.length; j++) {
        if (visited.has(j)) continue;

        const call1 = skillCalls[i];
        const call2 = skillCalls[j];
        if (!call1 || !call2) continue;

        // Check if skills can run in parallel
        if (this.canRunInParallel(call1, call2)) {
          group.push(j);
          visited.add(j);
        }
      }

      if (group.length > 1) {
        groups.push(group);
      }
      visited.add(i);
    }

    return groups;
  }

  /**
   * Check if two skill calls can run in parallel
   */
  private canRunInParallel(
    call1: SkillCallRecord,
    call2: SkillCallRecord
  ): boolean {
    // Different domains can run in parallel
    if (call1.domain !== call2.domain) {
      return true;
    }

    // Different profiles can run in parallel
    if (call1.profileId && call2.profileId && call1.profileId !== call2.profileId) {
      return true;
    }

    // Same skill with different parameters might run in parallel
    if (call1.skillId === call2.skillId) {
      return false; // Conservative: don't parallelize same skill
    }

    return false;
  }

  // ==========================================================================
  // Similarity and Confidence Calculations
  // ==========================================================================

  /**
   * Calculate skill similarity
   */
  private calculateSkillSimilarity(skill1: BrowserSkill, skill2: BrowserSkill): number {
    let score = 0;

    // Same domain
    if (skill1.domain === skill2.domain) {
      score += 0.3;
    }

    // Similar number of steps
    const stepDiff = Math.abs(skill1.steps.length - skill2.steps.length);
    if (stepDiff <= 2) {
      score += 0.2 * (1 - stepDiff / 10);
    }

    // Similar step types
    const types1 = new Set(skill1.steps.map((s) => s.type));
    const types2 = new Set(skill2.steps.map((s) => s.type));
    const intersection = new Set([...types1].filter((t) => types2.has(t)));
    const union = new Set([...types1, ...types2]);
    score += 0.3 * (intersection.size / union.size);

    // Similar tags
    const tags1 = new Set(skill1.tags || []);
    const tags2 = new Set(skill2.tags || []);
    if (tags1.size > 0 && tags2.size > 0) {
      const tagIntersection = new Set([...tags1].filter((t) => tags2.has(t)));
      const tagUnion = new Set([...tags1, ...tags2]);
      score += 0.2 * (tagIntersection.size / tagUnion.size);
    }

    return score;
  }

  /**
   * Calculate group similarity
   */
  private calculateGroupSimilarity(skills: BrowserSkill[]): number {
    if (skills.length < 2) return 0;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < skills.length; i++) {
      for (let j = i + 1; j < skills.length; j++) {
        const skill1 = skills[i];
        const skill2 = skills[j];
        if (!skill1 || !skill2) continue;
        totalSimilarity += this.calculateSkillSimilarity(skill1, skill2);
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  /**
   * Calculate pattern confidence
   */
  private calculatePatternConfidence(pattern: {
    skillIds: string[];
    frequency: number;
    averageDurationMs: number;
  }): number {
    // Higher frequency = higher confidence
    const frequencyScore = Math.min(pattern.frequency / 10, 1) * 0.4;

    // Fewer skills = higher confidence
    const complexityScore = Math.max(0, 1 - pattern.skillIds.length / 10) * 0.3;

    // Check if all skills still exist
    const existenceScore = pattern.skillIds.every((id) => getSkill(id) !== null)
      ? 0.3
      : 0;

    return frequencyScore + complexityScore + existenceScore;
  }

  /**
   * Calculate cluster confidence
   */
  private calculateClusterConfidence(pattern: {
    skillId: string;
    profileCount: number;
    frequency: number;
  }): number {
    // More profiles = higher confidence
    const profileScore = Math.min(pattern.profileCount / 5, 1) * 0.4;

    // Higher frequency = higher confidence
    const frequencyScore = Math.min(pattern.frequency / 10, 1) * 0.3;

    // Skill exists
    const existenceScore = getSkill(pattern.skillId) !== null ? 0.3 : 0;

    return profileScore + frequencyScore + existenceScore;
  }

  /**
   * Calculate parallel confidence
   */
  private calculateParallelConfidence(pattern: {
    skillIds: string[];
    frequency: number;
  }): number {
    return this.calculatePatternConfidence({
      ...pattern,
      averageDurationMs: 0,
    });
  }

  // ==========================================================================
  // Name and Description Generation
  // ==========================================================================

  /**
   * Generate workflow name from skill IDs
   */
  private generateWorkflowName(skillIds: string[], type: string): string {
    const skills = skillIds.map((id) => getSkill(id)).filter(Boolean);

    if (skills.length === 0) {
      return `Auto-workflow-${Date.now().toString(36)}`;
    }

    if (skills.length === 1) {
      return skills[0]!.name;
    }

    // Find common domain
    const domains = new Set(skills.map((s) => s!.domain));
    const domainPrefix = domains.size === 1 ? `${skills[0]!.domain}: ` : '';

    // Create name based on type
    if (type === 'sequential') {
      return `${domainPrefix}${skills[0]!.name} → ${skills[skills.length - 1]!.name}`;
    } else if (type === 'parallel') {
      return `${domainPrefix}Parallel: ${skills.map((s) => s!.name).join(' + ')}`;
    }

    return `${domainPrefix}Workflow (${skills.length} skills)`;
  }

  /**
   * Generate workflow description
   */
  private generateWorkflowDescription(skillIds: string[]): string {
    const skills = skillIds.map((id) => getSkill(id)).filter(Boolean);

    if (skills.length === 0) {
      return 'Auto-generated workflow';
    }

    return `Executes: ${skills.map((s) => s!.name).join(' → ')}`;
  }

  /**
   * Suggest merged name for similar skills
   */
  private suggestMergedName(skills: BrowserSkill[]): string {
    if (skills.length === 0) return 'Merged Skill';

    // Find common prefix
    const names = skills.map((s) => s.name);
    const firstName = names[0] ?? '';
    let prefix = '';

    for (let i = 0; i < firstName.length; i++) {
      const char = firstName[i];
      if (names.every((n) => n[i] === char)) {
        prefix += char;
      } else {
        break;
      }
    }

    if (prefix.length > 3) {
      return prefix.trim();
    }

    // Use first skill name with modifier
    const firstSkill = skills[0];
    return firstSkill ? `${firstSkill.name} (merged)` : 'Merged Skill';
  }

  /**
   * Identify differences between similar skills
   */
  private identifyDifferences(skills: BrowserSkill[]): string[] {
    const differences: string[] = [];

    // Compare step counts
    const stepCounts = skills.map((s) => s.steps.length);
    if (Math.max(...stepCounts) !== Math.min(...stepCounts)) {
      differences.push(`Step count varies: ${Math.min(...stepCounts)}-${Math.max(...stepCounts)}`);
    }

    // Compare domains
    const domains = new Set(skills.map((s) => s.domain));
    if (domains.size > 1) {
      differences.push(`Domains: ${Array.from(domains).join(', ')}`);
    }

    // Compare parameters
    const paramSets = skills.map((s) => new Set(s.parameters?.map((p) => p.name) || []));
    const allParams = new Set(paramSets.flatMap((s) => Array.from(s)));
    const commonParams = Array.from(allParams).filter((p) =>
      paramSets.every((s) => s.has(p))
    );

    if (commonParams.length < allParams.size) {
      differences.push(`Different parameters: ${allParams.size - commonParams.length} vary`);
    }

    return differences;
  }

  /**
   * Infer triggers from skill calls
   */
  private inferTriggers(skillCalls: SkillCallRecord[]): {
    urlPattern?: string;
    intentPatterns?: string[];
  } {
    const skills = skillCalls.map((c) => getSkill(c.skillId)).filter(Boolean);

    // Combine triggers from all skills
    const urlPatterns: string[] = [];
    const intentPatterns: string[] = [];

    for (const skill of skills) {
      if (skill!.triggers.urlPattern) {
        urlPatterns.push(skill!.triggers.urlPattern);
      }
      if (skill!.triggers.intentPatterns) {
        intentPatterns.push(...skill!.triggers.intentPatterns);
      }
    }

    return {
      urlPattern: urlPatterns.length > 0 ? urlPatterns[0] : undefined,
      intentPatterns: intentPatterns.length > 0 ? [...new Set(intentPatterns)] : undefined,
    };
  }

  /**
   * Infer parameter mapping from skill call
   */
  private inferParameterMapping(
    call: SkillCallRecord
  ): Record<string, string> | undefined {
    if (!call.parameters || Object.keys(call.parameters).length === 0) {
      return undefined;
    }

    // Create passthrough mapping
    const mapping: Record<string, string> = {};
    for (const key of Object.keys(call.parameters)) {
      mapping[key] = `$params.${key}`;
    }

    return mapping;
  }

  // ==========================================================================
  // AI Creator - Natural Language to Workflow
  // ==========================================================================

  /**
   * Create a workflow from natural language description
   *
   * This is the "AI Creator" functionality that allows users to describe
   * what they want in plain language, and automatically generates a
   * workflow configuration.
   *
   * @param description Natural language description of the workflow
   * @param context Context for workflow creation
   * @returns Generated workflow or null if unable to create
   */
  async createFromDescription(
    description: string,
    context: WorkflowCreationContext = {}
  ): Promise<WorkflowCreationResult> {
    const { availableSkills, profiles, domain, saveToStorage = false } = context;

    // Get available skills if not provided
    const skills = availableSkills || listSkills();

    // Analyze the description
    const analysis = this.analyzeDescription(description, skills);

    if (analysis.matchedSkills.length === 0) {
      return {
        success: false,
        error: 'No matching skills found for the described workflow',
        suggestions: analysis.suggestions,
      };
    }

    // Determine workflow structure based on analysis
    const structure = this.determineWorkflowStructure(analysis, profiles);

    // Build the workflow
    const workflow = this.buildWorkflowFromAnalysis(
      description,
      analysis,
      structure,
      domain
    );

    // Validate the workflow
    const validation = this.validateWorkflow(workflow);
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid workflow: ${validation.errors.join(', ')}`,
        workflow,
      };
    }

    // Save if requested
    if (saveToStorage) {
      await createWorkflow(workflow);
    }

    return {
      success: true,
      workflow,
      analysis: {
        matchedSkills: analysis.matchedSkills.map((m) => ({
          skillId: m.skill.id,
          skillName: m.skill.name,
          confidence: m.confidence,
        })),
        detectedPatterns: analysis.patterns,
        isParallel: structure.type === 'parallel',
        isCluster: structure.type === 'cluster',
      },
    };
  }

  /**
   * Analyze natural language description to extract intent and match skills
   */
  private analyzeDescription(
    description: string,
    skills: BrowserSkill[]
  ): DescriptionAnalysis {
    const normalizedDesc = description.toLowerCase();
    const matchedSkills: SkillMatchResult[] = [];
    const patterns: string[] = [];
    const suggestions: string[] = [];

    // Detect workflow patterns from keywords
    if (this.containsParallelKeywords(normalizedDesc)) {
      patterns.push('parallel');
    }
    if (this.containsSequentialKeywords(normalizedDesc)) {
      patterns.push('sequential');
    }
    if (this.containsClusterKeywords(normalizedDesc)) {
      patterns.push('cluster');
    }
    if (this.containsConditionalKeywords(normalizedDesc)) {
      patterns.push('conditional');
    }
    if (this.containsLoopKeywords(normalizedDesc)) {
      patterns.push('loop');
    }

    // Match skills based on description
    for (const skill of skills) {
      const confidence = this.calculateSkillMatch(normalizedDesc, skill);
      if (confidence > 0.3) {
        matchedSkills.push({ skill, confidence });
      }
    }

    // Sort by confidence
    matchedSkills.sort((a, b) => b.confidence - a.confidence);

    // Generate suggestions if no good matches
    const topMatch = matchedSkills[0];
    if (matchedSkills.length === 0 || (topMatch && topMatch.confidence < 0.5)) {
      suggestions.push('Try describing the task more specifically');
      suggestions.push('Mention the website or platform name');
      suggestions.push('Use action words like "download", "extract", "submit"');

      // Suggest similar skill names
      const similarSkills = this.findSimilarSkillNames(description, skills);
      if (similarSkills.length > 0) {
        suggestions.push(`Did you mean: ${similarSkills.slice(0, 3).join(', ')}?`);
      }
    }

    return {
      originalDescription: description,
      matchedSkills,
      patterns,
      suggestions,
      parameters: this.extractParametersFromDescription(description),
    };
  }

  /**
   * Check for parallel execution keywords
   */
  private containsParallelKeywords(text: string): boolean {
    const keywords = [
      'simultaneously',
      'at the same time',
      'in parallel',
      'concurrently',
      'all at once',
      'together',
      'parallel',
    ];
    return keywords.some((k) => text.includes(k));
  }

  /**
   * Check for sequential execution keywords
   */
  private containsSequentialKeywords(text: string): boolean {
    const keywords = [
      'then',
      'after that',
      'next',
      'followed by',
      'and then',
      'step by step',
      'sequentially',
      'in order',
      'first...then',
    ];
    return keywords.some((k) => text.includes(k));
  }

  /**
   * Check for cluster execution keywords
   */
  private containsClusterKeywords(text: string): boolean {
    const keywords = [
      'all stores',
      'all accounts',
      'all profiles',
      'every store',
      'every account',
      'each store',
      'each account',
      'multiple stores',
      'multiple accounts',
      'across all',
      'batch',
      'bulk',
    ];
    return keywords.some((k) => text.includes(k));
  }

  /**
   * Check for conditional keywords
   */
  private containsConditionalKeywords(text: string): boolean {
    const keywords = [
      'if',
      'when',
      'in case',
      'otherwise',
      'else',
      'depending on',
      'based on',
      'conditionally',
    ];
    return keywords.some((k) => text.includes(k));
  }

  /**
   * Check for loop keywords
   */
  private containsLoopKeywords(text: string): boolean {
    const keywords = [
      'for each',
      'repeat',
      'loop',
      'iterate',
      'every item',
      'all items',
      'each row',
      'all rows',
    ];
    return keywords.some((k) => text.includes(k));
  }

  /**
   * Calculate match confidence between description and skill
   */
  private calculateSkillMatch(description: string, skill: BrowserSkill): number {
    let score = 0;

    // Match skill name
    const nameWords = skill.name.toLowerCase().split(/\s+/);
    for (const word of nameWords) {
      if (word.length > 2 && description.includes(word)) {
        score += 0.2;
      }
    }

    // Match skill description
    if (skill.description) {
      const descWords = skill.description.toLowerCase().split(/\s+/);
      for (const word of descWords) {
        if (word.length > 3 && description.includes(word)) {
          score += 0.1;
        }
      }
    }

    // Match intent patterns
    if (skill.triggers.intentPatterns) {
      for (const pattern of skill.triggers.intentPatterns) {
        if (description.includes(pattern.toLowerCase())) {
          score += 0.4;
        }
      }
    }

    // Match domain
    if (skill.domain && description.includes(skill.domain.toLowerCase())) {
      score += 0.3;
    }

    // Match tags
    if (skill.tags) {
      for (const tag of skill.tags) {
        if (description.includes(tag.toLowerCase())) {
          score += 0.15;
        }
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Find similar skill names for suggestions
   */
  private findSimilarSkillNames(description: string, skills: BrowserSkill[]): string[] {
    const words = description.toLowerCase().split(/\s+/);
    const similar: { name: string; score: number }[] = [];

    for (const skill of skills) {
      const nameWords = skill.name.toLowerCase().split(/\s+/);
      let matchCount = 0;

      for (const word of words) {
        for (const nameWord of nameWords) {
          if (this.levenshteinDistance(word, nameWord) <= 2) {
            matchCount++;
          }
        }
      }

      if (matchCount > 0) {
        similar.push({ name: skill.name, score: matchCount });
      }
    }

    return similar
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((s) => s.name);
  }

  /**
   * Simple Levenshtein distance for fuzzy matching
   */
  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0]![j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1,
            matrix[i]![j - 1]! + 1,
            matrix[i - 1]![j]! + 1
          );
        }
      }
    }

    return matrix[b.length]![a.length]!;
  }

  /**
   * Extract parameters from description
   */
  private extractParametersFromDescription(
    description: string
  ): ExtractedParameter[] {
    const parameters: ExtractedParameter[] = [];

    // Extract date ranges
    const datePatterns = [
      /last (\d+) days?/i,
      /past (\d+) days?/i,
      /(\d+) days? ago/i,
      /this week/i,
      /last week/i,
      /this month/i,
      /last month/i,
    ];

    for (const pattern of datePatterns) {
      const match = description.match(pattern);
      if (match) {
        parameters.push({
          name: 'dateRange',
          value: match[0],
          type: 'date',
        });
        break;
      }
    }

    // Extract numbers
    const numberMatch = description.match(/\b(\d+)\b/g);
    if (numberMatch) {
      parameters.push({
        name: 'count',
        value: numberMatch[0]!,
        type: 'number',
      });
    }

    // Extract quoted strings
    const quotedMatch = description.match(/"([^"]+)"|'([^']+)'/g);
    if (quotedMatch) {
      quotedMatch.forEach((match, i) => {
        parameters.push({
          name: `text${i + 1}`,
          value: match.replace(/['"]/g, ''),
          type: 'string',
        });
      });
    }

    return parameters;
  }

  /**
   * Determine workflow structure based on analysis
   */
  private determineWorkflowStructure(
    analysis: DescriptionAnalysis,
    profiles?: string[]
  ): WorkflowStructure {
    const { patterns, matchedSkills } = analysis;

    // Check for cluster pattern first (highest priority)
    if (patterns.includes('cluster') && profiles && profiles.length > 1) {
      return {
        type: 'cluster',
        profiles,
        skills: matchedSkills.slice(0, 1).map((m) => m.skill.id),
      };
    }

    // Check for parallel pattern
    if (patterns.includes('parallel') && matchedSkills.length > 1) {
      return {
        type: 'parallel',
        skills: matchedSkills.slice(0, 5).map((m) => m.skill.id),
      };
    }

    // Default to sequential
    return {
      type: 'sequential',
      skills: matchedSkills.slice(0, 10).map((m) => m.skill.id),
    };
  }

  /**
   * Build workflow from analysis results
   */
  private buildWorkflowFromAnalysis(
    description: string,
    analysis: DescriptionAnalysis,
    structure: WorkflowStructure,
    domain?: string
  ): BrowserWorkflow {
    const workflowId = generateId();
    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];

    // Start node
    nodes.push({
      id: 'start',
      type: 'start',
      name: 'Start',
    });

    let prevNodeId = 'start';

    if (structure.type === 'cluster' && structure.profiles) {
      // Create cluster node
      const clusterNodeId = `cluster_${generateId()}`;
      nodes.push({
        id: clusterNodeId,
        type: 'cluster',
        name: 'Execute on all profiles',
        cluster: {
          profileIds: structure.profiles,
          skillId: structure.skills[0]!,
          aggregation: 'all',
        },
      });

      edges.push({
        id: `edge_${generateId()}`,
        sourceNodeId: prevNodeId,
        targetNodeId: clusterNodeId,
      });
      prevNodeId = clusterNodeId;
    } else if (structure.type === 'parallel') {
      // Create parallel node
      const parallelNodeId = `parallel_${generateId()}`;
      const skillNodeIds: string[] = [];

      for (const skillId of structure.skills) {
        const skill = getSkill(skillId);
        const nodeId = `skill_${generateId()}`;
        skillNodeIds.push(nodeId);

        nodes.push({
          id: nodeId,
          type: 'skill_call',
          name: skill?.name || skillId,
          skillCall: {
            skillId,
          },
        });
      }

      nodes.push({
        id: parallelNodeId,
        type: 'parallel',
        name: 'Parallel execution',
        parallel: {
          nodeIds: skillNodeIds,
          waitAll: true,
        },
      });

      edges.push({
        id: `edge_${generateId()}`,
        sourceNodeId: prevNodeId,
        targetNodeId: parallelNodeId,
      });
      prevNodeId = parallelNodeId;
    } else {
      // Sequential execution
      for (let i = 0; i < structure.skills.length; i++) {
        const skillId = structure.skills[i]!;
        const skill = getSkill(skillId);
        const nodeId = `skill_${i}_${generateId()}`;

        nodes.push({
          id: nodeId,
          type: 'skill_call',
          name: skill?.name || skillId,
          skillCall: {
            skillId,
          },
        });

        edges.push({
          id: `edge_${generateId()}`,
          sourceNodeId: prevNodeId,
          targetNodeId: nodeId,
        });
        prevNodeId = nodeId;
      }
    }

    // End node
    nodes.push({
      id: 'end',
      type: 'end',
      name: 'End',
    });

    edges.push({
      id: `edge_end_${generateId()}`,
      sourceNodeId: prevNodeId,
      targetNodeId: 'end',
    });

    // Build workflow object
    const workflow: BrowserWorkflow = {
      id: workflowId,
      name: this.generateWorkflowNameFromDescription(description),
      description: description,
      triggers: {
        intentPatterns: [description.toLowerCase()],
      },
      nodes,
      edges,
      parameters: analysis.parameters.map((p) => ({
        name: p.name,
        label: this.capitalize(p.name.replace(/([A-Z])/g, ' $1').trim()),
        type: p.type === 'number' ? 'number' : 'string',
        required: false,
        defaultValue: p.value,
      })),
      createdBy: 'agent',
      metadata: {
        successRate: 1,
        executionCount: 0,
        averageDurationMs: 0,
        consecutiveFailures: 0,
      },
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (domain) {
      workflow.tags = [domain];
    }

    return workflow;
  }

  /**
   * Generate a concise workflow name from description
   */
  private generateWorkflowNameFromDescription(description: string): string {
    // Extract key action words
    const actionWords = ['download', 'extract', 'export', 'import', 'submit', 'update', 'check', 'verify', 'create', 'delete', 'send', 'get', 'fetch'];

    const words = description.toLowerCase().split(/\s+/);
    const foundAction = actionWords.find((a) => words.includes(a));

    // Extract key nouns (simplistic approach)
    const keyNouns = words
      .filter((w) => w.length > 4 && !actionWords.includes(w))
      .slice(0, 2);

    if (foundAction && keyNouns.length > 0) {
      return `${this.capitalize(foundAction)} ${keyNouns.join(' ')}`;
    }

    // Fallback: use first 5 words
    return words.slice(0, 5).map((w) => this.capitalize(w)).join(' ');
  }

  /**
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Validate workflow structure
   */
  private validateWorkflow(workflow: BrowserWorkflow): WorkflowValidation {
    const errors: string[] = [];

    // Check for start node
    if (!workflow.nodes.find((n) => n.type === 'start')) {
      errors.push('Missing start node');
    }

    // Check for end node
    if (!workflow.nodes.find((n) => n.type === 'end')) {
      errors.push('Missing end node');
    }

    // Check for orphan nodes
    const connectedNodes = new Set<string>();
    for (const edge of workflow.edges) {
      connectedNodes.add(edge.sourceNodeId);
      connectedNodes.add(edge.targetNodeId);
    }

    for (const node of workflow.nodes) {
      if (!connectedNodes.has(node.id) && node.type !== 'start') {
        errors.push(`Orphan node: ${node.id}`);
      }
    }

    // Check skill references
    for (const node of workflow.nodes) {
      if (node.type === 'skill_call' && node.skillCall) {
        const skill = getSkill(node.skillCall.skillId);
        if (!skill) {
          errors.push(`Referenced skill not found: ${node.skillCall.skillId}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// ============================================================================
// AI Creator Types
// ============================================================================

/**
 * Context for workflow creation from description
 */
export interface WorkflowCreationContext {
  /** Available skills to use in the workflow */
  availableSkills?: BrowserSkill[];

  /** Available profiles for cluster execution */
  profiles?: string[];

  /** Target domain */
  domain?: string;

  /** Whether to save the workflow to storage */
  saveToStorage?: boolean;
}

/**
 * Result of workflow creation from description
 */
export interface WorkflowCreationResult {
  /** Whether creation was successful */
  success: boolean;

  /** Created workflow (if successful) */
  workflow?: BrowserWorkflow;

  /** Error message (if failed) */
  error?: string;

  /** Suggestions for improvement */
  suggestions?: string[];

  /** Analysis details */
  analysis?: {
    matchedSkills: Array<{
      skillId: string;
      skillName: string;
      confidence: number;
    }>;
    detectedPatterns: string[];
    isParallel: boolean;
    isCluster: boolean;
  };
}

/**
 * Internal analysis result
 */
interface DescriptionAnalysis {
  originalDescription: string;
  matchedSkills: SkillMatchResult[];
  patterns: string[];
  suggestions: string[];
  parameters: ExtractedParameter[];
}

/**
 * Skill match result
 */
interface SkillMatchResult {
  skill: BrowserSkill;
  confidence: number;
}

/**
 * Extracted parameter from description
 */
interface ExtractedParameter {
  name: string;
  value: string;
  type: 'string' | 'number' | 'date';
}

/**
 * Workflow structure determination
 */
interface WorkflowStructure {
  type: 'sequential' | 'parallel' | 'cluster';
  skills: string[];
  profiles?: string[];
}

/**
 * Workflow validation result
 */
interface WorkflowValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Singleton and Helpers
// ============================================================================

let defaultGenerator: WorkflowGenerator | null = null;

/**
 * Get the default workflow generator
 */
export function getDefaultWorkflowGenerator(): WorkflowGenerator {
  if (!defaultGenerator) {
    defaultGenerator = new WorkflowGenerator();
  }
  return defaultGenerator;
}

/**
 * Create a new workflow generator with custom config
 */
export function createWorkflowGenerator(
  config?: WorkflowGeneratorConfig
): WorkflowGenerator {
  return new WorkflowGenerator(config);
}

/**
 * Analyze patterns and get suggestions
 */
export async function analyzePatterns(options?: {
  days?: number;
  limit?: number;
}): Promise<WorkflowSuggestion[]> {
  return getDefaultWorkflowGenerator().analyzeSkillPatterns(options);
}

/**
 * Generate workflow from trace
 */
export async function generateWorkflowFromTrace(
  trace: ExecutionTrace,
  options?: {
    name?: string;
    description?: string;
    saveToStorage?: boolean;
  }
): Promise<BrowserWorkflow | null> {
  return getDefaultWorkflowGenerator().generateWorkflowFromTrace(trace, options);
}
