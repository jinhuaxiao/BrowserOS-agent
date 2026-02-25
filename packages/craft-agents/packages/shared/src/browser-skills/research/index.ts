/**
 * Product Research Module
 *
 * Comprehensive browser-based product research system for:
 * - Cross-platform product data collection (Home Depot, Lowe's, Amazon)
 * - Keyword mining from Google and Amazon
 * - Competition analysis
 * - LLM-powered data analysis and reporting
 *
 * Usage:
 * ```typescript
 * import {
 *   createResearchSession,
 *   PRODUCT_RESEARCH_WORKFLOW,
 *   PRODUCT_RESEARCH_EXPERT,
 *   HOMEDEPOT_SKILLS,
 *   GOOGLE_KEYWORD_SKILLS,
 *   AMAZON_KEYWORD_SKILLS,
 * } from '@craft-agent/shared/browser-skills/research';
 *
 * // Create a new research session
 * const session = createResearchSession('chainsaw', 'chainsaw compatible parts');
 *
 * // Execute the research workflow
 * const result = await workflowEngine.executeWorkflow(
 *   PRODUCT_RESEARCH_WORKFLOW,
 *   { sessionId: session.id }
 * );
 * ```
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Core data types
  ProductData,
  PartsData,
  PartInfo,
  ReviewData,
  ReviewInfo,
  QuestionInfo,
  KeywordData,
  KeywordSuggestion,

  // Analysis types
  AnalysisReport,
  PartOpportunity,
  PainPoint,
  KeywordRecommendation,
  CompetitionSummary,

  // Session types
  ResearchSession,
  ResearchResults,
  ResearchStats,
  ResearchPlatform,
} from './research-types.ts';

// ============================================================================
// Storage Utilities
// ============================================================================

export {
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
} from './research-types.ts';

// ============================================================================
// Expert Agent
// ============================================================================

export { PRODUCT_RESEARCH_EXPERT } from './product-research-expert.ts';

// ============================================================================
// Home Depot Skills
// ============================================================================

export {
  HOMEDEPOT_SEARCH_SKILL,
  HOMEDEPOT_PRODUCT_DETAIL_SKILL,
  HOMEDEPOT_EXTRACT_REVIEWS_SKILL,
  HOMEDEPOT_SKILLS,
} from './homedepot-skills.ts';

// ============================================================================
// Google Keyword Skills
// ============================================================================

export {
  GOOGLE_SEARCH_SUGGESTIONS_SKILL,
  GOOGLE_PEOPLE_ALSO_ASK_SKILL,
  GOOGLE_KEYWORD_SKILLS,
} from './google-keyword-skills.ts';

// ============================================================================
// Amazon Keyword Skills
// ============================================================================

export {
  AMAZON_SEARCH_SUGGESTIONS_SKILL,
  AMAZON_SEARCH_PRODUCTS_SKILL,
  AMAZON_KEYWORD_SKILLS,
} from './amazon-keyword-skills.ts';

// ============================================================================
// Data Analyzer
// ============================================================================

export {
  generateAnalysisPrompt,
  generateFocusedPrompt,
  parseAnalysisResponse,
  createFallbackReport,
} from './data-analyzer.ts';

// ============================================================================
// Research Workflows
// ============================================================================

export {
  PRODUCT_RESEARCH_WORKFLOW,
  PARTS_RESEARCH_WORKFLOW,
  KEYWORD_MINING_WORKFLOW,
  RESEARCH_WORKFLOWS,
} from './research-workflow.ts';

// ============================================================================
// Aggregated Exports
// ============================================================================

import { HOMEDEPOT_SKILLS } from './homedepot-skills.ts';
import { GOOGLE_KEYWORD_SKILLS } from './google-keyword-skills.ts';
import { AMAZON_KEYWORD_SKILLS } from './amazon-keyword-skills.ts';
import { RESEARCH_WORKFLOWS } from './research-workflow.ts';

/**
 * All research-related skills
 */
export const ALL_RESEARCH_SKILLS = [
  ...HOMEDEPOT_SKILLS,
  ...GOOGLE_KEYWORD_SKILLS,
  ...AMAZON_KEYWORD_SKILLS,
];

/**
 * All research-related workflows
 */
export const ALL_RESEARCH_WORKFLOWS = RESEARCH_WORKFLOWS;
