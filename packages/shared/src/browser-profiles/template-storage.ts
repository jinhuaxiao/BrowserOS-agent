/**
 * Profile Template Storage
 *
 * CRUD operations for profile templates.
 * Templates are stored at ~/.craft-agent/browser-profiles/templates/config.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { homedir } from 'os';
import type {
  ProfileTemplate,
  CreateTemplateInput,
  UpdateTemplateInput,
  BrowserProfileConfig,
  CreateProfileInput,
} from './types.ts';
import { createProfile } from './storage.ts';
import { getProxy } from './proxy-storage.ts';
import { getGroup } from './group-storage.ts';

// Template storage location
const TEMPLATES_DIR = join(homedir(), '.craft-agent', 'browser-profiles', 'templates');
const TEMPLATES_FILE = join(TEMPLATES_DIR, 'config.json');

/**
 * Ensure templates directory exists
 */
function ensureTemplatesDir(): void {
  if (!existsSync(TEMPLATES_DIR)) {
    mkdirSync(TEMPLATES_DIR, { recursive: true });
  }
}

/**
 * Load templates from disk
 */
function loadTemplates(): ProfileTemplate[] {
  ensureTemplatesDir();

  if (!existsSync(TEMPLATES_FILE)) {
    return [];
  }

  try {
    return JSON.parse(readFileSync(TEMPLATES_FILE, 'utf-8')) as ProfileTemplate[];
  } catch {
    return [];
  }
}

/**
 * Save templates to disk
 */
function saveTemplates(templates: ProfileTemplate[]): void {
  ensureTemplatesDir();
  writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2));
}

/**
 * List all profile templates
 */
export function listTemplates(): ProfileTemplate[] {
  return loadTemplates();
}

/**
 * Get a template by ID
 */
export function getTemplate(templateId: string): ProfileTemplate | null {
  const templates = loadTemplates();
  return templates.find((t) => t.id === templateId) || null;
}

/**
 * Create a new profile template
 */
export function createTemplate(input: CreateTemplateInput): ProfileTemplate {
  const templates = loadTemplates();
  const now = Date.now();

  const template: ProfileTemplate = {
    id: randomUUID(),
    name: input.name,
    description: input.description,
    platform: input.platform,
    targetPlatform: input.targetPlatform,
    targetRegion: input.targetRegion,
    proxyId: input.proxyId,
    tags: input.tags,
    groupId: input.groupId,
    startupUrl: input.startupUrl,
    createdAt: now,
    updatedAt: now,
  };

  templates.push(template);
  saveTemplates(templates);

  return template;
}

/**
 * Update a profile template
 */
export function updateTemplate(templateId: string, input: UpdateTemplateInput): ProfileTemplate | null {
  const templates = loadTemplates();
  const index = templates.findIndex((t) => t.id === templateId);
  if (index === -1) return null;

  const template = templates[index]!;

  if (input.name !== undefined) template.name = input.name;
  if (input.description !== undefined) template.description = input.description;
  if (input.platform !== undefined) template.platform = input.platform;
  if (input.targetPlatform !== undefined) template.targetPlatform = input.targetPlatform;
  if (input.targetRegion !== undefined) template.targetRegion = input.targetRegion;
  if (input.proxyId !== undefined) template.proxyId = input.proxyId;
  if (input.tags !== undefined) template.tags = input.tags;
  if (input.groupId !== undefined) template.groupId = input.groupId;
  if (input.startupUrl !== undefined) template.startupUrl = input.startupUrl;

  template.updatedAt = Date.now();
  templates[index] = template;
  saveTemplates(templates);

  return template;
}

/**
 * Delete a profile template
 */
export function deleteTemplate(templateId: string): boolean {
  const templates = loadTemplates();
  const index = templates.findIndex((t) => t.id === templateId);
  if (index === -1) return false;

  templates.splice(index, 1);
  saveTemplates(templates);

  return true;
}

/**
 * Create a new profile from a template
 */
export async function createProfileFromTemplate(
  templateId: string,
  overrides?: Partial<CreateProfileInput>
): Promise<BrowserProfileConfig> {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // Build profile input from template
  const profileInput: CreateProfileInput = {
    name: overrides?.name || `${template.name} - ${new Date().toLocaleDateString()}`,
    description: overrides?.description ?? template.description,
    platform: overrides?.platform ?? template.platform,
    targetPlatform: overrides?.targetPlatform ?? template.targetPlatform,
    targetRegion: overrides?.targetRegion ?? template.targetRegion,
    proxyId: overrides?.proxyId ?? template.proxyId,
    groupId: overrides?.groupId ?? template.groupId,
    startupUrl: overrides?.startupUrl ?? template.startupUrl,
    tags: overrides?.tags ?? template.tags,
  };

  return createProfile(profileInput);
}

/**
 * Batch create profiles from a template
 */
export async function batchCreateFromTemplate(
  templateId: string,
  count: number,
  options?: {
    namePrefix?: string;
    groupId?: string;
    proxyIds?: string[]; // Round-robin assign proxies
  }
): Promise<BrowserProfileConfig[]> {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const profiles: BrowserProfileConfig[] = [];

  for (let i = 0; i < count; i++) {
    const name = options?.namePrefix
      ? `${options.namePrefix} ${i + 1}`
      : `${template.name} ${i + 1}`;

    // Round-robin proxy assignment
    let proxyId = template.proxyId;
    if (options?.proxyIds && options.proxyIds.length > 0) {
      proxyId = options.proxyIds[i % options.proxyIds.length];
    }

    const profile = await createProfileFromTemplate(templateId, {
      name,
      groupId: options?.groupId ?? template.groupId,
      proxyId,
    });

    profiles.push(profile);
  }

  return profiles;
}

/**
 * Validate template references (proxy and group exist)
 */
export function validateTemplate(template: ProfileTemplate): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (template.proxyId) {
    const proxy = getProxy(template.proxyId);
    if (!proxy) {
      errors.push(`Referenced proxy not found: ${template.proxyId}`);
    }
  }

  if (template.groupId) {
    const group = getGroup(template.groupId);
    if (!group) {
      errors.push(`Referenced group not found: ${template.groupId}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create template from existing profile
 */
export function createTemplateFromProfile(
  profileId: string,
  templateName: string,
  options?: { includeProxy?: boolean; includeGroup?: boolean }
): ProfileTemplate {
  // Import here to avoid circular dependency
  const { getProfile } = require('./storage.ts');
  const profile = getProfile(profileId);

  if (!profile) {
    throw new Error(`Profile not found: ${profileId}`);
  }

  const templateInput: CreateTemplateInput = {
    name: templateName,
    description: `Created from profile: ${profile.name}`,
    platform: profile.platform,
    tags: profile.tags,
    startupUrl: profile.startupUrl,
  };

  // Extract target platform from user agent
  const ua = profile.fingerprint.navigator.userAgent.toLowerCase();
  if (ua.includes('windows')) {
    templateInput.targetPlatform = 'windows';
  } else if (ua.includes('mac')) {
    templateInput.targetPlatform = 'macos';
  } else if (ua.includes('linux')) {
    templateInput.targetPlatform = 'linux';
  }

  if (options?.includeProxy && profile.proxyId) {
    templateInput.proxyId = profile.proxyId;
  }

  if (options?.includeGroup && profile.groupId) {
    templateInput.groupId = profile.groupId;
  }

  return createTemplate(templateInput);
}

/**
 * Get templates by platform
 */
export function getTemplatesByPlatform(platform: string): ProfileTemplate[] {
  const templates = loadTemplates();
  return templates.filter((t) => t.platform === platform);
}
