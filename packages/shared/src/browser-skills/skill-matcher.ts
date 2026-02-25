/**
 * Skill Matcher
 *
 * Matches user intents to available skills using multiple matching strategies:
 * - URL pattern matching
 * - Page signature matching (DOM selectors)
 * - Intent pattern matching (NLP-like text matching)
 * - Title pattern matching
 *
 * Key features:
 * - Multi-strategy matching with confidence scoring
 * - Parameter extraction from user intent
 * - Fallback to vision when no match found
 */

import type {
  BrowserSkill,
  BrowserScript,
  SkillMatch,
  ExecutionPlan,
  SkillTriggers,
  SkillParameter,
} from './types.ts';
import { listSkills, listScripts, getSkill, loadIndex } from './skill-storage.ts';

// ============================================================================
// Matcher Configuration
// ============================================================================

/**
 * Configuration for skill matching
 */
export interface SkillMatcherConfig {
  /** Minimum confidence threshold for a match */
  minConfidence?: number;

  /** Weight for URL pattern matches */
  urlWeight?: number;

  /** Weight for page signature matches */
  signatureWeight?: number;

  /** Weight for intent pattern matches */
  intentWeight?: number;

  /** Weight for title pattern matches */
  titleWeight?: number;

  /** Maximum number of matches to return */
  maxMatches?: number;

  /** Whether to include deprecated skills */
  includeDeprecated?: boolean;
}

const DEFAULT_CONFIG: Required<SkillMatcherConfig> = {
  minConfidence: 0.5,
  urlWeight: 0.3,
  signatureWeight: 0.2,
  intentWeight: 0.4,
  titleWeight: 0.1,
  maxMatches: 5,
  includeDeprecated: false,
};

// ============================================================================
// Page Context
// ============================================================================

/**
 * Current page context for matching
 */
export interface PageContext {
  /** Current page URL */
  url: string;

  /** Page title */
  title?: string;

  /** Available DOM selectors on the page */
  availableSelectors?: string[];

  /** Page domain */
  domain?: string;
}

// ============================================================================
// Skill Matcher Class
// ============================================================================

/**
 * Skill Matcher
 *
 * Finds the best skill to execute for a given user intent and page context.
 */
export class SkillMatcher {
  private config: Required<SkillMatcherConfig>;
  private skillCache: BrowserSkill[] | null = null;
  private scriptCache: BrowserScript[] | null = null;

  constructor(config: SkillMatcherConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Clear cached skills and scripts
   */
  clearCache(): void {
    this.skillCache = null;
    this.scriptCache = null;
  }

  /**
   * Get all skills (with caching)
   */
  private getSkills(): BrowserSkill[] {
    if (!this.skillCache) {
      this.skillCache = listSkills();

      // Filter deprecated if needed
      if (!this.config.includeDeprecated) {
        this.skillCache = this.skillCache.filter(
          (s) => !s.tags?.includes('deprecated')
        );
      }
    }
    return this.skillCache;
  }

  /**
   * Get all scripts (with caching)
   */
  private getScripts(): BrowserScript[] {
    if (!this.scriptCache) {
      this.scriptCache = listScripts();
    }
    return this.scriptCache;
  }

  /**
   * Match user intent to the best execution plan
   */
  async matchIntent(
    intent: string,
    context: PageContext
  ): Promise<ExecutionPlan> {
    // First, try to find exact script matches
    const scriptMatch = await this.findScript(intent, context);
    if (scriptMatch) {
      return {
        type: 'script',
        script: scriptMatch,
        confidence: 1.0,
        reason: 'Exact script match for domain and intent',
      };
    }

    // Next, try to match skills
    const skillMatches = await this.findSkills(intent, context);
    const bestMatch = skillMatches[0];

    if (bestMatch && bestMatch.confidence >= this.config.minConfidence) {
      return {
        type: 'skill',
        skill: bestMatch.skill,
        confidence: bestMatch.confidence,
        reason: `Matched via ${bestMatch.matchedTrigger} with ${Math.round(bestMatch.confidence * 100)}% confidence`,
        variantId: bestMatch.variantId,
        parameters: bestMatch.extractedParams,
      };
    }

    // Fallback to vision
    return {
      type: 'vision',
      confidence: 0,
      reason: 'No matching skill or script found',
    };
  }

  /**
   * Find matching skills for an intent
   */
  async findSkills(
    intent: string,
    context: PageContext
  ): Promise<SkillMatch[]> {
    const skills = this.getSkills();
    const matches: SkillMatch[] = [];

    for (const skill of skills) {
      const match = this.matchSkill(skill, intent, context);
      if (match && match.confidence >= this.config.minConfidence) {
        matches.push(match);
      }
    }

    // Sort by confidence descending
    matches.sort((a, b) => b.confidence - a.confidence);

    // Return top matches
    return matches.slice(0, this.config.maxMatches);
  }

  /**
   * Match a single skill against intent and context
   */
  private matchSkill(
    skill: BrowserSkill,
    intent: string,
    context: PageContext
  ): SkillMatch | null {
    const triggers = skill.triggers;
    const scores: { type: 'url' | 'signature' | 'intent' | 'title'; score: number }[] = [];

    // URL pattern matching
    if (triggers.urlPattern) {
      try {
        const regex = new RegExp(triggers.urlPattern, 'i');
        if (regex.test(context.url)) {
          scores.push({ type: 'url', score: this.config.urlWeight });
        }
      } catch {
        // Invalid regex, skip
      }
    }

    // Page signature matching
    if (triggers.pageSignature && context.availableSelectors) {
      const matchedSelectors = triggers.pageSignature.filter((s) =>
        context.availableSelectors!.includes(s)
      );
      const signatureScore =
        (matchedSelectors.length / triggers.pageSignature.length) *
        this.config.signatureWeight;
      if (signatureScore > 0) {
        scores.push({ type: 'signature', score: signatureScore });
      }
    }

    // Intent pattern matching
    if (triggers.intentPatterns) {
      const intentScore = this.matchIntentPatterns(
        intent,
        triggers.intentPatterns
      );
      if (intentScore > 0) {
        scores.push({ type: 'intent', score: intentScore * this.config.intentWeight });
      }
    }

    // Title pattern matching
    if (triggers.titlePattern && context.title) {
      try {
        const regex = new RegExp(triggers.titlePattern, 'i');
        if (regex.test(context.title)) {
          scores.push({ type: 'title', score: this.config.titleWeight });
        }
      } catch {
        // Invalid regex, skip
      }
    }

    // Also do semantic matching on skill name and description
    const semanticScore = this.semanticMatch(intent, skill.name, skill.description);
    if (semanticScore > 0.3) {
      scores.push({ type: 'intent', score: semanticScore * this.config.intentWeight });
    }

    if (scores.length === 0) {
      return null;
    }

    // Calculate total confidence
    const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
    const confidence = Math.min(totalScore, 1);

    // Find the primary match type
    const sortedScores = scores.sort((a, b) => b.score - a.score);
    const primaryMatch = sortedScores[0];

    if (!primaryMatch) {
      return null;
    }

    // Extract parameters
    const extractedParams = this.extractParameters(intent, skill.parameters);

    return {
      skill,
      confidence,
      matchedTrigger: primaryMatch.type,
      extractedParams,
    };
  }

  /**
   * Match intent against patterns
   */
  private matchIntentPatterns(intent: string, patterns: string[]): number {
    const normalizedIntent = intent.toLowerCase();
    let bestScore = 0;

    for (const pattern of patterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(normalizedIntent)) {
          // Calculate match quality based on pattern specificity
          const score = Math.min(pattern.length / 50, 1);
          bestScore = Math.max(bestScore, score);
        }
      } catch {
        // Invalid regex, try simple string matching
        if (normalizedIntent.includes(pattern.toLowerCase().replace(/\.\*/g, ''))) {
          bestScore = Math.max(bestScore, 0.5);
        }
      }
    }

    return bestScore;
  }

  /**
   * Semantic matching using simple word overlap
   */
  private semanticMatch(
    intent: string,
    skillName: string,
    skillDescription: string
  ): number {
    // Tokenize
    const intentTokens = this.tokenize(intent);
    const skillTokens = new Set([
      ...this.tokenize(skillName),
      ...this.tokenize(skillDescription),
    ]);

    // Calculate word overlap
    const matchingTokens = intentTokens.filter((t) => skillTokens.has(t));
    const overlapScore = matchingTokens.length / Math.max(intentTokens.length, 1);

    // Boost score if key action words match
    const actionWords = ['download', 'upload', 'login', 'search', 'create', 'delete', 'export', 'import', 'check', 'verify'];
    const intentActions = intentTokens.filter((t) => actionWords.includes(t));
    const skillActions = Array.from(skillTokens).filter((t) => actionWords.includes(t));
    const actionMatch = intentActions.some((a) => skillActions.includes(a)) ? 0.3 : 0;

    return Math.min(overlapScore + actionMatch, 1);
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);
  }

  /**
   * Extract parameters from user intent
   */
  private extractParameters(
    intent: string,
    parameters?: SkillParameter[]
  ): Record<string, unknown> | undefined {
    if (!parameters || parameters.length === 0) {
      return undefined;
    }

    const extracted: Record<string, unknown> = {};

    for (const param of parameters) {
      const value = this.extractParameterValue(intent, param);
      if (value !== undefined) {
        extracted[param.name] = value;
      } else if (param.defaultValue !== undefined) {
        extracted[param.name] = param.defaultValue;
      }
    }

    return Object.keys(extracted).length > 0 ? extracted : undefined;
  }

  /**
   * Extract a single parameter value from intent
   */
  private extractParameterValue(
    intent: string,
    param: SkillParameter
  ): unknown {
    // Try to extract based on type
    switch (param.type) {
      case 'number': {
        const numbers = intent.match(/\b\d+(\.\d+)?\b/g);
        if (numbers && numbers.length > 0) {
          return parseFloat(numbers[0]);
        }
        break;
      }

      case 'date': {
        // Look for date patterns
        const datePatterns = [
          /\b(\d{4}-\d{2}-\d{2})\b/, // YYYY-MM-DD
          /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/, // MM/DD/YYYY
          /\b(last|past)\s+(\d+)\s+(day|week|month|year)s?\b/i, // Relative dates
          /\b(today|yesterday|tomorrow)\b/i, // Named dates
        ];

        for (const pattern of datePatterns) {
          const match = intent.match(pattern);
          if (match) {
            return this.parseDate(match[0]);
          }
        }
        break;
      }

      case 'boolean': {
        if (/\b(yes|true|enable|on)\b/i.test(intent)) {
          return true;
        }
        if (/\b(no|false|disable|off)\b/i.test(intent)) {
          return false;
        }
        break;
      }

      case 'select': {
        // Look for option labels in intent
        if (param.options) {
          for (const option of param.options) {
            if (intent.toLowerCase().includes(option.label.toLowerCase())) {
              return option.value;
            }
          }
        }
        break;
      }

      case 'string': {
        // Look for quoted strings
        const quotedMatch = intent.match(/"([^"]+)"|'([^']+)'/);
        if (quotedMatch) {
          return quotedMatch[1] || quotedMatch[2];
        }

        // Look for values after keywords like "for", "named", "called"
        const keywordMatch = intent.match(
          /\b(?:for|named|called|with|using)\s+["']?([^"'\s]+)["']?/i
        );
        if (keywordMatch) {
          return keywordMatch[1];
        }
        break;
      }
    }

    return undefined;
  }

  /**
   * Parse a date string
   */
  private parseDate(dateStr: string): string {
    const lower = dateStr.toLowerCase();

    // Handle named dates
    const today = new Date();
    if (lower === 'today') {
      return today.toISOString().split('T')[0] || dateStr;
    }
    if (lower === 'yesterday') {
      today.setDate(today.getDate() - 1);
      return today.toISOString().split('T')[0] || dateStr;
    }
    if (lower === 'tomorrow') {
      today.setDate(today.getDate() + 1);
      return today.toISOString().split('T')[0] || dateStr;
    }

    // Handle relative dates
    const relativeMatch = lower.match(/(?:last|past)\s+(\d+)\s+(day|week|month|year)s?/);
    if (relativeMatch && relativeMatch[1] && relativeMatch[2]) {
      const amount = parseInt(relativeMatch[1], 10);
      const unit = relativeMatch[2];
      const date = new Date();

      switch (unit) {
        case 'day':
          date.setDate(date.getDate() - amount);
          break;
        case 'week':
          date.setDate(date.getDate() - amount * 7);
          break;
        case 'month':
          date.setMonth(date.getMonth() - amount);
          break;
        case 'year':
          date.setFullYear(date.getFullYear() - amount);
          break;
      }

      return date.toISOString().split('T')[0] || dateStr;
    }

    // Return as-is if already in ISO format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }

    // Try to parse other formats
    try {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0] || dateStr;
      }
    } catch {
      // Return as-is
    }

    return dateStr;
  }

  /**
   * Find a matching script
   */
  private async findScript(
    intent: string,
    context: PageContext
  ): Promise<BrowserScript | null> {
    const scripts = this.getScripts();
    const domain = context.domain || this.extractDomain(context.url);

    // Find scripts for this domain
    const domainScripts = scripts.filter(
      (s) => s.domain === domain || s.domain.includes(domain)
    );

    if (domainScripts.length === 0) {
      return null;
    }

    // Match by description
    for (const script of domainScripts) {
      const score = this.semanticMatch(intent, script.name, script.description);
      if (score >= 0.8) {
        return script;
      }
    }

    return null;
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
   * Get skill by ID
   */
  async getSkillById(skillId: string): Promise<BrowserSkill | null> {
    return getSkill(skillId);
  }

  /**
   * Get skills by domain
   */
  async getSkillsByDomain(domain: string): Promise<BrowserSkill[]> {
    const skills = this.getSkills();
    return skills.filter((s) => s.domain === domain || s.domain.includes(domain));
  }

  /**
   * Get top skills by success rate
   */
  async getTopSkills(limit: number = 10): Promise<BrowserSkill[]> {
    const skills = this.getSkills();
    return skills
      .filter((s) => s.executionCount > 0)
      .sort((a, b) => {
        // Sort by success rate, then by execution count
        if (b.successRate !== a.successRate) {
          return b.successRate - a.successRate;
        }
        return b.executionCount - a.executionCount;
      })
      .slice(0, limit);
  }

  /**
   * Get recently used skills
   */
  async getRecentSkills(limit: number = 10): Promise<BrowserSkill[]> {
    const skills = this.getSkills();
    return skills
      .filter((s) => s.lastUsedAt)
      .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))
      .slice(0, limit);
  }

  /**
   * Check if a skill is applicable to a context
   */
  isApplicable(skill: BrowserSkill, context: PageContext): boolean {
    const match = this.matchSkill(skill, '', context);
    return match !== null && match.confidence >= this.config.minConfidence;
  }
}

// ============================================================================
// Singleton and Helpers
// ============================================================================

let defaultMatcher: SkillMatcher | null = null;

/**
 * Get the default skill matcher
 */
export function getDefaultSkillMatcher(): SkillMatcher {
  if (!defaultMatcher) {
    defaultMatcher = new SkillMatcher();
  }
  return defaultMatcher;
}

/**
 * Create a new skill matcher with custom config
 */
export function createSkillMatcher(config?: SkillMatcherConfig): SkillMatcher {
  return new SkillMatcher(config);
}

/**
 * Match intent using default matcher
 */
export async function matchIntent(
  intent: string,
  context: PageContext
): Promise<ExecutionPlan> {
  return getDefaultSkillMatcher().matchIntent(intent, context);
}

/**
 * Find skills matching intent using default matcher
 */
export async function findMatchingSkills(
  intent: string,
  context: PageContext
): Promise<SkillMatch[]> {
  return getDefaultSkillMatcher().findSkills(intent, context);
}

/**
 * Reset the default matcher
 */
export function resetDefaultMatcher(): void {
  if (defaultMatcher) {
    defaultMatcher.clearCache();
  }
  defaultMatcher = null;
}
