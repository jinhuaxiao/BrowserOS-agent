/**
 * Research Data Analyzer
 *
 * Aggregates collected research data and generates prompts for LLM analysis.
 * Parses LLM responses into structured reports.
 */

import type {
  ResearchSession,
  ProductData,
  PartsData,
  ReviewData,
  KeywordData,
  AnalysisReport,
  PartOpportunity,
  PainPoint,
  KeywordRecommendation,
  CompetitionSummary,
} from './research-types.ts';

import {
  loadProducts,
  loadParts,
  loadReviews,
  loadKeywords,
  saveAnalysisReport,
} from './research-types.ts';

// ============================================================================
// Analysis Prompt Generation
// ============================================================================

/**
 * Generate a comprehensive analysis prompt for LLM
 */
export function generateAnalysisPrompt(session: ResearchSession): string {
  const products = loadProducts(session);
  const parts = loadParts(session);
  const reviews = loadReviews(session);
  const keywords = loadKeywords(session);

  const sections: string[] = [];

  // Header
  sections.push(`# Product Research Analysis Request`);
  sections.push(``);
  sections.push(`## Research Context`);
  sections.push(`- **Category:** ${session.category}`);
  sections.push(`- **Keywords:** ${session.keywords.join(', ')}`);
  sections.push(`- **Platforms Researched:** ${session.platforms.join(', ')}`);
  sections.push(`- **Products Collected:** ${products.length}`);
  sections.push(``);

  // Products Summary
  sections.push(`## Products Data`);
  sections.push(``);
  sections.push(`### Sample Products (Top 10 by Rating)`);
  sections.push(``);
  const topProducts = [...products]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10);

  for (const p of topProducts) {
    sections.push(`- **${p.brand} ${p.model || p.name}**`);
    sections.push(`  - Price: $${p.price.toFixed(2)}`);
    sections.push(`  - Rating: ${p.rating}/5 (${p.reviewCount} reviews)`);
    sections.push(`  - Platform: ${p.platform}`);
  }
  sections.push(``);

  // Parts Analysis
  sections.push(`## Parts/Accessories Data`);
  sections.push(``);

  // Aggregate parts by category
  const partsByCategory = new Map<string, { count: number; examples: string[] }>();
  for (const partData of parts) {
    for (const part of partData.parts) {
      if (!partsByCategory.has(part.category)) {
        partsByCategory.set(part.category, { count: 0, examples: [] });
      }
      const cat = partsByCategory.get(part.category)!;
      cat.count++;
      if (cat.examples.length < 5) {
        cat.examples.push(part.model || part.name);
      }
    }
  }

  sections.push(`### Parts by Category`);
  sections.push(``);
  for (const [category, data] of partsByCategory.entries()) {
    sections.push(`- **${category}:** ${data.count} occurrences`);
    sections.push(`  - Examples: ${data.examples.join(', ')}`);
  }
  sections.push(``);

  // Reviews Analysis
  sections.push(`## Customer Reviews Summary`);
  sections.push(``);

  const allReviews: { rating: number; title: string; content: string }[] = [];
  for (const reviewData of reviews) {
    for (const review of reviewData.reviews) {
      allReviews.push(review);
    }
  }

  // Separate by rating
  const lowRatingReviews = allReviews.filter(r => r.rating <= 3);
  const highRatingReviews = allReviews.filter(r => r.rating >= 4);

  sections.push(`### Low Rating Reviews (1-3 stars) - ${lowRatingReviews.length} total`);
  sections.push(``);
  for (const review of lowRatingReviews.slice(0, 15)) {
    sections.push(`- **[${review.rating}/5] ${review.title}**`);
    const content = review.content.substring(0, 200);
    sections.push(`  "${content}${review.content.length > 200 ? '...' : ''}"`);
  }
  sections.push(``);

  // Q&A Summary
  const allQuestions: string[] = [];
  for (const reviewData of reviews) {
    for (const q of reviewData.questions) {
      allQuestions.push(q.question);
    }
  }

  if (allQuestions.length > 0) {
    sections.push(`### Common Customer Questions (${allQuestions.length} total)`);
    sections.push(``);
    for (const q of allQuestions.slice(0, 10)) {
      sections.push(`- ${q}`);
    }
    sections.push(``);
  }

  // Keywords Summary
  sections.push(`## Keyword Data`);
  sections.push(``);

  const keywordsBySource = new Map<string, string[]>();
  for (const kwData of keywords) {
    if (!keywordsBySource.has(kwData.source)) {
      keywordsBySource.set(kwData.source, []);
    }
    const kws = keywordsBySource.get(kwData.source)!;
    for (const s of kwData.suggestions) {
      if (!kws.includes(s.keyword) && kws.length < 30) {
        kws.push(s.keyword);
      }
    }
  }

  for (const [source, kws] of keywordsBySource.entries()) {
    sections.push(`### ${source.toUpperCase()} Keywords`);
    sections.push(``);
    sections.push(kws.map(k => `- ${k}`).join('\n'));
    sections.push(``);
  }

  // Analysis Instructions
  sections.push(`## Analysis Instructions`);
  sections.push(``);
  sections.push(`Please analyze this product research data and provide:`);
  sections.push(``);
  sections.push(`### 1. Part/Accessory Opportunity Analysis`);
  sections.push(`For each part category, assess:`);
  sections.push(`- Demand score (0-100) based on frequency and review mentions`);
  sections.push(`- Competition score (0-100) based on existing offerings`);
  sections.push(`- Overall opportunity rating (high/medium/low)`);
  sections.push(`- Recommended action`);
  sections.push(``);
  sections.push(`### 2. Pain Point Analysis`);
  sections.push(`From the negative reviews, identify:`);
  sections.push(`- Top 5-10 recurring issues`);
  sections.push(`- Severity of each issue`);
  sections.push(`- Product improvement opportunities`);
  sections.push(``);
  sections.push(`### 3. Keyword Recommendations`);
  sections.push(`Analyze the keywords and recommend:`);
  sections.push(`- Top 10 keywords for SEO/PPC`);
  sections.push(`- Search volume estimate (high/medium/low)`);
  sections.push(`- Competition level`);
  sections.push(`- Recommended use (product title, backend, PPC, etc.)`);
  sections.push(``);
  sections.push(`### 4. Competition Summary`);
  sections.push(`Provide:`);
  sections.push(`- Price range analysis`);
  sections.push(`- Brand concentration`);
  sections.push(`- Average quality (based on ratings)`);
  sections.push(`- Market entry difficulty`);
  sections.push(`- Key success factors`);
  sections.push(``);
  sections.push(`Please format your response as a structured analysis following the sections above.`);

  return sections.join('\n');
}

/**
 * Generate a shorter, focused analysis prompt for specific aspects
 */
export function generateFocusedPrompt(
  session: ResearchSession,
  focus: 'parts' | 'painpoints' | 'keywords' | 'competition'
): string {
  const products = loadProducts(session);
  const parts = loadParts(session);
  const reviews = loadReviews(session);
  const keywords = loadKeywords(session);

  switch (focus) {
    case 'parts':
      return generatePartsPrompt(parts, products);
    case 'painpoints':
      return generatePainPointsPrompt(reviews);
    case 'keywords':
      return generateKeywordsPrompt(keywords);
    case 'competition':
      return generateCompetitionPrompt(products);
  }
}

function generatePartsPrompt(parts: PartsData[], products: ProductData[]): string {
  const sections: string[] = [];
  sections.push(`# Parts/Accessories Analysis Request`);
  sections.push(``);

  // Aggregate parts
  const partsByCategory = new Map<string, { count: number; models: string[] }>();
  for (const partData of parts) {
    for (const part of partData.parts) {
      if (!partsByCategory.has(part.category)) {
        partsByCategory.set(part.category, { count: 0, models: [] });
      }
      const cat = partsByCategory.get(part.category)!;
      cat.count++;
      if (part.model && !cat.models.includes(part.model)) {
        cat.models.push(part.model);
      }
    }
  }

  sections.push(`## Parts Data (from ${products.length} products)`);
  sections.push(``);
  for (const [category, data] of partsByCategory.entries()) {
    sections.push(`### ${category}`);
    sections.push(`- Occurrences: ${data.count}`);
    sections.push(`- Unique models: ${data.models.slice(0, 10).join(', ')}`);
    sections.push(``);
  }

  sections.push(`## Analysis Required`);
  sections.push(`For each part category, provide:`);
  sections.push(`1. Demand score (0-100)`);
  sections.push(`2. Competition score (0-100)`);
  sections.push(`3. Opportunity rating (high/medium/low)`);
  sections.push(`4. Reasoning and recommended action`);

  return sections.join('\n');
}

function generatePainPointsPrompt(reviews: ReviewData[]): string {
  const sections: string[] = [];
  sections.push(`# Pain Point Analysis Request`);
  sections.push(``);

  const lowRatingReviews: { rating: number; content: string }[] = [];
  for (const reviewData of reviews) {
    for (const review of reviewData.reviews) {
      if (review.rating <= 3) {
        lowRatingReviews.push({ rating: review.rating, content: review.content });
      }
    }
  }

  sections.push(`## Negative Reviews (${lowRatingReviews.length} reviews, 1-3 stars)`);
  sections.push(``);
  for (const review of lowRatingReviews.slice(0, 30)) {
    sections.push(`[${review.rating}/5]: "${review.content.substring(0, 300)}"`);
    sections.push(``);
  }

  sections.push(`## Analysis Required`);
  sections.push(`Identify the top pain points from these reviews:`);
  sections.push(`1. Issue description`);
  sections.push(`2. Frequency (how many times mentioned)`);
  sections.push(`3. Severity (1-5)`);
  sections.push(`4. Product improvement opportunity`);

  return sections.join('\n');
}

function generateKeywordsPrompt(keywords: KeywordData[]): string {
  const sections: string[] = [];
  sections.push(`# Keyword Analysis Request`);
  sections.push(``);

  const allKeywords: string[] = [];
  for (const kwData of keywords) {
    for (const s of kwData.suggestions) {
      if (!allKeywords.includes(s.keyword)) {
        allKeywords.push(s.keyword);
      }
    }
  }

  sections.push(`## Collected Keywords (${allKeywords.length} unique)`);
  sections.push(``);
  sections.push(allKeywords.join('\n'));
  sections.push(``);

  sections.push(`## Analysis Required`);
  sections.push(`For the top 15 keywords, provide:`);
  sections.push(`1. Search volume estimate (high/medium/low)`);
  sections.push(`2. Competition level (high/medium/low)`);
  sections.push(`3. Search intent (informational/transactional/navigational)`);
  sections.push(`4. Recommended use`);

  return sections.join('\n');
}

function generateCompetitionPrompt(products: ProductData[]): string {
  const sections: string[] = [];
  sections.push(`# Competition Analysis Request`);
  sections.push(``);

  // Calculate stats
  const prices = products.map(p => p.price).filter(p => p > 0);
  const ratings = products.map(p => p.rating).filter(r => r > 0);
  const reviews = products.map(p => p.reviewCount);

  // Brand distribution
  const brandCounts = new Map<string, number>();
  for (const p of products) {
    brandCounts.set(p.brand, (brandCounts.get(p.brand) || 0) + 1);
  }
  const topBrands = [...brandCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  sections.push(`## Market Data (${products.length} products analyzed)`);
  sections.push(``);
  sections.push(`### Price Distribution`);
  sections.push(`- Min: $${Math.min(...prices).toFixed(2)}`);
  sections.push(`- Max: $${Math.max(...prices).toFixed(2)}`);
  sections.push(`- Average: $${(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)}`);
  sections.push(``);
  sections.push(`### Rating Distribution`);
  sections.push(`- Average: ${(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)}/5`);
  sections.push(``);
  sections.push(`### Review Counts`);
  sections.push(`- Average: ${Math.round(reviews.reduce((a, b) => a + b, 0) / reviews.length)}`);
  sections.push(`- Max: ${Math.max(...reviews)}`);
  sections.push(``);
  sections.push(`### Top Brands`);
  for (const [brand, count] of topBrands) {
    sections.push(`- ${brand}: ${count} products`);
  }
  sections.push(``);

  sections.push(`## Analysis Required`);
  sections.push(`Provide:`);
  sections.push(`1. Market entry difficulty assessment (easy/moderate/hard)`);
  sections.push(`2. Key success factors for this market`);
  sections.push(`3. Recommended positioning strategy`);
  sections.push(`4. Pricing recommendation`);

  return sections.join('\n');
}

// ============================================================================
// Response Parsing
// ============================================================================

/**
 * Parse LLM response into structured AnalysisReport
 */
export function parseAnalysisResponse(
  session: ResearchSession,
  llmResponse: string
): AnalysisReport {
  // This is a simplified parser - in production, you'd want more robust parsing
  // or structured output from the LLM

  const report: AnalysisReport = {
    title: `${session.category} Product Research Analysis`,
    summary: extractSection(llmResponse, 'summary', 'executive summary') || 'Analysis complete.',
    partsRanking: parsePartsRanking(llmResponse),
    painPoints: parsePainPoints(llmResponse),
    keywordRecommendations: parseKeywordRecommendations(llmResponse),
    competitionSummary: parseCompetitionSummary(llmResponse, session),
    generatedAt: Date.now(),
    sessionId: session.id,
  };

  return report;
}

/**
 * Extract a section from the LLM response by heading
 */
function extractSection(response: string, ...headings: string[]): string | null {
  const lines = response.split('\n');
  let capturing = false;
  const captured: string[] = [];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Check if we hit a new section heading
    if (line.startsWith('#')) {
      if (capturing) {
        // End of our section
        break;
      }
      // Check if this is a heading we want
      for (const heading of headings) {
        if (lowerLine.includes(heading.toLowerCase())) {
          capturing = true;
          break;
        }
      }
      continue;
    }

    if (capturing) {
      captured.push(line);
    }
  }

  return captured.length > 0 ? captured.join('\n').trim() : null;
}

/**
 * Parse parts ranking from LLM response
 */
function parsePartsRanking(response: string): PartOpportunity[] {
  const results: PartOpportunity[] = [];
  const partsSection = extractSection(response, 'part', 'accessory', 'opportunity');

  if (!partsSection) {
    return results;
  }

  // Look for patterns like "chain - Demand: 85, Competition: 40, Opportunity: high"
  const patterns = [
    /[-•]\s*\*?\*?([^:*]+)\*?\*?.*demand[:\s]*(\d+).*competition[:\s]*(\d+).*opportunity[:\s]*(high|medium|low)/gi,
    /\*?\*?([^:*]+)\*?\*?[:\s]*demand[:\s]*(\d+).*competition[:\s]*(\d+)/gi,
  ];

  for (const pattern of patterns) {
    const lines = partsSection.split('\n');
    for (const line of lines) {
      const match = pattern.exec(line);
      if (match && match[1] && match[2] && match[3]) {
        const opportunityRaw = match[4]?.toLowerCase();
        const opportunity: 'high' | 'medium' | 'low' =
          opportunityRaw === 'high' || opportunityRaw === 'medium' || opportunityRaw === 'low'
            ? opportunityRaw
            : 'medium';
        results.push({
          partCategory: match[1].trim(),
          demandScore: parseInt(match[2], 10) || 50,
          competitionScore: parseInt(match[3], 10) || 50,
          opportunity,
          reasoning: line,
        });
      }
      pattern.lastIndex = 0; // Reset regex
    }
  }

  return results;
}

/**
 * Parse pain points from LLM response
 */
function parsePainPoints(response: string): PainPoint[] {
  const results: PainPoint[] = [];
  const painSection = extractSection(response, 'pain point', 'issue', 'problem', 'complaint');

  if (!painSection) {
    return results;
  }

  // Look for numbered or bulleted items
  const lines = painSection.split('\n');
  let currentPain: Partial<PainPoint> | null = null;

  for (const line of lines) {
    // Check if this is a new pain point (numbered or bulleted)
    const newItemMatch = line.match(/^[\d•\-]\s*\.?\s*\*?\*?([^:]+)/);
    if (newItemMatch && newItemMatch[1]) {
      if (currentPain && currentPain.issue) {
        results.push(currentPain as PainPoint);
      }
      currentPain = {
        issue: newItemMatch[1].trim().replace(/\*\*/g, ''),
        frequency: 1,
        severity: 3,
        productOpportunity: '',
      };
    }

    // Extract frequency
    const freqMatch = line.match(/frequency[:\s]*(\d+)/i);
    if (freqMatch && freqMatch[1] && currentPain) {
      currentPain.frequency = parseInt(freqMatch[1], 10);
    }

    // Extract severity
    const severityMatch = line.match(/severity[:\s]*(\d)/i);
    if (severityMatch && severityMatch[1] && currentPain) {
      currentPain.severity = parseInt(severityMatch[1], 10);
    }

    // Extract opportunity
    const oppMatch = line.match(/opportunity[:\s]*(.+)/i);
    if (oppMatch && oppMatch[1] && currentPain) {
      currentPain.productOpportunity = oppMatch[1].trim();
    }
  }

  // Don't forget the last one
  if (currentPain && currentPain.issue) {
    results.push(currentPain as PainPoint);
  }

  return results;
}

/**
 * Parse keyword recommendations from LLM response
 */
function parseKeywordRecommendations(response: string): KeywordRecommendation[] {
  const results: KeywordRecommendation[] = [];
  const keywordSection = extractSection(response, 'keyword', 'seo', 'ppc');

  if (!keywordSection) {
    return results;
  }

  // Look for table-like or list patterns
  const lines = keywordSection.split('\n');

  for (const line of lines) {
    // Try to match keyword entries
    const match = line.match(/[-•|]\s*([^|:]+).*?(high|medium|low).*?(high|medium|low)/i);
    if (match && match[1] && match[2] && match[3]) {
      const volumeRaw = match[2].toLowerCase();
      const compRaw = match[3].toLowerCase();
      const searchVolume: 'high' | 'medium' | 'low' =
        volumeRaw === 'high' || volumeRaw === 'medium' || volumeRaw === 'low'
          ? volumeRaw
          : 'medium';
      const competition: 'high' | 'medium' | 'low' =
        compRaw === 'high' || compRaw === 'medium' || compRaw === 'low'
          ? compRaw
          : 'medium';
      results.push({
        keyword: match[1].trim().replace(/\*\*/g, ''),
        searchVolume,
        competition,
        recommendation: 'Consider for product listing and PPC',
      });
    }
  }

  return results;
}

/**
 * Parse competition summary from LLM response
 */
function parseCompetitionSummary(response: string, session: ResearchSession): CompetitionSummary {
  const products = loadProducts(session);
  const compSection = extractSection(response, 'competition', 'market', 'analysis');

  // Calculate from actual data
  const prices = products.map(p => p.price).filter(p => p > 0);
  const ratings = products.map(p => p.rating).filter(r => r > 0);

  const brandCounts = new Map<string, number>();
  for (const p of products) {
    brandCounts.set(p.brand, (brandCounts.get(p.brand) || 0) + 1);
  }
  const topBrands = [...brandCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([brand]) => brand);

  // Try to extract entry difficulty from response
  let entryDifficulty: 'easy' | 'moderate' | 'hard' = 'moderate';
  if (compSection) {
    if (/easy|low barrier/i.test(compSection)) entryDifficulty = 'easy';
    else if (/hard|difficult|high barrier/i.test(compSection)) entryDifficulty = 'hard';
  }

  // Extract success factors
  const successFactors: string[] = [];
  const factorsSection = extractSection(response, 'success factor', 'key factor');
  if (factorsSection) {
    const lines = factorsSection.split('\n');
    for (const line of lines) {
      const match = line.match(/[-•\d]\s*\.?\s*(.+)/);
      if (match && match[1] && match[1].length > 10) {
        successFactors.push(match[1].trim().replace(/\*\*/g, ''));
      }
    }
  }

  return {
    competitorCount: products.length,
    topBrands,
    priceRange: {
      min: prices.length > 0 ? Math.min(...prices) : 0,
      max: prices.length > 0 ? Math.max(...prices) : 0,
      average: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
    },
    averageRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
    entryDifficulty,
    successFactors: successFactors.length > 0 ? successFactors : ['Quality products', 'Competitive pricing', 'Good customer service'],
  };
}

// ============================================================================
// Analysis Execution
// ============================================================================

/**
 * Run complete analysis on a research session
 * Returns the prompt for LLM analysis
 */
export function prepareAnalysis(session: ResearchSession): {
  prompt: string;
  dataStats: {
    products: number;
    parts: number;
    reviews: number;
    keywords: number;
  };
} {
  const products = loadProducts(session);
  const parts = loadParts(session);
  const reviews = loadReviews(session);
  const keywords = loadKeywords(session);

  const prompt = generateAnalysisPrompt(session);

  return {
    prompt,
    dataStats: {
      products: products.length,
      parts: parts.reduce((sum, p) => sum + p.parts.length, 0),
      reviews: reviews.reduce((sum, r) => sum + r.reviews.length, 0),
      keywords: keywords.reduce((sum, k) => sum + k.suggestions.length, 0),
    },
  };
}

/**
 * Finalize analysis by saving the report
 */
export function finalizeAnalysis(
  session: ResearchSession,
  llmResponse: string
): AnalysisReport {
  const report = parseAnalysisResponse(session, llmResponse);
  saveAnalysisReport(session, report);
  return report;
}

/**
 * Create a fallback report when LLM analysis is not available
 */
export function createFallbackReport(session: ResearchSession): AnalysisReport {
  const products = loadProducts(session);
  const parts = loadParts(session);
  const reviews = loadReviews(session);
  const keywords = loadKeywords(session);

  // Aggregate parts
  const partsByCategory = new Map<string, number>();
  for (const partData of parts) {
    for (const part of partData.parts) {
      partsByCategory.set(part.category, (partsByCategory.get(part.category) || 0) + 1);
    }
  }

  const partsRanking: PartOpportunity[] = [...partsByCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([category, count]) => ({
      partCategory: category,
      demandScore: Math.min(100, count * 10),
      competitionScore: 50,
      opportunity: count > 5 ? 'high' : count > 2 ? 'medium' : 'low',
      reasoning: `Found ${count} instances across ${products.length} products`,
    }));

  // Calculate stats
  const prices = products.map(p => p.price).filter(p => p > 0);
  const ratings = products.map(p => p.rating).filter(r => r > 0);

  const brandCounts = new Map<string, number>();
  for (const p of products) {
    brandCounts.set(p.brand, (brandCounts.get(p.brand) || 0) + 1);
  }
  const topBrands = [...brandCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([brand]) => brand);

  // Collect top keywords
  const allKeywords: string[] = [];
  for (const kwData of keywords) {
    for (const s of kwData.suggestions) {
      if (!allKeywords.includes(s.keyword)) {
        allKeywords.push(s.keyword);
      }
    }
  }

  const keywordRecommendations: KeywordRecommendation[] = allKeywords
    .slice(0, 15)
    .map(kw => ({
      keyword: kw,
      searchVolume: 'medium' as const,
      competition: 'medium' as const,
      recommendation: 'Consider for product listing',
    }));

  const report: AnalysisReport = {
    title: `${session.category} Product Research Analysis`,
    summary: `Analyzed ${products.length} products from ${session.platforms.join(', ')}. Found ${partsByCategory.size} part categories and ${allKeywords.length} keywords.`,
    partsRanking,
    painPoints: [],
    keywordRecommendations,
    competitionSummary: {
      competitorCount: products.length,
      topBrands,
      priceRange: {
        min: prices.length > 0 ? Math.min(...prices) : 0,
        max: prices.length > 0 ? Math.max(...prices) : 0,
        average: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
      },
      averageRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
      entryDifficulty: 'moderate',
      successFactors: ['Quality products', 'Competitive pricing', 'Good customer service'],
    },
    generatedAt: Date.now(),
    sessionId: session.id,
  };

  saveAnalysisReport(session, report);
  return report;
}
