// Types shared between main and renderer processes
// Core types are re-exported from @craft-agent/core

// Import and re-export core types
import type {
  ContentBadge,
  Message as CoreMessage,
  MessageRole as CoreMessageRole,
  SessionMetadata as CoreSessionMetadata,
  StoredAttachment as CoreStoredAttachment,
  TokenUsage as CoreTokenUsage,
  Workspace as CoreWorkspace,
  ToolDisplayMeta,
  TypedError,
} from '@craft-agent/core/types'

// Permission mode type (formerly from @craft-agent/shared/agent/modes, now defined locally)
export type PermissionMode = 'safe' | 'ask' | 'allow-all'

// Permission mode config stub (UI display properties)
export const PERMISSION_MODE_CONFIG: Record<PermissionMode, { displayName: string; description: string; svgPath: string }> = {
  safe: { displayName: 'Explore', description: 'Read-only mode', svgPath: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z' },
  ask: { displayName: 'Ask to Edit', description: 'Prompts for permission', svgPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  'allow-all': { displayName: 'Auto', description: 'Full autonomy', svgPath: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
}

// Thinking level type (formerly from @craft-agent/shared/agent/thinking-levels, now defined locally)
export type ThinkingLevel = 'off' | 'think' | 'max'
export const DEFAULT_THINKING_LEVEL: ThinkingLevel = 'think'
export const THINKING_LEVELS: ThinkingLevel[] = ['off', 'think', 'max']

export type {
  CoreMessage as Message,
  CoreMessageRole as MessageRole,
  TypedError,
  CoreTokenUsage as TokenUsage,
  CoreWorkspace as Workspace,
  CoreSessionMetadata as SessionMetadata,
  CoreStoredAttachment as StoredAttachment,
  ContentBadge,
  ToolDisplayMeta,
}

// Import and re-export auth types for onboarding
// Use types-only subpaths to avoid pulling in Node.js dependencies
import type { AuthState, SetupNeeds } from '@craft-agent/shared/auth/types'
import type { AuthType } from '@craft-agent/shared/config/types'
export type { AuthState, SetupNeeds, AuthType }

// Import source types for session source selection
import type {
  FolderSourceConfig,
  LoadedSource,
  SourceConnectionStatus,
} from '@craft-agent/shared/sources/types'
export type { LoadedSource, FolderSourceConfig, SourceConnectionStatus }

// Import skill types
import type {
  LoadedSkill,
  SkillMetadata,
} from '@craft-agent/shared/skills/types'
export type { LoadedSkill, SkillMetadata }

// Import browser profile types
import type {
  AcceleratorHealthResult,
  // Accelerator types
  AcceleratorNode,
  AcceleratorStatus,
  // Browser config types
  BrowserConfig,
  BrowserProfileConfig,
  BrowserType,
  CreateAcceleratorInput,
  CreateGroupInput,
  CreateProfileInput,
  CreateProxyInput,
  CreateTemplateInput,
  EcommercePlatform,
  FingerprintConfig,
  // Geolocation types
  GeoLocation,
  LaunchResult,
  // Profile group types
  ProfileGroup,
  // Profile template types
  ProfileTemplate,
  ProxyConfig,
  ProxyHealthResult,
  ProxyImportResult,
  ProxyRegion,
  ProxySpeedTestResult,
  ProxyStatus,
  // Proxy pool types
  SavedProxy,
  UpdateAcceleratorInput,
  UpdateGroupInput,
  UpdateProfileInput,
  UpdateProxyInput,
  UpdateTemplateInput,
} from '@craft-agent/shared/browser-profiles/types'

// Import team management types
import type {
  ActivityAction,
  ActivityLog,
  ActivityTargetType,
  AssignmentPermission,
  CreateGroupAssignmentInput,
  CreateMemberInput,
  CreateOrganizationInput,
  CreateProfileAssignmentInput,
  GroupAssignment,
  GroupRole,
  LoginInput,
  LoginResult,
  LoginSession,
  Member,
  MemberRole,
  MemberStatus,
  Organization,
  ProfileAssignment,
  TeamSubpage,
  UpdateMemberInput,
  UpdateOrganizationInput,
} from '@craft-agent/shared/team/types'
export type {
  Organization,
  Member,
  MemberRole,
  MemberStatus,
  ProfileAssignment,
  GroupAssignment,
  ActivityLog,
  LoginSession,
  CreateOrganizationInput,
  UpdateOrganizationInput,
  CreateMemberInput,
  UpdateMemberInput,
  CreateProfileAssignmentInput,
  CreateGroupAssignmentInput,
  LoginInput,
  LoginResult,
  ActivityAction,
  ActivityTargetType,
  AssignmentPermission,
  GroupRole,
  TeamSubpage,
}

export type {
  BrowserProfileConfig,
  CreateProfileInput,
  UpdateProfileInput,
  LaunchResult,
  FingerprintConfig,
  ProxyConfig,
  EcommercePlatform,
  // Proxy pool types
  SavedProxy,
  CreateProxyInput,
  UpdateProxyInput,
  ProxyHealthResult,
  ProxyImportResult,
  ProxyStatus,
  ProxyRegion,
  // Accelerator types
  AcceleratorNode,
  CreateAcceleratorInput,
  UpdateAcceleratorInput,
  AcceleratorHealthResult,
  AcceleratorStatus,
  ProxySpeedTestResult,
  // Profile group types
  ProfileGroup,
  CreateGroupInput,
  UpdateGroupInput,
  // Profile template types
  ProfileTemplate,
  CreateTemplateInput,
  UpdateTemplateInput,
  // Geolocation types
  GeoLocation,
  // Browser config types
  BrowserConfig,
  BrowserType,
}

/**
 * Available browser info for settings UI
 */
export interface AvailableBrowser {
  name: string
  path: string
  type: BrowserType
  isInstalled: boolean
}

/**
 * File/directory entry in a skill folder
 */
export interface SkillFile {
  name: string
  type: 'file' | 'directory'
  size?: number
  children?: SkillFile[]
}

/**
 * File/directory entry in a session folder
 * Supports recursive tree structure with children for directories
 */
export interface SessionFile {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  children?: SessionFile[] // Recursive children for directories
}

/**
 * File search result for @ mention file selection.
 * Returned by FS_SEARCH IPC handler when user types @filename in input.
 */
export interface FileSearchResult {
  name: string
  path: string
  type: 'file' | 'directory'
  relativePath: string // Path relative to search base
}

// Auth request types (formerly from @craft-agent/shared/agent, now defined locally as stubs)
export interface AuthRequest {
  id: string
  type: 'oauth' | 'credential'
  sourceSlug?: string
  sourceName?: string
}
export type CredentialInputMode = 'bearer' | 'header' | 'query' | 'basic'
export interface CredentialRequest extends AuthRequest {
  type: 'credential'
  inputMode: CredentialInputMode
  headerName?: string
  queryParamName?: string
}

// Permissions config file type (formerly from @craft-agent/shared/agent/modes, now defined locally)
export interface PermissionsConfigFile {
  blockedTools?: string[]
  allowedBashPatterns?: string[]
  allowedMcpPatterns?: string[]
  allowedApiEndpoints?: Array<{ method?: string; pathPattern: string }>
  allowedWritePaths?: string[]
}

export { generateMessageId } from '@craft-agent/core/types'

/**
 * OAuth result from main process
 */
export interface OAuthResult {
  success: boolean
  error?: string
}

/**
 * MCP connection validation result
 */
export interface McpValidationResult {
  success: boolean
  error?: string
  tools?: string[]
}

/**
 * MCP tool with safe mode permission status
 */
export interface McpToolWithPermission {
  name: string
  description?: string
  allowed: boolean // true if allowed in safe mode, false if requires permission
}

/**
 * Result of fetching MCP tools with permission status
 */
export interface McpToolsResult {
  success: boolean
  error?: string
  tools?: McpToolWithPermission[]
}

/**
 * Result of sharing or revoking a session
 */
export interface ShareResult {
  success: boolean
  url?: string
  error?: string
}

/**
 * Result of refreshing/regenerating a session title
 */
export interface RefreshTitleResult {
  success: boolean
  title?: string
  error?: string
}

// Re-export permission types from core, extended with sessionId for multi-session context
export type { PermissionRequest as BasePermissionRequest } from '@craft-agent/core/types'

import type { PermissionRequest as BasePermissionRequest } from '@craft-agent/core/types'

/**
 * Permission request with session context (for multi-session Electron app)
 */
export interface PermissionRequest extends BasePermissionRequest {
  sessionId: string
}

// ============================================
// Credential Input Types (Secure Auth UI)
// ============================================

/**
 * Credential response from user (for credential auth requests)
 */
export interface CredentialResponse {
  type: 'credential'
  /** Single value for bearer/header/query modes */
  value?: string
  /** Username for basic auth */
  username?: string
  /** Password for basic auth */
  password?: string
  /** Whether user cancelled */
  cancelled: boolean
}

// ============================================
// Plan Types (SubmitPlan workflow)
// ============================================

/**
 * Step in a plan
 */
export interface PlanStep {
  id: string
  description: string
  tools?: string[]
  status?: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
}

/**
 * Plan from the agent
 */
export interface Plan {
  id: string
  title: string
  summary?: string
  steps: PlanStep[]
  questions?: string[]
  state?:
    | 'creating'
    | 'refining'
    | 'ready'
    | 'executing'
    | 'completed'
    | 'cancelled'
  createdAt?: number
  updatedAt?: number
}

// ============================================
// Onboarding Types
// ============================================

/**
 * Git Bash detection status (Windows only)
 */
export interface GitBashStatus {
  found: boolean
  path: string | null
  platform: 'win32' | 'darwin' | 'linux'
}

/**
 * Result of saving onboarding configuration
 */
export interface OnboardingSaveResult {
  success: boolean
  error?: string
  workspaceId?: string
}

/**
 * File attachment for sending with messages
 * Matches the FileAttachment interface from src/utils/files.ts
 */
export interface FileAttachment {
  type: 'image' | 'text' | 'pdf' | 'office' | 'unknown'
  path: string
  name: string
  mimeType: string
  base64?: string // For images, PDFs, and Office files
  text?: string // For text files
  size: number
  thumbnailBase64?: string // Quick Look thumbnail (generated by Electron main process)
}

// Import types needed for Session interface
import type { Message } from '@craft-agent/core/types'

/**
 * Electron-specific Session type (includes runtime state)
 * Extends core Session with messages array and processing state
 */
/**
 * Todo state for sessions (user-controlled, never automatic)
 *
 * Dynamic status ID referencing workspace status config.
 * Validated at runtime via validateSessionStatus().
 * Falls back to 'todo' if status doesn't exist.
 *
 * Built-in status IDs (for reference):
 * - 'todo': Not started
 * - 'in-progress': Currently working on
 * - 'needs-review': Awaiting review
 * - 'done': Completed successfully
 * - 'cancelled': Cancelled/abandoned
 */
export type TodoState = string

// Helper type for TypeScript consumers
export type BuiltInStatusId =
  | 'todo'
  | 'in-progress'
  | 'needs-review'
  | 'done'
  | 'cancelled'

export interface Session {
  id: string
  workspaceId: string
  workspaceName: string
  name?: string // User-defined or AI-generated session name
  /** Preview of first user message (from JSONL header, for lazy-loaded sessions) */
  preview?: string
  lastMessageAt: number
  messages: Message[]
  isProcessing: boolean
  // Session metadata
  isFlagged?: boolean
  // Advanced options (persisted per session)
  /** Permission mode for this session ('safe', 'ask', 'allow-all') */
  permissionMode?: PermissionMode
  // Todo state (user-controlled) - determines open vs closed
  todoState?: TodoState
  // Labels (additive tags, many-per-session — bare IDs or "id::value" entries)
  labels?: string[]
  // Read/unread tracking - ID of last message user has read
  lastReadMessageId?: string
  /**
   * Explicit unread flag - single source of truth for NEW badge.
   * Set to true when assistant message completes while user is NOT viewing.
   * Set to false when user views the session (and not processing).
   */
  hasUnread?: boolean
  // Per-session source selection (source slugs)
  enabledSourceSlugs?: string[]
  // Working directory for this session (used by agent for bash commands)
  workingDirectory?: string
  // Session folder path (for "Reset to Session Root" option)
  sessionFolderPath?: string
  // Shared viewer URL (if shared via viewer)
  sharedUrl?: string
  // Shared session ID in viewer (for revoke)
  sharedId?: string
  // Model to use for this session (overrides global config if set)
  model?: string
  // Thinking level for this session ('off', 'think', 'max')
  thinkingLevel?: ThinkingLevel
  // Role/type of the last message (for badge display without loading messages)
  lastMessageRole?: 'user' | 'assistant' | 'plan' | 'tool' | 'error'
  // ID of the last final (non-intermediate) assistant message - pre-computed for unread detection
  lastFinalMessageId?: string
  // Whether an async operation is ongoing (sharing, updating share, revoking, title regeneration)
  // Used for shimmer effect on session title in sidebar and panel header
  isAsyncOperationOngoing?: boolean
  /** @deprecated Use isAsyncOperationOngoing instead */
  isRegeneratingTitle?: boolean
  // Current status for ProcessingIndicator (e.g., compacting)
  currentStatus?: {
    message: string
    statusType?: string
  }
  // When the session was first created (ms timestamp)
  createdAt?: number
  // Total message count (pre-computed in JSONL header)
  messageCount?: number
  // Token usage for context tracking
  tokenUsage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    contextTokens: number
    costUsd: number
    cacheReadTokens?: number
    cacheCreationTokens?: number
    /** Model's context window size in tokens (from SDK modelUsage) */
    contextWindow?: number
  }
}

/**
 * Options for creating a new session
 * Note: Session creation itself has no options - auto-send is handled by NavigationContext
 */
export interface CreateSessionOptions {
  /** Initial permission mode for the session (overrides workspace default) */
  permissionMode?: PermissionMode
  /**
   * Working directory for the session:
   * - 'user_default' or undefined: Use workspace's configured default working directory
   * - 'none': No working directory (session folder only)
   * - Absolute path string: Use this specific path
   */
  workingDirectory?: string | 'user_default' | 'none'
}

// Events sent from main to renderer
// turnId: Correlation ID from the API's message.id, groups all events in an assistant turn
export type SessionEvent =
  | { type: 'text_delta'; sessionId: string; delta: string; turnId?: string }
  | {
      type: 'text_complete'
      sessionId: string
      text: string
      isIntermediate?: boolean
      turnId?: string
      parentToolUseId?: string
    }
  | {
      type: 'tool_start'
      sessionId: string
      toolName: string
      toolUseId: string
      toolInput: Record<string, unknown>
      toolIntent?: string
      toolDisplayName?: string
      toolDisplayMeta?: import('@craft-agent/core').ToolDisplayMeta
      turnId?: string
      parentToolUseId?: string
    }
  | {
      type: 'tool_result'
      sessionId: string
      toolUseId: string
      toolName: string
      result: string
      turnId?: string
      parentToolUseId?: string
      isError?: boolean
    }
  | {
      type: 'parent_update'
      sessionId: string
      toolUseId: string
      parentToolUseId: string
    }
  | { type: 'error'; sessionId: string; error: string }
  | { type: 'typed_error'; sessionId: string; error: TypedError }
  | {
      type: 'complete'
      sessionId: string
      tokenUsage?: Session['tokenUsage']
      hasUnread?: boolean
    }
  | { type: 'interrupted'; sessionId: string; message?: Message }
  | {
      type: 'status'
      sessionId: string
      message: string
      statusType?: 'compacting'
    }
  | {
      type: 'info'
      sessionId: string
      message: string
      statusType?: 'compaction_complete'
      level?: 'info' | 'warning' | 'error' | 'success'
    }
  | { type: 'title_generated'; sessionId: string; title: string }
  | { type: 'title_regenerating'; sessionId: string; isRegenerating: boolean }
  // Generic async operation state (sharing, updating share, revoking, title regeneration)
  | { type: 'async_operation'; sessionId: string; isOngoing: boolean }
  | {
      type: 'working_directory_changed'
      sessionId: string
      workingDirectory: string
    }
  | {
      type: 'permission_request'
      sessionId: string
      request: PermissionRequest
    }
  | {
      type: 'credential_request'
      sessionId: string
      request: CredentialRequest
    }
  // Permission mode events
  | {
      type: 'permission_mode_changed'
      sessionId: string
      permissionMode: PermissionMode
    }
  | { type: 'plan_submitted'; sessionId: string; message: CoreMessage }
  // Source events
  | { type: 'sources_changed'; sessionId: string; enabledSourceSlugs: string[] }
  | { type: 'labels_changed'; sessionId: string; labels: string[] }
  // Background task/shell events
  | {
      type: 'task_backgrounded'
      sessionId: string
      toolUseId: string
      taskId: string
      intent?: string
      turnId?: string
    }
  | {
      type: 'shell_backgrounded'
      sessionId: string
      toolUseId: string
      shellId: string
      intent?: string
      command?: string
      turnId?: string
    }
  | {
      type: 'task_progress'
      sessionId: string
      toolUseId: string
      elapsedSeconds: number
      turnId?: string
    }
  | { type: 'shell_killed'; sessionId: string; shellId: string }
  // User message events (for optimistic UI with backend as source of truth)
  | {
      type: 'user_message'
      sessionId: string
      message: Message
      status: 'accepted' | 'queued' | 'processing'
    }
  // Session metadata events (for multi-window sync)
  | { type: 'session_flagged'; sessionId: string }
  | { type: 'session_unflagged'; sessionId: string }
  | { type: 'session_model_changed'; sessionId: string; model: string | null }
  | { type: 'todo_state_changed'; sessionId: string; todoState: TodoState }
  | { type: 'session_deleted'; sessionId: string }
  | { type: 'session_shared'; sessionId: string; sharedUrl: string }
  | { type: 'session_unshared'; sessionId: string }
  // Auth request events (unified auth flow)
  | {
      type: 'auth_request'
      sessionId: string
      message: CoreMessage
      request: SharedAuthRequest
    }
  | {
      type: 'auth_completed'
      sessionId: string
      requestId: string
      success: boolean
      cancelled?: boolean
      error?: string
    }
  // Source activation events (for auto-retry on mid-turn activation)
  | {
      type: 'source_activated'
      sessionId: string
      sourceSlug: string
      originalMessage: string
    }
  // Real-time usage update during processing (for context display)
  | {
      type: 'usage_update'
      sessionId: string
      tokenUsage: { inputTokens: number; contextWindow?: number }
    }

// Options for sendMessage
export interface SendMessageOptions {
  /** Enable ultrathink mode for extended reasoning */
  ultrathinkEnabled?: boolean
  /** Skill slugs to activate for this message (from @mentions) */
  skillSlugs?: string[]
  /** Content badges for inline display (sources, skills with embedded icons) */
  badges?: import('@craft-agent/core').ContentBadge[]
}

// =============================================================================
// IPC Command Pattern Types
// =============================================================================

/**
 * SessionCommand - Consolidated session operations
 * Replaces individual IPC calls: flag, unflag, rename, setTodoState, etc.
 */
export type SessionCommand =
  | { type: 'flag' }
  | { type: 'unflag' }
  | { type: 'rename'; name: string }
  | { type: 'setTodoState'; state: TodoState }
  | { type: 'markRead' }
  | { type: 'markUnread' }
  /** Track which session user is actively viewing (for unread state machine) */
  | { type: 'setActiveViewing'; workspaceId: string }
  | { type: 'setPermissionMode'; mode: PermissionMode }
  | { type: 'setThinkingLevel'; level: ThinkingLevel }
  | { type: 'updateWorkingDirectory'; dir: string }
  | { type: 'setSources'; sourceSlugs: string[] }
  | { type: 'setLabels'; labels: string[] }
  | { type: 'showInFinder' }
  | { type: 'copyPath' }
  | { type: 'shareToViewer' }
  | { type: 'updateShare' }
  | { type: 'revokeShare' }
  | { type: 'startOAuth'; requestId: string }
  | { type: 'refreshTitle' }
  // Pending plan execution (Accept & Compact flow)
  | { type: 'setPendingPlanExecution'; planPath: string }
  | { type: 'markCompactionComplete' }
  | { type: 'clearPendingPlanExecution' }

/**
 * Parameters for opening a new chat session
 */
export interface NewChatActionParams {
  /** Text to pre-fill in the input (not sent automatically) */
  input?: string
  /** Session name */
  name?: string
}

// IPC channel names
export const IPC_CHANNELS = {
  // Session management
  GET_SESSIONS: 'sessions:get',
  CREATE_SESSION: 'sessions:create',
  DELETE_SESSION: 'sessions:delete',
  GET_SESSION_MESSAGES: 'sessions:getMessages',
  SEND_MESSAGE: 'sessions:sendMessage',
  CANCEL_PROCESSING: 'sessions:cancel',
  KILL_SHELL: 'sessions:killShell',
  GET_TASK_OUTPUT: 'tasks:getOutput',
  RESPOND_TO_PERMISSION: 'sessions:respondToPermission',
  RESPOND_TO_CREDENTIAL: 'sessions:respondToCredential',

  // Consolidated session command
  SESSION_COMMAND: 'sessions:command',

  // Pending plan execution (for reload recovery)
  GET_PENDING_PLAN_EXECUTION: 'sessions:getPendingPlanExecution',

  // Workspace management
  GET_WORKSPACES: 'workspaces:get',
  CREATE_WORKSPACE: 'workspaces:create',
  CHECK_WORKSPACE_SLUG: 'workspaces:checkSlug',

  // Window management
  GET_WINDOW_WORKSPACE: 'window:getWorkspace',
  GET_WINDOW_MODE: 'window:getMode',
  OPEN_WORKSPACE: 'window:openWorkspace',
  OPEN_SESSION_IN_NEW_WINDOW: 'window:openSessionInNewWindow',
  SWITCH_WORKSPACE: 'window:switchWorkspace',
  CLOSE_WINDOW: 'window:close',
  // Close request events (main → renderer, for intercepting X button / Cmd+W)
  WINDOW_CLOSE_REQUESTED: 'window:closeRequested',
  WINDOW_CONFIRM_CLOSE: 'window:confirmClose',
  // Traffic light visibility (macOS only - hide when fullscreen overlays are open)
  WINDOW_SET_TRAFFIC_LIGHTS: 'window:setTrafficLights',

  // Events from main to renderer
  SESSION_EVENT: 'session:event',

  // File operations
  READ_FILE: 'file:read',
  OPEN_FILE_DIALOG: 'file:openDialog',
  READ_FILE_ATTACHMENT: 'file:readAttachment',
  STORE_ATTACHMENT: 'file:storeAttachment',
  GENERATE_THUMBNAIL: 'file:generateThumbnail',

  // Filesystem search (for @ mention file selection)
  FS_SEARCH: 'fs:search',
  // Debug logging from renderer → main log file
  DEBUG_LOG: 'debug:log',

  // Session info panel
  GET_SESSION_FILES: 'sessions:getFiles',
  GET_SESSION_NOTES: 'sessions:getNotes',
  SET_SESSION_NOTES: 'sessions:setNotes',
  WATCH_SESSION_FILES: 'sessions:watchFiles', // Start watching session directory
  UNWATCH_SESSION_FILES: 'sessions:unwatchFiles', // Stop watching
  SESSION_FILES_CHANGED: 'sessions:filesChanged', // Event: main → renderer

  // Theme
  GET_SYSTEM_THEME: 'theme:getSystemPreference',
  SYSTEM_THEME_CHANGED: 'theme:systemChanged',

  // System
  GET_VERSIONS: 'system:versions',
  GET_HOME_DIR: 'system:homeDir',
  IS_DEBUG_MODE: 'system:isDebugMode',

  // Auto-update
  UPDATE_CHECK: 'update:check',
  UPDATE_GET_INFO: 'update:getInfo',
  UPDATE_INSTALL: 'update:install',
  UPDATE_DISMISS: 'update:dismiss', // Dismiss update for this version (persists across restarts)
  UPDATE_GET_DISMISSED: 'update:getDismissed', // Get dismissed version
  UPDATE_AVAILABLE: 'update:available', // main → renderer broadcast
  UPDATE_DOWNLOAD_PROGRESS: 'update:downloadProgress', // main → renderer broadcast

  // Shell operations (open external URLs/files)
  OPEN_URL: 'shell:openUrl',
  OPEN_FILE: 'shell:openFile',
  SHOW_IN_FOLDER: 'shell:showInFolder',

  // Menu actions (main → renderer)
  MENU_NEW_CHAT: 'menu:newChat',
  MENU_NEW_WINDOW: 'menu:newWindow',
  MENU_OPEN_SETTINGS: 'menu:openSettings',
  MENU_KEYBOARD_SHORTCUTS: 'menu:keyboardShortcuts',
  // Deep link navigation (main → renderer, for external craftagents:// URLs)
  DEEP_LINK_NAVIGATE: 'deeplink:navigate',

  // Auth
  LOGOUT: 'auth:logout',
  SHOW_LOGOUT_CONFIRMATION: 'auth:showLogoutConfirmation',
  SHOW_DELETE_SESSION_CONFIRMATION: 'auth:showDeleteSessionConfirmation',

  // Onboarding
  ONBOARDING_GET_AUTH_STATE: 'onboarding:getAuthState',
  ONBOARDING_VALIDATE_MCP: 'onboarding:validateMcp',
  ONBOARDING_START_MCP_OAUTH: 'onboarding:startMcpOAuth',
  ONBOARDING_SAVE_CONFIG: 'onboarding:saveConfig',
  // Claude OAuth (two-step flow)
  ONBOARDING_START_CLAUDE_OAUTH: 'onboarding:startClaudeOAuth',
  ONBOARDING_EXCHANGE_CLAUDE_CODE: 'onboarding:exchangeClaudeCode',
  ONBOARDING_HAS_CLAUDE_OAUTH_STATE: 'onboarding:hasClaudeOAuthState',
  ONBOARDING_CLEAR_CLAUDE_OAUTH_STATE: 'onboarding:clearClaudeOAuthState',
  ONBOARDING_IMPORT_CLI_CREDENTIALS: 'onboarding:importCliCredentials',

  // Settings - API Setup
  SETTINGS_GET_API_SETUP: 'settings:getApiSetup',
  SETTINGS_UPDATE_API_SETUP: 'settings:updateApiSetup',
  SETTINGS_TEST_API_CONNECTION: 'settings:testApiConnection',

  // Settings - Model
  SETTINGS_GET_MODEL: 'settings:getModel',
  SETTINGS_SET_MODEL: 'settings:setModel',
  SESSION_GET_MODEL: 'session:getModel',
  SESSION_SET_MODEL: 'session:setModel',

  // Folder dialog (for selecting working directory)
  OPEN_FOLDER_DIALOG: 'dialog:openFolder',

  // User Preferences
  PREFERENCES_READ: 'preferences:read',
  PREFERENCES_WRITE: 'preferences:write',

  // Session Drafts (input text persisted across app restarts)
  DRAFTS_GET: 'drafts:get',
  DRAFTS_SET: 'drafts:set',
  DRAFTS_DELETE: 'drafts:delete',
  DRAFTS_GET_ALL: 'drafts:getAll',

  // Sources (workspace-scoped)
  SOURCES_GET: 'sources:get',
  SOURCES_CREATE: 'sources:create',
  SOURCES_DELETE: 'sources:delete',
  SOURCES_START_OAUTH: 'sources:startOAuth',
  SOURCES_SAVE_CREDENTIALS: 'sources:saveCredentials',
  SOURCES_CHANGED: 'sources:changed',

  // Source permissions config
  SOURCES_GET_PERMISSIONS: 'sources:getPermissions',
  // Workspace permissions config (for Explore mode)
  WORKSPACE_GET_PERMISSIONS: 'workspace:getPermissions',
  // Default permissions from ~/.craft-agent/permissions/default.json
  DEFAULT_PERMISSIONS_GET: 'permissions:getDefaults',
  // Broadcast when default permissions change (file watcher)
  DEFAULT_PERMISSIONS_CHANGED: 'permissions:defaultsChanged',
  // MCP tools listing
  SOURCES_GET_MCP_TOOLS: 'sources:getMcpTools',

  // Skills (workspace-scoped)
  SKILLS_GET: 'skills:get',
  SKILLS_GET_FILES: 'skills:getFiles',
  SKILLS_DELETE: 'skills:delete',
  SKILLS_OPEN_EDITOR: 'skills:openEditor',
  SKILLS_OPEN_FINDER: 'skills:openFinder',
  SKILLS_CHANGED: 'skills:changed',

  // Status management (workspace-scoped)
  STATUSES_LIST: 'statuses:list',
  STATUSES_REORDER: 'statuses:reorder', // Reorder statuses (drag-and-drop)
  STATUSES_CHANGED: 'statuses:changed', // Broadcast event

  // Label management (workspace-scoped)
  LABELS_LIST: 'labels:list',
  LABELS_CREATE: 'labels:create',
  LABELS_DELETE: 'labels:delete',
  LABELS_CHANGED: 'labels:changed', // Broadcast event

  // Views management (workspace-scoped, stored in views.json)
  VIEWS_LIST: 'views:list',
  VIEWS_SAVE: 'views:save',

  // Theme management (cascading: app → workspace)
  THEME_APP_CHANGED: 'theme:appChanged', // Broadcast event

  // Generic workspace image loading/saving (for icons, etc.)
  WORKSPACE_READ_IMAGE: 'workspace:readImage',
  WORKSPACE_WRITE_IMAGE: 'workspace:writeImage',

  // Workspace settings (per-workspace configuration)
  WORKSPACE_SETTINGS_GET: 'workspaceSettings:get',
  WORKSPACE_SETTINGS_UPDATE: 'workspaceSettings:update',

  // Theme (app-level only)
  THEME_GET_APP: 'theme:getApp',
  THEME_GET_PRESETS: 'theme:getPresets',
  THEME_LOAD_PRESET: 'theme:loadPreset',
  THEME_GET_COLOR_THEME: 'theme:getColorTheme',
  THEME_SET_COLOR_THEME: 'theme:setColorTheme',
  THEME_BROADCAST_PREFERENCES: 'theme:broadcastPreferences', // Send preferences to main for broadcast
  THEME_PREFERENCES_CHANGED: 'theme:preferencesChanged', // Broadcast: preferences changed in another window

  // Logo URL resolution (uses Node.js filesystem cache)
  LOGO_GET_URL: 'logo:getUrl',

  // Notifications
  NOTIFICATION_SHOW: 'notification:show',
  NOTIFICATION_NAVIGATE: 'notification:navigate', // Broadcast: { workspaceId, sessionId }
  NOTIFICATION_GET_ENABLED: 'notification:getEnabled',
  NOTIFICATION_SET_ENABLED: 'notification:setEnabled',

  BADGE_UPDATE: 'badge:update',
  BADGE_CLEAR: 'badge:clear',
  BADGE_SET_ICON: 'badge:setIcon',
  BADGE_DRAW: 'badge:draw', // Broadcast: { count: number, iconDataUrl: string }
  WINDOW_FOCUS_STATE: 'window:focusState', // Broadcast: boolean (isFocused)
  WINDOW_GET_FOCUS_STATE: 'window:getFocusState',

  // Git operations
  GET_GIT_BRANCH: 'git:getBranch',

  // Git Bash (Windows)
  GITBASH_CHECK: 'gitbash:check',
  GITBASH_BROWSE: 'gitbash:browse',
  GITBASH_SET_PATH: 'gitbash:setPath',

  // Browser Profiles
  BROWSER_PROFILES_LIST: 'browserProfiles:list',
  BROWSER_PROFILES_GET: 'browserProfiles:get',
  BROWSER_PROFILES_CREATE: 'browserProfiles:create',
  BROWSER_PROFILES_UPDATE: 'browserProfiles:update',
  BROWSER_PROFILES_DELETE: 'browserProfiles:delete',
  BROWSER_PROFILES_LAUNCH: 'browserProfiles:launch',
  BROWSER_PROFILES_STOP: 'browserProfiles:stop',
  BROWSER_PROFILES_REGENERATE_FINGERPRINT:
    'browserProfiles:regenerateFingerprint',
  BROWSER_PROFILES_GET_RUNNING: 'browserProfiles:getRunning',
  BROWSER_PROFILES_BATCH_CREATE: 'browserProfiles:batchCreate',
  BROWSER_PROFILES_GET_MCP_PORT: 'browserProfiles:getMcpPort',

  // Trash
  TRASH_LIST: 'trash:list',
  TRASH_RESTORE: 'trash:restore',
  TRASH_PERMANENT_DELETE: 'trash:permanentDelete',
  TRASH_EMPTY: 'trash:empty',
  TRASH_COUNT: 'trash:count',

  // Cookie Import/Export
  BROWSER_PROFILES_IMPORT_COOKIES: 'browserProfiles:importCookies',
  BROWSER_PROFILES_EXPORT_COOKIES: 'browserProfiles:exportCookies',
  BROWSER_PROFILES_GET_COOKIES: 'browserProfiles:getCookies',

  // Proxy Pool
  PROXY_POOL_LIST: 'proxyPool:list',
  PROXY_POOL_GET: 'proxyPool:get',
  PROXY_POOL_CREATE: 'proxyPool:create',
  PROXY_POOL_UPDATE: 'proxyPool:update',
  PROXY_POOL_DELETE: 'proxyPool:delete',
  PROXY_POOL_IMPORT: 'proxyPool:import',
  PROXY_POOL_CHECK_HEALTH: 'proxyPool:checkHealth',
  PROXY_POOL_CHECK_ALL_HEALTH: 'proxyPool:checkAllHealth',
  PROXY_POOL_GET_PROFILES_USING: 'proxyPool:getProfilesUsing',
  PROXY_POOL_TEST_CONNECTION: 'proxyPool:testConnection',
  PROXY_POOL_DETECT_GEO: 'proxyPool:detectGeo',
  PROXY_POOL_REFRESH_ALL_GEO: 'proxyPool:refreshAllGeo',

  // Network Accelerator (gost)
  ACCELERATOR_LIST: 'accelerator:list',
  ACCELERATOR_GET: 'accelerator:get',
  ACCELERATOR_CREATE: 'accelerator:create',
  ACCELERATOR_UPDATE: 'accelerator:update',
  ACCELERATOR_DELETE: 'accelerator:delete',
  ACCELERATOR_HEALTH_CHECK: 'accelerator:healthCheck',
  ACCELERATOR_SPEED_TEST: 'accelerator:speedTest',
  GOST_AVAILABLE: 'gost:available',

  // Profile Groups
  PROFILE_GROUPS_LIST: 'profileGroups:list',
  PROFILE_GROUPS_GET: 'profileGroups:get',
  PROFILE_GROUPS_CREATE: 'profileGroups:create',
  PROFILE_GROUPS_UPDATE: 'profileGroups:update',
  PROFILE_GROUPS_DELETE: 'profileGroups:delete',
  PROFILE_GROUPS_GET_PROFILES: 'profileGroups:getProfiles',
  PROFILE_GROUPS_MOVE_PROFILE: 'profileGroups:moveProfile',

  // Profile Templates
  PROFILE_TEMPLATES_LIST: 'profileTemplates:list',
  PROFILE_TEMPLATES_GET: 'profileTemplates:get',
  PROFILE_TEMPLATES_CREATE: 'profileTemplates:create',
  PROFILE_TEMPLATES_UPDATE: 'profileTemplates:update',
  PROFILE_TEMPLATES_DELETE: 'profileTemplates:delete',
  PROFILE_TEMPLATES_CREATE_PROFILE: 'profileTemplates:createProfile',
  PROFILE_TEMPLATES_BATCH_CREATE: 'profileTemplates:batchCreate',

  // Migration
  BROWSER_PROFILES_MIGRATE: 'browserProfiles:migrate',
  BROWSER_PROFILES_NEEDS_MIGRATION: 'browserProfiles:needsMigration',

  // Browser Settings
  BROWSER_SETTINGS_GET: 'browserSettings:get',
  BROWSER_SETTINGS_SET: 'browserSettings:set',
  BROWSER_SETTINGS_CLEAR: 'browserSettings:clear',
  BROWSER_SETTINGS_LIST_AVAILABLE: 'browserSettings:listAvailable',

  // Team Management
  TEAM_LOGIN: 'team:login',
  TEAM_LOGOUT: 'team:logout',
  TEAM_GET_SESSION: 'team:getSession',
  TEAM_ORG_LIST: 'team:orgList',
  TEAM_ORG_CREATE: 'team:orgCreate',
  TEAM_ORG_UPDATE: 'team:orgUpdate',
  TEAM_ORG_GET: 'team:orgGet',
  TEAM_MEMBER_LIST: 'team:memberList',
  TEAM_MEMBER_CREATE: 'team:memberCreate',
  TEAM_MEMBER_UPDATE: 'team:memberUpdate',
  TEAM_MEMBER_DELETE: 'team:memberDelete',
  TEAM_MEMBER_GET: 'team:memberGet',
  TEAM_PROFILE_ASSIGNMENT_LIST: 'team:profileAssignmentList',
  TEAM_PROFILE_ASSIGNMENT_CREATE: 'team:profileAssignmentCreate',
  TEAM_PROFILE_ASSIGNMENT_DELETE: 'team:profileAssignmentDelete',
  TEAM_GROUP_ASSIGNMENT_LIST: 'team:groupAssignmentList',
  TEAM_GROUP_ASSIGNMENT_CREATE: 'team:groupAssignmentCreate',
  TEAM_GROUP_ASSIGNMENT_DELETE: 'team:groupAssignmentDelete',
  TEAM_ACTIVITY_LOG_LIST: 'team:activityLogList',
  TEAM_SETUP_CHECK: 'team:setupCheck',
  TEAM_SETUP_ORG: 'team:setupOrg',

  // Menu actions (renderer → main for window/app control)
  MENU_QUIT: 'menu:quit',
  MENU_MINIMIZE: 'menu:minimize',
  MENU_MAXIMIZE: 'menu:maximize',
  MENU_ZOOM_IN: 'menu:zoomIn',
  MENU_ZOOM_OUT: 'menu:zoomOut',
  MENU_ZOOM_RESET: 'menu:zoomReset',
  MENU_TOGGLE_DEVTOOLS: 'menu:toggleDevTools',
  MENU_UNDO: 'menu:undo',
  MENU_REDO: 'menu:redo',
  MENU_CUT: 'menu:cut',
  MENU_COPY: 'menu:copy',
  MENU_PASTE: 'menu:paste',
  MENU_SELECT_ALL: 'menu:selectAll',
} as const

// Re-import types for ElectronAPI
import type {
  StoredAttachment as StoredAttachmentType,
  Workspace,
} from '@craft-agent/core/types'

// Type-safe IPC API exposed to renderer
export interface ElectronAPI {
  // Session management
  getSessions(): Promise<Session[]>
  getSessionMessages(sessionId: string): Promise<Session | null>
  createSession(
    workspaceId: string,
    options?: CreateSessionOptions,
  ): Promise<Session>
  deleteSession(sessionId: string): Promise<void>
  sendMessage(
    sessionId: string,
    message: string,
    attachments?: FileAttachment[],
    storedAttachments?: StoredAttachmentType[],
    options?: SendMessageOptions,
  ): Promise<void>
  cancelProcessing(sessionId: string, silent?: boolean): Promise<void>
  killShell(
    sessionId: string,
    shellId: string,
  ): Promise<{ success: boolean; error?: string }>
  getTaskOutput(taskId: string): Promise<string | null>
  respondToPermission(
    sessionId: string,
    requestId: string,
    allowed: boolean,
    alwaysAllow: boolean,
  ): Promise<boolean>
  respondToCredential(
    sessionId: string,
    requestId: string,
    response: CredentialResponse,
  ): Promise<boolean>

  // Consolidated session command handler
  sessionCommand(
    sessionId: string,
    command: SessionCommand,
  ): Promise<undefined | ShareResult | RefreshTitleResult>

  // Pending plan execution (for reload recovery)
  getPendingPlanExecution(
    sessionId: string,
  ): Promise<{ planPath: string; awaitingCompaction: boolean } | null>

  // Workspace management
  getWorkspaces(): Promise<Workspace[]>
  createWorkspace(folderPath: string, name: string): Promise<Workspace>
  checkWorkspaceSlug(slug: string): Promise<{ exists: boolean; path: string }>

  // Window management
  getWindowWorkspace(): Promise<string | null>
  getWindowMode(): Promise<string | null>
  openWorkspace(workspaceId: string): Promise<void>
  openSessionInNewWindow(workspaceId: string, sessionId: string): Promise<void>
  switchWorkspace(workspaceId: string): Promise<void>
  closeWindow(): Promise<void>
  confirmCloseWindow(): Promise<void>
  /** Listen for close requests (X button, Cmd+W). Returns cleanup function. */
  onCloseRequested(callback: () => void): () => void
  /** Show/hide macOS traffic light buttons (for fullscreen overlays) */
  setTrafficLightsVisible(visible: boolean): Promise<void>

  // Event listeners
  onSessionEvent(callback: (event: SessionEvent) => void): () => void

  // File operations
  readFile(path: string): Promise<string>
  openFileDialog(): Promise<string[]>
  readFileAttachment(path: string): Promise<FileAttachment | null>
  storeAttachment(
    sessionId: string,
    attachment: FileAttachment,
  ): Promise<
    import('../../../../packages/core/src/types/index.ts').StoredAttachment
  >
  generateThumbnail(base64: string, mimeType: string): Promise<string | null>

  // Filesystem search (for @ mention file selection)
  searchFiles(basePath: string, query: string): Promise<FileSearchResult[]>
  // Debug: send renderer logs to main process log file
  debugLog(...args: unknown[]): void

  // Theme
  getSystemTheme(): Promise<boolean>
  onSystemThemeChange(callback: (isDark: boolean) => void): () => void

  // System
  getVersions(): { node: string; chrome: string; electron: string }
  getHomeDir(): Promise<string>
  isDebugMode(): Promise<boolean>

  // Auto-update
  checkForUpdates(): Promise<UpdateInfo>
  getUpdateInfo(): Promise<UpdateInfo>
  installUpdate(): Promise<void>
  dismissUpdate(version: string): Promise<void>
  getDismissedUpdateVersion(): Promise<string | null>
  onUpdateAvailable(callback: (info: UpdateInfo) => void): () => void
  onUpdateDownloadProgress(callback: (progress: number) => void): () => void

  // Shell operations
  openUrl(url: string): Promise<void>
  openFile(path: string): Promise<void>
  showInFolder(path: string): Promise<void>

  // Menu event listeners
  onMenuNewChat(callback: () => void): () => void
  onMenuOpenSettings(callback: () => void): () => void
  onMenuKeyboardShortcuts(callback: () => void): () => void

  // Deep link navigation listener (for external craftagents:// URLs)
  onDeepLinkNavigate(callback: (nav: DeepLinkNavigation) => void): () => void

  // Auth
  showLogoutConfirmation(): Promise<boolean>
  showDeleteSessionConfirmation(name: string): Promise<boolean>
  logout(): Promise<void>

  // Onboarding
  getAuthState(): Promise<AuthState>
  getSetupNeeds(): Promise<SetupNeeds>
  startWorkspaceMcpOAuth(
    mcpUrl: string,
  ): Promise<OAuthResult & { accessToken?: string; clientId?: string }>
  saveOnboardingConfig(config: {
    authType?: AuthType // Optional - if not provided, preserves existing auth type (for add workspace)
    workspace?: { name: string; iconUrl?: string; mcpUrl?: string } // Optional - if not provided, only updates billing
    credential?: string // API key or OAuth token based on authType
    mcpCredentials?: { accessToken: string; clientId?: string } // MCP OAuth credentials
    anthropicBaseUrl?: string | null // Custom Anthropic API base URL
    customModel?: string | null // Custom model ID override
  }): Promise<OnboardingSaveResult>
  // Claude OAuth (two-step flow)
  startClaudeOAuth(): Promise<{
    success: boolean
    authUrl?: string
    error?: string
  }>
  exchangeClaudeCode(code: string): Promise<ClaudeOAuthResult>
  hasClaudeOAuthState(): Promise<boolean>
  clearClaudeOAuthState(): Promise<{ success: boolean }>
  importCliCredentials(): Promise<{
    success: boolean
    token?: string
    error?: string
  }>

  // Settings - API Setup
  getApiSetup(): Promise<ApiSetupInfo>
  updateApiSetup(
    authType: AuthType,
    credential?: string,
    anthropicBaseUrl?: string | null,
    customModel?: string | null,
  ): Promise<void>
  testApiConnection(
    apiKey: string,
    baseUrl?: string,
    modelName?: string,
  ): Promise<{ success: boolean; error?: string; modelCount?: number }>

  // Settings - Model (global default)
  getModel(): Promise<string | null>
  setModel(model: string): Promise<void>
  // Session-specific model (overrides global)
  getSessionModel(
    sessionId: string,
    workspaceId: string,
  ): Promise<string | null>
  setSessionModel(
    sessionId: string,
    workspaceId: string,
    model: string | null,
  ): Promise<void>

  // Workspace Settings (per-workspace configuration)
  getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings | null>
  updateWorkspaceSetting<K extends keyof WorkspaceSettings>(
    workspaceId: string,
    key: K,
    value: WorkspaceSettings[K],
  ): Promise<void>

  // Folder dialog
  openFolderDialog(): Promise<string | null>

  // User Preferences
  readPreferences(): Promise<{ content: string; exists: boolean; path: string }>
  writePreferences(
    content: string,
  ): Promise<{ success: boolean; error?: string }>

  // Session Drafts (persisted input text)
  getDraft(sessionId: string): Promise<string | null>
  setDraft(sessionId: string, text: string): Promise<void>
  deleteDraft(sessionId: string): Promise<void>
  getAllDrafts(): Promise<Record<string, string>>

  // Session Info Panel
  getSessionFiles(sessionId: string): Promise<SessionFile[]>
  getSessionNotes(sessionId: string): Promise<string>
  setSessionNotes(sessionId: string, content: string): Promise<void>
  watchSessionFiles(sessionId: string): Promise<void>
  unwatchSessionFiles(): Promise<void>
  onSessionFilesChanged(callback: (sessionId: string) => void): () => void

  // Sources
  getSources(workspaceId: string): Promise<LoadedSource[]>
  createSource(
    workspaceId: string,
    config: Partial<FolderSourceConfig>,
  ): Promise<FolderSourceConfig>
  deleteSource(workspaceId: string, sourceSlug: string): Promise<void>
  startSourceOAuth(
    workspaceId: string,
    sourceSlug: string,
  ): Promise<{ success: boolean; error?: string; accessToken?: string }>
  saveSourceCredentials(
    workspaceId: string,
    sourceSlug: string,
    credential: string,
  ): Promise<void>
  getSourcePermissionsConfig(
    workspaceId: string,
    sourceSlug: string,
  ): Promise<PermissionsConfigFile | null>
  getWorkspacePermissionsConfig(
    workspaceId: string,
  ): Promise<PermissionsConfigFile | null>
  getDefaultPermissionsConfig(): Promise<{
    config: PermissionsConfigFile | null
    path: string
  }>
  getMcpTools(workspaceId: string, sourceSlug: string): Promise<McpToolsResult>

  // Sources change listener (live updates when sources are added/removed)
  onSourcesChanged(callback: (sources: LoadedSource[]) => void): () => void

  // Default permissions change listener (live updates when default.json changes)
  onDefaultPermissionsChanged(callback: () => void): () => void

  // Skills
  getSkills(workspaceId: string): Promise<LoadedSkill[]>
  getSkillFiles?(workspaceId: string, skillSlug: string): Promise<SkillFile[]>
  deleteSkill(workspaceId: string, skillSlug: string): Promise<void>
  openSkillInEditor(workspaceId: string, skillSlug: string): Promise<void>
  openSkillInFinder(workspaceId: string, skillSlug: string): Promise<void>

  // Skills change listener (live updates when skills are added/removed/modified)
  onSkillsChanged(callback: (skills: LoadedSkill[]) => void): () => void

  // Statuses (workspace-scoped)
  listStatuses(
    workspaceId: string,
  ): Promise<import('@craft-agent/shared/statuses').StatusConfig[]>
  reorderStatuses(workspaceId: string, orderedIds: string[]): Promise<void>
  // Statuses change listener (live updates when statuses config or icon files change)
  onStatusesChanged(callback: (workspaceId: string) => void): () => void

  // Labels (workspace-scoped)
  listLabels(
    workspaceId: string,
  ): Promise<import('@craft-agent/shared/labels').LabelConfig[]>
  createLabel(
    workspaceId: string,
    input: import('@craft-agent/shared/labels').CreateLabelInput,
  ): Promise<import('@craft-agent/shared/labels').LabelConfig>
  deleteLabel(
    workspaceId: string,
    labelId: string,
  ): Promise<{ stripped: number }>
  // Labels change listener (live updates when labels config changes)
  onLabelsChanged(callback: (workspaceId: string) => void): () => void

  // Views (workspace-scoped, stored in views.json)
  listViews(
    workspaceId: string,
  ): Promise<import('@craft-agent/shared/views').ViewConfig[]>
  saveViews(
    workspaceId: string,
    views: import('@craft-agent/shared/views').ViewConfig[],
  ): Promise<void>

  // Generic workspace image loading/saving (returns data URL for images, raw string for SVG)
  readWorkspaceImage(workspaceId: string, relativePath: string): Promise<string>
  writeWorkspaceImage(
    workspaceId: string,
    relativePath: string,
    base64: string,
    mimeType: string,
  ): Promise<void>

  // Theme (app-level only)
  getAppTheme(): Promise<import('@config/theme').ThemeOverrides | null>
  // Preset themes (app-level)
  loadPresetThemes(): Promise<import('@config/theme').PresetTheme[]>
  loadPresetTheme(
    themeId: string,
  ): Promise<import('@config/theme').PresetTheme | null>
  getColorTheme(): Promise<string>
  setColorTheme(themeId: string): Promise<void>

  // Theme change listeners (live updates when theme.json files change)
  onAppThemeChange(
    callback: (theme: import('@config/theme').ThemeOverrides | null) => void,
  ): () => void

  // Logo URL resolution (uses Node.js filesystem cache for provider domains)
  getLogoUrl(serviceUrl: string, provider?: string): Promise<string | null>

  // Notifications
  showNotification(
    title: string,
    body: string,
    workspaceId: string,
    sessionId: string,
  ): Promise<void>
  getNotificationsEnabled(): Promise<boolean>
  setNotificationsEnabled(enabled: boolean): Promise<void>

  updateBadgeCount(count: number): Promise<void>
  clearBadgeCount(): Promise<void>
  setDockIconWithBadge(dataUrl: string): Promise<void>
  onBadgeDraw(
    callback: (data: { count: number; iconDataUrl: string }) => void,
  ): () => void
  getWindowFocusState(): Promise<boolean>
  onWindowFocusChange(callback: (isFocused: boolean) => void): () => void
  onNotificationNavigate(
    callback: (data: { workspaceId: string; sessionId: string }) => void,
  ): () => void

  // Theme preferences sync across windows (mode, colorTheme, font)
  broadcastThemePreferences(preferences: {
    mode: string
    colorTheme: string
    font: string
  }): Promise<void>
  onThemePreferencesChange(
    callback: (preferences: {
      mode: string
      colorTheme: string
      font: string
    }) => void,
  ): () => void

  // Git operations
  getGitBranch(dirPath: string): Promise<string | null>

  // Git Bash (Windows)
  checkGitBash(): Promise<GitBashStatus>
  browseForGitBash(): Promise<string | null>
  setGitBashPath(path: string): Promise<{ success: boolean; error?: string }>

  // Browser Profiles
  listBrowserProfiles(): Promise<BrowserProfileConfig[]>
  getBrowserProfile(profileId: string): Promise<BrowserProfileConfig | null>
  createBrowserProfile(input: CreateProfileInput): Promise<BrowserProfileConfig>
  updateBrowserProfile(
    profileId: string,
    input: UpdateProfileInput,
  ): Promise<BrowserProfileConfig | null>
  deleteBrowserProfile(profileId: string): Promise<boolean>
  launchBrowserProfile(profileId: string): Promise<LaunchResult>
  stopBrowserProfile(profileId: string): Promise<boolean>
  regenerateBrowserFingerprint(
    profileId: string,
    options?: {
      targetPlatform?: 'windows' | 'macos' | 'linux'
      targetRegion?: 'us' | 'eu' | 'asia' | 'oceania'
    },
  ): Promise<BrowserProfileConfig | null>
  getRunningBrowserProfiles(): Promise<string[]>
  getBrowserProfileMcpPort(profileId: string): Promise<number>
  batchCreateBrowserProfiles(
    inputs: CreateProfileInput[],
  ): Promise<BrowserProfileConfig[]>

  // Trash
  listTrashItems(): Promise<
    import('@craft-agent/shared/browser-profiles').TrashItem[]
  >
  restoreTrashProfile(profileId: string): Promise<boolean>
  permanentDeleteTrashProfile(profileId: string): Promise<boolean>
  emptyTrash(): Promise<number>
  getTrashCount(): Promise<number>

  // Cookie Import/Export
  importCookies(
    profileId: string,
    cookiesText: string,
    format: 'json' | 'netscape',
  ): Promise<{ saved: number }>
  exportCookies(
    profileId: string,
    format: 'json' | 'netscape',
    cdpPort?: number,
  ): Promise<string>
  getCookies(
    profileId: string,
  ): Promise<import('@craft-agent/shared/browser-profiles').CookieItem[]>

  // Proxy Pool
  listProxies(): Promise<SavedProxy[]>
  getProxy(proxyId: string): Promise<SavedProxy | null>
  createProxy(input: CreateProxyInput): Promise<SavedProxy>
  updateProxy(
    proxyId: string,
    input: UpdateProxyInput,
  ): Promise<SavedProxy | null>
  deleteProxy(proxyId: string): Promise<boolean>
  importProxies(
    lines: string[],
    options?: {
      defaultType?: 'socks5' | 'http' | 'https'
      tags?: string[]
      region?: string
      provider?: string
    },
  ): Promise<ProxyImportResult>
  checkProxyHealth(proxyId: string): Promise<ProxyHealthResult>
  checkAllProxiesHealth(): Promise<ProxyHealthResult[]>
  getProfilesUsingProxy(proxyId: string): Promise<string[]>
  testProxyConnection(config: { host: string; port: number }): Promise<{
    success: boolean
    responseTimeMs?: number
    errorMessage?: string
  }>
  detectProxyGeoLocation(proxyId: string): Promise<GeoLocation | null>
  refreshAllProxiesGeoLocation(): Promise<{
    total: number
    success: number
    failed: number
  }>

  // Network Accelerator (gost)
  listAccelerators(): Promise<AcceleratorNode[]>
  getAccelerator(id: string): Promise<AcceleratorNode | null>
  createAccelerator(input: CreateAcceleratorInput): Promise<AcceleratorNode>
  updateAccelerator(
    id: string,
    input: UpdateAcceleratorInput,
  ): Promise<AcceleratorNode | null>
  deleteAccelerator(id: string): Promise<boolean>
  checkAcceleratorHealth(id: string): Promise<AcceleratorHealthResult>
  runAcceleratorSpeedTest(options: {
    proxyId: string
    acceleratorId?: string
    testUrl?: string
  }): Promise<ProxySpeedTestResult>
  isGostAvailable(): Promise<boolean>

  // Profile Groups
  listProfileGroups(): Promise<ProfileGroup[]>
  getProfileGroup(groupId: string): Promise<ProfileGroup | null>
  createProfileGroup(input: CreateGroupInput): Promise<ProfileGroup>
  updateProfileGroup(
    groupId: string,
    input: UpdateGroupInput,
  ): Promise<ProfileGroup | null>
  deleteProfileGroup(groupId: string): Promise<boolean>
  getProfilesInGroup(groupId: string): Promise<BrowserProfileConfig[]>
  moveProfileToGroup(
    profileId: string,
    groupId: string | undefined,
  ): Promise<boolean>

  // Profile Templates
  listProfileTemplates(): Promise<ProfileTemplate[]>
  getProfileTemplate(templateId: string): Promise<ProfileTemplate | null>
  createProfileTemplate(input: CreateTemplateInput): Promise<ProfileTemplate>
  updateProfileTemplate(
    templateId: string,
    input: UpdateTemplateInput,
  ): Promise<ProfileTemplate | null>
  deleteProfileTemplate(templateId: string): Promise<boolean>
  createProfileFromTemplate(
    templateId: string,
    overrides?: Partial<CreateProfileInput>,
  ): Promise<BrowserProfileConfig>
  batchCreateFromTemplate(
    templateId: string,
    count: number,
    options?: { namePrefix?: string; groupId?: string; proxyIds?: string[] },
  ): Promise<BrowserProfileConfig[]>

  // Migration
  migrateToProxyPool(): Promise<{
    migratedProfiles: number
    uniqueProxies: number
    skippedProfiles: number
    errors: Array<{ profileId: string; error: string }>
  }>
  needsProxyPoolMigration(): Promise<boolean>

  // Browser Settings
  getBrowserSettings(): Promise<BrowserConfig>
  setBrowserSettings(
    path: string,
    options?: { browserType?: BrowserType; useCustomPathOnly?: boolean },
  ): Promise<void>
  clearBrowserSettings(): Promise<void>
  listAvailableBrowsers(): Promise<AvailableBrowser[]>

  // Team Management
  teamLogin(input: LoginInput): Promise<LoginResult>
  teamLogout(): Promise<void>
  teamGetSession(): Promise<{
    member: Omit<Member, 'passwordHash'>
    organization: Organization
  } | null>
  teamListOrgs(): Promise<Organization[]>
  teamCreateOrg(
    input: CreateOrganizationInput & {
      adminEmail: string
      adminPassword: string
      adminName: string
    },
  ): Promise<{
    organization: Organization
    member: Omit<Member, 'passwordHash'>
  }>
  teamUpdateOrg(
    orgId: string,
    input: UpdateOrganizationInput,
  ): Promise<Organization | null>
  teamGetOrg(orgId: string): Promise<Organization | null>
  teamListMembers(orgId: string): Promise<Omit<Member, 'passwordHash'>[]>
  teamCreateMember(
    input: CreateMemberInput,
  ): Promise<Omit<Member, 'passwordHash'>>
  teamUpdateMember(
    memberId: string,
    input: UpdateMemberInput,
  ): Promise<Omit<Member, 'passwordHash'> | null>
  teamDeleteMember(memberId: string): Promise<boolean>
  teamGetMember(memberId: string): Promise<Omit<Member, 'passwordHash'> | null>
  teamListProfileAssignments(
    orgId: string,
    filters?: { memberId?: string; profileId?: string },
  ): Promise<ProfileAssignment[]>
  teamCreateProfileAssignment(
    input: CreateProfileAssignmentInput,
  ): Promise<ProfileAssignment>
  teamDeleteProfileAssignment(
    assignmentId: string,
    context?: { orgId: string; memberId: string },
  ): Promise<boolean>
  teamListGroupAssignments(
    orgId: string,
    filters?: { memberId?: string; groupId?: string },
  ): Promise<GroupAssignment[]>
  teamCreateGroupAssignment(
    input: CreateGroupAssignmentInput,
    context?: { actorMemberId: string },
  ): Promise<GroupAssignment>
  teamDeleteGroupAssignment(
    assignmentId: string,
    context?: { orgId: string; memberId: string },
  ): Promise<boolean>
  teamListActivityLogs(
    orgId: string,
    filters?: {
      memberId?: string
      action?: string
      limit?: number
      offset?: number
    },
  ): Promise<ActivityLog[]>
  teamSetupCheck(): Promise<{ needsSetup: boolean; hasOrgs: boolean }>
  teamSetupOrg(
    input: CreateOrganizationInput & {
      adminEmail: string
      adminPassword: string
      adminName: string
    },
  ): Promise<{
    organization: Organization
    member: Omit<Member, 'passwordHash'>
    token: string
  }>

  // Menu actions (from renderer to main)
  menuQuit(): Promise<void>
  menuNewWindow(): Promise<void>
  menuMinimize(): Promise<void>
  menuMaximize(): Promise<void>
  menuZoomIn(): Promise<void>
  menuZoomOut(): Promise<void>
  menuZoomReset(): Promise<void>
  menuToggleDevTools(): Promise<void>
  menuUndo(): Promise<void>
  menuRedo(): Promise<void>
  menuCut(): Promise<void>
  menuCopy(): Promise<void>
  menuPaste(): Promise<void>
  menuSelectAll(): Promise<void>
}

/**
 * Result from Claude OAuth (setup-token) flow
 */
export interface ClaudeOAuthResult {
  success: boolean
  token?: string
  error?: string
}

/**
 * Current API setup info for settings
 */
export interface ApiSetupInfo {
  authType: AuthType
  hasCredential: boolean
  apiKey?: string // The stored API key (only returned for api_key auth type)
  anthropicBaseUrl?: string // Custom Anthropic API base URL (for third-party compatible APIs)
  customModel?: string // Custom model ID override (for third-party APIs)
}

/**
 * Auto-update information
 */
export interface UpdateInfo {
  /** Whether an update is available */
  available: boolean
  /** Current installed version */
  currentVersion: string
  /** Latest available version (null if check failed) */
  latestVersion: string | null
  /** Download state */
  downloadState: 'idle' | 'downloading' | 'ready' | 'installing' | 'error'
  /** Download progress (0-100) */
  downloadProgress: number
  /** Error message if download/install failed */
  error?: string
}

/**
 * Per-workspace settings
 */
export interface WorkspaceSettings {
  name?: string
  model?: string
  permissionMode?: PermissionMode
  /** Permission modes available for SHIFT+TAB cycling (min 2 modes) */
  cyclablePermissionModes?: PermissionMode[]
  /** Default thinking level for new sessions ('off', 'think', 'max'). Defaults to 'think'. */
  thinkingLevel?: ThinkingLevel
  workingDirectory?: string
  /** Whether local (stdio) MCP servers are enabled */
  localMcpEnabled?: boolean
}

/**
 * Navigation payload for deep links (main → renderer)
 */
export interface DeepLinkNavigation {
  /** Compound route format (e.g., 'allChats/chat/abc123', 'settings/shortcuts') */
  view?: string
  /** Tab type */
  tabType?: string
  tabParams?: Record<string, string>
  action?: string
  actionParams?: Record<string, string>
}

// ============================================
// Unified Navigation State Types
// ============================================

/**
 * Right sidebar panel types
 * Defines the content displayed in the right sidebar
 */
export type RightSidebarPanel =
  | { type: 'sessionMetadata' }
  | { type: 'files'; path?: string }
  | { type: 'history' }
  | { type: 'none' }

/**
 * Chat filter options - determines which sessions to show
 * - 'allChats': All sessions regardless of status
 * - 'flagged': Only flagged sessions
 * - 'state': Sessions with specific status ID
 * - 'label': Sessions with specific label (includes descendants via tree hierarchy)
 */
export type ChatFilter =
  | { kind: 'allChats' }
  | { kind: 'flagged' }
  | { kind: 'state'; stateId: string }
  | { kind: 'label'; labelId: string }
  | { kind: 'view'; viewId: string }

/**
 * Settings subpage options
 */
export type SettingsSubpage =
  | 'app'
  | 'workspace'
  | 'permissions'
  | 'labels'
  | 'shortcuts'
  | 'preferences'

/**
 * Chats navigation state - shows SessionList in navigator
 */
export interface ChatsNavigationState {
  navigator: 'chats'
  filter: ChatFilter
  /** Selected chat details, or null for empty state */
  details: { type: 'chat'; sessionId: string } | null
  /** Optional right sidebar panel state */
  rightSidebar?: RightSidebarPanel
}

/**
 * Source type filter for sources navigation (e.g., show only APIs, MCPs, or Local sources)
 */
export interface SourceFilter {
  kind: 'type'
  sourceType: 'api' | 'mcp' | 'local'
}

/**
 * Sources navigation state - shows SourcesListPanel in navigator
 */
export interface SourcesNavigationState {
  navigator: 'sources'
  /** Optional filter for source type */
  filter?: SourceFilter
  /** Selected source details, or null for empty state */
  details: { type: 'source'; sourceSlug: string } | null
  /** Optional right sidebar panel state */
  rightSidebar?: RightSidebarPanel
}

/**
 * Settings navigation state - shows SettingsNavigator in navigator
 * Settings subpages are the details themselves (no separate selection)
 */
export interface SettingsNavigationState {
  navigator: 'settings'
  subpage: SettingsSubpage
  /** Optional right sidebar panel state */
  rightSidebar?: RightSidebarPanel
}

/**
 * Skills navigation state - shows SkillsListPanel in navigator
 */
export interface SkillsNavigationState {
  navigator: 'skills'
  /** Selected skill details, or null for empty state */
  details: { type: 'skill'; skillSlug: string } | null
  /** Optional right sidebar panel state */
  rightSidebar?: RightSidebarPanel
}

/**
 * Browser Profiles navigation state - shows BrowserProfileList in main panel
 */
export interface BrowserProfilesNavigationState {
  navigator: 'browser-profiles'
  /** Selected profile details, or null for list view */
  details: { type: 'profile'; profileId: string } | null
  /** Optional right sidebar panel state */
  rightSidebar?: RightSidebarPanel
}

/**
 * Connectors navigation state - shows ConnectorsList in main panel
 */
export interface ConnectorsNavigationState {
  navigator: 'connectors'
  /** Selected connector details, or null for list view */
  details: { type: 'connector'; connectorId: string } | null
  /** Optional right sidebar panel state */
  rightSidebar?: RightSidebarPanel
}

/**
 * Team subpage options
 */
export type TeamSubpageType =
  | 'my-profile'
  | 'members'
  | 'roles'
  | 'activity-log'
  | 'org-settings'

/**
 * Team navigation state - shows team management pages
 */
export interface TeamNavigationState {
  navigator: 'team'
  subpage: TeamSubpageType
  /** Selected member details, or null for list view */
  details: { type: 'member'; memberId: string } | null
  /** Optional right sidebar panel state */
  rightSidebar?: RightSidebarPanel
}

/**
 * Dashboard navigation state - main overview page
 */
export interface DashboardNavigationState {
  navigator: 'dashboard'
  rightSidebar?: RightSidebarPanel
}

/**
 * Proxies navigation state - proxy pool management page
 */
export interface ProxiesNavigationState {
  navigator: 'proxies'
  details: { type: 'proxy'; proxyId: string } | null
  rightSidebar?: RightSidebarPanel
}

/**
 * Agent navigation state - AI assistant page
 */
export interface AgentNavigationState {
  navigator: 'agent'
  rightSidebar?: RightSidebarPanel
}

/**
 * Tasks navigation state - task queue page
 */
export interface TasksNavigationState {
  navigator: 'tasks'
  details: { type: 'task'; taskId: string } | null
  rightSidebar?: RightSidebarPanel
}

/**
 * Unified navigation state - single source of truth for all 3 panels
 *
 * From this state we can derive:
 * - LeftSidebar: which item is highlighted (from navigator + filter/subpage)
 * - NavigatorPanel: which list/content to show (from navigator)
 * - MainContentPanel: what details to display (from details or subpage)
 */
export type NavigationState =
  | DashboardNavigationState
  | BrowserProfilesNavigationState
  | ProxiesNavigationState
  | AgentNavigationState
  | TasksNavigationState
  | TeamNavigationState
  | SettingsNavigationState

/**
 * Type guard to check if state is dashboard navigation
 */
export const isDashboardNavigation = (
  state: NavigationState,
): state is DashboardNavigationState => state.navigator === 'dashboard'

/**
 * Type guard to check if state is browser profiles navigation
 */
export const isBrowserProfilesNavigation = (
  state: NavigationState,
): state is BrowserProfilesNavigationState =>
  state.navigator === 'browser-profiles'

/**
 * Type guard to check if state is proxies navigation
 */
export const isProxiesNavigation = (
  state: NavigationState,
): state is ProxiesNavigationState => state.navigator === 'proxies'

/**
 * Type guard to check if state is agent navigation
 */
export const isAgentNavigation = (
  state: NavigationState,
): state is AgentNavigationState => state.navigator === 'agent'

/**
 * Type guard to check if state is tasks navigation
 */
export const isTasksNavigation = (
  state: NavigationState,
): state is TasksNavigationState => state.navigator === 'tasks'

/**
 * Type guard to check if state is team navigation
 */
export const isTeamNavigation = (
  state: NavigationState,
): state is TeamNavigationState => state.navigator === 'team'

/**
 * Type guard to check if state is settings navigation
 */
export const isSettingsNavigation = (
  state: NavigationState,
): state is SettingsNavigationState => state.navigator === 'settings'

/**
 * @deprecated - Chats navigation removed; kept for backward compatibility
 */
export const isChatsNavigation = (
  state: any,
): state is ChatsNavigationState => state.navigator === 'chats'

/**
 * @deprecated - Sources navigation removed; kept for backward compatibility
 */
export const isSourcesNavigation = (
  state: any,
): state is SourcesNavigationState => state.navigator === 'sources'

/**
 * @deprecated - Skills navigation removed; kept for backward compatibility
 */
export const isSkillsNavigation = (
  state: any,
): state is SkillsNavigationState => state.navigator === 'skills'

/**
 * @deprecated - Connectors navigation removed; kept for backward compatibility
 */
export const isConnectorsNavigation = (
  state: any,
): state is ConnectorsNavigationState => state.navigator === 'connectors'

/**
 * Default navigation state - dashboard
 */
export const DEFAULT_NAVIGATION_STATE: NavigationState = {
  navigator: 'dashboard',
}

/**
 * Get a persistence key for localStorage from NavigationState
 */
export const getNavigationStateKey = (state: NavigationState): string => {
  if (state.navigator === 'dashboard') {
    return 'dashboard'
  }
  if (state.navigator === 'browser-profiles') {
    if (state.details) {
      return `browser-profiles/profile/${state.details.profileId}`
    }
    return 'browser-profiles'
  }
  if (state.navigator === 'proxies') {
    if (state.details) {
      return `proxies/proxy/${state.details.proxyId}`
    }
    return 'proxies'
  }
  if (state.navigator === 'agent') {
    return 'agent'
  }
  if (state.navigator === 'tasks') {
    if (state.details) {
      return `tasks/task/${state.details.taskId}`
    }
    return 'tasks'
  }
  if (state.navigator === 'team') {
    if (state.details) {
      return `team/member/${state.details.memberId}`
    }
    return state.subpage === 'members' ? 'team' : `team:${state.subpage}`
  }
  if (state.navigator === 'settings') {
    return `settings:${state.subpage}`
  }
  return 'dashboard'
}

/**
 * Parse a persistence key back to NavigationState
 * Returns null if the key is invalid
 */
export const parseNavigationStateKey = (
  key: string,
): NavigationState | null => {
  // Handle dashboard
  if (key === 'dashboard') return { navigator: 'dashboard' }

  // Handle browser-profiles
  if (key === 'browser-profiles')
    return { navigator: 'browser-profiles', details: null }
  if (key.startsWith('browser-profiles/profile/')) {
    const profileId = key.slice(24)
    if (profileId) {
      return {
        navigator: 'browser-profiles',
        details: { type: 'profile', profileId },
      }
    }
    return { navigator: 'browser-profiles', details: null }
  }

  // Handle proxies
  if (key === 'proxies') return { navigator: 'proxies', details: null }
  if (key.startsWith('proxies/proxy/')) {
    const proxyId = key.slice(14)
    if (proxyId) {
      return { navigator: 'proxies', details: { type: 'proxy', proxyId } }
    }
    return { navigator: 'proxies', details: null }
  }

  // Handle agent
  if (key === 'agent') return { navigator: 'agent' }

  // Handle tasks
  if (key === 'tasks') return { navigator: 'tasks', details: null }
  if (key.startsWith('tasks/task/')) {
    const taskId = key.slice(11)
    if (taskId) {
      return { navigator: 'tasks', details: { type: 'task', taskId } }
    }
    return { navigator: 'tasks', details: null }
  }

  // Handle settings
  if (key === 'settings') return { navigator: 'settings', subpage: 'app' }
  if (key.startsWith('settings:')) {
    const subpage = key.slice(9) as SettingsSubpage
    if (
      [
        'app',
        'workspace',
        'permissions',
        'labels',
        'shortcuts',
        'preferences',
      ].includes(subpage)
    ) {
      return { navigator: 'settings', subpage }
    }
  }

  // Handle team
  if (key === 'team')
    return { navigator: 'team', subpage: 'members', details: null }
  if (key.startsWith('team:')) {
    const subpage = key.slice(5) as TeamSubpageType
    if (
      ['members', 'roles', 'activity-log', 'org-settings'].includes(subpage)
    ) {
      return { navigator: 'team', subpage, details: null }
    }
  }
  if (key.startsWith('team/member/')) {
    const memberId = key.slice(12)
    if (memberId) {
      return {
        navigator: 'team',
        subpage: 'members',
        details: { type: 'member', memberId },
      }
    }
    return { navigator: 'team', subpage: 'members', details: null }
  }

  return null
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
