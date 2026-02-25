/**
 * Profile Group Storage
 *
 * CRUD operations for profile groups.
 * Groups are stored at ~/.craft-agent/browser-profiles/groups/config.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { homedir } from 'os';
import type {
  ProfileGroup,
  CreateGroupInput,
  UpdateGroupInput,
  BrowserProfileConfig,
} from './types.ts';
import { listProfiles, loadProfileConfig, saveProfileConfig } from './storage.ts';

// Group storage location
const GROUPS_DIR = join(homedir(), '.craft-agent', 'browser-profiles', 'groups');
const GROUPS_FILE = join(GROUPS_DIR, 'config.json');

/**
 * Ensure groups directory exists
 */
function ensureGroupsDir(): void {
  if (!existsSync(GROUPS_DIR)) {
    mkdirSync(GROUPS_DIR, { recursive: true });
  }
}

/**
 * Load groups from disk
 */
function loadGroups(): ProfileGroup[] {
  ensureGroupsDir();

  if (!existsSync(GROUPS_FILE)) {
    return [];
  }

  try {
    return JSON.parse(readFileSync(GROUPS_FILE, 'utf-8')) as ProfileGroup[];
  } catch {
    return [];
  }
}

/**
 * Save groups to disk
 */
function saveGroups(groups: ProfileGroup[]): void {
  ensureGroupsDir();
  writeFileSync(GROUPS_FILE, JSON.stringify(groups, null, 2));
}

/**
 * List all profile groups
 */
export function listGroups(): ProfileGroup[] {
  return loadGroups();
}

/**
 * Get a group by ID
 */
export function getGroup(groupId: string): ProfileGroup | null {
  const groups = loadGroups();
  return groups.find((g) => g.id === groupId) || null;
}

/**
 * Create a new profile group
 */
export function createGroup(input: CreateGroupInput): ProfileGroup {
  const groups = loadGroups();
  const now = Date.now();

  const group: ProfileGroup = {
    id: randomUUID(),
    name: input.name,
    description: input.description,
    color: input.color,
    icon: input.icon,
    createdAt: now,
    updatedAt: now,
  };

  groups.push(group);
  saveGroups(groups);

  return group;
}

/**
 * Update a profile group
 */
export function updateGroup(groupId: string, input: UpdateGroupInput): ProfileGroup | null {
  const groups = loadGroups();
  const index = groups.findIndex((g) => g.id === groupId);
  if (index === -1) return null;

  const group = groups[index]!;

  if (input.name !== undefined) group.name = input.name;
  if (input.description !== undefined) group.description = input.description;
  if (input.color !== undefined) group.color = input.color;
  if (input.icon !== undefined) group.icon = input.icon;

  group.updatedAt = Date.now();
  groups[index] = group;
  saveGroups(groups);

  return group;
}

/**
 * Delete a profile group
 * Optionally clear groupId from profiles using this group
 */
export function deleteGroup(groupId: string, clearProfileReferences = true): boolean {
  const groups = loadGroups();
  const index = groups.findIndex((g) => g.id === groupId);
  if (index === -1) return false;

  groups.splice(index, 1);
  saveGroups(groups);

  // Clear group reference from profiles
  if (clearProfileReferences) {
    const profiles = listProfiles();
    for (const profile of profiles) {
      if (profile.groupId === groupId) {
        profile.groupId = undefined;
        profile.updatedAt = Date.now();
        saveProfileConfig(profile);
      }
    }
  }

  return true;
}

/**
 * Get all profiles in a specific group
 */
export function getProfilesInGroup(groupId: string): BrowserProfileConfig[] {
  const profiles = listProfiles();
  return profiles.filter((p) => p.groupId === groupId);
}

/**
 * Get profile count for a group
 */
export function getGroupProfileCount(groupId: string): number {
  return getProfilesInGroup(groupId).length;
}

/**
 * Move profile to a group
 */
export function moveProfileToGroup(profileId: string, groupId: string | undefined): boolean {
  const profile = loadProfileConfig(profileId);
  if (!profile) return false;

  // Verify group exists if groupId is provided
  if (groupId) {
    const group = getGroup(groupId);
    if (!group) return false;
  }

  profile.groupId = groupId;
  profile.updatedAt = Date.now();
  saveProfileConfig(profile);

  return true;
}

/**
 * Move multiple profiles to a group
 */
export function moveProfilesToGroup(profileIds: string[], groupId: string | undefined): number {
  let moved = 0;

  // Verify group exists if groupId is provided
  if (groupId) {
    const group = getGroup(groupId);
    if (!group) return 0;
  }

  for (const profileId of profileIds) {
    if (moveProfileToGroup(profileId, groupId)) {
      moved++;
    }
  }

  return moved;
}

/**
 * Get group statistics
 */
export function getGroupStats(): Array<{ group: ProfileGroup; profileCount: number }> {
  const groups = loadGroups();
  const profiles = listProfiles();

  return groups.map((group) => ({
    group,
    profileCount: profiles.filter((p) => p.groupId === group.id).length,
  }));
}

/**
 * Get ungrouped profiles (profiles without a group)
 */
export function getUngroupedProfiles(): BrowserProfileConfig[] {
  const profiles = listProfiles();
  return profiles.filter((p) => !p.groupId);
}
