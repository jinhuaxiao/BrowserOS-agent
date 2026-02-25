/**
 * Home Depot Research Skills
 *
 * Skill definitions for extracting product data, parts information,
 * and reviews from Home Depot website.
 */

import type { BrowserSkill, SkillStep } from '../types.ts';
import type { ProductData, PartsData, ReviewData, PartInfo, ReviewInfo, QuestionInfo } from './research-types.ts';

// ============================================================================
// Home Depot Search Skill
// ============================================================================

/**
 * Search Home Depot and extract product listings
 */
export const HOMEDEPOT_SEARCH_SKILL: BrowserSkill = {
  id: 'homedepot-search',
  name: 'Home Depot Product Search',
  description: 'Search Home Depot and extract product listings with basic info',
  domain: 'homedepot.com',

  triggers: {
    urlPattern: 'homedepot.com',
    intentPatterns: [
      'search home depot',
      'find products on home depot',
      'homedepot search',
    ],
  },

  parameters: [
    {
      name: 'keyword',
      label: 'Search Keyword',
      type: 'string',
      required: true,
      description: 'Product category or keyword to search',
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
      description: 'List of extracted product data',
    },
  ],

  steps: [
    // Step 1: Navigate to Home Depot
    {
      id: 'navigate',
      type: 'navigate',
      name: 'Navigate to Home Depot',
      url: 'https://www.homedepot.com',
      waitFor: {
        type: 'selector',
        value: '#headerSearchInput, input[data-testid="search-input"]',
        timeout: 10000,
      },
    },
    // Step 2: Enter search query
    {
      id: 'search',
      type: 'type',
      name: 'Enter search keyword',
      selector: '#headerSearchInput, input[data-testid="search-input"]',
      value: { type: 'parameter', source: 'keyword' },
      clearFirst: true,
    },
    // Step 3: Submit search
    {
      id: 'submit',
      type: 'click',
      name: 'Submit search',
      selector: 'button[data-testid="search-submit"], .searchInput__button',
      waitFor: {
        type: 'selector',
        value: '[data-testid="product-pod"], .browse-search__pod',
        timeout: 15000,
      },
    },
    // Step 4: Wait for results to load
    {
      id: 'wait-results',
      type: 'wait',
      name: 'Wait for search results',
      waitFor: {
        type: 'networkIdle',
        timeout: 5000,
      },
    },
    // Step 5: Extract product data
    {
      id: 'extract',
      type: 'extract',
      name: 'Extract product listings',
      extract: {
        type: 'list',
        containerSelector: '[data-testid="product-pod"], .browse-search__pod, .product-pod',
        maxItems: { type: 'parameter', source: 'maxProducts' },
        fields: {
          name: {
            selector: '[data-testid="product-header"] a, .product-pod__title a',
            attribute: 'textContent',
          },
          url: {
            selector: '[data-testid="product-header"] a, .product-pod__title a',
            attribute: 'href',
          },
          price: {
            selector: '[data-testid="price-format"], .price-format__main-price',
            attribute: 'textContent',
            transform: 'parsePrice',
          },
          rating: {
            selector: '[data-testid="ratings-stars"], .stars__rating',
            attribute: 'textContent',
            transform: 'parseRating',
          },
          reviewCount: {
            selector: '[data-testid="ratings-reviews"], .ratings__count',
            attribute: 'textContent',
            transform: 'parseNumber',
          },
          imageUrl: {
            selector: 'img[data-testid="product-image"], .product-pod__image img',
            attribute: 'src',
          },
          brand: {
            selector: '[data-testid="product-brand"], .product-pod__brand',
            attribute: 'textContent',
          },
          model: {
            selector: '[data-testid="product-model"], .product-identifier__model',
            attribute: 'textContent',
          },
        },
      },
      outputVariable: 'rawProducts',
    },
    // Step 6: Transform and validate data
    {
      id: 'transform',
      type: 'script',
      name: 'Transform product data',
      code: `
        const products = context.rawProducts || [];
        return products.map((p, i) => ({
          id: 'hd_' + Date.now() + '_' + i,
          name: p.name?.trim() || 'Unknown',
          brand: p.brand?.trim() || 'Unknown',
          model: p.model?.replace(/Model #/i, '').trim() || '',
          price: typeof p.price === 'number' ? p.price : parseFloat(p.price?.replace(/[^0-9.]/g, '')) || 0,
          rating: typeof p.rating === 'number' ? p.rating : parseFloat(p.rating) || 0,
          reviewCount: typeof p.reviewCount === 'number' ? p.reviewCount : parseInt(p.reviewCount?.replace(/[^0-9]/g, '')) || 0,
          url: p.url?.startsWith('http') ? p.url : 'https://www.homedepot.com' + p.url,
          platform: 'homedepot',
          imageUrl: p.imageUrl,
          scrapedAt: Date.now(),
        })).filter(p => p.name !== 'Unknown');
      `,
      outputVariable: 'products',
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
// Home Depot Product Detail Skill
// ============================================================================

/**
 * Extract detailed product information and parts from a Home Depot product page
 */
export const HOMEDEPOT_PRODUCT_DETAIL_SKILL: BrowserSkill = {
  id: 'homedepot-product-detail',
  name: 'Home Depot Product Details',
  description: 'Extract detailed product specifications and parts from a Home Depot product page',
  domain: 'homedepot.com',

  triggers: {
    urlPattern: 'homedepot.com/p/*',
    intentPatterns: [
      'get product details',
      'extract product info',
      'get specifications',
      'get parts list',
    ],
  },

  parameters: [
    {
      name: 'productUrl',
      label: 'Product URL',
      type: 'string',
      required: true,
      description: 'URL of the Home Depot product page',
    },
    {
      name: 'productId',
      label: 'Product ID',
      type: 'string',
      required: false,
      description: 'Optional product ID for reference',
    },
  ],

  outputs: [
    {
      name: 'product',
      type: 'object',
      description: 'Detailed product information',
    },
    {
      name: 'parts',
      type: 'object',
      description: 'Parts and accessories data',
    },
  ],

  steps: [
    // Step 1: Navigate to product page
    {
      id: 'navigate',
      type: 'navigate',
      name: 'Navigate to product page',
      url: { type: 'parameter', source: 'productUrl' },
      waitFor: {
        type: 'selector',
        value: '[data-testid="product-details"], .product-details__title',
        timeout: 15000,
      },
    },
    // Step 2: Wait for dynamic content
    {
      id: 'wait-content',
      type: 'wait',
      name: 'Wait for content to load',
      waitFor: {
        type: 'networkIdle',
        timeout: 5000,
      },
    },
    // Step 3: Extract basic product info
    {
      id: 'extract-basic',
      type: 'extract',
      name: 'Extract basic product info',
      extract: {
        type: 'single',
        fields: {
          name: {
            selector: 'h1[data-testid="product-header"], .product-details__title h1',
            attribute: 'textContent',
          },
          brand: {
            selector: '[data-testid="product-header-brand"], .product-details__brand',
            attribute: 'textContent',
          },
          model: {
            selector: '.product-info-bar__detail--model span:last-child, [data-testid="model-number"]',
            attribute: 'textContent',
          },
          sku: {
            selector: '.product-info-bar__detail--sku span:last-child, [data-testid="sku"]',
            attribute: 'textContent',
          },
          price: {
            selector: '[data-testid="price-format"], .price-format__main-price',
            attribute: 'textContent',
          },
          rating: {
            selector: '.ratings-reviews__average-rate',
            attribute: 'textContent',
          },
          reviewCount: {
            selector: '.ratings-reviews__reviews-count',
            attribute: 'textContent',
          },
          description: {
            selector: '.product-details__description, [data-testid="product-description"]',
            attribute: 'textContent',
          },
        },
      },
      outputVariable: 'basicInfo',
    },
    // Step 4: Extract specifications
    {
      id: 'extract-specs',
      type: 'extract',
      name: 'Extract specifications',
      extract: {
        type: 'list',
        containerSelector: '.specifications-desktop__list .specifications-desktop__item, .product-specifications tr',
        fields: {
          label: {
            selector: '.specifications-desktop__label, th',
            attribute: 'textContent',
          },
          value: {
            selector: '.specifications-desktop__value, td',
            attribute: 'textContent',
          },
        },
      },
      outputVariable: 'specifications',
    },
    // Step 5: Scroll to load accessories section
    {
      id: 'scroll-accessories',
      type: 'scroll',
      name: 'Scroll to accessories section',
      direction: 'down',
      amount: 1000,
    },
    // Step 6: Wait for accessories to load
    {
      id: 'wait-accessories',
      type: 'wait',
      name: 'Wait for accessories',
      waitFor: {
        type: 'idle',
        timeout: 2000,
      },
    },
    // Step 7: Extract accessories/related products
    {
      id: 'extract-accessories',
      type: 'extract',
      name: 'Extract accessories',
      extract: {
        type: 'list',
        containerSelector: '[data-testid="accessories-pod"], .accessories-section .product-pod, .frequently-bought-together .product-pod',
        maxItems: 20,
        fields: {
          name: {
            selector: '[data-testid="product-header"] a, .product-pod__title a',
            attribute: 'textContent',
          },
          url: {
            selector: 'a',
            attribute: 'href',
          },
          price: {
            selector: '[data-testid="price-format"], .price-format__main-price',
            attribute: 'textContent',
          },
        },
      },
      outputVariable: 'accessories',
    },
    // Step 8: Transform data
    {
      id: 'transform',
      type: 'script',
      name: 'Transform product data',
      code: `
        const info = context.basicInfo || {};
        const specs = context.specifications || [];
        const accessories = context.accessories || [];
        const productId = context.parameters.productId || 'hd_' + Date.now();

        // Parse specifications into key-value object
        const specsObj = {};
        for (const spec of specs) {
          if (spec.label && spec.value) {
            specsObj[spec.label.trim()] = spec.value.trim();
          }
        }

        // Identify parts from specifications
        const parts = [];
        const partPatterns = [
          { key: 'Chain Size', category: 'chain' },
          { key: 'Bar Length', category: 'bar' },
          { key: 'Guide Bar Length', category: 'bar' },
          { key: 'Battery', category: 'battery' },
          { key: 'Battery Type', category: 'battery' },
          { key: 'Blade', category: 'blade' },
          { key: 'Filter', category: 'filter' },
          { key: 'Spark Plug', category: 'spark-plug' },
        ];

        for (const pattern of partPatterns) {
          if (specsObj[pattern.key]) {
            parts.push({
              name: pattern.key,
              model: specsObj[pattern.key],
              category: pattern.category,
              isReplaceable: true,
            });
          }
        }

        // Add accessories as potential parts
        for (const acc of accessories) {
          if (acc.name) {
            const name = acc.name.trim().toLowerCase();
            let category = 'accessory';
            if (name.includes('chain')) category = 'chain';
            else if (name.includes('bar')) category = 'bar';
            else if (name.includes('battery')) category = 'battery';
            else if (name.includes('charger')) category = 'charger';
            else if (name.includes('oil')) category = 'oil';
            else if (name.includes('filter')) category = 'filter';

            parts.push({
              name: acc.name.trim(),
              category,
              isReplaceable: true,
              price: parseFloat(acc.price?.replace(/[^0-9.]/g, '')) || undefined,
              purchaseUrl: acc.url?.startsWith('http') ? acc.url : 'https://www.homedepot.com' + acc.url,
            });
          }
        }

        const product = {
          id: productId,
          name: info.name?.trim() || 'Unknown',
          brand: info.brand?.trim() || 'Unknown',
          model: info.model?.trim() || '',
          price: parseFloat(info.price?.replace(/[^0-9.]/g, '')) || 0,
          rating: parseFloat(info.rating) || 0,
          reviewCount: parseInt(info.reviewCount?.replace(/[^0-9]/g, '')) || 0,
          url: context.parameters.productUrl,
          platform: 'homedepot',
          platformId: info.sku?.trim(),
          specifications: specsObj,
          scrapedAt: Date.now(),
        };

        const partsData = {
          productId,
          parts,
          extractedAt: Date.now(),
        };

        return { product, parts: partsData };
      `,
      outputVariable: 'result',
    },
  ],

  metadata: {
    successRate: 1.0,
    averageDurationMs: 8000,
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
// Home Depot Reviews Extraction Skill
// ============================================================================

/**
 * Extract reviews and Q&A from a Home Depot product page
 */
export const HOMEDEPOT_EXTRACT_REVIEWS_SKILL: BrowserSkill = {
  id: 'homedepot-extract-reviews',
  name: 'Home Depot Reviews Extraction',
  description: 'Extract customer reviews and Q&A from a Home Depot product page',
  domain: 'homedepot.com',

  triggers: {
    urlPattern: 'homedepot.com/p/*',
    intentPatterns: [
      'get reviews',
      'extract reviews',
      'get customer feedback',
      'get questions and answers',
    ],
  },

  parameters: [
    {
      name: 'productUrl',
      label: 'Product URL',
      type: 'string',
      required: true,
      description: 'URL of the Home Depot product page',
    },
    {
      name: 'productId',
      label: 'Product ID',
      type: 'string',
      required: false,
      description: 'Product ID for reference',
    },
    {
      name: 'maxReviews',
      label: 'Maximum Reviews',
      type: 'number',
      required: false,
      defaultValue: 50,
      description: 'Maximum number of reviews to extract',
    },
    {
      name: 'filterLowRatings',
      label: 'Filter Low Ratings',
      type: 'boolean',
      required: false,
      defaultValue: true,
      description: 'Focus on 1-3 star reviews for pain point analysis',
    },
  ],

  outputs: [
    {
      name: 'reviews',
      type: 'object',
      description: 'Extracted reviews and Q&A data',
    },
  ],

  steps: [
    // Step 1: Navigate to product page
    {
      id: 'navigate',
      type: 'navigate',
      name: 'Navigate to product page',
      url: { type: 'parameter', source: 'productUrl' },
      waitFor: {
        type: 'selector',
        value: '[data-testid="product-details"], .product-details__title',
        timeout: 15000,
      },
    },
    // Step 2: Scroll to reviews section
    {
      id: 'scroll-reviews',
      type: 'scroll',
      name: 'Scroll to reviews section',
      target: '#reviews-section, .ratings-and-reviews, [data-testid="ratings-reviews"]',
    },
    // Step 3: Wait for reviews to load
    {
      id: 'wait-reviews',
      type: 'wait',
      name: 'Wait for reviews to load',
      waitFor: {
        type: 'selector',
        value: '.review-item, [data-testid="review-card"]',
        timeout: 10000,
      },
    },
    // Step 4: Apply low rating filter if requested
    {
      id: 'filter-ratings',
      type: 'condition',
      name: 'Check if filter low ratings',
      condition: {
        type: 'expression',
        expression: 'context.parameters.filterLowRatings === true',
      },
      ifTrue: [
        {
          id: 'click-filter',
          type: 'click',
          name: 'Click rating filter',
          selector: '[data-testid="filter-1-star"], [data-testid="filter-2-star"], [data-testid="filter-3-star"], .rating-filter__button',
          optional: true,
        },
        {
          id: 'wait-filter',
          type: 'wait',
          name: 'Wait for filter',
          waitFor: { type: 'idle', timeout: 2000 },
        },
      ],
    },
    // Step 5: Extract reviews
    {
      id: 'extract-reviews',
      type: 'extract',
      name: 'Extract reviews',
      extract: {
        type: 'list',
        containerSelector: '.review-item, [data-testid="review-card"], .customer-review',
        maxItems: { type: 'parameter', source: 'maxReviews' },
        fields: {
          rating: {
            selector: '.stars-reviews__rating, [data-testid="review-rating"]',
            attribute: 'textContent',
          },
          title: {
            selector: '.review-item__title, [data-testid="review-title"]',
            attribute: 'textContent',
          },
          content: {
            selector: '.review-item__content, [data-testid="review-content"]',
            attribute: 'textContent',
          },
          date: {
            selector: '.review-item__date, [data-testid="review-date"]',
            attribute: 'textContent',
          },
          verified: {
            selector: '.review-item__verified, [data-testid="verified-purchase"]',
            attribute: 'textContent',
          },
          helpful: {
            selector: '.review-item__helpful, [data-testid="helpful-count"]',
            attribute: 'textContent',
          },
          reviewer: {
            selector: '.review-item__author, [data-testid="reviewer-name"]',
            attribute: 'textContent',
          },
        },
      },
      outputVariable: 'rawReviews',
    },
    // Step 6: Scroll to Q&A section
    {
      id: 'scroll-qa',
      type: 'scroll',
      name: 'Scroll to Q&A section',
      target: '#questions-section, .questions-answers, [data-testid="qa-section"]',
    },
    // Step 7: Wait for Q&A to load
    {
      id: 'wait-qa',
      type: 'wait',
      name: 'Wait for Q&A',
      waitFor: { type: 'idle', timeout: 2000 },
    },
    // Step 8: Extract Q&A
    {
      id: 'extract-qa',
      type: 'extract',
      name: 'Extract Q&A',
      extract: {
        type: 'list',
        containerSelector: '.qa-item, [data-testid="qa-card"], .question-answer',
        maxItems: 30,
        fields: {
          question: {
            selector: '.qa-item__question, [data-testid="question-text"]',
            attribute: 'textContent',
          },
          answer: {
            selector: '.qa-item__answer, [data-testid="answer-text"]',
            attribute: 'textContent',
          },
          answeredBy: {
            selector: '.qa-item__answered-by, [data-testid="answered-by"]',
            attribute: 'textContent',
          },
          date: {
            selector: '.qa-item__date, [data-testid="answer-date"]',
            attribute: 'textContent',
          },
        },
      },
      outputVariable: 'rawQA',
    },
    // Step 9: Transform data
    {
      id: 'transform',
      type: 'script',
      name: 'Transform reviews data',
      code: `
        const rawReviews = context.rawReviews || [];
        const rawQA = context.rawQA || [];
        const productId = context.parameters.productId || 'unknown';

        const reviews = rawReviews.map(r => ({
          rating: parseInt(r.rating) || 0,
          title: r.title?.trim() || '',
          content: r.content?.trim() || '',
          date: r.date?.trim() || '',
          isVerified: r.verified?.toLowerCase().includes('verified') || false,
          helpfulVotes: parseInt(r.helpful?.replace(/[^0-9]/g, '')) || 0,
          reviewer: r.reviewer?.trim(),
        })).filter(r => r.content.length > 0);

        const questions = rawQA.map(q => ({
          question: q.question?.trim() || '',
          answer: q.answer?.trim(),
          answeredBy: q.answeredBy?.trim(),
          answerDate: q.date?.trim(),
        })).filter(q => q.question.length > 0);

        return {
          productId,
          reviews,
          questions,
          extractedAt: Date.now(),
        };
      `,
      outputVariable: 'reviews',
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
// Export all Home Depot skills
// ============================================================================

export const HOMEDEPOT_SKILLS = [
  HOMEDEPOT_SEARCH_SKILL,
  HOMEDEPOT_PRODUCT_DETAIL_SKILL,
  HOMEDEPOT_EXTRACT_REVIEWS_SKILL,
];
