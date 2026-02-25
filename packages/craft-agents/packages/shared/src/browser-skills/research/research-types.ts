/**
 * Product Research Types and Storage
 *
 * Type definitions and storage utilities for product research data.
 * Supports multi-platform data collection, analysis, and reporting.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';

// ============================================================================
// Directory Constants
// ============================================================================

const RESEARCH_DATA_DIR = path.join(homedir(), '.craft-agent', 'research-data');

// ============================================================================
// Product Data Types
// ============================================================================

/**
 * Platform identifiers for product research
 */
export type ResearchPlatform = 'homedepot' | 'lowes' | 'amazon' | 'google';

/**
 * Product data extracted from e-commerce platforms
 */
export interface ProductData {
  /** Unique identifier for this product */
  id: string;

  /** Product name/title */
  name: string;

  /** Brand name */
  brand: string;

  /** Model number */
  model: string;

  /** Price in USD */
  price: number;

  /** Rating (0-5 scale) */
  rating: number;

  /** Number of reviews */
  reviewCount: number;

  /** Product URL */
  url: string;

  /** Source platform */
  platform: ResearchPlatform;

  /** Image URL */
  imageUrl?: string;

  /** SKU or product identifier from the platform */
  platformId?: string;

  /** Category path */
  category?: string[];

  /** Product specifications */
  specifications?: Record<string, string>;

  /** When this data was scraped */
  scrapedAt: number;
}

/**
 * Parts/accessories data for a product
 */
export interface PartsData {
  /** Reference to the parent product */
  productId: string;

  /** List of parts/accessories */
  parts: PartInfo[];

  /** When this data was extracted */
  extractedAt: number;
}

/**
 * Individual part/accessory information
 */
export interface PartInfo {
  /** Part name */
  name: string;

  /** Part model number */
  model?: string;

  /** Part category (chain, bar, battery, etc.) */
  category: string;

  /** Whether this is a replaceable/consumable part */
  isReplaceable: boolean;

  /** Compatibility notes */
  compatibility?: string;

  /** Price if available */
  price?: number;

  /** Link to purchase if available */
  purchaseUrl?: string;
}

/**
 * Review data from a product
 */
export interface ReviewData {
  /** Reference to the product */
  productId: string;

  /** List of reviews */
  reviews: ReviewInfo[];

  /** Q&A from the product page */
  questions: QuestionInfo[];

  /** When this data was extracted */
  extractedAt: number;
}

/**
 * Individual review information
 */
export interface ReviewInfo {
  /** Rating (1-5) */
  rating: number;

  /** Review title */
  title: string;

  /** Review content/body */
  content: string;

  /** Review date */
  date: string;

  /** Whether this is a verified purchase */
  isVerified: boolean;

  /** Helpful votes count */
  helpfulVotes?: number;

  /** Reviewer name/username */
  reviewer?: string;
}

/**
 * Q&A information from product pages
 */
export interface QuestionInfo {
  /** The question asked */
  question: string;

  /** The answer (if provided) */
  answer?: string;

  /** Who answered (seller, community, etc.) */
  answeredBy?: string;

  /** Date of the answer */
  answerDate?: string;

  /** Number of votes/helpful marks */
  votes?: number;
}

// ============================================================================
// Keyword Data Types
// ============================================================================

/**
 * Keyword data from search engines
 */
export interface KeywordData {
  /** Source of the keywords */
  source: 'google' | 'amazon';

  /** The seed keyword used for search */
  seedKeyword: string;

  /** List of suggested/related keywords */
  suggestions: KeywordSuggestion[];

  /** When this data was collected */
  collectedAt: number;
}

/**
 * Individual keyword suggestion
 */
export interface KeywordSuggestion {
  /** The keyword */
  keyword: string;

  /** Type of suggestion */
  type: 'autocomplete' | 'paa' | 'related' | 'trending';

  /** Position in the suggestion list */
  position?: number;

  /** Estimated search volume (if available) */
  searchVolume?: 'high' | 'medium' | 'low';
}

// ============================================================================
// Analysis Report Types
// ============================================================================

/**
 * Complete analysis report from LLM
 */
export interface AnalysisReport {
  /** Report title */
  title: string;

  /** Executive summary */
  summary: string;

  /** Part/accessory opportunity rankings */
  partsRanking: PartOpportunity[];

  /** Common pain points identified */
  painPoints: PainPoint[];

  /** Keyword recommendations */
  keywordRecommendations: KeywordRecommendation[];

  /** Competition analysis summary */
  competitionSummary: CompetitionSummary;

  /** Report generation timestamp */
  generatedAt: number;

  /** Research session ID */
  sessionId: string;
}

/**
 * Part/accessory opportunity assessment
 */
export interface PartOpportunity {
  /** Part category name */
  partCategory: string;

  /** Demand score (0-100) */
  demandScore: number;

  /** Competition score (0-100, lower is better) */
  competitionScore: number;

  /** Overall opportunity rating */
  opportunity: 'high' | 'medium' | 'low';

  /** Reasoning for the assessment */
  reasoning: string;

  /** Recommended action */
  action?: string;

  /** Related keywords */
  relatedKeywords?: string[];
}

/**
 * Pain point identified from reviews/Q&A
 */
export interface PainPoint {
  /** Issue description */
  issue: string;

  /** Frequency/mentions count */
  frequency: number;

  /** Severity (1-5) */
  severity: number;

  /** Product improvement opportunity */
  productOpportunity: string;

  /** Example quotes from reviews */
  exampleQuotes?: string[];
}

/**
 * Keyword recommendation
 */
export interface KeywordRecommendation {
  /** The keyword */
  keyword: string;

  /** Estimated search volume */
  searchVolume: 'high' | 'medium' | 'low';

  /** Competition level */
  competition: 'high' | 'medium' | 'low';

  /** Recommendation text */
  recommendation: string;

  /** Keyword type (informational, transactional, etc.) */
  intent?: 'informational' | 'transactional' | 'navigational';
}

/**
 * Competition summary
 */
export interface CompetitionSummary {
  /** Number of competitors analyzed */
  competitorCount: number;

  /** Top brands in the market */
  topBrands: string[];

  /** Price range observed */
  priceRange: {
    min: number;
    max: number;
    average: number;
  };

  /** Average review rating in the market */
  averageRating: number;

  /** Market entry difficulty assessment */
  entryDifficulty: 'easy' | 'moderate' | 'hard';

  /** Key success factors */
  successFactors: string[];
}

// ============================================================================
// Research Session Types
// ============================================================================

/**
 * Research session configuration
 */
export interface ResearchSession {
  /** Unique session ID */
  id: string;

  /** Research category (chainsaw, drill, etc.) */
  category: string;

  /** Search keywords used */
  keywords: string[];

  /** Platforms to research */
  platforms: ResearchPlatform[];

  /** Maximum products to collect */
  maxProducts: number;

  /** Session status */
  status: 'pending' | 'running' | 'completed' | 'failed';

  /** Session creation time */
  createdAt: number;

  /** Session completion time */
  completedAt?: number;

  /** Output directory path */
  outputDir: string;

  /** Error message if failed */
  error?: string;
}

/**
 * Research session results
 */
export interface ResearchResults {
  /** Session reference */
  sessionId: string;

  /** Collected products */
  products: ProductData[];

  /** Collected parts data */
  parts: PartsData[];

  /** Collected reviews */
  reviews: ReviewData[];

  /** Collected keywords */
  keywords: KeywordData[];

  /** Generated analysis report */
  report?: AnalysisReport;

  /** Summary statistics */
  stats: ResearchStats;
}

/**
 * Research statistics
 */
export interface ResearchStats {
  /** Total products collected */
  totalProducts: number;

  /** Products per platform */
  productsByPlatform: Record<ResearchPlatform, number>;

  /** Total reviews collected */
  totalReviews: number;

  /** Total Q&A collected */
  totalQuestions: number;

  /** Total keywords collected */
  totalKeywords: number;

  /** Unique parts identified */
  uniqueParts: number;

  /** Research duration in ms */
  durationMs: number;
}

// ============================================================================
// Storage Functions
// ============================================================================

/**
 * Ensure research data directories exist
 */
export function ensureResearchDirectories(): void {
  if (!fs.existsSync(RESEARCH_DATA_DIR)) {
    fs.mkdirSync(RESEARCH_DATA_DIR, { recursive: true });
  }
}

/**
 * Get the research data directory
 */
export function getResearchDataDir(): string {
  ensureResearchDirectories();
  return RESEARCH_DATA_DIR;
}

/**
 * Create a new research session
 */
export function createResearchSession(
  category: string,
  keywords: string[],
  platforms: ResearchPlatform[] = ['homedepot'],
  maxProducts: number = 50
): ResearchSession {
  const id = `research_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const outputDir = path.join(RESEARCH_DATA_DIR, `${category}-${timestamp}`);

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const session: ResearchSession = {
    id,
    category,
    keywords,
    platforms,
    maxProducts,
    status: 'pending',
    createdAt: Date.now(),
    outputDir,
  };

  // Save session config
  saveSessionConfig(session);

  return session;
}

/**
 * Save session configuration
 */
export function saveSessionConfig(session: ResearchSession): void {
  const configPath = path.join(session.outputDir, 'session.json');
  fs.writeFileSync(configPath, JSON.stringify(session, null, 2));
}

/**
 * Load session configuration
 */
export function loadSessionConfig(outputDir: string): ResearchSession | null {
  const configPath = path.join(outputDir, 'session.json');
  if (!fs.existsSync(configPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

/**
 * Get a research session by ID
 */
export function getResearchSession(sessionId: string): ResearchSession | null {
  const sessions = listResearchSessions();
  return sessions.find(s => s.id === sessionId) || null;
}

/**
 * Get the output directory for a session
 */
export function getSessionDir(session: ResearchSession): string {
  return session.outputDir;
}

/**
 * Update session status
 */
export function updateSessionStatus(
  session: ResearchSession,
  status: ResearchSession['status'],
  error?: string
): void {
  session.status = status;
  if (status === 'completed' || status === 'failed') {
    session.completedAt = Date.now();
  }
  if (error) {
    session.error = error;
  }
  saveSessionConfig(session);
}

/**
 * Save products data
 */
export function saveProducts(session: ResearchSession, products: ProductData[]): void {
  const filePath = path.join(session.outputDir, 'products.json');
  fs.writeFileSync(filePath, JSON.stringify(products, null, 2));
}

/**
 * Load products data
 */
export function loadProducts(session: ResearchSession): ProductData[] {
  const filePath = path.join(session.outputDir, 'products.json');
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Save parts data
 */
export function saveParts(session: ResearchSession, parts: PartsData[]): void {
  const filePath = path.join(session.outputDir, 'parts.json');
  fs.writeFileSync(filePath, JSON.stringify(parts, null, 2));
}

/**
 * Load parts data
 */
export function loadParts(session: ResearchSession): PartsData[] {
  const filePath = path.join(session.outputDir, 'parts.json');
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Save reviews data
 */
export function saveReviews(session: ResearchSession, reviews: ReviewData[]): void {
  const filePath = path.join(session.outputDir, 'reviews.json');
  fs.writeFileSync(filePath, JSON.stringify(reviews, null, 2));
}

/**
 * Load reviews data
 */
export function loadReviews(session: ResearchSession): ReviewData[] {
  const filePath = path.join(session.outputDir, 'reviews.json');
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Save keywords data
 */
export function saveKeywords(session: ResearchSession, keywords: KeywordData[]): void {
  const filePath = path.join(session.outputDir, 'keywords.json');
  fs.writeFileSync(filePath, JSON.stringify(keywords, null, 2));
}

/**
 * Load keywords data
 */
export function loadKeywords(session: ResearchSession): KeywordData[] {
  const filePath = path.join(session.outputDir, 'keywords.json');
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Save analysis report
 */
export function saveAnalysisReport(session: ResearchSession, report: AnalysisReport): void {
  // Save as JSON
  const jsonPath = path.join(session.outputDir, 'analysis_report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  // Save as Markdown
  const mdPath = path.join(session.outputDir, 'analysis_report.md');
  fs.writeFileSync(mdPath, generateReportMarkdown(report));
}

/**
 * Load analysis report
 */
export function loadAnalysisReport(session: ResearchSession): AnalysisReport | null {
  const filePath = path.join(session.outputDir, 'analysis_report.json');
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Generate markdown report from analysis
 */
export function generateReportMarkdown(report: AnalysisReport): string {
  const lines: string[] = [];

  lines.push(`# ${report.title}`);
  lines.push('');
  lines.push(`*Generated: ${new Date(report.generatedAt).toISOString()}*`);
  lines.push('');

  // Summary
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(report.summary);
  lines.push('');

  // Parts Ranking
  lines.push('## Part/Accessory Opportunities');
  lines.push('');
  lines.push('| Category | Demand | Competition | Opportunity | Action |');
  lines.push('|----------|--------|-------------|-------------|--------|');
  for (const part of report.partsRanking) {
    const opportunityEmoji = part.opportunity === 'high' ? '🔥' : part.opportunity === 'medium' ? '⚡' : '➖';
    lines.push(`| ${part.partCategory} | ${part.demandScore} | ${part.competitionScore} | ${opportunityEmoji} ${part.opportunity} | ${part.action || '-'} |`);
  }
  lines.push('');

  // Pain Points
  lines.push('## Customer Pain Points');
  lines.push('');
  for (const pain of report.painPoints) {
    lines.push(`### ${pain.issue}`);
    lines.push('');
    lines.push(`- **Frequency:** ${pain.frequency} mentions`);
    lines.push(`- **Severity:** ${pain.severity}/5`);
    lines.push(`- **Product Opportunity:** ${pain.productOpportunity}`);
    if (pain.exampleQuotes && pain.exampleQuotes.length > 0) {
      lines.push('');
      lines.push('**Example quotes:**');
      for (const quote of pain.exampleQuotes.slice(0, 2)) {
        lines.push(`> "${quote}"`);
      }
    }
    lines.push('');
  }

  // Keyword Recommendations
  lines.push('## Keyword Recommendations');
  lines.push('');
  lines.push('| Keyword | Volume | Competition | Intent | Recommendation |');
  lines.push('|---------|--------|-------------|--------|----------------|');
  for (const kw of report.keywordRecommendations) {
    lines.push(`| ${kw.keyword} | ${kw.searchVolume} | ${kw.competition} | ${kw.intent || '-'} | ${kw.recommendation} |`);
  }
  lines.push('');

  // Competition Summary
  lines.push('## Competition Analysis');
  lines.push('');
  const comp = report.competitionSummary;
  lines.push(`- **Competitors Analyzed:** ${comp.competitorCount}`);
  lines.push(`- **Top Brands:** ${comp.topBrands.join(', ')}`);
  lines.push(`- **Price Range:** $${comp.priceRange.min.toFixed(2)} - $${comp.priceRange.max.toFixed(2)} (avg: $${comp.priceRange.average.toFixed(2)})`);
  lines.push(`- **Average Rating:** ${comp.averageRating.toFixed(1)}/5`);
  lines.push(`- **Market Entry Difficulty:** ${comp.entryDifficulty}`);
  lines.push('');
  lines.push('**Key Success Factors:**');
  for (const factor of comp.successFactors) {
    lines.push(`- ${factor}`);
  }
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// CSV Export Functions
// ============================================================================

/**
 * Export products to CSV
 */
export function exportProductsToCSV(session: ResearchSession): string {
  const products = loadProducts(session);
  const csvPath = path.join(session.outputDir, 'products.csv');

  const headers = ['id', 'name', 'brand', 'model', 'price', 'rating', 'reviewCount', 'platform', 'url'];
  const rows = products.map(p => [
    p.id,
    `"${p.name.replace(/"/g, '""')}"`,
    `"${p.brand.replace(/"/g, '""')}"`,
    p.model,
    p.price.toString(),
    p.rating.toString(),
    p.reviewCount.toString(),
    p.platform,
    p.url,
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  fs.writeFileSync(csvPath, csv);

  return csvPath;
}

/**
 * Export parts matrix to CSV
 */
export function exportPartsMatrixToCSV(session: ResearchSession): string {
  const parts = loadParts(session);
  const products = loadProducts(session);
  const csvPath = path.join(session.outputDir, 'parts_matrix.csv');

  // Create a mapping of product IDs to names
  const productNames = new Map(products.map(p => [p.id, `${p.brand} ${p.model}`]));

  const headers = ['product', 'partName', 'partModel', 'category', 'isReplaceable', 'price'];
  const rows: string[] = [];

  for (const partData of parts) {
    const productName = productNames.get(partData.productId) || partData.productId;
    for (const part of partData.parts) {
      rows.push([
        `"${productName.replace(/"/g, '""')}"`,
        `"${part.name.replace(/"/g, '""')}"`,
        part.model || '',
        part.category,
        part.isReplaceable ? 'Yes' : 'No',
        part.price?.toString() || '',
      ].join(','));
    }
  }

  const csv = [headers.join(','), ...rows].join('\n');
  fs.writeFileSync(csvPath, csv);

  return csvPath;
}

/**
 * Export keywords to CSV
 */
export function exportKeywordsToCSV(session: ResearchSession): string {
  const keywords = loadKeywords(session);
  const csvPath = path.join(session.outputDir, 'keywords.csv');

  const headers = ['keyword', 'source', 'type', 'seedKeyword', 'position'];
  const rows: string[] = [];

  for (const kwData of keywords) {
    for (const suggestion of kwData.suggestions) {
      rows.push([
        `"${suggestion.keyword.replace(/"/g, '""')}"`,
        kwData.source,
        suggestion.type,
        `"${kwData.seedKeyword.replace(/"/g, '""')}"`,
        suggestion.position?.toString() || '',
      ].join(','));
    }
  }

  const csv = [headers.join(','), ...rows].join('\n');
  fs.writeFileSync(csvPath, csv);

  return csvPath;
}

/**
 * Export competition scores to CSV
 */
export function exportCompetitionToCSV(session: ResearchSession): string {
  const report = loadAnalysisReport(session);
  if (!report) {
    throw new Error('No analysis report found');
  }

  const csvPath = path.join(session.outputDir, 'competition_score.csv');

  const headers = ['category', 'demandScore', 'competitionScore', 'opportunity', 'reasoning'];
  const rows = report.partsRanking.map(p => [
    p.partCategory,
    p.demandScore.toString(),
    p.competitionScore.toString(),
    p.opportunity,
    `"${p.reasoning.replace(/"/g, '""')}"`,
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  fs.writeFileSync(csvPath, csv);

  return csvPath;
}

/**
 * Generate all research statistics
 */
export function calculateResearchStats(session: ResearchSession): ResearchStats {
  const products = loadProducts(session);
  const parts = loadParts(session);
  const reviews = loadReviews(session);
  const keywords = loadKeywords(session);

  const productsByPlatform: Record<ResearchPlatform, number> = {
    homedepot: 0,
    lowes: 0,
    amazon: 0,
    google: 0,
  };

  for (const product of products) {
    productsByPlatform[product.platform]++;
  }

  const uniqueParts = new Set<string>();
  for (const partData of parts) {
    for (const part of partData.parts) {
      uniqueParts.add(`${part.category}:${part.model || part.name}`);
    }
  }

  const totalReviews = reviews.reduce((sum, r) => sum + r.reviews.length, 0);
  const totalQuestions = reviews.reduce((sum, r) => sum + r.questions.length, 0);
  const totalKeywords = keywords.reduce((sum, k) => sum + k.suggestions.length, 0);

  return {
    totalProducts: products.length,
    productsByPlatform,
    totalReviews,
    totalQuestions,
    totalKeywords,
    uniqueParts: uniqueParts.size,
    durationMs: session.completedAt
      ? session.completedAt - session.createdAt
      : Date.now() - session.createdAt,
  };
}

/**
 * List all research sessions
 */
export function listResearchSessions(): ResearchSession[] {
  ensureResearchDirectories();

  const sessions: ResearchSession[] = [];
  const dirs = fs.readdirSync(RESEARCH_DATA_DIR);

  for (const dir of dirs) {
    const dirPath = path.join(RESEARCH_DATA_DIR, dir);
    const stat = fs.statSync(dirPath);

    if (stat.isDirectory()) {
      const session = loadSessionConfig(dirPath);
      if (session) {
        sessions.push(session);
      }
    }
  }

  // Sort by creation time, newest first
  return sessions.sort((a, b) => b.createdAt - a.createdAt);
}
