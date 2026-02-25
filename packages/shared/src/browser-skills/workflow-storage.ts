/**
 * Workflow Storage
 *
 * CRUD operations for browser workflows with persistence.
 * Workflows are stored in ~/.craft-agent/browser-skills/workflows/
 *
 * Storage structure:
 * ~/.craft-agent/browser-skills/
 * ├── workflows/
 * │   ├── index.json           # Workflow index for fast lookup
 * │   ├── {workflow-id}.json   # Individual workflow files
 * │   └── ...
 * └── logs/
 *     └── workflow-executions.jsonl  # Workflow execution log
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, appendFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type {
  BrowserWorkflow,
  WorkflowIndex,
  WorkflowIndexEntry,
  WorkflowExecutionLogEntry,
  WorkflowEvent,
  WorkflowEventListener,
  WorkflowMetadata,
} from './workflow-types.ts';
import type { SkillTriggers } from './types.ts';

// ============================================================================
// Configuration
// ============================================================================

const BROWSER_SKILLS_DIR = join(homedir(), '.craft-agent', 'browser-skills');
const WORKFLOWS_DIR = join(BROWSER_SKILLS_DIR, 'workflows');
const LOGS_DIR = join(BROWSER_SKILLS_DIR, 'logs');
const WORKFLOW_INDEX_FILE = join(WORKFLOWS_DIR, 'index.json');
const WORKFLOW_EXECUTION_LOG_FILE = join(LOGS_DIR, 'workflow-executions.jsonl');

const INDEX_VERSION = 1;

// ============================================================================
// Event System
// ============================================================================

const eventListeners = new Set<WorkflowEventListener>();

/**
 * Add workflow event listener
 */
export function addWorkflowEventListener(listener: WorkflowEventListener): void {
  eventListeners.add(listener);
}

/**
 * Remove workflow event listener
 */
export function removeWorkflowEventListener(listener: WorkflowEventListener): void {
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
      console.error('[WorkflowStorage] Event listener error:', err);
    }
  }
}

// ============================================================================
// Directory Management
// ============================================================================

/**
 * Ensure all required directories exist
 */
export function ensureWorkflowDirectories(): void {
  if (!existsSync(BROWSER_SKILLS_DIR)) {
    mkdirSync(BROWSER_SKILLS_DIR, { recursive: true });
  }
  if (!existsSync(WORKFLOWS_DIR)) {
    mkdirSync(WORKFLOWS_DIR, { recursive: true });
  }
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }
}

/**
 * Get the workflows directory
 */
export function getWorkflowsDir(): string {
  return WORKFLOWS_DIR;
}

// ============================================================================
// Index Management
// ============================================================================

/**
 * Load workflow index
 */
export function loadWorkflowIndex(): WorkflowIndex {
  ensureWorkflowDirectories();

  if (!existsSync(WORKFLOW_INDEX_FILE)) {
    return {
      version: INDEX_VERSION,
      workflows: {},
      updatedAt: Date.now(),
    };
  }

  try {
    const content = readFileSync(WORKFLOW_INDEX_FILE, 'utf-8');
    return JSON.parse(content) as WorkflowIndex;
  } catch {
    return {
      version: INDEX_VERSION,
      workflows: {},
      updatedAt: Date.now(),
    };
  }
}

/**
 * Save workflow index
 */
export function saveWorkflowIndex(index: WorkflowIndex): void {
  ensureWorkflowDirectories();
  index.updatedAt = Date.now();
  writeFileSync(WORKFLOW_INDEX_FILE, JSON.stringify(index, null, 2));
}

/**
 * Update index entry for a workflow
 */
function updateWorkflowIndexEntry(workflow: BrowserWorkflow): void {
  const index = loadWorkflowIndex();
  index.workflows[workflow.id] = {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    tags: workflow.tags,
    successRate: workflow.metadata.successRate,
    lastUsedAt: workflow.metadata.lastUsedAt,
    skillCount: countSkillsInWorkflow(workflow),
    filePath: join(WORKFLOWS_DIR, `${workflow.id}.json`),
  };
  saveWorkflowIndex(index);
}

/**
 * Remove index entry for a workflow
 */
function removeWorkflowIndexEntry(workflowId: string): void {
  const index = loadWorkflowIndex();
  delete index.workflows[workflowId];
  saveWorkflowIndex(index);
}

/**
 * Rebuild workflow index from files
 */
export function rebuildWorkflowIndex(): WorkflowIndex {
  ensureWorkflowDirectories();

  const index: WorkflowIndex = {
    version: INDEX_VERSION,
    workflows: {},
    updatedAt: Date.now(),
  };

  try {
    const files = readdirSync(WORKFLOWS_DIR);
    for (const file of files) {
      if (!file.endsWith('.json') || file === 'index.json') continue;

      const workflowPath = join(WORKFLOWS_DIR, file);
      try {
        const content = readFileSync(workflowPath, 'utf-8');
        const workflow = JSON.parse(content) as BrowserWorkflow;
        index.workflows[workflow.id] = {
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          tags: workflow.tags,
          successRate: workflow.metadata.successRate,
          lastUsedAt: workflow.metadata.lastUsedAt,
          skillCount: countSkillsInWorkflow(workflow),
          filePath: workflowPath,
        };
      } catch {
        // Skip invalid workflow files
      }
    }
  } catch {
    // Workflows directory doesn't exist or can't be read
  }

  saveWorkflowIndex(index);
  return index;
}

/**
 * Count the number of skills referenced in a workflow
 */
function countSkillsInWorkflow(workflow: BrowserWorkflow): number {
  const skillIds = new Set<string>();

  for (const node of workflow.nodes) {
    if (node.type === 'skill_call' && node.skillCall?.skillId) {
      skillIds.add(node.skillCall.skillId);
    }
    if (node.type === 'cluster' && node.cluster?.skillId) {
      skillIds.add(node.cluster.skillId);
    }
  }

  return skillIds.size;
}

// ============================================================================
// Workflow CRUD Operations
// ============================================================================

/**
 * Generate a unique workflow ID
 */
export function generateWorkflowId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `wf_${timestamp}_${random}`;
}

/**
 * Get workflow file path
 */
function getWorkflowPath(workflowId: string): string {
  return join(WORKFLOWS_DIR, `${workflowId}.json`);
}

/**
 * Create a new workflow
 */
export function createWorkflow(
  workflow: Omit<BrowserWorkflow, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'metadata'> & {
    metadata?: Partial<WorkflowMetadata>;
  }
): BrowserWorkflow {
  ensureWorkflowDirectories();

  const now = Date.now();
  const defaultMetadata: WorkflowMetadata = {
    successRate: 1.0,
    executionCount: 0,
    averageDurationMs: 0,
    consecutiveFailures: 0,
  };

  const newWorkflow: BrowserWorkflow = {
    ...workflow,
    id: generateWorkflowId(),
    version: 1,
    metadata: { ...defaultMetadata, ...workflow.metadata },
    createdAt: now,
    updatedAt: now,
  };

  const workflowPath = getWorkflowPath(newWorkflow.id);
  writeFileSync(workflowPath, JSON.stringify(newWorkflow, null, 2));

  updateWorkflowIndexEntry(newWorkflow);
  emit({ type: 'workflow_created', workflow: newWorkflow });

  return newWorkflow;
}

/**
 * Get a workflow by ID
 */
export function getWorkflow(workflowId: string): BrowserWorkflow | null {
  const workflowPath = getWorkflowPath(workflowId);

  if (!existsSync(workflowPath)) {
    return null;
  }

  try {
    const content = readFileSync(workflowPath, 'utf-8');
    return JSON.parse(content) as BrowserWorkflow;
  } catch {
    return null;
  }
}

/**
 * Update a workflow
 */
export function updateWorkflow(
  workflowId: string,
  updates: Partial<Omit<BrowserWorkflow, 'id' | 'createdAt'>>
): BrowserWorkflow | null {
  const workflow = getWorkflow(workflowId);
  if (!workflow) return null;

  const updatedWorkflow: BrowserWorkflow = {
    ...workflow,
    ...updates,
    id: workflow.id,
    createdAt: workflow.createdAt,
    version: workflow.version + 1,
    updatedAt: Date.now(),
    metadata: {
      ...workflow.metadata,
      ...updates.metadata,
    },
  };

  const workflowPath = getWorkflowPath(workflowId);
  writeFileSync(workflowPath, JSON.stringify(updatedWorkflow, null, 2));

  updateWorkflowIndexEntry(updatedWorkflow);

  const changes = Object.keys(updates);
  emit({ type: 'workflow_updated', workflow: updatedWorkflow, changes });

  return updatedWorkflow;
}

/**
 * Delete a workflow
 */
export function deleteWorkflow(workflowId: string): boolean {
  const workflowPath = getWorkflowPath(workflowId);

  if (!existsSync(workflowPath)) {
    return false;
  }

  try {
    rmSync(workflowPath);
    removeWorkflowIndexEntry(workflowId);
    emit({ type: 'workflow_deleted', workflowId });
    return true;
  } catch {
    return false;
  }
}

/**
 * List all workflows
 */
export function listWorkflows(): BrowserWorkflow[] {
  ensureWorkflowDirectories();

  const workflows: BrowserWorkflow[] = [];

  try {
    const files = readdirSync(WORKFLOWS_DIR);
    for (const file of files) {
      if (!file.endsWith('.json') || file === 'index.json') continue;

      const workflowPath = join(WORKFLOWS_DIR, file);
      try {
        const content = readFileSync(workflowPath, 'utf-8');
        workflows.push(JSON.parse(content) as BrowserWorkflow);
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Workflows directory doesn't exist
  }

  return workflows;
}

/**
 * List workflows by tag
 */
export function listWorkflowsByTag(tag: string): BrowserWorkflow[] {
  return listWorkflows().filter((w) => w.tags?.includes(tag));
}

/**
 * Search workflows by query (name, description)
 */
export function searchWorkflows(query: string): BrowserWorkflow[] {
  const lowerQuery = query.toLowerCase();
  return listWorkflows().filter(
    (w) =>
      w.name.toLowerCase().includes(lowerQuery) ||
      w.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Find workflows matching the given triggers
 */
export function findMatchingWorkflows(
  intent: string,
  context?: { url?: string; title?: string }
): BrowserWorkflow[] {
  const workflows = listWorkflows();
  const matches: Array<{ workflow: BrowserWorkflow; score: number }> = [];

  for (const workflow of workflows) {
    let score = 0;

    // Check intent patterns
    if (workflow.triggers.intentPatterns) {
      for (const pattern of workflow.triggers.intentPatterns) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(intent)) {
          score += 0.5;
          break;
        }
      }
    }

    // Check URL pattern
    if (workflow.triggers.urlPattern && context?.url) {
      const regex = new RegExp(workflow.triggers.urlPattern, 'i');
      if (regex.test(context.url)) {
        score += 0.3;
      }
    }

    // Check title pattern
    if (workflow.triggers.titlePattern && context?.title) {
      const regex = new RegExp(workflow.triggers.titlePattern, 'i');
      if (regex.test(context.title)) {
        score += 0.2;
      }
    }

    // Minimum confidence threshold
    const minConfidence = workflow.triggers.minConfidence || 0.3;
    if (score >= minConfidence) {
      matches.push({ workflow, score });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  return matches.map((m) => m.workflow);
}

// ============================================================================
// Workflow Statistics
// ============================================================================

/**
 * Record workflow execution result
 */
export function recordWorkflowExecution(
  workflowId: string,
  success: boolean,
  durationMs: number,
  options?: {
    error?: string;
    parameters?: Record<string, unknown>;
    nodeSummary?: Record<string, { success: boolean; durationMs: number }>;
    profileIds?: string[];
  }
): void {
  const workflow = getWorkflow(workflowId);
  if (!workflow) return;

  // Update workflow statistics
  const executionCount = workflow.metadata.executionCount + 1;
  const consecutiveFailures = success ? 0 : workflow.metadata.consecutiveFailures + 1;

  // Calculate new success rate (exponential moving average)
  const alpha = 0.3;
  const newSuccessRate = alpha * (success ? 1 : 0) + (1 - alpha) * workflow.metadata.successRate;

  // Calculate new average duration (moving average)
  const newAverageDuration =
    (workflow.metadata.averageDurationMs * workflow.metadata.executionCount + durationMs) /
    executionCount;

  updateWorkflow(workflowId, {
    metadata: {
      ...workflow.metadata,
      executionCount,
      consecutiveFailures,
      successRate: newSuccessRate,
      averageDurationMs: newAverageDuration,
      lastUsedAt: Date.now(),
      lastSuccessAt: success ? Date.now() : workflow.metadata.lastSuccessAt,
    },
  });

  // Log execution
  logWorkflowExecution({
    id: `wfexec_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    workflowId,
    timestamp: Date.now(),
    success,
    durationMs,
    error: options?.error,
    parameters: options?.parameters,
    nodeSummary: options?.nodeSummary,
    profileIds: options?.profileIds,
  });
}

/**
 * Deprecate a workflow
 */
export function deprecateWorkflow(workflowId: string, reason: string): boolean {
  const workflow = getWorkflow(workflowId);
  if (!workflow) return false;

  // Add deprecated tag
  const tags = workflow.tags || [];
  if (!tags.includes('deprecated')) {
    tags.push('deprecated');
  }

  updateWorkflow(workflowId, {
    tags,
    description: `[DEPRECATED: ${reason}] ${workflow.description}`,
  });

  emit({ type: 'workflow_deprecated', workflowId, reason });
  return true;
}

/**
 * Get workflow statistics
 */
export function getWorkflowStats(workflowId: string): {
  executionCount: number;
  successRate: number;
  consecutiveFailures: number;
  averageDurationMs: number;
  lastUsedAt?: number;
  lastSuccessAt?: number;
  daysSinceLastUse: number;
} | null {
  const workflow = getWorkflow(workflowId);
  if (!workflow) return null;

  const now = Date.now();
  const daysSinceLastUse = workflow.metadata.lastUsedAt
    ? Math.floor((now - workflow.metadata.lastUsedAt) / (1000 * 60 * 60 * 24))
    : Infinity;

  return {
    executionCount: workflow.metadata.executionCount,
    successRate: workflow.metadata.successRate,
    consecutiveFailures: workflow.metadata.consecutiveFailures,
    averageDurationMs: workflow.metadata.averageDurationMs,
    lastUsedAt: workflow.metadata.lastUsedAt,
    lastSuccessAt: workflow.metadata.lastSuccessAt,
    daysSinceLastUse,
  };
}

// ============================================================================
// Execution Logging
// ============================================================================

/**
 * Log a workflow execution entry
 */
export function logWorkflowExecution(entry: WorkflowExecutionLogEntry): void {
  ensureWorkflowDirectories();

  const line = JSON.stringify(entry) + '\n';

  try {
    appendFileSync(WORKFLOW_EXECUTION_LOG_FILE, line);
  } catch {
    // Ignore logging errors
  }
}

/**
 * Read workflow execution logs (with pagination)
 */
export function readWorkflowExecutionLogs(options?: {
  workflowId?: string;
  limit?: number;
  offset?: number;
  startTime?: number;
  endTime?: number;
}): WorkflowExecutionLogEntry[] {
  if (!existsSync(WORKFLOW_EXECUTION_LOG_FILE)) {
    return [];
  }

  try {
    const content = readFileSync(WORKFLOW_EXECUTION_LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    let entries = lines
      .map((line) => {
        try {
          return JSON.parse(line) as WorkflowExecutionLogEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is WorkflowExecutionLogEntry => e !== null);

    // Filter by workflow ID
    if (options?.workflowId) {
      entries = entries.filter((e) => e.workflowId === options.workflowId);
    }

    // Filter by time range
    if (options?.startTime) {
      entries = entries.filter((e) => e.timestamp >= options.startTime!);
    }
    if (options?.endTime) {
      entries = entries.filter((e) => e.timestamp <= options.endTime!);
    }

    // Sort by timestamp descending (newest first)
    entries.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return entries.slice(offset, offset + limit);
  } catch {
    return [];
  }
}

/**
 * Get workflow execution summary
 */
export function getWorkflowExecutionSummary(workflowId: string, days: number = 30): {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDurationMs: number;
  successRate: number;
  mostCommonError?: string;
} {
  const startTime = Date.now() - days * 24 * 60 * 60 * 1000;
  const logs = readWorkflowExecutionLogs({ workflowId, startTime });

  if (logs.length === 0) {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDurationMs: 0,
      successRate: 0,
    };
  }

  const totalExecutions = logs.length;
  const successfulExecutions = logs.filter((l) => l.success).length;
  const failedExecutions = totalExecutions - successfulExecutions;
  const averageDurationMs =
    logs.reduce((sum, l) => sum + l.durationMs, 0) / totalExecutions;
  const successRate = successfulExecutions / totalExecutions;

  // Find most common error
  const errorCounts = new Map<string, number>();
  for (const log of logs) {
    if (log.error) {
      errorCounts.set(log.error, (errorCounts.get(log.error) || 0) + 1);
    }
  }
  let mostCommonError: string | undefined;
  let maxCount = 0;
  for (const [error, count] of errorCounts) {
    if (count > maxCount) {
      mostCommonError = error;
      maxCount = count;
    }
  }

  return {
    totalExecutions,
    successfulExecutions,
    failedExecutions,
    averageDurationMs,
    successRate,
    mostCommonError,
  };
}

/**
 * Clean old workflow execution logs (keep last N days)
 */
export function cleanOldWorkflowLogs(keepDays: number = 30): number {
  const cutoffTime = Date.now() - keepDays * 24 * 60 * 60 * 1000;

  if (!existsSync(WORKFLOW_EXECUTION_LOG_FILE)) {
    return 0;
  }

  try {
    const content = readFileSync(WORKFLOW_EXECUTION_LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    const filteredLines = lines.filter((line) => {
      try {
        const entry = JSON.parse(line) as WorkflowExecutionLogEntry;
        return entry.timestamp >= cutoffTime;
      } catch {
        return false;
      }
    });

    const removed = lines.length - filteredLines.length;
    writeFileSync(WORKFLOW_EXECUTION_LOG_FILE, filteredLines.join('\n') + (filteredLines.length > 0 ? '\n' : ''));
    return removed;
  } catch {
    return 0;
  }
}

// ============================================================================
// Import/Export
// ============================================================================

/**
 * Export all workflows to JSON
 */
export function exportWorkflows(): BrowserWorkflow[] {
  return listWorkflows();
}

/**
 * Import workflows from exported data
 */
export function importWorkflows(
  workflows: BrowserWorkflow[],
  options?: { overwrite?: boolean }
): { imported: number; skipped: number } {
  let imported = 0;
  let skipped = 0;

  for (const workflow of workflows) {
    const existing = getWorkflow(workflow.id);
    if (existing && !options?.overwrite) {
      skipped++;
      continue;
    }

    const workflowPath = getWorkflowPath(workflow.id);
    writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
    updateWorkflowIndexEntry(workflow);
    imported++;
  }

  return { imported, skipped };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get workflows that use a specific skill
 */
export function getWorkflowsUsingSkill(skillId: string): BrowserWorkflow[] {
  return listWorkflows().filter((workflow) =>
    workflow.nodes.some(
      (node) =>
        (node.type === 'skill_call' && node.skillCall?.skillId === skillId) ||
        (node.type === 'cluster' && node.cluster?.skillId === skillId)
    )
  );
}

/**
 * Get workflows that involve specific profiles
 */
export function getWorkflowsForProfiles(profileIds: string[]): BrowserWorkflow[] {
  const profileSet = new Set(profileIds);
  return listWorkflows().filter((workflow) =>
    workflow.nodes.some(
      (node) =>
        node.type === 'cluster' &&
        node.cluster?.profileIds.some((pid) => profileSet.has(pid))
    )
  );
}

/**
 * Clone a workflow with a new ID
 */
export function cloneWorkflow(
  workflowId: string,
  newName?: string
): BrowserWorkflow | null {
  const original = getWorkflow(workflowId);
  if (!original) return null;

  const { id, createdAt, updatedAt, version, metadata, ...rest } = original;

  return createWorkflow({
    ...rest,
    name: newName || `${original.name} (Copy)`,
    metadata: {
      successRate: 1.0,
      executionCount: 0,
      averageDurationMs: original.metadata.averageDurationMs,
      consecutiveFailures: 0,
      sourceTraceIds: original.metadata.sourceTraceIds,
    },
  });
}
