/**
 * Expert Agent Configuration
 *
 * Pre-configured domain experts with specialized knowledge,
 * system prompts, and skill sets for specific platforms.
 *
 * Inspired by MiniMax Agent's Expert Agent concept - providing
 * domain-specific expertise that elevates performance from
 * generic 70% to specialized 95%+ accuracy.
 *
 * Use cases:
 * - E-commerce platform automation (Amazon, Shopee, etc.)
 * - Data analysis and reporting
 * - Social media management
 * - General web automation
 */

import type { BrowserSkill } from './types.ts';
import type { BrowserWorkflow } from './workflow-types.ts';
import { PRODUCT_RESEARCH_EXPERT } from './research/product-research-expert.ts';

// ============================================================================
// Expert Agent Types
// ============================================================================

/**
 * Expert agent configuration
 */
export interface ExpertAgentConfig {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Short description */
  description: string;

  /** Target domain(s) this expert handles */
  domains: string[];

  /** Domain knowledge */
  knowledge: ExpertKnowledge;

  /** Pre-configured skill IDs for this expert */
  skillIds: string[];

  /** Default workflow IDs */
  workflowIds: string[];

  /** UI configuration */
  ui: ExpertUIConfig;

  /** Activation patterns - when to suggest this expert */
  activationPatterns: string[];

  /** Priority when multiple experts match (higher = more priority) */
  priority: number;

  /** Whether this expert is built-in or user-created */
  isBuiltIn: boolean;

  /** Creation timestamp */
  createdAt: number;

  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Domain knowledge for an expert
 */
export interface ExpertKnowledge {
  /** System prompt additions for the LLM */
  systemPromptAdditions: string;

  /** Common operation patterns in this domain */
  commonPatterns: ExpertPattern[];

  /** Domain-specific terminology */
  terminology: Record<string, string>;

  /** Known page structures and their purposes */
  pageSignatures: PageSignature[];

  /** Common error patterns and how to handle them */
  errorHandling: ErrorPattern[];

  /** Best practices for this domain */
  bestPractices: string[];
}

/**
 * Common pattern in a domain
 */
export interface ExpertPattern {
  /** Pattern name */
  name: string;

  /** When this pattern applies */
  trigger: string;

  /** Step description */
  steps: string[];

  /** Tips for execution */
  tips?: string[];
}

/**
 * Page signature for recognition
 */
export interface PageSignature {
  /** Page type name */
  name: string;

  /** URL pattern */
  urlPattern: string;

  /** DOM selectors that identify this page */
  selectors: string[];

  /** What can be done on this page */
  capabilities: string[];
}

/**
 * Error pattern and handling
 */
export interface ErrorPattern {
  /** Error description */
  description: string;

  /** How to detect this error */
  detection: string;

  /** How to handle/recover */
  recovery: string;
}

/**
 * UI configuration for expert
 */
export interface ExpertUIConfig {
  /** Icon identifier */
  icon: string;

  /** Primary color */
  color: string;

  /** Badge text */
  badge?: string;
}

// ============================================================================
// Built-in Expert Agents
// ============================================================================

/**
 * Amazon Seller Expert
 */
export const AMAZON_SELLER_EXPERT: ExpertAgentConfig = {
  id: 'amazon-seller',
  name: 'Amazon Seller Assistant',
  description: 'Expert in Amazon Seller Central operations, including inventory, orders, advertising, and reports.',
  domains: ['sellercentral.amazon.com', 'advertising.amazon.com', 'amazon.com'],

  knowledge: {
    systemPromptAdditions: `
You are an expert Amazon seller assistant with deep knowledge of:
- Seller Central navigation and operations
- Inventory management and FBA processes
- Amazon Advertising (PPC) campaign management
- Business reports and analytics
- Account health and performance metrics

When performing tasks on Amazon:
1. Always verify you're on the correct marketplace (US, UK, DE, etc.)
2. Be aware of rate limits on report downloads
3. Handle session timeouts gracefully
4. Watch for CAPTCHA and verification challenges
`,

    commonPatterns: [
      {
        name: 'Download Business Report',
        trigger: 'download report, get sales data, export business report',
        steps: [
          'Navigate to Reports > Business Reports',
          'Select report type (Detail Page Sales, etc.)',
          'Set date range',
          'Click Download/Export',
          'Wait for report generation',
          'Download the file',
        ],
        tips: [
          'Reports may take time to generate for large date ranges',
          'CSV format is usually most compatible',
        ],
      },
      {
        name: 'Check Inventory Levels',
        trigger: 'check inventory, stock levels, FBA inventory',
        steps: [
          'Navigate to Inventory > Manage Inventory',
          'Apply filters if needed',
          'Extract inventory data',
        ],
      },
      {
        name: 'Manage Advertising Campaigns',
        trigger: 'advertising, ppc, campaigns, sponsored',
        steps: [
          'Navigate to Campaign Manager',
          'Select campaign type',
          'Apply date range',
          'Perform required operations',
        ],
      },
    ],

    terminology: {
      'FBA': 'Fulfillment by Amazon',
      'FBM': 'Fulfillment by Merchant',
      'ASIN': 'Amazon Standard Identification Number',
      'SKU': 'Stock Keeping Unit',
      'PPC': 'Pay Per Click advertising',
      'ACoS': 'Advertising Cost of Sales',
      'TACoS': 'Total Advertising Cost of Sales',
      'BSR': 'Best Seller Rank',
      'IPI': 'Inventory Performance Index',
      'ACOS': 'Advertising Cost of Sales',
    },

    pageSignatures: [
      {
        name: 'Seller Central Dashboard',
        urlPattern: 'sellercentral.amazon.*/home',
        selectors: ['#sc-content-container', '.dashboard-widget'],
        capabilities: ['view metrics', 'access navigation'],
      },
      {
        name: 'Inventory Management',
        urlPattern: 'sellercentral.amazon.*/inventory',
        selectors: ['#myitable', '.inventory-table'],
        capabilities: ['view inventory', 'edit listings', 'manage FBA'],
      },
      {
        name: 'Business Reports',
        urlPattern: 'sellercentral.amazon.*/reports',
        selectors: ['.report-selection', '#report-type-dropdown'],
        capabilities: ['generate reports', 'download data'],
      },
      {
        name: 'Advertising Console',
        urlPattern: 'advertising.amazon.*/cm/campaigns',
        selectors: ['[data-e2e-id="campaigns-table"]', '.campaign-list'],
        capabilities: ['manage campaigns', 'view performance', 'adjust bids'],
      },
    ],

    errorHandling: [
      {
        description: 'Session timeout',
        detection: 'Login page appears, "session expired" message',
        recovery: 'Re-authenticate and retry the operation',
      },
      {
        description: 'CAPTCHA challenge',
        detection: 'CAPTCHA image or puzzle appears',
        recovery: 'Pause and notify user to complete verification',
      },
      {
        description: 'Rate limit',
        detection: 'Too many requests, please try again later',
        recovery: 'Wait 30 seconds and retry with exponential backoff',
      },
    ],

    bestPractices: [
      'Always check which marketplace you are operating in',
      'Download reports during off-peak hours for faster processing',
      'Use date ranges that match your business reporting periods',
      'Verify data after download by checking row counts',
    ],
  },

  skillIds: [],
  workflowIds: [],

  ui: {
    icon: 'amazon',
    color: '#FF9900',
    badge: 'E-commerce',
  },

  activationPatterns: [
    'amazon',
    'seller central',
    'fba',
    'asin',
    'amazon seller',
    'amazon advertising',
  ],

  priority: 100,
  isBuiltIn: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

/**
 * Shopee Seller Expert
 */
export const SHOPEE_SELLER_EXPERT: ExpertAgentConfig = {
  id: 'shopee-seller',
  name: 'Shopee Seller Assistant',
  description: 'Expert in Shopee Seller Center operations for Southeast Asian markets.',
  domains: ['seller.shopee.sg', 'seller.shopee.co.th', 'seller.shopee.com.my', 'seller.shopee.ph', 'seller.shopee.vn', 'seller.shopee.co.id', 'seller.shopee.tw'],

  knowledge: {
    systemPromptAdditions: `
You are an expert Shopee seller assistant with deep knowledge of:
- Shopee Seller Center for all SE Asian markets
- Product listing and management
- Order fulfillment and shipping
- Shopee Ads and promotions
- Flash sales and campaigns
- Shopee Mall operations

When performing tasks on Shopee:
1. Be aware of market-specific differences (SG, TH, MY, PH, VN, ID, TW)
2. Handle OTP verification when required
3. Watch for promotional campaign deadlines
4. Consider timezone differences for scheduled operations
`,

    commonPatterns: [
      {
        name: 'Export Order Data',
        trigger: 'export orders, download order list, order report',
        steps: [
          'Navigate to Orders > My Orders',
          'Apply date and status filters',
          'Click Export',
          'Select export format',
          'Download file',
        ],
      },
      {
        name: 'Update Product Pricing',
        trigger: 'update price, change pricing, adjust price',
        steps: [
          'Navigate to Product > My Products',
          'Search or filter for target products',
          'Edit price field',
          'Save changes',
        ],
      },
      {
        name: 'Manage Shopee Ads',
        trigger: 'shopee ads, advertising, boost product',
        steps: [
          'Navigate to Marketing Centre > Shopee Ads',
          'Select campaign type',
          'Configure targeting',
          'Set budget and schedule',
        ],
      },
    ],

    terminology: {
      'SSC': 'Shopee Seller Center',
      'COD': 'Cash on Delivery',
      'SPX': 'Shopee Express',
      'SLS': 'Shopee Logistics Service',
      'FSS': 'Free Shipping Subsidy',
      'VV': 'Voucher Value',
      'GMV': 'Gross Merchandise Value',
    },

    pageSignatures: [
      {
        name: 'Seller Dashboard',
        urlPattern: 'seller.shopee.*/portal/dashboard',
        selectors: ['.dashboard-container', '.metrics-card'],
        capabilities: ['view metrics', 'quick actions'],
      },
      {
        name: 'Product Management',
        urlPattern: 'seller.shopee.*/portal/product/list',
        selectors: ['.product-list-table', '[data-testid="product-table"]'],
        capabilities: ['view products', 'edit listings', 'manage stock'],
      },
      {
        name: 'Order Management',
        urlPattern: 'seller.shopee.*/portal/sale',
        selectors: ['.order-list', '.order-table'],
        capabilities: ['view orders', 'process shipments', 'export data'],
      },
    ],

    errorHandling: [
      {
        description: 'OTP verification required',
        detection: 'OTP input field appears',
        recovery: 'Notify user to input OTP, then continue',
      },
      {
        description: 'Session expired',
        detection: 'Redirect to login page',
        recovery: 'Re-authenticate and retry',
      },
    ],

    bestPractices: [
      'Check promotion eligibility before joining campaigns',
      'Process orders before SLA deadlines to avoid penalties',
      'Keep stock synchronized across channels',
      'Monitor chat response rate for Preferred Seller status',
    ],
  },

  skillIds: [],
  workflowIds: [],

  ui: {
    icon: 'shopee',
    color: '#EE4D2D',
    badge: 'E-commerce',
  },

  activationPatterns: [
    'shopee',
    'seller center',
    'shopee seller',
    'shopee ads',
  ],

  priority: 100,
  isBuiltIn: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

/**
 * Data Analyst Expert
 */
export const DATA_ANALYST_EXPERT: ExpertAgentConfig = {
  id: 'data-analyst',
  name: 'Data Analyst',
  description: 'Expert in web data extraction, table parsing, and data export.',
  domains: ['*'],

  knowledge: {
    systemPromptAdditions: `
You are an expert data analyst assistant specializing in:
- Web scraping and data extraction
- Table parsing and structure recognition
- Data cleaning and transformation
- Export to various formats (CSV, JSON, Excel)
- Pattern recognition in web data

When extracting data:
1. Identify the data structure first (table, list, cards, etc.)
2. Handle pagination for large datasets
3. Validate extracted data for completeness
4. Consider rate limiting and politeness
5. Handle dynamic content loading (infinite scroll, lazy load)
`,

    commonPatterns: [
      {
        name: 'Extract Table Data',
        trigger: 'extract table, scrape table, get table data',
        steps: [
          'Identify table structure (HTML table or grid layout)',
          'Extract headers',
          'Iterate through rows',
          'Extract cell data with proper typing',
          'Format output',
        ],
        tips: [
          'Check for nested tables',
          'Handle colspan/rowspan',
          'Watch for hidden columns',
        ],
      },
      {
        name: 'Handle Pagination',
        trigger: 'all pages, paginated data, multiple pages',
        steps: [
          'Identify pagination controls',
          'Extract current page data',
          'Navigate to next page',
          'Repeat until no more pages',
          'Combine all data',
        ],
      },
      {
        name: 'Export to CSV',
        trigger: 'export csv, save as csv, download csv',
        steps: [
          'Collect all data',
          'Format headers',
          'Escape special characters',
          'Generate CSV content',
          'Trigger download',
        ],
      },
    ],

    terminology: {
      'DOM': 'Document Object Model',
      'XPath': 'XML Path Language for selecting nodes',
      'CSS Selector': 'Pattern for selecting HTML elements',
      'Pagination': 'Splitting data across multiple pages',
      'Lazy Loading': 'Loading content on demand as user scrolls',
    },

    pageSignatures: [],

    errorHandling: [
      {
        description: 'Dynamic content not loaded',
        detection: 'Expected elements not found, skeleton loaders visible',
        recovery: 'Wait for content to load, scroll to trigger lazy loading',
      },
      {
        description: 'Rate limited',
        detection: '429 status code, "too many requests" message',
        recovery: 'Implement exponential backoff, reduce request frequency',
      },
    ],

    bestPractices: [
      'Always verify data completeness after extraction',
      'Use stable selectors (data-* attributes, IDs) when possible',
      'Respect robots.txt and rate limits',
      'Handle encoding properly (UTF-8)',
      'Log extraction progress for large datasets',
    ],
  },

  skillIds: [],
  workflowIds: [],

  ui: {
    icon: 'chart-bar',
    color: '#3B82F6',
    badge: 'Analysis',
  },

  activationPatterns: [
    'extract data',
    'scrape',
    'table data',
    'export csv',
    'download data',
    'parse table',
    'collect data',
  ],

  priority: 50,
  isBuiltIn: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

/**
 * Social Media Expert
 */
export const SOCIAL_MEDIA_EXPERT: ExpertAgentConfig = {
  id: 'social-media',
  name: 'Social Media Manager',
  description: 'Expert in social media platform operations and analytics.',
  domains: ['twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'tiktok.com'],

  knowledge: {
    systemPromptAdditions: `
You are an expert social media manager assistant specializing in:
- Content scheduling and publishing
- Analytics and performance tracking
- Engagement monitoring
- Hashtag and trend analysis
- Cross-platform management

When operating on social media:
1. Respect platform-specific rate limits
2. Handle authentication carefully
3. Be aware of content policies
4. Handle media uploads properly
5. Consider timezone for scheduling
`,

    commonPatterns: [
      {
        name: 'Get Analytics Data',
        trigger: 'get analytics, performance data, engagement stats',
        steps: [
          'Navigate to analytics/insights section',
          'Set date range',
          'Extract relevant metrics',
          'Format data for export',
        ],
      },
      {
        name: 'Schedule Post',
        trigger: 'schedule post, plan content, publish later',
        steps: [
          'Navigate to composer/post creator',
          'Enter content',
          'Add media if needed',
          'Set schedule time',
          'Confirm scheduling',
        ],
      },
    ],

    terminology: {
      'Engagement Rate': 'Interactions divided by reach/impressions',
      'Reach': 'Unique users who saw content',
      'Impressions': 'Total times content was displayed',
      'CTR': 'Click-through rate',
    },

    pageSignatures: [
      {
        name: 'Twitter/X Home',
        urlPattern: 'twitter.com/home|x.com/home',
        selectors: ['[data-testid="primaryColumn"]', '[data-testid="tweetText"]'],
        capabilities: ['view feed', 'compose tweet', 'search'],
      },
    ],

    errorHandling: [
      {
        description: 'Rate limit exceeded',
        detection: 'Rate limit warning, 429 error',
        recovery: 'Wait for reset window, typically 15 minutes',
      },
    ],

    bestPractices: [
      'Always preview posts before publishing',
      'Check image dimensions for each platform',
      'Verify hashtag relevance and trending status',
      'Schedule posts during peak engagement hours',
    ],
  },

  skillIds: [],
  workflowIds: [],

  ui: {
    icon: 'share',
    color: '#1DA1F2',
    badge: 'Social',
  },

  activationPatterns: [
    'twitter',
    'facebook',
    'instagram',
    'linkedin',
    'social media',
    'tiktok',
    'post to',
    'share on',
  ],

  priority: 80,
  isBuiltIn: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

/**
 * General Web Automation Expert
 */
export const GENERAL_WEB_EXPERT: ExpertAgentConfig = {
  id: 'general-web',
  name: 'Web Automation Expert',
  description: 'General-purpose web automation for any website.',
  domains: ['*'],

  knowledge: {
    systemPromptAdditions: `
You are a general-purpose web automation expert capable of:
- Form filling and submission
- Navigation and interaction
- Data extraction
- File downloads and uploads
- Authentication handling

When automating web tasks:
1. Analyze page structure before acting
2. Handle popups and modals
3. Wait for page loads and dynamic content
4. Provide fallback strategies
5. Validate actions were successful
`,

    commonPatterns: [
      {
        name: 'Fill Form',
        trigger: 'fill form, enter data, complete form',
        steps: [
          'Identify form fields',
          'Validate field types',
          'Enter data sequentially',
          'Handle dropdowns and checkboxes',
          'Submit form',
          'Verify success',
        ],
      },
      {
        name: 'Login',
        trigger: 'login, sign in, authenticate',
        steps: [
          'Navigate to login page',
          'Enter credentials',
          'Handle 2FA if needed',
          'Verify successful login',
        ],
      },
      {
        name: 'Download File',
        trigger: 'download file, save file, export',
        steps: [
          'Navigate to download source',
          'Trigger download action',
          'Wait for download completion',
          'Verify file',
        ],
      },
    ],

    terminology: {},

    pageSignatures: [],

    errorHandling: [
      {
        description: 'Element not found',
        detection: 'Selector returns null, timeout waiting for element',
        recovery: 'Try alternative selectors, wait for dynamic loading',
      },
      {
        description: 'Navigation blocked',
        detection: 'Popup blocker, new window blocked',
        recovery: 'Handle in same window, use direct navigation',
      },
    ],

    bestPractices: [
      'Use multiple selector strategies for resilience',
      'Implement explicit waits over implicit waits',
      'Take screenshots at key points for debugging',
      'Log all actions for reproducibility',
    ],
  },

  skillIds: [],
  workflowIds: [],

  ui: {
    icon: 'globe',
    color: '#6B7280',
    badge: 'General',
  },

  activationPatterns: [],

  priority: 1,
  isBuiltIn: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// ============================================================================
// Expert Registry
// ============================================================================

/**
 * All built-in expert agents
 */
export const BUILT_IN_EXPERTS: ExpertAgentConfig[] = [
  AMAZON_SELLER_EXPERT,
  SHOPEE_SELLER_EXPERT,
  DATA_ANALYST_EXPERT,
  SOCIAL_MEDIA_EXPERT,
  PRODUCT_RESEARCH_EXPERT,
  GENERAL_WEB_EXPERT,
];

/**
 * Registry of all expert agents (built-in + custom)
 */
let expertRegistry: Map<string, ExpertAgentConfig> = new Map();
let isInitialized = false;

/**
 * Initialize the expert registry
 */
export function initializeExpertRegistry(customExperts: ExpertAgentConfig[] = []): void {
  expertRegistry.clear();

  // Add built-in experts
  for (const expert of BUILT_IN_EXPERTS) {
    expertRegistry.set(expert.id, expert);
  }

  // Add custom experts (can override built-ins)
  for (const expert of customExperts) {
    expertRegistry.set(expert.id, expert);
  }

  isInitialized = true;
}

/**
 * Get an expert by ID
 */
export function getExpert(id: string): ExpertAgentConfig | undefined {
  if (!isInitialized) {
    initializeExpertRegistry();
  }
  return expertRegistry.get(id);
}

/**
 * Get all experts
 */
export function getAllExperts(): ExpertAgentConfig[] {
  if (!isInitialized) {
    initializeExpertRegistry();
  }
  return Array.from(expertRegistry.values()).sort((a, b) => b.priority - a.priority);
}

/**
 * Register a custom expert
 */
export function registerExpert(expert: ExpertAgentConfig): void {
  if (!isInitialized) {
    initializeExpertRegistry();
  }
  expertRegistry.set(expert.id, expert);
}

/**
 * Unregister an expert
 */
export function unregisterExpert(id: string): boolean {
  if (!isInitialized) {
    initializeExpertRegistry();
  }
  return expertRegistry.delete(id);
}

// ============================================================================
// Expert Matching
// ============================================================================

/**
 * Match result for expert finding
 */
export interface ExpertMatch {
  /** Matched expert */
  expert: ExpertAgentConfig;

  /** Confidence score (0-1) */
  confidence: number;

  /** Why this expert was matched */
  matchReason: 'domain' | 'pattern' | 'fallback';

  /** Matched pattern if applicable */
  matchedPattern?: string;
}

/**
 * Find the best expert for a given context
 */
export function findBestExpert(
  url: string,
  intent?: string
): ExpertMatch | null {
  if (!isInitialized) {
    initializeExpertRegistry();
  }

  const matches: ExpertMatch[] = [];
  const hostname = extractHostname(url);

  for (const expert of expertRegistry.values()) {
    // Check domain match
    const domainMatch = expert.domains.some(domain => {
      if (domain === '*') return false; // Wildcard domains have lowest priority
      return hostname.includes(domain.replace('*', ''));
    });

    if (domainMatch) {
      matches.push({
        expert,
        confidence: 0.9,
        matchReason: 'domain',
      });
      continue;
    }

    // Check pattern match (if intent provided)
    if (intent) {
      const intentLower = intent.toLowerCase();
      for (const pattern of expert.activationPatterns) {
        if (intentLower.includes(pattern.toLowerCase())) {
          matches.push({
            expert,
            confidence: 0.7,
            matchReason: 'pattern',
            matchedPattern: pattern,
          });
          break;
        }
      }
    }
  }

  // Sort by confidence and priority
  matches.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence;
    }
    return b.expert.priority - a.expert.priority;
  });

  // Return best match or fallback to general expert
  const bestMatch = matches[0];
  if (bestMatch) {
    return bestMatch;
  }

  // Use general web expert as fallback
  const generalExpert = expertRegistry.get('general-web');
  if (generalExpert) {
    return {
      expert: generalExpert,
      confidence: 0.3,
      matchReason: 'fallback',
    };
  }

  return null;
}

/**
 * Find all applicable experts for a context
 */
export function findApplicableExperts(
  url: string,
  intent?: string
): ExpertMatch[] {
  if (!isInitialized) {
    initializeExpertRegistry();
  }

  const matches: ExpertMatch[] = [];
  const hostname = extractHostname(url);

  for (const expert of expertRegistry.values()) {
    // Check domain match
    const domainMatch = expert.domains.some(domain => {
      if (domain === '*') return true;
      return hostname.includes(domain.replace('*', ''));
    });

    if (domainMatch) {
      matches.push({
        expert,
        confidence: expert.domains.includes('*') ? 0.3 : 0.9,
        matchReason: domainMatch && !expert.domains.includes('*') ? 'domain' : 'fallback',
      });
    }

    // Also check pattern match
    if (intent) {
      const intentLower = intent.toLowerCase();
      for (const pattern of expert.activationPatterns) {
        if (intentLower.includes(pattern.toLowerCase())) {
          // Avoid duplicates
          const existing = matches.find(m => m.expert.id === expert.id);
          if (existing) {
            existing.confidence = Math.max(existing.confidence, 0.7);
          } else {
            matches.push({
              expert,
              confidence: 0.7,
              matchReason: 'pattern',
              matchedPattern: pattern,
            });
          }
          break;
        }
      }
    }
  }

  // Sort by confidence and priority
  return matches.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence;
    }
    return b.expert.priority - a.expert.priority;
  });
}

// ============================================================================
// Expert System Prompt Generation
// ============================================================================

/**
 * Generate enhanced system prompt with expert knowledge
 */
export function generateExpertSystemPrompt(
  expert: ExpertAgentConfig,
  basePrompt: string = ''
): string {
  const sections: string[] = [];

  if (basePrompt) {
    sections.push(basePrompt);
  }

  // Add expert introduction
  sections.push(`\n## Expert Mode: ${expert.name}\n`);
  sections.push(expert.knowledge.systemPromptAdditions);

  // Add terminology
  if (Object.keys(expert.knowledge.terminology).length > 0) {
    sections.push('\n### Domain Terminology\n');
    for (const [term, definition] of Object.entries(expert.knowledge.terminology)) {
      sections.push(`- **${term}**: ${definition}`);
    }
  }

  // Add common patterns
  if (expert.knowledge.commonPatterns.length > 0) {
    sections.push('\n### Common Operations\n');
    for (const pattern of expert.knowledge.commonPatterns) {
      sections.push(`\n#### ${pattern.name}`);
      sections.push(`Triggered by: ${pattern.trigger}`);
      sections.push('Steps:');
      pattern.steps.forEach((step, i) => {
        sections.push(`${i + 1}. ${step}`);
      });
      if (pattern.tips && pattern.tips.length > 0) {
        sections.push('Tips:');
        pattern.tips.forEach(tip => {
          sections.push(`- ${tip}`);
        });
      }
    }
  }

  // Add best practices
  if (expert.knowledge.bestPractices.length > 0) {
    sections.push('\n### Best Practices\n');
    expert.knowledge.bestPractices.forEach(practice => {
      sections.push(`- ${practice}`);
    });
  }

  // Add error handling guidance
  if (expert.knowledge.errorHandling.length > 0) {
    sections.push('\n### Error Handling\n');
    for (const error of expert.knowledge.errorHandling) {
      sections.push(`\n**${error.description}**`);
      sections.push(`- Detection: ${error.detection}`);
      sections.push(`- Recovery: ${error.recovery}`);
    }
  }

  return sections.join('\n');
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract hostname from URL
 */
function extractHostname(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
}

/**
 * Create a custom expert from template
 */
export function createCustomExpert(
  template: Partial<ExpertAgentConfig> & { id: string; name: string }
): ExpertAgentConfig {
  return {
    id: template.id,
    name: template.name,
    description: template.description || `Custom expert: ${template.name}`,
    domains: template.domains || ['*'],
    knowledge: template.knowledge || {
      systemPromptAdditions: '',
      commonPatterns: [],
      terminology: {},
      pageSignatures: [],
      errorHandling: [],
      bestPractices: [],
    },
    skillIds: template.skillIds || [],
    workflowIds: template.workflowIds || [],
    ui: template.ui || {
      icon: 'user',
      color: '#6B7280',
    },
    activationPatterns: template.activationPatterns || [],
    priority: template.priority || 50,
    isBuiltIn: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Associate skills with an expert
 */
export function associateSkillsWithExpert(
  expertId: string,
  skillIds: string[]
): void {
  const expert = getExpert(expertId);
  if (expert) {
    expert.skillIds = [...new Set([...expert.skillIds, ...skillIds])];
    expert.updatedAt = Date.now();
  }
}

/**
 * Associate workflows with an expert
 */
export function associateWorkflowsWithExpert(
  expertId: string,
  workflowIds: string[]
): void {
  const expert = getExpert(expertId);
  if (expert) {
    expert.workflowIds = [...new Set([...expert.workflowIds, ...workflowIds])];
    expert.updatedAt = Date.now();
  }
}
