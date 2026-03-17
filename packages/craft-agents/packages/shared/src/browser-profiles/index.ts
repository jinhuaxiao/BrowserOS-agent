/**
 * Browser Profiles Module
 *
 * Manages browser profiles with fingerprint configuration for cross-border
 * e-commerce multi-account management.
 *
 * Features:
 * - Profile CRUD operations
 * - Fingerprint generation and management
 * - Proxy pool management (reusable proxies)
 * - Profile groups for organization
 * - Profile templates for quick creation
 * - Browser launching with fingerprint injection
 */

// Browser config storage
export {
  BROWSER_ENV_VARS,
  clearConfigCache,
  getConfigFilePath,
  getCustomBrowserPath,
  hasCustomBrowserPath,
  loadBrowserConfig,
  saveBrowserConfig,
  validateCustomBrowserPath,
} from './browser-config-storage.ts'
// Browser version detection
export {
  type BrowserVersionInfo,
  clearVersionCache,
  detectBrowserVersion,
  generateUserAgent,
  generateUserAgentFromVersion,
  getCachedVersion,
  type UserAgentInfo,
} from './browser-version.ts'
// BrowserOS kernel configuration (also used by Nova Seller)
export {
  type BrowserOSKernelConfig,
  buildBrowserOSLaunchArgs,
  type CachedWriteResult,
  type ChromiumFingerprintJson,
  fingerprintToChromiumJson,
  fingerprintToKernelConfig,
  getBrowserOSConfigPath,
  getBrowserOSPath,
  getPlatformColor,
  isBrowserOSAvailable,
  type KernelConfigOptions,
  PLATFORM_COLORS,
  type ProfileBadgeConfig,
  serializeKernelConfig,
  setTLSProfile,
  type TLSProfile,
  type WriteBrowserOSConfigOptions,
  writeBrowserOSConfig,
  writeBrowserOSConfigCached,
} from './browseros-config.ts'
// Config cache
export {
  type CacheLookupResult,
  ConfigCache,
  type ConfigCacheOptions,
  getConfigCache,
  getExtensionVersionCache,
  resetConfigCache,
  resetExtensionVersionCache,
} from './config-cache.ts'
export {
  deleteCookiesFromProfile,
  exportCookiesViaCDP,
  injectCookiesViaCDP,
  loadCookiesFromProfile,
  parseCookies,
  profileHasCookies,
  saveCookiesToProfile,
  serializeCookies,
} from './cookie-storage.ts'
// Cookie operations
export type {
  CookieFormat,
  CookieItem,
} from './cookie-types.ts'
// Fingerprint extension builder
export {
  buildFingerprintExtension,
  getExtensionPath,
  hasExtension,
  updateExtensionConfig,
} from './extension-builder.ts'
// Fingerprint data (for UI)
export {
  COUNTRY_LANGUAGES,
  DEVICE_MEMORY,
  FONTS,
  HARDWARE_CONCURRENCY,
  LANGUAGES,
  SCREEN_RESOLUTIONS,
  TIMEZONES,
  USER_AGENTS,
  WEBGL_DATA_BY_PLATFORM,
} from './fingerprint-data.ts'
// Fingerprint generation
export {
  type GeneratorOptions,
  generateFingerprint,
  generateQuickFingerprint,
} from './fingerprint-generator.ts'
// Geolocation service
export {
  detectIpGeoLocation,
  detectProxyGeoLocation,
  getCountryFlag,
  getLanguageForCountry,
  getTimezoneOffset,
  getTimezoneOffsetDynamic,
  isValidTimezone,
} from './geolocation-service.ts'
// Group operations
export {
  createGroup,
  deleteGroup,
  getGroup,
  getGroupProfileCount,
  getGroupStats,
  getProfilesInGroup,
  getUngroupedProfiles,
  listGroups,
  moveProfilesToGroup,
  moveProfileToGroup,
  updateGroup,
} from './group-storage.ts'
// Launch queue
export {
  type AddToQueueOptions,
  createLaunchQueue,
  type LaunchFunction,
  LaunchQueue,
  type QueueEvent,
  type QueueEventListener,
  type QueueItem,
  type QueueItemStatus,
  type QueueStats,
} from './launch-queue.ts'
// Browser launcher
// Launcher - also export resolveProxyConfig
export {
  buildLaunchArgs,
  clearCustomBrowserPath,
  findBrowserExecutable,
  getBrowserConfig,
  getProfileMcpPort,
  getRunningProfiles,
  isBrowserRunning,
  type LaunchBrowserOptions,
  type LaunchWithMcpExtendedOptions,
  launchBrowser,
  launchBrowserWithMcp,
  resolveProxyConfig,
  // Custom browser path functions
  setBrowserPath,
  stopAllBrowsers,
  stopBrowser,
} from './launcher.ts'
// MCP connection manager
export {
  type ConnectionEvent,
  type ConnectionEventListener,
  type ConnectionManagerConfig,
  getDefaultConnectionManager,
  ProfileMcpConnectionManager,
  resetDefaultConnectionManager,
} from './mcp-connection-manager.ts'
// MCP port discovery
export {
  calculatePortFromProfileId,
  DEFAULT_MCP_PORT_RANGE,
  discoverAllMcpPorts,
  discoverMcpPort,
  discoverMcpPortByScanning,
  discoverMcpPortFast,
  discoverMcpPortFromFile,
  discoverMcpPortViaCDP,
  type FastDiscoveryOptions,
  type FastDiscoveryResult,
  findNextAvailablePort,
  getMcpInfoFilePath,
  type McpDiscoveryResult,
  readMcpInfoFile,
  type SmartWaitResult,
  waitForMcpInfoFile,
  waitForMcpServer,
  waitForMcpServerSmart,
  watchMcpInfoFile,
} from './mcp-port-discovery.ts'
// Migration utilities
export {
  cleanupLegacyProxyFields,
  getMigrationPreview,
  type MigrationResult,
  migrateToProxyPool,
  needsMigration,
  rollbackMigration,
} from './migration.ts'
// Nova Seller branding and configuration
export {
  getNovaSellerArgs,
  getNovaSellerEnv,
  getNovaSellerExtensionsDir,
  getNovaSellerPath,
  isNovaSeller,
  isNovaSellerAvailable,
  NOVA_SELLER_BRAND,
  NOVA_SELLER_ENV,
  NOVA_SELLER_FILES,
  NOVA_SELLER_ICONS,
  NOVA_SELLER_PATHS,
  type NovaSellerLaunchOptions,
} from './nova-seller-config.ts'
// Profile orchestrator
export {
  createAmazonStoreOrchestrator,
  getAmazonProfiles,
  type OrchestratorEvent,
  type OrchestratorEventListener,
  type ParallelTask,
  ProfileAgentOrchestrator,
  type ProfileState,
  type TaskResult,
} from './profile-orchestrator.ts'
// Proxy pool operations
export {
  checkAllProxiesHealth,
  checkProxyHealth,
  createProxy,
  createProxyWithGeoDetection,
  deleteProxy,
  detectAndUpdateProxyGeoLocation,
  getProfilesUsingProxy,
  getProxy,
  importProxies,
  listProxies,
  refreshAllProxiesGeoLocation,
  savedProxyToConfig,
  testProxyConnection,
  updateAllProxyProfileCounts,
  updateProxy,
  updateProxyProfileCount,
} from './proxy-storage.ts'
// Runtime + CLI helpers
export {
  type BrowserToolResult,
  buildProfileBaseUrl,
  buildProfileMcpUrl,
  type EnsureProfileOptions,
  getProfileHost,
  getStructuredContentFromToolResult,
  getTextFromToolResult,
  isBrowserToolResult,
  isProcessAlive,
  ProfileRuntimeManager,
  type ProfileSelection,
  type ProfileSession,
  resolveProfileSelection,
} from './runtime.ts'
// Storage operations
export {
  createProfile,
  deleteProfile,
  ensureProfilesDir,
  getFingerprintConfigPath,
  getProfile,
  getProfileConfigPath,
  getProfilePath,
  getProfilesBaseDir,
  getUserDataDir,
  listProfiles,
  loadProfileConfig,
  rebuildAllProfileExtensions,
  rebuildProfileExtension,
  regenerateFingerprint,
  saveProfileConfig,
  updateProfile,
  updateProfileStatus,
} from './storage.ts'
// Template operations
export {
  batchCreateFromTemplate,
  createProfileFromTemplate,
  createTemplate,
  createTemplateFromProfile,
  deleteTemplate,
  getTemplate,
  getTemplatesByPlatform,
  listTemplates,
  updateTemplate,
  validateTemplate,
} from './template-storage.ts'
// Trash operations
export {
  autoCleanupTrash,
  emptyTrash,
  getTrashCount,
  listTrashItems,
  permanentDeleteProfile,
  restoreProfile,
  softDeleteProfile,
  type TrashItem,
} from './trash-storage'
// Types
export type {
  AudioConfig,
  // Batch launch types
  BatchLaunchOptions,
  BatchLaunchProgress,
  BatchLaunchResult,
  BrowserConfig,
  BrowserProfileConfig,
  BrowserProfileWithStatus,
  // Browser config types
  BrowserType,
  CanvasConfig,
  CreateGroupInput,
  CreateProfileInput,
  CreateProxyInput,
  CreateTemplateInput,
  EcommercePlatform,
  FingerprintConfig,
  FontConfig,
  // Geolocation types
  GeoLocation,
  LaunchResult,
  LaunchWithMcpOptions,
  LaunchWithMcpResult,
  McpConnectionStatus,
  McpInfoFile,
  // MCP types
  McpTransport,
  NavigatorConfig,
  OrchestratorConfig,
  // Group types
  ProfileGroup,
  ProfileMcpConfig,
  ProfileMcpState,
  ProfileStatus,
  // Template types
  ProfileTemplate,
  ProxyConfig,
  ProxyHealthResult,
  ProxyImportResult,
  ProxyRegion,
  // Proxy pool types
  ProxyStatus,
  SavedProxy,
  ScreenConfig,
  StoredBrowserConfig,
  TimezoneConfig,
  UpdateGroupInput,
  UpdateProfileInput,
  UpdateProxyInput,
  UpdateTemplateInput,
  WebGLConfig,
  WebRTCConfig,
} from './types.ts'
export { runZenCtl } from './zenctl.ts'
