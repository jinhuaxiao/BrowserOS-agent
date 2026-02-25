/**
 * Product Research Expert Agent
 *
 * Expert configuration for cross-platform product research,
 * compatible parts analysis, and keyword mining.
 *
 * Targets:
 * - Home Depot (professional/DIY products)
 * - Lowe's (DIY products)
 * - Amazon (market validation, reviews)
 * - Google (keyword research)
 */

import type { ExpertAgentConfig } from '../expert-agents.ts';

/**
 * Product Research Expert Configuration
 *
 * Specializes in:
 * - Multi-platform product data collection
 * - Compatible parts/accessories research
 * - User pain point analysis from reviews
 * - Keyword mining for SEO/PPC
 * - Competition analysis
 */
export const PRODUCT_RESEARCH_EXPERT: ExpertAgentConfig = {
  id: 'product-research',
  name: 'Product Research Expert',
  description: 'Cross-platform product research, compatible parts analysis, and keyword mining for e-commerce product development.',
  domains: [
    'homedepot.com',
    'lowes.com',
    'amazon.com',
    'google.com',
  ],

  knowledge: {
    systemPromptAdditions: `
You are an expert product researcher specializing in:
- Cross-platform product data collection and comparison
- Compatible parts and accessories identification
- User pain point analysis from reviews and Q&A
- Keyword research and search trend analysis
- Competition analysis and market opportunity assessment

When performing product research:
1. Always collect data from multiple platforms to cross-validate
2. Focus on replaceable/consumable parts for recurring revenue opportunities
3. Prioritize negative reviews (1-3 stars) for pain point discovery
4. Extract model numbers and specifications for compatibility mapping
5. Track price ranges across platforms for competitive positioning

Research Methodology:
1. Start with category search on Home Depot/Lowe's (professional tools focus)
2. Cross-reference with Amazon for market size validation (BSR, review counts)
3. Extract parts/accessories from product detail pages
4. Mine keywords from Google and Amazon search suggestions
5. Analyze reviews for pain points and improvement opportunities
6. Generate structured reports with actionable insights

Data Quality Guidelines:
- Verify data accuracy by cross-checking across platforms
- Handle pagination to ensure complete data collection
- Wait for dynamic content to load before extraction
- Use consistent data formats for aggregation
`,

    commonPatterns: [
      {
        name: 'Full Product Category Research',
        trigger: 'research product, product research, analyze category, market research',
        steps: [
          'Create research session with category and keywords',
          'Search Home Depot for product listings',
          'Extract product details and parts from each product',
          'Collect reviews and Q&A from product pages',
          'Search Amazon for market validation data',
          'Collect Google search suggestions for keywords',
          'Run LLM analysis on collected data',
          'Generate comprehensive research report',
        ],
        tips: [
          'Limit initial research to 20-50 products for MVP',
          'Focus on top-rated and best-selling products',
          'Prioritize products with 50+ reviews for pain point analysis',
        ],
      },
      {
        name: 'Parts/Accessories Research',
        trigger: 'compatible parts, accessories, replacement parts, parts research',
        steps: [
          'Navigate to product detail page',
          'Extract specifications and parts list',
          'Identify replaceable/consumable components',
          'Note model numbers and compatibility info',
          'Cross-reference with manufacturer specs',
        ],
        tips: [
          'Pay attention to "Frequently bought together" sections',
          'Check Q&A for compatibility questions',
          'Look for part numbers in specifications',
        ],
      },
      {
        name: 'Pain Point Mining',
        trigger: 'pain points, user problems, review analysis, customer complaints',
        steps: [
          'Filter reviews to 1-3 star ratings',
          'Extract common complaint themes',
          'Categorize issues (quality, design, compatibility, etc.)',
          'Identify improvement opportunities',
          'Quantify frequency of each issue',
        ],
        tips: [
          'Look for repeated keywords in negative reviews',
          'Check Q&A for unanswered questions (unmet needs)',
          'Note specific failure modes mentioned',
        ],
      },
      {
        name: 'Keyword Mining',
        trigger: 'keyword research, search terms, seo keywords, ppc keywords',
        steps: [
          'Enter seed keyword in Google search',
          'Capture autocomplete suggestions',
          'Extract "People Also Ask" questions',
          'Enter seed keyword in Amazon search',
          'Capture Amazon autocomplete suggestions',
          'Deduplicate and categorize keywords',
        ],
        tips: [
          'Use product model numbers as seed keywords',
          'Include problem-related keywords (e.g., "chainsaw not starting")',
          'Look for long-tail keywords with purchase intent',
        ],
      },
      {
        name: 'Competition Analysis',
        trigger: 'competition, competitors, market analysis, competitive landscape',
        steps: [
          'Search target keywords on Amazon',
          'Extract result count and top listings',
          'Analyze price distribution',
          'Note review counts of top competitors',
          'Identify brand concentration',
          'Assess barriers to entry',
        ],
        tips: [
          'High review counts indicate established competitors',
          'Wide price ranges may indicate market segmentation opportunity',
          'Low average ratings suggest room for quality differentiation',
        ],
      },
    ],

    terminology: {
      'BSR': 'Best Seller Rank - Amazon sales ranking within category',
      'SKU': 'Stock Keeping Unit - unique product identifier',
      'OEM': 'Original Equipment Manufacturer - the original parts maker',
      'Aftermarket': 'Third-party compatible parts (our target market)',
      'Long-tail keyword': 'Specific, low-volume search term with high conversion',
      'Pain point': 'Customer frustration or unmet need',
      'Consumables': 'Parts that wear out and need regular replacement',
      'Cross-sell': 'Selling related/compatible products',
      'ASIN': 'Amazon Standard Identification Number',
      'PDP': 'Product Detail Page',
      'SERP': 'Search Engine Results Page',
      'PAA': 'People Also Ask - Google feature showing related questions',
    },

    pageSignatures: [
      {
        name: 'Home Depot Search Results',
        urlPattern: 'homedepot.com/s/*',
        selectors: [
          '[data-testid="product-pod"]',
          '.browse-search__pod',
          '.product-pod',
        ],
        capabilities: [
          'extract product listings',
          'navigate pagination',
          'apply filters',
        ],
      },
      {
        name: 'Home Depot Product Page',
        urlPattern: 'homedepot.com/p/*',
        selectors: [
          '[data-testid="product-details"]',
          '.product-details__title',
          '.specifications-list',
          '#reviews-section',
        ],
        capabilities: [
          'extract product details',
          'extract specifications',
          'extract reviews',
          'extract Q&A',
        ],
      },
      {
        name: 'Lowes Search Results',
        urlPattern: 'lowes.com/search*',
        selectors: [
          '[data-selector="prd-tile"]',
          '.product-card',
        ],
        capabilities: [
          'extract product listings',
          'navigate pagination',
        ],
      },
      {
        name: 'Lowes Product Page',
        urlPattern: 'lowes.com/pd/*',
        selectors: [
          '.product-heading__title',
          '.Specifications-table',
          '#reviews',
        ],
        capabilities: [
          'extract product details',
          'extract specifications',
          'extract reviews',
        ],
      },
      {
        name: 'Amazon Search Results',
        urlPattern: 'amazon.com/s?k=*',
        selectors: [
          '[data-component-type="s-search-result"]',
          '.s-result-item',
        ],
        capabilities: [
          'extract product listings',
          'extract BSR indicators',
          'navigate pagination',
        ],
      },
      {
        name: 'Amazon Product Page',
        urlPattern: 'amazon.com/*/dp/*',
        selectors: [
          '#productTitle',
          '#acrPopover',
          '#reviewsMedley',
          '#askATFLink',
        ],
        capabilities: [
          'extract product details',
          'extract reviews',
          'extract Q&A',
          'extract BSR',
        ],
      },
      {
        name: 'Google Search',
        urlPattern: 'google.com/search*',
        selectors: [
          '#search',
          '.related-question-pair',
          '[data-async-type="embedUpdate"]',
        ],
        capabilities: [
          'extract search suggestions',
          'extract People Also Ask',
          'extract related searches',
        ],
      },
    ],

    errorHandling: [
      {
        description: 'CAPTCHA encountered',
        detection: 'CAPTCHA image, robot verification, "Are you a robot"',
        recovery: 'Pause and notify user to complete verification manually',
      },
      {
        description: 'Rate limiting',
        detection: '429 error, "too many requests", access denied',
        recovery: 'Wait 30-60 seconds, reduce request frequency, rotate profiles',
      },
      {
        description: 'Product page not found',
        detection: '404 error, "product not available"',
        recovery: 'Skip product, log error, continue with next product',
      },
      {
        description: 'Dynamic content not loaded',
        detection: 'Empty results, skeleton loaders visible',
        recovery: 'Wait for content to load, scroll to trigger lazy loading',
      },
      {
        description: 'Session timeout',
        detection: 'Login page appears, session expired message',
        recovery: 'Re-establish session, retry operation',
      },
    ],

    bestPractices: [
      'Always verify data by checking multiple sources',
      'Respect rate limits and add delays between requests',
      'Save intermediate results to avoid data loss',
      'Focus on quality over quantity - 50 good products beats 500 incomplete ones',
      'Prioritize products with substantial review counts for analysis',
      'Cross-reference part numbers with manufacturer specifications',
      'Use incognito/clean profiles to avoid personalized results',
      'Document the research methodology for reproducibility',
    ],
  },

  skillIds: [
    'homedepot-search',
    'homedepot-product-detail',
    'homedepot-extract-reviews',
    'lowes-search',
    'lowes-product-detail',
    'amazon-search-products',
    'amazon-search-suggestions',
    'google-search-suggestions',
    'google-people-also-ask',
    'llm-analyze-research-data',
  ],

  workflowIds: [
    'product-research-full',
    'parts-research-quick',
    'keyword-mining',
  ],

  ui: {
    icon: 'search',
    color: '#10B981', // Emerald green
    badge: 'Research',
  },

  activationPatterns: [
    'product research',
    'market research',
    'parts research',
    'accessories research',
    'compatible parts',
    'keyword research',
    'pain point',
    'review analysis',
    'competition analysis',
    'homedepot',
    'home depot',
    'lowes',
    'chainsaw',
    'power tools',
    'replacement parts',
  ],

  priority: 90,
  isBuiltIn: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

/**
 * Register the Product Research Expert with the expert registry
 */
export function registerProductResearchExpert(): void {
  // Dynamic import to avoid circular dependency
  import('../expert-agents.ts').then(({ registerExpert }) => {
    registerExpert(PRODUCT_RESEARCH_EXPERT);
  });
}
