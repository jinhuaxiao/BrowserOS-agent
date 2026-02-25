/**
 * Browser Skill Storage
 *
 * CRUD operations for browser skills with persistence.
 * Skills are stored in ~/.craft-agent/browser-skills/
 *
 * Storage structure:
 * ~/.craft-agent/browser-skills/
 * ├── index.json           # Skill index for fast lookup
 * ├── skills/
 * │   ├── {skill-id}.json  # Individual skill files
 * │   └── ...
 * ├── scripts/
 * │   ├── {script-id}.json # Individual script files
 * │   └── ...
 * └── logs/
 *     └── executions.jsonl # Execution log (append-only)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type {
  BrowserSkill,
  BrowserScript,
  SkillIndex,
  SkillIndexEntry,
  ExecutionLogEntry,
  BrowserSkillEvent,
  BrowserSkillEventListener,
} from './types.ts';

// ============================================================================
// Configuration
// ============================================================================

const BROWSER_SKILLS_DIR = join(homedir(), '.craft-agent', 'browser-skills');
const SKILLS_DIR = join(BROWSER_SKILLS_DIR, 'skills');
const SCRIPTS_DIR = join(BROWSER_SKILLS_DIR, 'scripts');
const LOGS_DIR = join(BROWSER_SKILLS_DIR, 'logs');
const INDEX_FILE = join(BROWSER_SKILLS_DIR, 'index.json');
const EXECUTION_LOG_FILE = join(LOGS_DIR, 'executions.jsonl');

const INDEX_VERSION = 1;

// ============================================================================
// Event System
// ============================================================================

const eventListeners = new Set<BrowserSkillEventListener>();

/**
 * Add event listener
 */
export function addEventListener(listener: BrowserSkillEventListener): void {
  eventListeners.add(listener);
}

/**
 * Remove event listener
 */
export function removeEventListener(listener: BrowserSkillEventListener): void {
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
      console.error('[SkillStorage] Event listener error:', err);
    }
  }
}

// ============================================================================
// Directory Management
// ============================================================================

/**
 * Ensure all required directories exist
 */
export function ensureDirectories(): void {
  if (!existsSync(BROWSER_SKILLS_DIR)) {
    mkdirSync(BROWSER_SKILLS_DIR, { recursive: true });
  }
  if (!existsSync(SKILLS_DIR)) {
    mkdirSync(SKILLS_DIR, { recursive: true });
  }
  if (!existsSync(SCRIPTS_DIR)) {
    mkdirSync(SCRIPTS_DIR, { recursive: true });
  }
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }
}

/**
 * Get the base directory for browser skills
 */
export function getBrowserSkillsDir(): string {
  return BROWSER_SKILLS_DIR;
}

/**
 * Get the skills directory
 */
export function getSkillsDir(): string {
  return SKILLS_DIR;
}

/**
 * Get the scripts directory
 */
export function getScriptsDir(): string {
  return SCRIPTS_DIR;
}

// ============================================================================
// Index Management
// ============================================================================

/**
 * Load skill index
 */
export function loadIndex(): SkillIndex {
  ensureDirectories();

  if (!existsSync(INDEX_FILE)) {
    return {
      version: INDEX_VERSION,
      skills: {},
      updatedAt: Date.now(),
    };
  }

  try {
    const content = readFileSync(INDEX_FILE, 'utf-8');
    return JSON.parse(content) as SkillIndex;
  } catch {
    return {
      version: INDEX_VERSION,
      skills: {},
      updatedAt: Date.now(),
    };
  }
}

/**
 * Save skill index
 */
export function saveIndex(index: SkillIndex): void {
  ensureDirectories();
  index.updatedAt = Date.now();
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

/**
 * Update index entry for a skill
 */
function updateIndexEntry(skill: BrowserSkill): void {
  const index = loadIndex();
  index.skills[skill.id] = {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    domain: skill.domain,
    tags: skill.tags,
    successRate: skill.successRate,
    lastUsedAt: skill.lastUsedAt,
    filePath: join(SKILLS_DIR, `${skill.id}.json`),
  };
  saveIndex(index);
}

/**
 * Remove index entry for a skill
 */
function removeIndexEntry(skillId: string): void {
  const index = loadIndex();
  delete index.skills[skillId];
  saveIndex(index);
}

/**
 * Rebuild index from skill files
 */
export function rebuildIndex(): SkillIndex {
  ensureDirectories();

  const index: SkillIndex = {
    version: INDEX_VERSION,
    skills: {},
    updatedAt: Date.now(),
  };

  try {
    const files = readdirSync(SKILLS_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const skillPath = join(SKILLS_DIR, file);
      try {
        const content = readFileSync(skillPath, 'utf-8');
        const skill = JSON.parse(content) as BrowserSkill;
        index.skills[skill.id] = {
          id: skill.id,
          name: skill.name,
          description: skill.description,
          domain: skill.domain,
          tags: skill.tags,
          successRate: skill.successRate,
          lastUsedAt: skill.lastUsedAt,
          filePath: skillPath,
        };
      } catch {
        // Skip invalid skill files
      }
    }
  } catch {
    // Skills directory doesn't exist or can't be read
  }

  saveIndex(index);
  return index;
}

// ============================================================================
// Skill CRUD Operations
// ============================================================================

/**
 * Generate a unique skill ID
 */
export function generateSkillId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `skill_${timestamp}_${random}`;
}

/**
 * Get skill file path
 */
function getSkillPath(skillId: string): string {
  return join(SKILLS_DIR, `${skillId}.json`);
}

/**
 * Create a new skill
 */
export function createSkill(
  skill: Omit<BrowserSkill, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'executionCount' | 'consecutiveFailures' | 'successRate'>
): BrowserSkill {
  ensureDirectories();

  const now = Date.now();
  const newSkill: BrowserSkill = {
    ...skill,
    id: generateSkillId(),
    version: 1,
    successRate: 1.0, // Start optimistic
    executionCount: 0,
    consecutiveFailures: 0,
    createdAt: now,
    updatedAt: now,
  };

  const skillPath = getSkillPath(newSkill.id);
  writeFileSync(skillPath, JSON.stringify(newSkill, null, 2));

  updateIndexEntry(newSkill);
  emit({ type: 'skill_created', skill: newSkill });

  return newSkill;
}

/**
 * Get a skill by ID
 */
export function getSkill(skillId: string): BrowserSkill | null {
  const skillPath = getSkillPath(skillId);

  if (!existsSync(skillPath)) {
    return null;
  }

  try {
    const content = readFileSync(skillPath, 'utf-8');
    return JSON.parse(content) as BrowserSkill;
  } catch {
    return null;
  }
}

/**
 * Update a skill
 */
export function updateSkill(
  skillId: string,
  updates: Partial<Omit<BrowserSkill, 'id' | 'createdAt'>>
): BrowserSkill | null {
  const skill = getSkill(skillId);
  if (!skill) return null;

  const updatedSkill: BrowserSkill = {
    ...skill,
    ...updates,
    id: skill.id,
    createdAt: skill.createdAt,
    version: skill.version + 1,
    updatedAt: Date.now(),
  };

  const skillPath = getSkillPath(skillId);
  writeFileSync(skillPath, JSON.stringify(updatedSkill, null, 2));

  updateIndexEntry(updatedSkill);

  const changes = Object.keys(updates);
  emit({ type: 'skill_updated', skill: updatedSkill, changes });

  return updatedSkill;
}

/**
 * Delete a skill
 */
export function deleteSkill(skillId: string): boolean {
  const skillPath = getSkillPath(skillId);

  if (!existsSync(skillPath)) {
    return false;
  }

  try {
    rmSync(skillPath);
    removeIndexEntry(skillId);
    emit({ type: 'skill_deleted', skillId });
    return true;
  } catch {
    return false;
  }
}

/**
 * List all skills
 */
export function listSkills(): BrowserSkill[] {
  ensureDirectories();

  const skills: BrowserSkill[] = [];

  try {
    const files = readdirSync(SKILLS_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const skillPath = join(SKILLS_DIR, file);
      try {
        const content = readFileSync(skillPath, 'utf-8');
        skills.push(JSON.parse(content) as BrowserSkill);
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Skills directory doesn't exist
  }

  return skills;
}

/**
 * List skills by domain
 */
export function listSkillsByDomain(domain: string): BrowserSkill[] {
  return listSkills().filter((s) => s.domain === domain || s.domain.includes(domain));
}

/**
 * List skills by tag
 */
export function listSkillsByTag(tag: string): BrowserSkill[] {
  return listSkills().filter((s) => s.tags?.includes(tag));
}

/**
 * Search skills by query (name, description)
 */
export function searchSkills(query: string): BrowserSkill[] {
  const lowerQuery = query.toLowerCase();
  return listSkills().filter(
    (s) =>
      s.name.toLowerCase().includes(lowerQuery) ||
      s.description.toLowerCase().includes(lowerQuery)
  );
}

// ============================================================================
// Skill Statistics
// ============================================================================

/**
 * Record skill execution result
 */
export function recordExecution(
  skillId: string,
  success: boolean,
  durationMs: number,
  options?: {
    error?: string;
    parameters?: Record<string, unknown>;
    profileId?: string;
    usedVisionFallback?: boolean;
  }
): void {
  const skill = getSkill(skillId);
  if (!skill) return;

  // Update skill statistics
  const executionCount = skill.executionCount + 1;
  const consecutiveFailures = success ? 0 : skill.consecutiveFailures + 1;

  // Calculate new success rate (exponential moving average)
  const alpha = 0.3; // Weight for recent executions
  const newSuccessRate = alpha * (success ? 1 : 0) + (1 - alpha) * skill.successRate;

  updateSkill(skillId, {
    executionCount,
    consecutiveFailures,
    successRate: newSuccessRate,
    lastUsedAt: Date.now(),
    lastSuccessAt: success ? Date.now() : skill.lastSuccessAt,
  });

  // Log execution
  logExecution({
    id: `exec_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    skillId,
    timestamp: Date.now(),
    success,
    durationMs,
    error: options?.error,
    parameters: options?.parameters,
    profileId: options?.profileId,
    usedVisionFallback: options?.usedVisionFallback,
  });
}

/**
 * Deprecate a skill
 */
export function deprecateSkill(skillId: string, reason: string): boolean {
  const skill = getSkill(skillId);
  if (!skill) return false;

  // Add deprecated tag
  const tags = skill.tags || [];
  if (!tags.includes('deprecated')) {
    tags.push('deprecated');
  }

  updateSkill(skillId, {
    tags,
    description: `[DEPRECATED: ${reason}] ${skill.description}`,
  });

  emit({ type: 'skill_deprecated', skillId, reason });
  return true;
}

/**
 * Get skill statistics
 */
export function getSkillStats(skillId: string): {
  executionCount: number;
  successRate: number;
  consecutiveFailures: number;
  lastUsedAt?: number;
  lastSuccessAt?: number;
  daysSinceLastUse: number;
} | null {
  const skill = getSkill(skillId);
  if (!skill) return null;

  const now = Date.now();
  const daysSinceLastUse = skill.lastUsedAt
    ? Math.floor((now - skill.lastUsedAt) / (1000 * 60 * 60 * 24))
    : Infinity;

  return {
    executionCount: skill.executionCount,
    successRate: skill.successRate,
    consecutiveFailures: skill.consecutiveFailures,
    lastUsedAt: skill.lastUsedAt,
    lastSuccessAt: skill.lastSuccessAt,
    daysSinceLastUse,
  };
}

// ============================================================================
// Script CRUD Operations
// ============================================================================

/**
 * Generate a unique script ID
 */
export function generateScriptId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `script_${timestamp}_${random}`;
}

/**
 * Get script file path
 */
function getScriptPath(scriptId: string): string {
  return join(SCRIPTS_DIR, `${scriptId}.json`);
}

/**
 * Create a new script
 */
export function createScript(
  script: Omit<BrowserScript, 'id' | 'createdAt' | 'updatedAt'>
): BrowserScript {
  ensureDirectories();

  const now = Date.now();
  const newScript: BrowserScript = {
    ...script,
    id: generateScriptId(),
    createdAt: now,
    updatedAt: now,
  };

  const scriptPath = getScriptPath(newScript.id);
  writeFileSync(scriptPath, JSON.stringify(newScript, null, 2));

  return newScript;
}

/**
 * Get a script by ID
 */
export function getScript(scriptId: string): BrowserScript | null {
  const scriptPath = getScriptPath(scriptId);

  if (!existsSync(scriptPath)) {
    return null;
  }

  try {
    const content = readFileSync(scriptPath, 'utf-8');
    return JSON.parse(content) as BrowserScript;
  } catch {
    return null;
  }
}

/**
 * Update a script
 */
export function updateScript(
  scriptId: string,
  updates: Partial<Omit<BrowserScript, 'id' | 'createdAt'>>
): BrowserScript | null {
  const script = getScript(scriptId);
  if (!script) return null;

  const updatedScript: BrowserScript = {
    ...script,
    ...updates,
    id: script.id,
    createdAt: script.createdAt,
    updatedAt: Date.now(),
  };

  const scriptPath = getScriptPath(scriptId);
  writeFileSync(scriptPath, JSON.stringify(updatedScript, null, 2));

  return updatedScript;
}

/**
 * Delete a script
 */
export function deleteScript(scriptId: string): boolean {
  const scriptPath = getScriptPath(scriptId);

  if (!existsSync(scriptPath)) {
    return false;
  }

  try {
    rmSync(scriptPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * List all scripts
 */
export function listScripts(): BrowserScript[] {
  ensureDirectories();

  const scripts: BrowserScript[] = [];

  try {
    const files = readdirSync(SCRIPTS_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const scriptPath = join(SCRIPTS_DIR, file);
      try {
        const content = readFileSync(scriptPath, 'utf-8');
        scripts.push(JSON.parse(content) as BrowserScript);
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Scripts directory doesn't exist
  }

  return scripts;
}

/**
 * List scripts by domain
 */
export function listScriptsByDomain(domain: string): BrowserScript[] {
  return listScripts().filter((s) => s.domain === domain || s.domain.includes(domain));
}

// ============================================================================
// Execution Logging
// ============================================================================

/**
 * Log an execution entry
 */
export function logExecution(entry: ExecutionLogEntry): void {
  ensureDirectories();

  const line = JSON.stringify(entry) + '\n';

  try {
    const fs = require('fs');
    fs.appendFileSync(EXECUTION_LOG_FILE, line);
  } catch {
    // Ignore logging errors
  }
}

/**
 * Read execution logs (with pagination)
 */
export function readExecutionLogs(options?: {
  skillId?: string;
  limit?: number;
  offset?: number;
  startTime?: number;
  endTime?: number;
}): ExecutionLogEntry[] {
  if (!existsSync(EXECUTION_LOG_FILE)) {
    return [];
  }

  try {
    const content = readFileSync(EXECUTION_LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    let entries = lines
      .map((line) => {
        try {
          return JSON.parse(line) as ExecutionLogEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is ExecutionLogEntry => e !== null);

    // Filter by skill ID
    if (options?.skillId) {
      entries = entries.filter((e) => e.skillId === options.skillId);
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
 * Get execution summary for a skill
 */
export function getExecutionSummary(skillId: string, days: number = 30): {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDurationMs: number;
  successRate: number;
} {
  const startTime = Date.now() - days * 24 * 60 * 60 * 1000;
  const logs = readExecutionLogs({ skillId, startTime });

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

  return {
    totalExecutions,
    successfulExecutions,
    failedExecutions,
    averageDurationMs,
    successRate,
  };
}

/**
 * Clean old execution logs (keep last N days)
 */
export function cleanOldLogs(keepDays: number = 30): number {
  const cutoffTime = Date.now() - keepDays * 24 * 60 * 60 * 1000;

  if (!existsSync(EXECUTION_LOG_FILE)) {
    return 0;
  }

  try {
    const content = readFileSync(EXECUTION_LOG_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    const filteredLines = lines.filter((line) => {
      try {
        const entry = JSON.parse(line) as ExecutionLogEntry;
        return entry.timestamp >= cutoffTime;
      } catch {
        return false;
      }
    });

    const removed = lines.length - filteredLines.length;
    writeFileSync(EXECUTION_LOG_FILE, filteredLines.join('\n') + '\n');
    return removed;
  } catch {
    return 0;
  }
}

// ============================================================================
// Import/Export
// ============================================================================

/**
 * Export all skills to a JSON file
 */
export function exportSkills(): { skills: BrowserSkill[]; scripts: BrowserScript[] } {
  return {
    skills: listSkills(),
    scripts: listScripts(),
  };
}

/**
 * Import skills from exported data
 */
export function importSkills(
  data: { skills?: BrowserSkill[]; scripts?: BrowserScript[] },
  options?: { overwrite?: boolean }
): { skillsImported: number; scriptsImported: number; skipped: number } {
  let skillsImported = 0;
  let scriptsImported = 0;
  let skipped = 0;

  // Import skills
  if (data.skills) {
    for (const skill of data.skills) {
      const existing = getSkill(skill.id);
      if (existing && !options?.overwrite) {
        skipped++;
        continue;
      }

      const skillPath = getSkillPath(skill.id);
      writeFileSync(skillPath, JSON.stringify(skill, null, 2));
      updateIndexEntry(skill);
      skillsImported++;
    }
  }

  // Import scripts
  if (data.scripts) {
    for (const script of data.scripts) {
      const existing = getScript(script.id);
      if (existing && !options?.overwrite) {
        skipped++;
        continue;
      }

      const scriptPath = getScriptPath(script.id);
      writeFileSync(scriptPath, JSON.stringify(script, null, 2));
      scriptsImported++;
    }
  }

  return { skillsImported, scriptsImported, skipped };
}
