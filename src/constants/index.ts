import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } from 'react-native-dotenv';

export const GITHUB_CONFIG = {
  CLIENT_ID: GITHUB_CLIENT_ID,
  CLIENT_SECRET: GITHUB_CLIENT_SECRET,
  SCOPES: ['read:user', 'repo', 'read:org', 'project'] as const,
  ENDPOINTS: {
    AUTHORIZATION: 'https://github.com/login/oauth/authorize',
    TOKEN: 'https://github.com/login/oauth/access_token',
  },
} as const;

export const APP_CONFIG = {
  SCHEME: 'gitswipe',
  AUTH_PATH: 'auth',
  // Production app store links for deep linking fallback
  PRODUCTION: {
    IOS_APP_ID: 'your-ios-app-id', // TODO: Update when you publish to App Store
    ANDROID_PACKAGE: 'com.yourcompany.gitswipe', // TODO: Update with your actual package name
  },
} as const;

export const ALERT_MESSAGES = {
  AUTH_NOT_READY: 'Authentication not ready',
  AUTH_FAILED: 'Authentication failed',
  GITHUB_AUTH_FAILED: 'Failed to authenticate with GitHub',
  SIGN_IN_FAILED: 'Failed to sign in with GitHub',
  SIGN_IN_ERROR: 'Sign In Error',
  AUTH_ERROR: 'Authentication Error',
  ERROR: 'Error',
} as const;