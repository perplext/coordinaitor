import { Platform } from 'react-native';

// API Configuration
export const API_BASE_URL = __DEV__
  ? Platform.select({
      ios: 'http://localhost:3000/api',
      android: 'http://10.0.2.2:3000/api',
    })
  : 'https://api.multi-agent-orchestrator.com/api';

export const WS_BASE_URL = __DEV__
  ? Platform.select({
      ios: 'ws://localhost:3000',
      android: 'ws://10.0.2.2:3000',
    })
  : 'wss://api.multi-agent-orchestrator.com';

// App Configuration
export const APP_CONFIG = {
  appName: 'Multi-Agent Orchestrator',
  version: '1.0.0',
  buildNumber: '1',
  bundleId: 'com.multiagent.orchestrator',
  supportEmail: 'support@multi-agent-orchestrator.com',
  privacyPolicyUrl: 'https://multi-agent-orchestrator.com/privacy',
  termsOfServiceUrl: 'https://multi-agent-orchestrator.com/terms',
};

// Feature Flags
export const FEATURES = {
  biometricAuth: true,
  pushNotifications: true,
  offlineMode: true,
  naturalLanguageInput: true,
  voiceInput: false,
  darkMode: true,
  analytics: true,
};

// Cache Configuration
export const CACHE_CONFIG = {
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 50 * 1024 * 1024, // 50MB
  offlineDataRetention: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Pagination
export const PAGINATION = {
  defaultPageSize: 20,
  maxPageSize: 100,
};

// Timeouts
export const TIMEOUTS = {
  apiRequest: 30000, // 30 seconds
  wsReconnect: 5000, // 5 seconds
  authRefresh: 5 * 60 * 1000, // 5 minutes before expiry
};

// Storage Keys
export const STORAGE_KEYS = {
  authToken: '@auth_token',
  refreshToken: '@refresh_token',
  user: '@user_data',
  theme: '@theme_preference',
  onboardingComplete: '@onboarding_complete',
  biometricEnabled: '@biometric_enabled',
  notificationSettings: '@notification_settings',
  offlineQueue: '@offline_queue',
};