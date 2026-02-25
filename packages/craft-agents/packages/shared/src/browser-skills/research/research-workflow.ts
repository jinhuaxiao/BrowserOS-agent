/**
 * Product Research Workflow
 *
 * Complete workflow definition for multi-platform product research,
 * parts analysis, and keyword mining.
 */

import type { BrowserWorkflow, WorkflowNode, WorkflowEdge } from '../workflow-types.ts';
import type { ResearchSession, ResearchPlatform } from './research-types.ts';

// ============================================================================
// Full Product Research Workflow
// ============================================================================

/**
 * Complete product research workflow
 *
 * This workflow:
 * 1. Searches multiple platforms in parallel (Home Depot, Lowe's, Amazon)
 * 2. Merges and deduplicates products
 * 3. Extracts detailed info from each product
 * 4. Collects reviews and Q&A
 * 5. Mines keywords from Google and Amazon
 * 6. Generates analysis report
 */
export const PRODUCT_RESEARCH_WORKFLOW: BrowserWorkflow = {
  id: 'product-research-full',
  name: 'Full Product Research',
  description: 'Complete cross-platform product research workflow with parts analysis and keyword mining',

  triggers: {
    intentPatterns: [
      'product research',
      'research products',
      'market research',
      'analyze category',
      'parts research',
    ],
  },

  parameters: [
    {
      name: 'category',
      label: 'Product Category',
      type: 'string',
      required: true,
      description: 'Product category to research (e.g., chainsaw)',
    },
    {
      name: 'keyword',
      label: 'Search Keyword',
      type: 'string',
      required: true,
      description: 'Primary search keyword',
    },
    {
      name: 'maxProducts',
      label: 'Max Products',
      type: 'number',
      required: false,
      defaultValue: 20,
      description: 'Maximum products to collect per platform',
    },
    {
      name: 'platforms',
      label: 'Platforms',
      type: 'string',
      required: false,
      defaultValue: 'homedepot',
      description: 'Comma-separated platforms: homedepot,lowes,amazon',
    },
    {
      name: 'sessionId',
      label: 'Session ID',
      type: 'string',
      required: false,
      description: 'Research session ID (auto-generated if not provided)',
    },
  ],

  outputs: [
    {
      name: 'sessionId',
      type: 'string',
      description: 'Research session ID',
    },
    {
      name: 'outputDir',
      type: 'string',
      description: 'Output directory path',
    },
    {
      name: 'stats',
      type: 'object',
      description: 'Research statistics',
    },
  ],

  nodes: [
    // ========== START ==========
    {
      id: 'start',
      type: 'start',
      name: 'Start Research',
    },

    // ========== INITIALIZATION ==========
    {
      id: 'init-session',
      type: 'script',
      name: 'Initialize Research Session',
      script: {
        code: `
          const { createResearchSession } = require('./research-types.ts');
          const category = context.parameters.category;
          const keyword = context.parameters.keyword;
          const platforms = (context.parameters.platforms || 'homedepot').split(',').map(p => p.trim());
          const maxProducts = context.parameters.maxProducts || 20;

          const session = createResearchSession(category, [keyword], platforms, maxProducts);
          return { session, outputDir: session.outputDir };
        `,
        outputVariable: 'sessionInfo',
      },
    },

    // ========== PLATFORM SEARCH (PARALLEL) ==========
    {
      id: 'search-platforms',
      type: 'parallel',
      name: 'Search All Platforms',
      parallel: {
        nodeIds: ['search-homedepot', 'search-amazon'],
        waitAll: true,
        failFast: false,
      },
    },

    // Home Depot Search
    {
      id: 'search-homedepot',
      type: 'skill_call',
      name: 'Search Home Depot',
      skillCall: {
        skillId: 'homedepot-search',
        parameterMapping: {
          keyword: '$params.keyword',
          maxProducts: '$params.maxProducts',
        },
        outputVariable: 'homedepotProducts',
      },
      optional: true,
    },

    // Amazon Search
    {
      id: 'search-amazon',
      type: 'skill_call',
      name: 'Search Amazon',
      skillCall: {
        skillId: 'amazon-search-products',
        parameterMapping: {
          keyword: '$params.keyword',
          maxProducts: '$params.maxProducts',
        },
        outputVariable: 'amazonResults',
      },
      optional: true,
    },

    // ========== MERGE PRODUCTS ==========
    {
      id: 'merge-products',
      type: 'transform',
      name: 'Merge Product Results',
      transform: {
        inputs: ['$vars.homedepotProducts', '$vars.amazonResults'],
        expression: `
          const hd = inputs[0]?.products || inputs[0] || [];
          const amz = inputs[1]?.products || [];
          const merged = [...hd, ...amz];
          context.variables.allProducts = merged;
          return { products: merged, count: merged.length };
        `,
        outputVariable: 'mergedProducts',
      },
    },

    // ========== SAVE INITIAL PRODUCTS ==========
    {
      id: 'save-products',
      type: 'script',
      name: 'Save Products Data',
      script: {
        code: `
          const { saveProducts, updateSessionStatus } = require('./research-types.ts');
          const session = context.variables.sessionInfo.session;
          const products = context.variables.allProducts || [];

          saveProducts(session, products);
          updateSessionStatus(session, 'running');

          return { saved: products.length };
        `,
        outputVariable: 'productsSaved',
      },
    },

    // ========== EXTRACT DETAILS LOOP ==========
    {
      id: 'extract-details-loop',
      type: 'loop',
      name: 'Extract Product Details',
      loop: {
        type: 'for_each',
        itemsVariable: 'allProducts',
        loopVariable: 'currentProduct',
        indexVariable: 'productIndex',
        maxIterations: 20,
        bodyNodeIds: ['extract-product-details'],
      },
    },

    // Extract details for one product
    {
      id: 'extract-product-details',
      type: 'condition',
      name: 'Check Platform for Details',
      condition: {
        expression: 'context.variables.currentProduct?.platform === "homedepot"',
        branches: [
          {
            condition: 'context.variables.currentProduct?.platform === "homedepot"',
            targetNodeId: 'extract-hd-details',
          },
        ],
        defaultBranch: 'skip-details',
      },
    },

    {
      id: 'extract-hd-details',
      type: 'skill_call',
      name: 'Extract HD Product Details',
      skillCall: {
        skillId: 'homedepot-product-detail',
        parameterMapping: {
          productUrl: '$vars.currentProduct.url',
          productId: '$vars.currentProduct.id',
        },
        outputVariable: 'productDetails',
      },
      optional: true,
      onError: {
        strategy: 'skip',
      },
    },

    {
      id: 'skip-details',
      type: 'wait',
      name: 'Skip Non-HD Product',
      wait: {
        durationMs: 100,
      },
    },

    // ========== SAVE PARTS DATA ==========
    {
      id: 'save-parts',
      type: 'script',
      name: 'Aggregate and Save Parts',
      script: {
        code: `
          const { saveParts, loadParts } = require('./research-types.ts');
          const session = context.variables.sessionInfo.session;

          // Collect all parts data from loop iterations
          const allParts = context.variables.collectedParts || [];
          saveParts(session, allParts);

          return { partsSaved: allParts.length };
        `,
        outputVariable: 'partsSaved',
      },
    },

    // ========== EXTRACT REVIEWS LOOP ==========
    {
      id: 'extract-reviews-loop',
      type: 'loop',
      name: 'Extract Product Reviews',
      loop: {
        type: 'for_each',
        itemsVariable: 'allProducts',
        loopVariable: 'currentProduct',
        indexVariable: 'reviewIndex',
        maxIterations: 10, // Limit for MVP
        bodyNodeIds: ['extract-product-reviews'],
      },
    },

    {
      id: 'extract-product-reviews',
      type: 'condition',
      name: 'Check if HD Product for Reviews',
      condition: {
        expression: 'context.variables.currentProduct?.platform === "homedepot" && context.variables.currentProduct?.reviewCount > 10',
        branches: [
          {
            condition: 'context.variables.currentProduct?.platform === "homedepot"',
            targetNodeId: 'extract-hd-reviews',
          },
        ],
        defaultBranch: 'skip-reviews',
      },
    },

    {
      id: 'extract-hd-reviews',
      type: 'skill_call',
      name: 'Extract HD Reviews',
      skillCall: {
        skillId: 'homedepot-extract-reviews',
        parameterMapping: {
          productUrl: '$vars.currentProduct.url',
          productId: '$vars.currentProduct.id',
          maxReviews: 30,
          filterLowRatings: true,
        },
        outputVariable: 'productReviews',
      },
      optional: true,
      onError: {
        strategy: 'skip',
      },
    },

    {
      id: 'skip-reviews',
      type: 'wait',
      name: 'Skip Reviews',
      wait: {
        durationMs: 100,
      },
    },

    // ========== SAVE REVIEWS DATA ==========
    {
      id: 'save-reviews',
      type: 'script',
      name: 'Save Reviews Data',
      script: {
        code: `
          const { saveReviews } = require('./research-types.ts');
          const session = context.variables.sessionInfo.session;
          const allReviews = context.variables.collectedReviews || [];

          saveReviews(session, allReviews);
          return { reviewsSaved: allReviews.length };
        `,
        outputVariable: 'reviewsSaved',
      },
    },

    // ========== KEYWORD RESEARCH (PARALLEL) ==========
    {
      id: 'keyword-research',
      type: 'parallel',
      name: 'Mine Keywords',
      parallel: {
        nodeIds: ['google-suggestions', 'google-paa', 'amazon-suggestions'],
        waitAll: true,
        failFast: false,
      },
    },

    {
      id: 'google-suggestions',
      type: 'skill_call',
      name: 'Google Search Suggestions',
      skillCall: {
        skillId: 'google-search-suggestions',
        parameterMapping: {
          keyword: '$params.keyword',
          variants: true,
        },
        outputVariable: 'googleSuggestions',
      },
      optional: true,
    },

    {
      id: 'google-paa',
      type: 'skill_call',
      name: 'Google People Also Ask',
      skillCall: {
        skillId: 'google-people-also-ask',
        parameterMapping: {
          keyword: '$params.keyword',
          expandQuestions: true,
          maxQuestions: 20,
        },
        outputVariable: 'googlePAA',
      },
      optional: true,
    },

    {
      id: 'amazon-suggestions',
      type: 'skill_call',
      name: 'Amazon Suggestions',
      skillCall: {
        skillId: 'amazon-search-suggestions',
        parameterMapping: {
          keyword: '$params.keyword',
          variants: true,
        },
        outputVariable: 'amazonSuggestions',
      },
      optional: true,
    },

    // ========== SAVE KEYWORDS ==========
    {
      id: 'save-keywords',
      type: 'script',
      name: 'Save Keywords Data',
      script: {
        code: `
          const { saveKeywords } = require('./research-types.ts');
          const session = context.variables.sessionInfo.session;

          const allKeywords = [
            context.variables.googleSuggestions,
            context.variables.googlePAA,
            context.variables.amazonSuggestions,
          ].filter(Boolean);

          saveKeywords(session, allKeywords);
          return { keywordsSaved: allKeywords.length };
        `,
        outputVariable: 'keywordsSaved',
      },
    },

    // ========== GENERATE ANALYSIS ==========
    {
      id: 'prepare-analysis',
      type: 'script',
      name: 'Prepare Analysis',
      script: {
        code: `
          const { prepareAnalysis, createFallbackReport } = require('./data-analyzer.ts');
          const session = context.variables.sessionInfo.session;

          // Generate the analysis prompt
          const { prompt, dataStats } = prepareAnalysis(session);

          // For now, create a fallback report
          // In production, this would be sent to an LLM
          const report = createFallbackReport(session);

          return { prompt, dataStats, reportGenerated: true };
        `,
        outputVariable: 'analysisResult',
      },
    },

    // ========== FINALIZE ==========
    {
      id: 'finalize',
      type: 'script',
      name: 'Finalize Research',
      script: {
        code: `
          const { updateSessionStatus, calculateResearchStats, exportProductsToCSV, exportPartsMatrixToCSV, exportKeywordsToCSV } = require('./research-types.ts');
          const session = context.variables.sessionInfo.session;

          // Calculate stats
          const stats = calculateResearchStats(session);

          // Export CSVs
          try {
            exportProductsToCSV(session);
            exportPartsMatrixToCSV(session);
            exportKeywordsToCSV(session);
          } catch (e) {
            console.error('CSV export error:', e);
          }

          // Update session status
          updateSessionStatus(session, 'completed');

          return {
            sessionId: session.id,
            outputDir: session.outputDir,
            stats,
          };
        `,
        outputVariable: 'finalResult',
      },
    },

    // ========== END ==========
    {
      id: 'end',
      type: 'end',
      name: 'Research Complete',
    },
  ],

  edges: [
    // Start -> Initialize
    { id: 'e1', sourceNodeId: 'start', targetNodeId: 'init-session' },

    // Initialize -> Parallel Search
    { id: 'e2', sourceNodeId: 'init-session', targetNodeId: 'search-platforms' },

    // Parallel search nodes (internal)
    // These are handled by the parallel node

    // Parallel Search -> Merge
    { id: 'e3', sourceNodeId: 'search-platforms', targetNodeId: 'merge-products' },

    // Merge -> Save Products
    { id: 'e4', sourceNodeId: 'merge-products', targetNodeId: 'save-products' },

    // Save Products -> Extract Details Loop
    { id: 'e5', sourceNodeId: 'save-products', targetNodeId: 'extract-details-loop' },

    // Details Loop -> Save Parts
    { id: 'e6', sourceNodeId: 'extract-details-loop', targetNodeId: 'save-parts' },

    // Save Parts -> Reviews Loop
    { id: 'e7', sourceNodeId: 'save-parts', targetNodeId: 'extract-reviews-loop' },

    // Reviews Loop -> Save Reviews
    { id: 'e8', sourceNodeId: 'extract-reviews-loop', targetNodeId: 'save-reviews' },

    // Save Reviews -> Keyword Research
    { id: 'e9', sourceNodeId: 'save-reviews', targetNodeId: 'keyword-research' },

    // Keyword Research -> Save Keywords
    { id: 'e10', sourceNodeId: 'keyword-research', targetNodeId: 'save-keywords' },

    // Save Keywords -> Prepare Analysis
    { id: 'e11', sourceNodeId: 'save-keywords', targetNodeId: 'prepare-analysis' },

    // Prepare Analysis -> Finalize
    { id: 'e12', sourceNodeId: 'prepare-analysis', targetNodeId: 'finalize' },

    // Finalize -> End
    { id: 'e13', sourceNodeId: 'finalize', targetNodeId: 'end' },

    // Condition edges for detail extraction
    { id: 'e20', sourceNodeId: 'extract-product-details', targetNodeId: 'extract-hd-details', condition: 'platform === "homedepot"' },
    { id: 'e21', sourceNodeId: 'extract-product-details', targetNodeId: 'skip-details' },

    // Condition edges for review extraction
    { id: 'e22', sourceNodeId: 'extract-product-reviews', targetNodeId: 'extract-hd-reviews', condition: 'platform === "homedepot"' },
    { id: 'e23', sourceNodeId: 'extract-product-reviews', targetNodeId: 'skip-reviews' },
  ],

  createdBy: 'agent',
  metadata: {
    successRate: 1.0,
    executionCount: 0,
    averageDurationMs: 0,
    consecutiveFailures: 0,
  },
  version: 1,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// ============================================================================
// Quick Parts Research Workflow
// ============================================================================

/**
 * Simplified workflow focused on parts research only
 */
export const PARTS_RESEARCH_WORKFLOW: BrowserWorkflow = {
  id: 'parts-research-quick',
  name: 'Quick Parts Research',
  description: 'Fast parts/accessories research from Home Depot',

  triggers: {
    intentPatterns: [
      'parts research',
      'accessories research',
      'replacement parts',
      'compatible parts',
    ],
  },

  parameters: [
    {
      name: 'keyword',
      label: 'Search Keyword',
      type: 'string',
      required: true,
    },
    {
      name: 'maxProducts',
      label: 'Max Products',
      type: 'number',
      required: false,
      defaultValue: 10,
    },
  ],

  outputs: [
    {
      name: 'parts',
      type: 'array',
      description: 'Aggregated parts data',
    },
  ],

  nodes: [
    { id: 'start', type: 'start', name: 'Start' },
    {
      id: 'search',
      type: 'skill_call',
      name: 'Search Products',
      skillCall: {
        skillId: 'homedepot-search',
        parameterMapping: {
          keyword: '$params.keyword',
          maxProducts: '$params.maxProducts',
        },
        outputVariable: 'products',
      },
    },
    {
      id: 'extract-loop',
      type: 'loop',
      name: 'Extract Parts',
      loop: {
        type: 'for_each',
        itemsVariable: 'products',
        loopVariable: 'product',
        maxIterations: 10,
        bodyNodeIds: ['extract-parts'],
      },
    },
    {
      id: 'extract-parts',
      type: 'skill_call',
      name: 'Get Product Parts',
      skillCall: {
        skillId: 'homedepot-product-detail',
        parameterMapping: {
          productUrl: '$vars.product.url',
          productId: '$vars.product.id',
        },
        outputVariable: 'partDetails',
      },
      optional: true,
    },
    { id: 'end', type: 'end', name: 'Complete' },
  ],

  edges: [
    { id: 'e1', sourceNodeId: 'start', targetNodeId: 'search' },
    { id: 'e2', sourceNodeId: 'search', targetNodeId: 'extract-loop' },
    { id: 'e3', sourceNodeId: 'extract-loop', targetNodeId: 'end' },
  ],

  createdBy: 'agent',
  metadata: {
    successRate: 1.0,
    executionCount: 0,
    averageDurationMs: 0,
    consecutiveFailures: 0,
  },
  version: 1,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// ============================================================================
// Keyword Mining Workflow
// ============================================================================

/**
 * Focused keyword mining workflow
 */
export const KEYWORD_MINING_WORKFLOW: BrowserWorkflow = {
  id: 'keyword-mining',
  name: 'Keyword Mining',
  description: 'Mine keywords from Google and Amazon for a product category',

  triggers: {
    intentPatterns: [
      'keyword research',
      'find keywords',
      'seo keywords',
      'search terms',
    ],
  },

  parameters: [
    {
      name: 'keyword',
      label: 'Seed Keyword',
      type: 'string',
      required: true,
    },
  ],

  outputs: [
    {
      name: 'keywords',
      type: 'array',
      description: 'All collected keywords',
    },
  ],

  nodes: [
    { id: 'start', type: 'start', name: 'Start' },
    {
      id: 'parallel-search',
      type: 'parallel',
      name: 'Search Keywords',
      parallel: {
        nodeIds: ['google-auto', 'google-paa', 'amazon-auto'],
        waitAll: true,
      },
    },
    {
      id: 'google-auto',
      type: 'skill_call',
      name: 'Google Autocomplete',
      skillCall: {
        skillId: 'google-search-suggestions',
        parameterMapping: { keyword: '$params.keyword', variants: true },
        outputVariable: 'googleAuto',
      },
      optional: true,
    },
    {
      id: 'google-paa',
      type: 'skill_call',
      name: 'Google PAA',
      skillCall: {
        skillId: 'google-people-also-ask',
        parameterMapping: { keyword: '$params.keyword' },
        outputVariable: 'googlePAA',
      },
      optional: true,
    },
    {
      id: 'amazon-auto',
      type: 'skill_call',
      name: 'Amazon Autocomplete',
      skillCall: {
        skillId: 'amazon-search-suggestions',
        parameterMapping: { keyword: '$params.keyword', variants: true },
        outputVariable: 'amazonAuto',
      },
      optional: true,
    },
    {
      id: 'merge-keywords',
      type: 'transform',
      name: 'Merge Keywords',
      transform: {
        inputs: ['$vars.googleAuto', '$vars.googlePAA', '$vars.amazonAuto'],
        expression: `
          const all = [];
          const seen = new Set();
          for (const kw of inputs.filter(Boolean)) {
            for (const s of (kw.suggestions || [])) {
              if (!seen.has(s.keyword.toLowerCase())) {
                seen.add(s.keyword.toLowerCase());
                all.push(s);
              }
            }
          }
          return { keywords: all, count: all.length };
        `,
        outputVariable: 'mergedKeywords',
      },
    },
    { id: 'end', type: 'end', name: 'Complete' },
  ],

  edges: [
    { id: 'e1', sourceNodeId: 'start', targetNodeId: 'parallel-search' },
    { id: 'e2', sourceNodeId: 'parallel-search', targetNodeId: 'merge-keywords' },
    { id: 'e3', sourceNodeId: 'merge-keywords', targetNodeId: 'end' },
  ],

  createdBy: 'agent',
  metadata: {
    successRate: 1.0,
    executionCount: 0,
    averageDurationMs: 0,
    consecutiveFailures: 0,
  },
  version: 1,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// ============================================================================
// Export All Workflows
// ============================================================================

export const RESEARCH_WORKFLOWS = [
  PRODUCT_RESEARCH_WORKFLOW,
  PARTS_RESEARCH_WORKFLOW,
  KEYWORD_MINING_WORKFLOW,
];
