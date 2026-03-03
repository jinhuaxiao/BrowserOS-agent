/**
 * Browser Profile Types
 *
 * Types for managing browser profiles with fingerprint configuration
 * for cross-border e-commerce multi-account management.
 *
 * Includes support for:
 * - Proxy pool management (reusable proxies across profiles)
 * - Profile groups (organization by customer/platform/project)
 * - Profile templates (quick creation of common configurations)
 */

/**
 * Navigator API fingerprint configuration
 */
export interface NavigatorConfig {
  userAgent: string
  platform: string
  language: string
  languages: string[]
  /**
   * Accept-Language HTTP header format (e.g., "en-US,en;q=0.9")
   * Generated from the languages array to ensure HTTP header matches JS API
   */
  acceptLanguage: string
  hardwareConcurrency: number
  deviceMemory: number
  maxTouchPoints: number
  vendor: string
  appVersion: string
}

/**
 * Screen API fingerprint configuration
 */
export interface ScreenConfig {
  width: number
  height: number
  availWidth: number
  availHeight: number
  colorDepth: number
  pixelDepth: number
  devicePixelRatio: number
}

/**
 * WebGL shader precision format (matches getShaderPrecisionFormat output)
 */
export interface WebGLShaderPrecisionFormat {
  rangeMin: number
  rangeMax: number
  precision: number
}

/**
 * Shader precision set for all precision types in a shader stage
 */
export interface WebGLShaderPrecisionSet {
  lowFloat: WebGLShaderPrecisionFormat
  mediumFloat: WebGLShaderPrecisionFormat
  highFloat: WebGLShaderPrecisionFormat
  lowInt: WebGLShaderPrecisionFormat
  mediumInt: WebGLShaderPrecisionFormat
  highInt: WebGLShaderPrecisionFormat
}

/**
 * WebGL fingerprint configuration
 */
export interface WebGLConfig {
  vendor: string
  renderer: string
  unmaskedVendor: string
  unmaskedRenderer: string
  /**
   * GL_VERSION inner string for WebGL1 context.
   * Wrapped by C++/inject.js as "WebGL 1.0 (<glVersion>)".
   * e.g. "OpenGL ES 2.0 Chromium"
   */
  glVersion?: string
  /**
   * GL_VERSION inner string for WebGL2 context.
   * Wrapped as "WebGL 2.0 (<glVersion2>)".
   * e.g. "OpenGL ES 3.0 Chromium"
   */
  glVersion2?: string
  /**
   * GL_SHADING_LANGUAGE_VERSION inner string for WebGL1.
   * Wrapped as "WebGL GLSL ES 1.0 (<shadingLanguageVersion>)".
   */
  shadingLanguageVersion?: string
  /**
   * GL_SHADING_LANGUAGE_VERSION inner string for WebGL2.
   * Wrapped as "WebGL GLSL ES 3.00 (<shadingLanguageVersion2>)".
   */
  shadingLanguageVersion2?: string
  /**
   * If true, WebGL spoofing is disabled and real values are used.
   * This can help avoid detection when WebGL parameters are inconsistent.
   */
  disableSpoofing?: boolean
  /**
   * Per-GPU shader precision values for vertex and fragment shaders.
   * If set, the kernel uses these instead of hardcoded defaults.
   */
  shaderPrecision?: {
    vertexShader: WebGLShaderPrecisionSet
    fragmentShader: WebGLShaderPrecisionSet
  }
  /**
   * WebGL getParameter() values (MAX_TEXTURE_SIZE, etc.) matching the claimed GPU.
   */
  params?: Record<string, number | [number, number]>
  /**
   * WebGL extension list matching the claimed GPU.
   * The kernel intersects this with real GPU extensions for safety.
   */
  extensions?: string[]
}

/**
 * Timezone fingerprint configuration
 */
export interface TimezoneConfig {
  name: string
  offset: number // in minutes
}

/**
 * Canvas fingerprint configuration
 */
export interface CanvasConfig {
  noiseSeed: number
  noiseLevel: number
}

/**
 * AudioContext fingerprint configuration
 */
export interface AudioConfig {
  noiseSeed: number
  noiseLevel: number
}

/**
 * WebRTC configuration
 */
export interface WebRTCConfig {
  publicIp: string | null
  localIp: string | null
  disableWebRTC: boolean
}

/**
 * MediaDevices configuration
 */
export interface MediaDeviceConfig {
  kind: 'audioinput' | 'audiooutput' | 'videoinput'
  deviceId: string
  label: string
  groupId: string
}

export interface MediaDevicesConfig {
  devices: MediaDeviceConfig[]
}

/**
 * Plugins / MimeTypes configuration
 */
export interface PluginMimeTypeConfig {
  type: string
  description: string
  suffixes: string
}

export interface PluginConfig {
  name: string
  description: string
  filename: string
  mimeTypes: PluginMimeTypeConfig[]
}

export interface PluginsConfig {
  items: PluginConfig[]
}

/**
 * Font fingerprint configuration
 */
export interface FontConfig {
  enabledFonts: string[]
  blockFontEnumeration: boolean
}

/**
 * Proxy configuration for browser profiles
 */
export interface ProxyConfig {
  type: 'socks5' | 'http' | 'https'
  host: string
  port: number
  username?: string
  password?: string
}

/**
 * ClientRects noise configuration
 */
export interface ClientRectsConfig {
  noiseSeed: number
  noiseLevel: number
}

/**
 * Battery API configuration
 */
export interface BatteryConfig {
  charging: boolean
  chargingTime: number
  dischargingTime: number
  level: number
}

/**
 * Geolocation configuration
 */
export interface GeolocationConfig {
  enabled: boolean
  latitude: number
  longitude: number
  accuracy: number
}

/**
 * Speech synthesis voice entry
 */
export interface SpeechVoice {
  name: string
  lang: string
  localService: boolean
  default: boolean
}

/**
 * Speech synthesis configuration
 */
export interface SpeechSynthesisConfig {
  voices: SpeechVoice[]
}

/**
 * WebGPU adapter info configuration
 * Spoofs navigator.gpu.requestAdapter().info to prevent GPU fingerprinting
 */
export interface WebGPUConfig {
  vendor: string
  architecture: string
  device: string
  description: string
}

/**
 * DNS-over-HTTPS configuration for DNS leak protection
 */
export interface DnsConfig {
  mode: 'system' | 'doh' | 'custom'
  dohProvider?: 'cloudflare' | 'google' | 'quad9' | 'custom'
  customDohUrl?: string
}

/**
 * Complete fingerprint configuration for a browser profile
 */
export interface FingerprintConfig {
  profileId: string
  navigator: NavigatorConfig
  screen: ScreenConfig
  webgl: WebGLConfig
  timezone: TimezoneConfig
  canvas: CanvasConfig
  audio: AudioConfig
  webrtc: WebRTCConfig
  mediaDevices: MediaDevicesConfig
  plugins: PluginsConfig
  fonts: FontConfig
  clientRects?: ClientRectsConfig
  battery?: BatteryConfig
  geolocation?: GeolocationConfig
  speechSynthesis?: SpeechSynthesisConfig
  /** WebGPU adapter info spoofing */
  webgpu?: WebGPUConfig
  /** Port scan protection — blocks requests to localhost/loopback */
  portScanProtection?: boolean
  /** Whitelisted ports that bypass port scan protection */
  portScanWhitelist?: number[]
  /** DNS leak protection configuration */
  dns?: DnsConfig
  /** Device type for mobile/tablet emulation */
  deviceType?: 'desktop' | 'mobile' | 'tablet'
  /** Optional TLS profile for JA3/JA4 consistency */
  tlsProfile?: 'chrome' | 'firefox' | 'safari'
  proxy?: ProxyConfig
}

/**
 * E-commerce platform type
 */
export type EcommercePlatform =
  | 'amazon'
  | 'ebay'
  | 'shopee'
  | 'lazada'
  | 'aliexpress'
  | 'wish'
  | 'etsy'
  | 'walmart'
  | 'mercadolibre'
  | 'other'

/**
 * Browser profile status
 */
export type ProfileStatus = 'idle' | 'running' | 'error'

/**
 * Browser profile configuration (stored in config.json)
 */
export interface BrowserProfileConfig {
  id: string
  name: string
  description?: string
  platform?: EcommercePlatform

  // Fingerprint configuration
  fingerprint: FingerprintConfig

  // Proxy configuration - prefer proxyId for proxy pool reference
  /** @deprecated Use proxyId to reference proxy pool instead */
  proxy?: ProxyConfig

  // Reference to proxy pool (preferred over embedded proxy)
  proxyId?: string

  // Profile group reference
  groupId?: string

  // Startup URL - automatically navigate to this URL when browser launches
  startupUrl?: string

  // Browser data directory
  userDataDir: string

  // MCP configuration for connecting to BrowserOS MCP server
  mcp?: ProfileMcpConfig

  // Status tracking
  status: ProfileStatus
  lastLaunchedAt?: number
  lastError?: string

  // Process ID when running
  pid?: number

  // Tags for organization
  tags?: string[]

  // Metadata
  createdAt: number
  updatedAt: number
}

/**
 * Input for creating a new browser profile
 */
export interface CreateProfileInput {
  name: string
  description?: string
  platform?: EcommercePlatform

  // Proxy configuration - prefer proxyId for proxy pool reference
  /** @deprecated Use proxyId to reference proxy pool instead */
  proxy?: ProxyConfig

  // Reference to proxy pool (preferred)
  proxyId?: string

  // Profile group reference
  groupId?: string

  // Startup URL
  startupUrl?: string

  tags?: string[]

  // Optional: provide custom fingerprint, otherwise auto-generate
  fingerprint?: Partial<FingerprintConfig>

  // Fingerprint generation options
  targetPlatform?: 'windows' | 'macos' | 'linux'
  targetRegion?: 'us' | 'eu' | 'asia' | 'oceania'
}

/**
 * Input for updating a browser profile
 */
export interface UpdateProfileInput {
  name?: string
  description?: string
  platform?: EcommercePlatform

  /** @deprecated Use proxyId to reference proxy pool instead */
  proxy?: ProxyConfig

  proxyId?: string
  groupId?: string
  startupUrl?: string

  tags?: string[]
  fingerprint?: Partial<FingerprintConfig>
}

/**
 * Browser launch result
 */
export interface LaunchResult {
  success: boolean
  pid?: number
  error?: string
}

/**
 * Browser profile with runtime info
 */
export interface BrowserProfileWithStatus extends BrowserProfileConfig {
  isRunning: boolean
}

// ============================================================================
// Proxy Pool Management
// ============================================================================

/**
 * Proxy health status for proxy pool
 */
export type ProxyStatus = 'healthy' | 'unhealthy' | 'unknown' | 'checking'

/**
 * Region for proxy/profile targeting
 */
export type ProxyRegion = 'us' | 'eu' | 'asia' | 'oceania'

/**
 * Saved proxy in the proxy pool
 * Proxies can be shared across multiple profiles
 */
export interface SavedProxy {
  id: string
  name: string
  type: 'socks5' | 'http' | 'https'
  host: string
  port: number
  username?: string
  password?: string

  // Health check status
  status: ProxyStatus
  lastCheckedAt?: number
  responseTimeMs?: number
  errorMessage?: string

  // Usage statistics
  profileCount: number // Number of profiles using this proxy

  // Organization
  tags?: string[]
  region?: ProxyRegion
  provider?: string

  // Cached geolocation information (detected from proxy exit IP)
  geoLocation?: GeoLocation

  createdAt: number
  updatedAt: number
}

/**
 * Input for creating a new proxy in the pool
 */
export interface CreateProxyInput {
  name: string
  type: 'socks5' | 'http' | 'https'
  host: string
  port: number
  username?: string
  password?: string
  tags?: string[]
  region?: ProxyRegion
  provider?: string
}

/**
 * Input for updating a proxy in the pool
 */
export interface UpdateProxyInput {
  name?: string
  type?: 'socks5' | 'http' | 'https'
  host?: string
  port?: number
  username?: string
  password?: string
  tags?: string[]
  region?: ProxyRegion
  provider?: string
}

/**
 * Result of proxy health check
 */
export interface ProxyHealthResult {
  proxyId: string
  status: ProxyStatus
  responseTimeMs?: number
  errorMessage?: string
  checkedAt: number
}

/**
 * Result of bulk proxy import
 */
export interface ProxyImportResult {
  total: number
  success: number
  failed: number
  errors: Array<{ line: number; error: string }>
  proxies: SavedProxy[]
}

// ============================================================================
// Profile Groups
// ============================================================================

/**
 * Profile group for organizing profiles
 */
export interface ProfileGroup {
  id: string
  name: string
  description?: string
  color?: string // Hex color code
  icon?: string // Icon name
  createdAt: number
  updatedAt: number
}

/**
 * Input for creating a profile group
 */
export interface CreateGroupInput {
  name: string
  description?: string
  color?: string
  icon?: string
}

/**
 * Input for updating a profile group
 */
export interface UpdateGroupInput {
  name?: string
  description?: string
  color?: string
  icon?: string
}

// ============================================================================
// Profile Templates
// ============================================================================

/**
 * Profile template for quick profile creation
 */
export interface ProfileTemplate {
  id: string
  name: string
  description?: string
  platform?: EcommercePlatform
  targetPlatform?: 'windows' | 'macos' | 'linux'
  targetRegion?: ProxyRegion
  proxyId?: string
  tags?: string[]
  groupId?: string
  startupUrl?: string
  createdAt: number
  updatedAt: number
}

/**
 * Input for creating a profile template
 */
export interface CreateTemplateInput {
  name: string
  description?: string
  platform?: EcommercePlatform
  targetPlatform?: 'windows' | 'macos' | 'linux'
  targetRegion?: ProxyRegion
  proxyId?: string
  tags?: string[]
  groupId?: string
  startupUrl?: string
}

/**
 * Input for updating a profile template
 */
export interface UpdateTemplateInput {
  name?: string
  description?: string
  platform?: EcommercePlatform
  targetPlatform?: 'windows' | 'macos' | 'linux'
  targetRegion?: ProxyRegion
  proxyId?: string
  tags?: string[]
  groupId?: string
  startupUrl?: string
}

// ============================================================================
// IP Geolocation
// ============================================================================

/**
 * IP geolocation information
 * Used to match fingerprint timezone/language with proxy IP location
 */
export interface GeoLocation {
  ip: string
  country: string // ISO 3166-1 alpha-2 code (e.g., 'US', 'CN', 'DE')
  countryName: string // Full country name (e.g., 'United States')
  region: string // State/province (e.g., 'California')
  city: string // City name (e.g., 'Los Angeles')
  timezone: string // IANA timezone (e.g., 'America/Los_Angeles')
  latitude: number
  longitude: number
  isp?: string // Internet Service Provider
  detectedAt: number // Detection timestamp
}

// ============================================================================
// MCP (Model Context Protocol) Configuration
// ============================================================================

/**
 * MCP transport type
 * - 'http': HTTP-based transport (default for BrowserOS)
 * - 'stdio': Standard I/O transport
 */
export type McpTransport = 'http' | 'stdio'

/**
 * MCP configuration for a browser profile
 * Defines how to connect to the BrowserOS MCP server
 */
export interface ProfileMcpConfig {
  /** Transport type for MCP connection */
  transport: McpTransport

  /** MCP server port (for http transport) */
  port?: number

  /** MCP server host (default: 127.0.0.1) */
  host?: string

  /** Complete MCP URL (overrides host/port if provided) */
  url?: string

  /** Auto-discover port on launch (for dynamic port allocation) */
  autoDiscover?: boolean

  /** Port range for auto-discovery */
  portRange?: {
    min: number
    max: number
  }
}

/**
 * MCP connection status
 */
export type McpConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

/**
 * MCP runtime state (not persisted)
 * Tracks the current state of MCP connection for a profile
 */
export interface ProfileMcpState {
  /** Current connection status */
  status: McpConnectionStatus

  /** Actual port being used (may differ from config if auto-discovered) */
  port?: number

  /** Error message if status is 'error' */
  error?: string

  /** Timestamp of last successful connection */
  lastConnectedAt?: number

  /** Timestamp of last health check */
  lastHealthCheckAt?: number

  /** Profile ID this state belongs to */
  profileId?: string
}

/**
 * MCP info file written by BrowserOS after startup
 * Located at {userDataDir}/mcp-info.json
 */
export interface McpInfoFile {
  /** MCP server port */
  port: number

  /** Profile identifier (if provided via --mcp-profile-id) */
  profileId?: string

  /** Timestamp when browser started */
  startedAt: number

  /** MCP server URL */
  url?: string
}

/**
 * Extended launch result with MCP information
 */
export interface LaunchWithMcpResult extends LaunchResult {
  /** Whether MCP connection was established */
  mcpConnected: boolean

  /** MCP port (discovered or configured) */
  mcpPort?: number

  /** MCP connection state */
  mcpState?: ProfileMcpState
}

/**
 * Options for launching browser with MCP
 */
export interface LaunchWithMcpOptions {
  /** Specific MCP port to use (Phase 2: passed to browser via --mcp-port) */
  mcpPort?: number

  /** Wait for MCP server to become ready */
  waitForMcp?: boolean

  /** Timeout for MCP connection (ms, default: 30000) */
  mcpTimeout?: number

  /** Port range for auto-discovery */
  portRange?: {
    min: number
    max: number
  }
}

/**
 * Orchestrator configuration for managing multiple profiles
 */
export interface OrchestratorConfig {
  /** Port configuration for MCP connections */
  portConfig?: {
    /** Starting port for sequential allocation (default: 9100) */
    basePort: number

    /** Maximum port number (default: 9199) */
    maxPort: number

    /** Port allocation strategy */
    strategy: 'sequential' | 'profile-hash'
  }

  /** Health check interval in ms (default: 30000) */
  healthCheckInterval?: number

  /** Auto-reconnect on connection loss */
  autoReconnect?: boolean

  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number

  /** Reconnection backoff delay in ms */
  reconnectBackoffMs?: number
}

// ============================================================================
// Browser Configuration
// ============================================================================

/**
 * Browser type identifier
 */
export type BrowserType =
  | 'nova-seller'
  | 'browseros'
  | 'chrome'
  | 'chromium'
  | 'auto'

/**
 * Browser configuration for custom executable paths
 * Allows specifying non-standard browser locations
 */
export interface BrowserConfig {
  /** Custom path to browser executable */
  customBrowserPath?: string

  /** If true, only use the custom path (don't fallback to default paths) */
  useCustomPathOnly?: boolean

  /** Browser type preference */
  browserType?: BrowserType
}

/**
 * Stored browser configuration (persisted to disk)
 */
export interface StoredBrowserConfig extends BrowserConfig {
  /** When the config was last updated */
  updatedAt?: number

  /** Version of the config format */
  version?: number
}

// ============================================================================
// Batch Launch Types
// ============================================================================

/**
 * Options for batch launching multiple profiles
 */
export interface BatchLaunchOptions {
  /** Wait for MCP server to be ready (default: true) */
  waitForMcp?: boolean

  /** Timeout for MCP connection per profile in ms (default: 30000) */
  mcpTimeout?: number

  /** Maximum number of profiles to launch concurrently (default: 3) */
  concurrency?: number

  /** Delay between starting each profile in ms (default: 500) */
  staggerDelay?: number

  /** Progress callback */
  onProgress?: (progress: BatchLaunchProgress) => void

  /** Continue launching remaining profiles if one fails (default: true) */
  continueOnError?: boolean

  /** Pre-allocated ports for profiles (profileId -> port) */
  preallocatedPorts?: Map<string, number>
}

/**
 * Progress information for batch launch operations
 */
export interface BatchLaunchProgress {
  /** Total number of profiles to launch */
  total: number

  /** Number of profiles completed (success or failure) */
  completed: number

  /** Number of successfully launched profiles */
  successful: number

  /** Number of failed launches */
  failed: number

  /** Currently launching profile ID */
  current?: string

  /** Estimated time remaining in ms */
  estimatedRemainingMs?: number
}

/**
 * Result of a batch launch operation
 */
export interface BatchLaunchResult {
  /** Individual results per profile */
  results: Map<string, LaunchWithMcpResult>

  /** Overall success (all profiles launched) */
  allSuccessful: boolean

  /** Number of successful launches */
  successCount: number

  /** Number of failed launches */
  failedCount: number

  /** Total time taken in ms */
  totalTimeMs: number

  /** List of failed profile IDs with errors */
  failures: Array<{ profileId: string; error: string }>
}
