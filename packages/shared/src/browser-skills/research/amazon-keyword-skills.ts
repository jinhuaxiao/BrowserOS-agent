/**
 * Amazon Keyword Research Skills
 *
 * Skill definitions for extracting search suggestions and
 * product data from Amazon for market validation.
 */

import type { BrowserSkill } from '../types.ts';
import type { KeywordData, ProductData } from './research-types.ts';

// ============================================================================
// Amazon Search Suggestions Skill
// ============================================================================

/**
 * Extract Amazon search autocomplete suggestions
 */
export const AMAZON_SEARCH_SUGGESTIONS_SKILL: BrowserSkill = {
  id: 'amazon-search-suggestions',
  name: 'Amazon Search Suggestions',
  description: 'Extract autocomplete suggestions from Amazon search with purchase intent',
  domain: 'amazon.com',

  triggers: {
    urlPattern: 'amazon.com',
    intentPatterns: [
      'amazon suggestions',
      'amazon keywords',
      'amazon search terms',
      'product keywords amazon',
    ],
  },

  parameters: [
    {
      name: 'keyword',
      label: 'Seed Keyword',
      type: 'string',
      required: true,
      description: 'The keyword to get suggestions for',
    },
    {
      name: 'variants',
      label: 'Include Variants',
      type: 'boolean',
      required: false,
      defaultValue: true,
      description: 'Also search with alphabet modifiers (a-z)',
    },
  ],

  outputs: [
    {
      name: 'keywords',
      type: 'object',
      description: 'Keyword data with Amazon suggestions',
    },
  ],

  steps: [
    // Step 1: Navigate to Amazon
    {
      id: 'navigate',
      type: 'navigate',
      name: 'Navigate to Amazon',
      url: 'https://www.amazon.com',
      waitFor: {
        type: 'selector',
        value: '#twotabsearchtextbox, input[id="twotabsearchtextbox"]',
        timeout: 10000,
      },
    },
    // Step 2: Focus on search input
    {
      id: 'focus-search',
      type: 'click',
      name: 'Focus search input',
      selector: '#twotabsearchtextbox',
    },
    // Step 3: Clear and type keyword
    {
      id: 'type-keyword',
      type: 'type',
      name: 'Type keyword for suggestions',
      selector: '#twotabsearchtextbox',
      value: { type: 'parameter', source: 'keyword' },
      typeDelay: 80,
      clearFirst: true,
    },
    // Step 4: Wait for suggestions dropdown
    {
      id: 'wait-suggestions',
      type: 'wait',
      name: 'Wait for suggestions',
      waitFor: {
        type: 'selector',
        value: '.s-suggestion, .autocomplete-suggestion, [role="listbox"] .s-suggestion-container',
        timeout: 3000,
      },
    },
    // Step 5: Extract autocomplete suggestions
    {
      id: 'extract-suggestions',
      type: 'extract',
      name: 'Extract autocomplete suggestions',
      extract: {
        type: 'list',
        containerSelector: '.s-suggestion, .autocomplete-suggestion, .s-suggestion-container div[role="option"]',
        maxItems: 10,
        fields: {
          keyword: {
            selector: '.s-suggestion-ellipsis-direction, span, div',
            attribute: 'textContent',
          },
        },
      },
      outputVariable: 'autocompleteSuggestions',
    },
    // Step 6: Try variant with " a" suffix
    {
      id: 'variant-check',
      type: 'condition',
      name: 'Check if variants enabled',
      condition: {
        type: 'expression',
        expression: 'context.parameters.variants === true',
      },
      ifTrue: [
        {
          id: 'clear-for-variant',
          type: 'click',
          name: 'Click search to clear',
          selector: '#twotabsearchtextbox',
        },
        {
          id: 'type-variant-b',
          type: 'type',
          name: 'Type variant b',
          selector: '#twotabsearchtextbox',
          value: { type: 'parameter', source: 'keyword', suffix: ' b' },
          typeDelay: 80,
          clearFirst: true,
        },
        {
          id: 'wait-variant-b',
          type: 'wait',
          name: 'Wait for variant suggestions',
          waitFor: { type: 'idle', timeout: 1500 },
        },
        {
          id: 'extract-variant-b',
          type: 'extract',
          name: 'Extract variant B suggestions',
          extract: {
            type: 'list',
            containerSelector: '.s-suggestion, .autocomplete-suggestion, .s-suggestion-container div[role="option"]',
            maxItems: 10,
            fields: {
              keyword: {
                selector: '.s-suggestion-ellipsis-direction, span, div',
                attribute: 'textContent',
              },
            },
          },
          outputVariable: 'variantBSuggestions',
        },
        // Try with "replacement" suffix for parts research
        {
          id: 'type-replacement',
          type: 'type',
          name: 'Type replacement variant',
          selector: '#twotabsearchtextbox',
          value: { type: 'parameter', source: 'keyword', suffix: ' replacement' },
          typeDelay: 80,
          clearFirst: true,
        },
        {
          id: 'wait-replacement',
          type: 'wait',
          name: 'Wait for replacement suggestions',
          waitFor: { type: 'idle', timeout: 1500 },
        },
        {
          id: 'extract-replacement',
          type: 'extract',
          name: 'Extract replacement suggestions',
          extract: {
            type: 'list',
            containerSelector: '.s-suggestion, .autocomplete-suggestion',
            maxItems: 10,
            fields: {
              keyword: {
                selector: '.s-suggestion-ellipsis-direction, span',
                attribute: 'textContent',
              },
            },
          },
          outputVariable: 'replacementSuggestions',
        },
        // Try with "parts" suffix
        {
          id: 'type-parts',
          type: 'type',
          name: 'Type parts variant',
          selector: '#twotabsearchtextbox',
          value: { type: 'parameter', source: 'keyword', suffix: ' parts' },
          typeDelay: 80,
          clearFirst: true,
        },
        {
          id: 'wait-parts',
          type: 'wait',
          name: 'Wait for parts suggestions',
          waitFor: { type: 'idle', timeout: 1500 },
        },
        {
          id: 'extract-parts',
          type: 'extract',
          name: 'Extract parts suggestions',
          extract: {
            type: 'list',
            containerSelector: '.s-suggestion, .autocomplete-suggestion',
            maxItems: 10,
            fields: {
              keyword: {
                selector: '.s-suggestion-ellipsis-direction, span',
                attribute: 'textContent',
              },
            },
          },
          outputVariable: 'partsSuggestions',
        },
      ],
    },
    // Step 7: Transform and compile results
    {
      id: 'transform',
      type: 'script',
      name: 'Compile Amazon keyword data',
      code: `
        const seedKeyword = context.parameters.keyword;
        const autocomplete = context.autocompleteSuggestions || [];
        const variantB = context.variantBSuggestions || [];
        const replacement = context.replacementSuggestions || [];
        const parts = context.partsSuggestions || [];

        const seen = new Set();
        const suggestions = [];
        let position = 0;

        const addSuggestions = (items, type = 'autocomplete') => {
          for (const item of items) {
            const kw = item.keyword?.trim()?.toLowerCase();
            if (kw && !seen.has(kw) && kw !== seedKeyword.toLowerCase()) {
              seen.add(kw);
              suggestions.push({
                keyword: item.keyword.trim(),
                type,
                position: position++,
              });
            }
          }
        };

        addSuggestions(autocomplete, 'autocomplete');
        addSuggestions(variantB, 'autocomplete');
        addSuggestions(replacement, 'autocomplete');
        addSuggestions(parts, 'autocomplete');

        return {
          source: 'amazon',
          seedKeyword,
          suggestions,
          collectedAt: Date.now(),
        };
      `,
      outputVariable: 'keywords',
    },
  ],

  metadata: {
    successRate: 1.0,
    averageDurationMs: 10000,
    lastUpdated: Date.now(),
  },

  version: 1,
  createdBy: 'agent',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  successRate: 1.0,
  executionCount: 0,
  consecutiveFailures: 0,
};

// ============================================================================
// Amazon Search Products Skill
// ============================================================================

/**
 * Search Amazon and extract product data for market validation
 */
export const AMAZON_SEARCH_PRODUCTS_SKILL: BrowserSkill = {
  id: 'amazon-search-products',
  name: 'Amazon Product Search',
  description: 'Search Amazon and extract products with BSR, ratings, and review counts',
  domain: 'amazon.com',

  triggers: {
    urlPattern: 'amazon.com/s?k=*',
    intentPatterns: [
      'search amazon',
      'find products on amazon',
      'amazon product research',
      'amazon competition',
    ],
  },

  parameters: [
    {
      name: 'keyword',
      label: 'Search Keyword',
      type: 'string',
      required: true,
      description: 'Product keyword to search',
    },
    {
      name: 'maxProducts',
      label: 'Maximum Products',
      type: 'number',
      required: false,
      defaultValue: 20,
      description: 'Maximum number of products to extract',
    },
  ],

  outputs: [
    {
      name: 'products',
      type: 'array',
      description: 'List of Amazon products with market data',
    },
    {
      name: 'competitionStats',
      type: 'object',
      description: 'Competition statistics',
    },
  ],

  steps: [
    // Step 1: Navigate to Amazon search
    {
      id: 'navigate',
      type: 'navigate',
      name: 'Search Amazon',
      url: {
        type: 'expression',
        source: '"https://www.amazon.com/s?k=" + encodeURIComponent(context.parameters.keyword)',
      },
      waitFor: {
        type: 'selector',
        value: '[data-component-type="s-search-result"], .s-result-item',
        timeout: 15000,
      },
    },
    // Step 2: Wait for results to fully load
    {
      id: 'wait-results',
      type: 'wait',
      name: 'Wait for results',
      waitFor: {
        type: 'networkIdle',
        timeout: 5000,
      },
    },
    // Step 3: Get total result count
    {
      id: 'extract-count',
      type: 'extract',
      name: 'Extract result count',
      extract: {
        type: 'single',
        fields: {
          resultCount: {
            selector: '.s-breadcrumb .rush-component span:last-child, .sg-col-inner span:first-child',
            attribute: 'textContent',
          },
        },
      },
      outputVariable: 'searchStats',
    },
    // Step 4: Extract product listings
    {
      id: 'extract-products',
      type: 'extract',
      name: 'Extract product data',
      extract: {
        type: 'list',
        containerSelector: '[data-component-type="s-search-result"]:not([data-component-type="s-ad-slot"]), .s-result-item[data-asin]:not(.AdHolder)',
        maxItems: { type: 'parameter', source: 'maxProducts' },
        fields: {
          asin: {
            selector: '',
            attribute: 'data-asin',
          },
          name: {
            selector: 'h2 a span, .a-text-normal',
            attribute: 'textContent',
          },
          url: {
            selector: 'h2 a',
            attribute: 'href',
          },
          price: {
            selector: '.a-price .a-offscreen, .a-price-whole',
            attribute: 'textContent',
          },
          rating: {
            selector: '[data-cy="reviews-ratings-slot"] span:first-child, .a-icon-alt',
            attribute: 'textContent',
          },
          reviewCount: {
            selector: '[data-cy="reviews-ratings-slot"] span:last-child, .a-size-base.s-underline-text',
            attribute: 'textContent',
          },
          imageUrl: {
            selector: '.s-image',
            attribute: 'src',
          },
          isPrime: {
            selector: '.s-prime, [aria-label*="Prime"]',
            attribute: 'exists',
          },
          isBestSeller: {
            selector: '.a-badge-text, .best-seller-badge',
            attribute: 'textContent',
          },
          isSponsored: {
            selector: '.s-label-popover-default, [data-component-type="sp-sponsored-result"]',
            attribute: 'exists',
          },
        },
      },
      outputVariable: 'rawProducts',
    },
    // Step 5: Transform product data
    {
      id: 'transform',
      type: 'script',
      name: 'Transform product data',
      code: `
        const rawProducts = context.rawProducts || [];
        const searchStats = context.searchStats || {};

        // Parse result count
        const resultCountMatch = searchStats.resultCount?.match(/([\\d,]+)/);
        const totalResults = resultCountMatch ? parseInt(resultCountMatch[1].replace(/,/g, '')) : 0;

        // Transform products
        const products = rawProducts
          .filter(p => p.asin && !p.isSponsored) // Exclude sponsored and invalid
          .map((p, i) => {
            // Parse price
            let price = 0;
            if (p.price) {
              const priceMatch = p.price.match(/([\\d,.]+)/);
              if (priceMatch) {
                price = parseFloat(priceMatch[1].replace(/,/g, ''));
              }
            }

            // Parse rating
            let rating = 0;
            if (p.rating) {
              const ratingMatch = p.rating.match(/([\\d.]+)/);
              if (ratingMatch) {
                rating = parseFloat(ratingMatch[1]);
              }
            }

            // Parse review count
            let reviewCount = 0;
            if (p.reviewCount) {
              const countMatch = p.reviewCount.match(/([\\d,]+)/);
              if (countMatch) {
                reviewCount = parseInt(countMatch[1].replace(/,/g, ''));
              }
            }

            return {
              id: 'amz_' + p.asin,
              name: p.name?.trim() || 'Unknown',
              brand: extractBrand(p.name || ''),
              model: '',
              price,
              rating,
              reviewCount,
              url: p.url?.startsWith('http') ? p.url : 'https://www.amazon.com' + p.url,
              platform: 'amazon',
              platformId: p.asin,
              imageUrl: p.imageUrl,
              specifications: {
                isPrime: p.isPrime ? 'Yes' : 'No',
                isBestSeller: p.isBestSeller || 'No',
              },
              scrapedAt: Date.now(),
            };
          });

        // Calculate competition stats
        const validProducts = products.filter(p => p.price > 0);
        const prices = validProducts.map(p => p.price);
        const ratings = validProducts.map(p => p.rating).filter(r => r > 0);
        const reviews = validProducts.map(p => p.reviewCount);

        const competitionStats = {
          totalResults,
          productsAnalyzed: validProducts.length,
          priceRange: {
            min: prices.length > 0 ? Math.min(...prices) : 0,
            max: prices.length > 0 ? Math.max(...prices) : 0,
            average: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
          },
          averageRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
          averageReviews: reviews.length > 0 ? Math.round(reviews.reduce((a, b) => a + b, 0) / reviews.length) : 0,
          topBrands: getTopBrands(products),
        };

        function extractBrand(name) {
          // Try to extract brand from product name (usually first word or two)
          const parts = name.split(/\\s+/);
          return parts[0] || 'Unknown';
        }

        function getTopBrands(products) {
          const brandCounts = {};
          for (const p of products) {
            const brand = p.brand;
            brandCounts[brand] = (brandCounts[brand] || 0) + 1;
          }
          return Object.entries(brandCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([brand]) => brand);
        }

        return { products, competitionStats };
      `,
      outputVariable: 'result',
    },
  ],

  metadata: {
    successRate: 1.0,
    averageDurationMs: 12000,
    lastUpdated: Date.now(),
  },

  version: 1,
  createdBy: 'agent',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  successRate: 1.0,
  executionCount: 0,
  consecutiveFailures: 0,
};

// ============================================================================
// Export all Amazon skills
// ============================================================================

export const AMAZON_KEYWORD_SKILLS = [
  AMAZON_SEARCH_SUGGESTIONS_SKILL,
  AMAZON_SEARCH_PRODUCTS_SKILL,
];
