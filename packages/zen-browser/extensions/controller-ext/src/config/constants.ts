export type WebSocketProtocol = 'ws' | 'wss'

export interface WebSocketConfig {
  readonly protocol: WebSocketProtocol
  readonly host: string
  readonly path: string
  readonly defaultExtensionPort: number
  readonly reconnectIntervalMs: number
  readonly heartbeatInterval: number
  readonly heartbeatTimeout: number
  readonly connectionTimeout: number
  readonly requestTimeout: number
}

export interface ConcurrencyConfig {
  readonly maxConcurrent: number
  readonly maxQueueSize: number
}

export interface LoggingConfig {
  readonly enabled: boolean
  readonly level: 'debug' | 'info' | 'warn' | 'error'
  readonly prefix: string
}

export const WEBSOCKET_CONFIG: WebSocketConfig = {
  protocol: 'ws',
  host: '127.0.0.1',
  path: '/controller',
  defaultExtensionPort: 9400,
  reconnectIntervalMs: 5_000,
  heartbeatInterval: 20_000,
  heartbeatTimeout: 5_000,
  connectionTimeout: 10_000,
  requestTimeout: 30_000,
}

export const CONCURRENCY_CONFIG: ConcurrencyConfig = {
  maxConcurrent: 1,
  maxQueueSize: 1_000,
}

export const LOGGING_CONFIG: LoggingConfig = {
  enabled: true,
  level: 'info',
  prefix: '[BrowserOS]',
}
