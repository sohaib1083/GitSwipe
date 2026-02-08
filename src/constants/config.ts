// Environment configuration
export const isDevelopment = __DEV__;
export const isProduction = !__DEV__;

// Logging Configuration
export const LOG_CONFIG = {
  LEVEL: process.env.LOG_LEVEL || (__DEV__ ? 'debug' : 'warn'),
  ENABLE_CONSOLE: __DEV__,
  ENABLE_FILE_LOGGING: !__DEV__,
} as const;

// Log levels in order of severity
export const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;

// API Configuration
export const API_CONFIG = {
  GITHUB_API_BASE: 'https://api.github.com',
  GITHUB_GRAPHQL_BASE: 'https://api.github.com/graphql',
  REQUEST_TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
  RATE_LIMIT_BUFFER: 100,
} as const;

// App Configuration
export const APP_CONFIG = {
  VERSION: '1.0.0',
  USER_AGENT: 'GitSwipe-Mobile-App',
  ISSUES_PER_PAGE: 20,
  MAX_SEARCH_RESULTS: 100,
  DEBOUNCE_DELAY: 500,
  CACHE_TTL: 5 * 60 * 1000,
} as const;

// Colors
export const COLORS = {
  PRIMARY: '#0366d6',
  SUCCESS: '#28a745',
  DANGER: '#f85149',
  WARNING: '#ffd700',
  INFO: '#17a2b8',

  BACKGROUND: '#f6f8fa',
  SURFACE: '#ffffff',
  BORDER: '#e1e4e8',

  TEXT_PRIMARY: '#24292e',
  TEXT_SECONDARY: '#586069',
  TEXT_TERTIARY: '#6a737d',
  TEXT_INVERSE: '#ffffff',

  STATE_OPEN: '#28a745',
  STATE_CLOSED: '#6f42c1',
} as const;