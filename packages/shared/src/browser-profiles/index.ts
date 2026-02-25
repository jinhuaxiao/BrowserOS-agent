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

// Types
export type {
  NavigatorConfig,
  ScreenConfig,
  WebGLConfig,
  TimezoneConfig,
  CanvasConfig,
  AudioConfig,
  WebRTCConfig,
  FontConfig,
  ProxyConfig,
  FingerprintConfig,
  EcommercePlatform,
  ProfileStatus,
  BrowserProfileConfig,
  CreateProfileInput,
  UpdateProfileInput,
  LaunchResult,
  BrowserProfileWithStatus,
  // Proxy pool types
  ProxyStatus,
  ProxyRegion,
  SavedProxy,
  CreateProxyInput,
  UpdateProxyInput,
  ProxyHealthResult,
  ProxyImportResult,
  // Group types
  ProfileGroup,
  CreateGroupInput,
  UpdateGroupInput,
  // Template types
  ProfileTemplate,
  CreateTemplateInput,
  UpdateTemplateInput,
  // Geolocation types
  GeoLocation,
  // MCP types
  McpTransport,
  ProfileMcpConfig,
  McpConnectionStatus,
  ProfileMcpState,
  McpInfoFile,
  LaunchWithMcpResult,
  LaunchWithMcpOptions,
  OrchestratorConfig,
  // Browser config types
  BrowserType,
  BrowserConfig,
  StoredBrowserConfig,
  // Batch launch types
  BatchLaunchOptions,
  BatchLaunchProgress,
  BatchLaunchResult,
} from './types.ts';

// Storage operations
export {
  ensureProfilesDir,
  getProfilePath,
  getProfileConfigPath,
  getFingerprintConfigPath,
  getUserDataDir,
  loadProfileConfig,
  saveProfileConfig,
  createProfile,
  updateProfile,
  deleteProfile,
  getProfile,
  listProfiles,
  updateProfileStatus,
  regenerateFingerprint,
  getProfilesBaseDir,
  rebuildProfileExtension,
  rebuildAllProfileExtensions,
} from './storage.ts';

// Fingerprint generation
export {
  generateFingerprint,
  generateQuickFingerprint,
  type GeneratorOptions,
} from './fingerprint-generator.ts';

// Browser launcher
export {
  findBrowserExecutable,
  buildLaunchArgs,
  launchBrowser,
  launchBrowserWithMcp,
  stopBrowser,
  isBrowserRunning,
  getRunningProfiles,
  stopAllBrowsers,
  // Custom browser path functions
  setBrowserPath,
  clearCustomBrowserPath,
  getBrowserConfig,
  type LaunchBrowserOptions,
  type LaunchWithMcpExtendedOptions,
} from './launcher.ts';

// Fingerprint data (for UI)
export {
  USER_AGENTS,
  WEBGL_DATA_BY_PLATFORM,
  SCREEN_RESOLUTIONS,
  TIMEZONES,
  LANGUAGES,
  FONTS,
  HARDWARE_CONCURRENCY,
  DEVICE_MEMORY,
  COUNTRY_LANGUAGES,
} from './fingerprint-data.ts';

// Browser version detection
export {
  detectBrowserVersion,
  generateUserAgent,
  generateUserAgentFromVersion,
  clearVersionCache,
  getCachedVersion,
  type BrowserVersionInfo,
  type UserAgentInfo,
} from './browser-version.ts';

// Geolocation service
export {
  detectIpGeoLocation,
  detectProxyGeoLocation,
  getLanguageForCountry,
  getTimezoneOffset,
  getTimezoneOffsetDynamic,
  isValidTimezone,
  getCountryFlag,
} from './geolocation-service.ts';

// Proxy pool operations
export {
  listProxies,
  getProxy,
  createProxy,
  updateProxy,
  deleteProxy,
  getProfilesUsingProxy,
  updateProxyProfileCount,
  updateAllProxyProfileCounts,
  importProxies,
  checkProxyHealth,
  checkAllProxiesHealth,
  testProxyConnection,
  savedProxyToConfig,
  detectAndUpdateProxyGeoLocation,
  createProxyWithGeoDetection,
  refreshAllProxiesGeoLocation,
} from './proxy-storage.ts';

// Group operations
export {
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  getProfilesInGroup,
  getGroupProfileCount,
  moveProfileToGroup,
  moveProfilesToGroup,
  getGroupStats,
  getUngroupedProfiles,
} from './group-storage.ts';

// Template operations
export {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  createProfileFromTemplate,
  batchCreateFromTemplate,
  validateTemplate,
  createTemplateFromProfile,
  getTemplatesByPlatform,
} from './template-storage.ts';

// Migration utilities
export {
  migrateToProxyPool,
  needsMigration,
  getMigrationPreview,
  rollbackMigration,
  cleanupLegacyProxyFields,
  type MigrationResult,
} from './migration.ts';

// Launcher - also export resolveProxyConfig
export { resolveProxyConfig } from './launcher.ts';

// Fingerprint extension builder
export {
  buildFingerprintExtension,
  getExtensionPath,
  hasExtension,
  updateExtensionConfig,
} from './extension-builder.ts';

// MCP port discovery
export {
  DEFAULT_MCP_PORT_RANGE,
  discoverMcpPort,
  discoverMcpPortByScanning,
  discoverMcpPortFromFile,
  discoverMcpPortViaCDP,
  discoverAllMcpPorts,
  getMcpInfoFilePath,
  readMcpInfoFile,
  waitForMcpInfoFile,
  waitForMcpServer,
  waitForMcpServerSmart,
  discoverMcpPortFast,
  watchMcpInfoFile,
  calculatePortFromProfileId,
  findNextAvailablePort,
  type McpDiscoveryResult,
  type SmartWaitResult,
  type FastDiscoveryOptions,
  type FastDiscoveryResult,
} from './mcp-port-discovery.ts';

// MCP connection manager
export {
  ProfileMcpConnectionManager,
  getDefaultConnectionManager,
  resetDefaultConnectionManager,
  type ConnectionManagerConfig,
  type ConnectionEvent,
  type ConnectionEventListener,
} from './mcp-connection-manager.ts';

// Profile orchestrator
export {
  ProfileAgentOrchestrator,
  createAmazonStoreOrchestrator,
  getAmazonProfiles,
  type ProfileState,
  type TaskResult,
  type ParallelTask,
  type OrchestratorEvent,
  type OrchestratorEventListener,
} from './profile-orchestrator.ts';

// Nova Seller branding and configuration
export {
  NOVA_SELLER_BRAND,
  NOVA_SELLER_PATHS,
  NOVA_SELLER_ICONS,
  NOVA_SELLER_FILES,
  NOVA_SELLER_ENV,
  isNovaSellerAvailable,
  getNovaSellerPath,
  isNovaSeller,
  getNovaSellerExtensionsDir,
  getNovaSellerArgs,
  getNovaSellerEnv,
  type NovaSellerLaunchOptions,
} from './nova-seller-config.ts';

// BrowserOS kernel configuration (also used by Nova Seller)
export {
  fingerprintToKernelConfig,
  fingerprintToChromiumJson,
  serializeKernelConfig,
  getBrowserOSConfigPath,
  writeBrowserOSConfig,
  writeBrowserOSConfigCached,
  isBrowserOSAvailable,
  getBrowserOSPath,
  buildBrowserOSLaunchArgs,
  setTLSProfile,
  getPlatformColor,
  PLATFORM_COLORS,
  type BrowserOSKernelConfig,
  type ChromiumFingerprintJson,
  type TLSProfile,
  type ProfileBadgeConfig,
  type KernelConfigOptions,
  type WriteBrowserOSConfigOptions,
  type CachedWriteResult,
} from './browseros-config.ts';

// Browser config storage
export {
  loadBrowserConfig,
  saveBrowserConfig,
  hasCustomBrowserPath,
  getCustomBrowserPath,
  validateCustomBrowserPath,
  clearConfigCache,
  getConfigFilePath,
  BROWSER_ENV_VARS,
} from './browser-config-storage.ts';

// Config cache
export {
  ConfigCache,
  getConfigCache,
  resetConfigCache,
  getExtensionVersionCache,
  resetExtensionVersionCache,
  type CacheLookupResult,
  type ConfigCacheOptions,
} from './config-cache.ts';

// Launch queue
export {
  LaunchQueue,
  createLaunchQueue,
  type QueueItem,
  type QueueItemStatus,
  type AddToQueueOptions,
  type QueueStats,
  type LaunchFunction,
  type QueueEvent,
  type QueueEventListener,
} from './launch-queue.ts';
