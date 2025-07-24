export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  organizationName: string;
  role: 'admin' | 'user' | 'viewer';
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  organizationName: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken?: string;
}

export interface Organization {
  id: string;
  name: string;
  domain?: string;
  subdomain?: string;
  logo?: string;
  settings?: OrganizationSettings;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationSettings {
  ssoEnabled: boolean;
  ssoProvider?: string;
  mfaRequired: boolean;
  allowedDomains?: string[];
  features: {
    naturalLanguage: boolean;
    marketplace: boolean;
    advancedAnalytics: boolean;
    customAgents: boolean;
  };
}