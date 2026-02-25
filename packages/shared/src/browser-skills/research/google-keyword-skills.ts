/**
 * Google Keyword Research Skills
 *
 * Skill definitions for extracting search suggestions and
 * "People Also Ask" questions from Google.
 */

import type { BrowserSkill } from '../types.ts';
import type { KeywordData, KeywordSuggestion } from './research-types.ts';

// ============================================================================
// Google Search Suggestions Skill
// ============================================================================

/**
 * Extract Google search autocomplete suggestions
 */
export const GOOGLE_SEARCH_SUGGESTIONS_SKILL: BrowserSkill = {
  id: 'google-search-suggestions',
  name: 'Google Search Suggestions',
  description: 'Extract autocomplete suggestions from Google search',
  domain: 'google.com',

  triggers: {
    urlPattern: 'google.com',
    intentPatterns: [
      'google suggestions',
      'search suggestions',
      'autocomplete keywords',
      'keyword ideas',
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
      description: 'Keyword data with suggestions',
    },
  ],

  steps: [
    // Step 1: Navigate to Google
    {
      id: 'navigate',
      type: 'navigate',
      name: 'Navigate to Google',
      url: 'https://www.google.com',
      waitFor: {
        type: 'selector',
        value: 'input[name="q"], textarea[name="q"]',
        timeout: 10000,
      },
    },
    // Step 2: Clear any existing search
    {
      id: 'clear-search',
      type: 'script',
      name: 'Clear search input',
      code: `
        const input = document.querySelector('input[name="q"], textarea[name="q"]');
        if (input) {
          input.value = '';
          input.focus();
        }
        return true;
      `,
    },
    // Step 3: Enter seed keyword slowly to trigger suggestions
    {
      id: 'type-keyword',
      type: 'type',
      name: 'Type keyword to trigger suggestions',
      selector: 'input[name="q"], textarea[name="q"]',
      value: { type: 'parameter', source: 'keyword' },
      typeDelay: 100, // Slow typing to trigger autocomplete
      clearFirst: true,
    },
    // Step 4: Wait for suggestions to appear
    {
      id: 'wait-suggestions',
      type: 'wait',
      name: 'Wait for suggestions dropdown',
      waitFor: {
        type: 'selector',
        value: 'ul[role="listbox"] li, .erkvQe, .sbct, [data-entityname]',
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
        containerSelector: 'ul[role="listbox"] li, .erkvQe, .sbct, [data-entityname]',
        maxItems: 10,
        fields: {
          keyword: {
            selector: '[role="option"], .wM6W7d, span',
            attribute: 'textContent',
          },
        },
      },
      outputVariable: 'autocompleteSuggestions',
    },
    // Step 6: Clear and try with " a" suffix for more suggestions
    {
      id: 'variant-a',
      type: 'condition',
      name: 'Check if variants enabled',
      condition: {
        type: 'expression',
        expression: 'context.parameters.variants === true',
      },
      ifTrue: [
        {
          id: 'type-variant-a',
          type: 'type',
          name: 'Add variant suffix',
          selector: 'input[name="q"], textarea[name="q"]',
          value: { type: 'parameter', source: 'keyword', suffix: ' a' },
          typeDelay: 100,
          clearFirst: true,
        },
        {
          id: 'wait-variant-suggestions',
          type: 'wait',
          name: 'Wait for variant suggestions',
          waitFor: { type: 'idle', timeout: 1500 },
        },
        {
          id: 'extract-variant-a',
          type: 'extract',
          name: 'Extract variant A suggestions',
          extract: {
            type: 'list',
            containerSelector: 'ul[role="listbox"] li, .erkvQe, .sbct',
            maxItems: 10,
            fields: {
              keyword: {
                selector: '[role="option"], .wM6W7d, span',
                attribute: 'textContent',
              },
            },
          },
          outputVariable: 'variantASuggestions',
        },
      ],
    },
    // Step 7: Submit search to get related searches
    {
      id: 'submit-search',
      type: 'click',
      name: 'Submit search',
      selector: 'input[name="btnK"], button[type="submit"], .gNO89b',
      waitFor: {
        type: 'selector',
        value: '#search, #rso',
        timeout: 10000,
      },
    },
    // Step 8: Scroll to related searches at bottom
    {
      id: 'scroll-related',
      type: 'scroll',
      name: 'Scroll to related searches',
      direction: 'down',
      amount: 3000,
    },
    // Step 9: Extract related searches
    {
      id: 'extract-related',
      type: 'extract',
      name: 'Extract related searches',
      extract: {
        type: 'list',
        containerSelector: '.k8XOCe, .s75CSd, .AJLUJb a',
        maxItems: 10,
        fields: {
          keyword: {
            selector: 'div, span, a',
            attribute: 'textContent',
          },
        },
      },
      outputVariable: 'relatedSearches',
    },
    // Step 10: Transform and compile results
    {
      id: 'transform',
      type: 'script',
      name: 'Compile keyword data',
      code: `
        const seedKeyword = context.parameters.keyword;
        const autocomplete = context.autocompleteSuggestions || [];
        const variantA = context.variantASuggestions || [];
        const related = context.relatedSearches || [];

        const seen = new Set();
        const suggestions = [];

        // Add autocomplete suggestions
        let position = 0;
        for (const item of autocomplete) {
          const kw = item.keyword?.trim()?.toLowerCase();
          if (kw && !seen.has(kw) && kw !== seedKeyword.toLowerCase()) {
            seen.add(kw);
            suggestions.push({
              keyword: item.keyword.trim(),
              type: 'autocomplete',
              position: position++,
            });
          }
        }

        // Add variant suggestions
        for (const item of variantA) {
          const kw = item.keyword?.trim()?.toLowerCase();
          if (kw && !seen.has(kw) && kw !== seedKeyword.toLowerCase()) {
            seen.add(kw);
            suggestions.push({
              keyword: item.keyword.trim(),
              type: 'autocomplete',
              position: position++,
            });
          }
        }

        // Add related searches
        for (const item of related) {
          const kw = item.keyword?.trim()?.toLowerCase();
          if (kw && !seen.has(kw) && kw.length > 2) {
            seen.add(kw);
            suggestions.push({
              keyword: item.keyword.trim(),
              type: 'related',
              position: position++,
            });
          }
        }

        return {
          source: 'google',
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
// Google People Also Ask Skill
// ============================================================================

/**
 * Extract "People Also Ask" questions from Google search results
 */
export const GOOGLE_PEOPLE_ALSO_ASK_SKILL: BrowserSkill = {
  id: 'google-people-also-ask',
  name: 'Google People Also Ask',
  description: 'Extract "People Also Ask" questions from Google search results',
  domain: 'google.com',

  triggers: {
    urlPattern: 'google.com/search',
    intentPatterns: [
      'people also ask',
      'paa questions',
      'related questions',
      'faq research',
    ],
  },

  parameters: [
    {
      name: 'keyword',
      label: 'Search Keyword',
      type: 'string',
      required: true,
      description: 'The keyword to search for PAA questions',
    },
    {
      name: 'expandQuestions',
      label: 'Expand Questions',
      type: 'boolean',
      required: false,
      defaultValue: true,
      description: 'Click on questions to reveal more',
    },
    {
      name: 'maxQuestions',
      label: 'Maximum Questions',
      type: 'number',
      required: false,
      defaultValue: 20,
      description: 'Maximum number of questions to extract',
    },
  ],

  outputs: [
    {
      name: 'keywords',
      type: 'object',
      description: 'Keyword data with PAA questions',
    },
  ],

  steps: [
    // Step 1: Navigate to Google search
    {
      id: 'navigate',
      type: 'navigate',
      name: 'Search on Google',
      url: {
        type: 'expression',
        source: '"https://www.google.com/search?q=" + encodeURIComponent(context.parameters.keyword)',
      },
      waitFor: {
        type: 'selector',
        value: '#search, #rso',
        timeout: 10000,
      },
    },
    // Step 2: Wait for PAA section to load
    {
      id: 'wait-paa',
      type: 'wait',
      name: 'Wait for People Also Ask',
      waitFor: {
        type: 'selector',
        value: '.related-question-pair, [jsname="yEVEwb"], .wQiwMc',
        timeout: 5000,
      },
    },
    // Step 3: Scroll to PAA section
    {
      id: 'scroll-to-paa',
      type: 'scroll',
      name: 'Scroll to PAA section',
      target: '.related-question-pair, [jsname="yEVEwb"], .wQiwMc',
    },
    // Step 4: Extract initial PAA questions
    {
      id: 'extract-initial-paa',
      type: 'extract',
      name: 'Extract initial PAA questions',
      extract: {
        type: 'list',
        containerSelector: '.related-question-pair, [jsname="yEVEwb"], .wQiwMc .dnXCYb',
        maxItems: 10,
        fields: {
          question: {
            selector: '.CSkcDe, [data-attrid], .JlqpRe span',
            attribute: 'textContent',
          },
        },
      },
      outputVariable: 'initialQuestions',
    },
    // Step 5: Expand questions to get more
    {
      id: 'expand-questions',
      type: 'condition',
      name: 'Check if should expand',
      condition: {
        type: 'expression',
        expression: 'context.parameters.expandQuestions === true',
      },
      ifTrue: [
        // Click on first question to expand more
        {
          id: 'click-first',
          type: 'click',
          name: 'Click first question',
          selector: '.related-question-pair:first-child, [jsname="yEVEwb"]:first-child',
          optional: true,
        },
        {
          id: 'wait-expand-1',
          type: 'wait',
          name: 'Wait for expansion',
          waitFor: { type: 'idle', timeout: 1000 },
        },
        // Click on second question
        {
          id: 'click-second',
          type: 'click',
          name: 'Click second question',
          selector: '.related-question-pair:nth-child(2), [jsname="yEVEwb"]:nth-child(2)',
          optional: true,
        },
        {
          id: 'wait-expand-2',
          type: 'wait',
          name: 'Wait for more questions',
          waitFor: { type: 'idle', timeout: 1000 },
        },
        // Extract expanded questions
        {
          id: 'extract-expanded',
          type: 'extract',
          name: 'Extract expanded questions',
          extract: {
            type: 'list',
            containerSelector: '.related-question-pair, [jsname="yEVEwb"], .wQiwMc .dnXCYb',
            maxItems: { type: 'parameter', source: 'maxQuestions' },
            fields: {
              question: {
                selector: '.CSkcDe, [data-attrid], .JlqpRe span',
                attribute: 'textContent',
              },
            },
          },
          outputVariable: 'expandedQuestions',
        },
      ],
    },
    // Step 6: Combine and transform results
    {
      id: 'transform',
      type: 'script',
      name: 'Compile PAA data',
      code: `
        const seedKeyword = context.parameters.keyword;
        const initial = context.initialQuestions || [];
        const expanded = context.expandedQuestions || [];

        // Combine and deduplicate
        const seen = new Set();
        const suggestions = [];
        let position = 0;

        const allQuestions = [...initial, ...expanded];

        for (const item of allQuestions) {
          const q = item.question?.trim()?.toLowerCase();
          if (q && !seen.has(q) && q.length > 10) {
            seen.add(q);
            suggestions.push({
              keyword: item.question.trim(),
              type: 'paa',
              position: position++,
            });
          }
        }

        return {
          source: 'google',
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
    averageDurationMs: 6000,
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
// Export all Google skills
// ============================================================================

export const GOOGLE_KEYWORD_SKILLS = [
  GOOGLE_SEARCH_SUGGESTIONS_SKILL,
  GOOGLE_PEOPLE_ALSO_ASK_SKILL,
];
