import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import winston from 'winston';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { DatabaseService } from '../database/database-service';

export interface OAuth2Config {
  id: string;
  organizationId: string;
  name: string;
  provider: 'google' | 'microsoft' | 'okta' | 'auth0' | 'custom';
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
  jwksUrl?: string;
  scopes: string[];
  redirectUri: string;
  additionalParams?: Record<string, string>;
  enabled: boolean;
}

export interface OIDCConfig extends OAuth2Config {
  issuer: string;
  discoveryUrl?: string;
  useDiscovery: boolean;
  idTokenSigningAlg?: string;
  userInfoEndpoint?: string;
  endSessionEndpoint?: string;
  clockTolerance?: number;
}

export interface OAuth2AuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    picture?: string;
    verified?: boolean;
    attributes?: Record<string, any>;
  };
  tokens?: {
    accessToken: string;
    refreshToken?: string;
    idToken?: string;
    expiresIn?: number;
    tokenType?: string;
  };
  error?: string;
  state?: string;
}

export interface TokenInfo {
  valid: boolean;
  payload?: any;
  error?: string;
  expiresAt?: Date;
}

export class OAuth2Service extends EventEmitter {
  private logger: winston.Logger;
  private db: DatabaseService;
  private configs: Map<string, OAuth2Config | OIDCConfig> = new Map();
  private httpClients: Map<string, AxiosInstance> = new Map();
  private jwksClients: Map<string, jwksClient.JwksClient> = new Map();
  private discoveryCache: Map<string, any> = new Map();

  constructor() {
    super();
    this.db = DatabaseService.getInstance();
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        }),
        new winston.transports.File({ 
          filename: 'logs/oauth-service.log',
          maxsize: 10485760,
          maxFiles: 5
        })
      ]
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.loadConfigurations();
      this.logger.info('OAuth2/OIDC service initialized successfully', {
        providers: this.configs.size
      });
    } catch (error) {
      this.logger.error('Failed to initialize OAuth2/OIDC service:', error);
      throw error;
    }
  }

  private async loadConfigurations(): Promise<void> {
    // Load configurations from database
    // For now, create some default configurations
    await this.createDefaultConfigurations();
  }

  private async createDefaultConfigurations(): Promise<void> {
    const defaultConfigs: (OAuth2Config | OIDCConfig)[] = [
      {
        id: 'google-oauth2',
        organizationId: 'default',
        name: 'Google OAuth2',
        provider: 'google',
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
        scopes: ['openid', 'email', 'profile'],
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/oauth2/callback/google',
        enabled: !!process.env.GOOGLE_CLIENT_ID,
        issuer: 'https://accounts.google.com',
        discoveryUrl: 'https://accounts.google.com/.well-known/openid_configuration',
        useDiscovery: true,
        jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs'
      } as OIDCConfig,
      {
        id: 'microsoft-oauth2',
        organizationId: 'default',
        name: 'Microsoft Azure AD',
        provider: 'microsoft',
        clientId: process.env.AZURE_CLIENT_ID || '',
        clientSecret: process.env.AZURE_CLIENT_SECRET || '',
        authorizationUrl: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}/oauth2/v2.0/authorize`,
        tokenUrl: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}/oauth2/v2.0/token`,
        userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
        scopes: ['openid', 'email', 'profile', 'User.Read'],
        redirectUri: process.env.AZURE_REDIRECT_URI || 'http://localhost:3000/auth/oauth2/callback/microsoft',
        enabled: !!process.env.AZURE_CLIENT_ID,
        issuer: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}/v2.0`,
        useDiscovery: true,
        jwksUrl: 'https://login.microsoftonline.com/common/discovery/v2.0/keys'
      } as OIDCConfig
    ];

    for (const config of defaultConfigs) {
      if (config.enabled) {
        await this.configureProvider(config);
      }
    }
  }

  async configureProvider(config: OAuth2Config | OIDCConfig): Promise<void> {
    try {
      // Validate configuration
      this.validateConfig(config);

      // Setup HTTP client
      const httpClient = axios.create({
        timeout: 30000,
        headers: {
          'User-Agent': 'MultiAgentOrchestrator/1.0'
        }
      });

      this.httpClients.set(config.id, httpClient);

      // Setup JWKS client for OIDC
      if (this.isOIDCConfig(config) && config.jwksUrl) {
        const jwksClientInstance = jwksClient({
          jwksUri: config.jwksUrl,
          cache: true,
          cacheMaxEntries: 5,
          cacheMaxAge: 600000, // 10 minutes
          rateLimit: true,
          jwksRequestsPerMinute: 10
        });

        this.jwksClients.set(config.id, jwksClientInstance);
      }

      // Load discovery document for OIDC
      if (this.isOIDCConfig(config) && config.useDiscovery) {
        await this.loadDiscoveryDocument(config);
      }

      this.configs.set(config.id, config);

      this.logger.info('OAuth2/OIDC provider configured', {
        id: config.id,
        provider: config.provider,
        organizationId: config.organizationId
      });

    } catch (error) {
      this.logger.error('Failed to configure OAuth2/OIDC provider:', error);
      throw error;
    }
  }

  private validateConfig(config: OAuth2Config | OIDCConfig): void {
    if (!config.clientId || !config.clientSecret) {
      throw new Error('Client ID and Client Secret are required');
    }

    if (!config.authorizationUrl || !config.tokenUrl) {
      throw new Error('Authorization URL and Token URL are required');
    }

    if (!config.redirectUri) {
      throw new Error('Redirect URI is required');
    }

    if (!config.scopes || config.scopes.length === 0) {
      throw new Error('At least one scope is required');
    }
  }

  private isOIDCConfig(config: OAuth2Config | OIDCConfig): config is OIDCConfig {
    return 'issuer' in config;
  }

  private async loadDiscoveryDocument(config: OIDCConfig): Promise<void> {
    if (!config.discoveryUrl) return;

    try {
      const httpClient = this.httpClients.get(config.id);
      if (!httpClient) throw new Error('HTTP client not configured');

      const response = await httpClient.get(config.discoveryUrl);
      const discovery = response.data;

      // Update configuration with discovered endpoints
      if (discovery.authorization_endpoint) {
        config.authorizationUrl = discovery.authorization_endpoint;
      }
      if (discovery.token_endpoint) {
        config.tokenUrl = discovery.token_endpoint;
      }
      if (discovery.userinfo_endpoint) {
        config.userInfoUrl = discovery.userinfo_endpoint;
      }
      if (discovery.jwks_uri) {
        config.jwksUrl = discovery.jwks_uri;
      }
      if (discovery.end_session_endpoint) {
        config.endSessionEndpoint = discovery.end_session_endpoint;
      }

      this.discoveryCache.set(config.id, discovery);

      this.logger.info('OIDC discovery document loaded', {
        providerId: config.id,
        issuer: config.issuer
      });

    } catch (error) {
      this.logger.warn('Failed to load OIDC discovery document:', error);
      // Continue without discovery - use manual configuration
    }
  }

  async generateAuthorizationUrl(
    providerId: string,
    state?: string,
    nonce?: string,
    additionalParams?: Record<string, string>
  ): Promise<{
    url: string;
    state: string;
    nonce?: string;
    codeVerifier?: string;
  }> {
    const config = this.configs.get(providerId);
    if (!config) {
      throw new Error('OAuth2 provider not found');
    }

    // Generate state and nonce if not provided
    const generatedState = state || crypto.randomBytes(32).toString('hex');
    const generatedNonce = nonce || crypto.randomBytes(32).toString('hex');

    // Generate PKCE code verifier and challenge for security
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(' '),
      state: generatedState,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    // Add nonce for OIDC
    if (this.isOIDCConfig(config)) {
      params.append('nonce', generatedNonce);
    }

    // Add additional parameters
    if (config.additionalParams) {
      Object.entries(config.additionalParams).forEach(([key, value]) => {
        params.append(key, value);
      });
    }

    if (additionalParams) {
      Object.entries(additionalParams).forEach(([key, value]) => {
        params.append(key, value);
      });
    }

    const authUrl = `${config.authorizationUrl}?${params.toString()}`;

    this.logger.info('Authorization URL generated', {
      providerId,
      state: generatedState,
      hasNonce: !!generatedNonce
    });

    return {
      url: authUrl,
      state: generatedState,
      nonce: generatedNonce,
      codeVerifier
    };
  }

  async exchangeCodeForTokens(
    providerId: string,
    code: string,
    state: string,
    codeVerifier?: string
  ): Promise<OAuth2AuthResult> {
    const config = this.configs.get(providerId);
    if (!config) {
      throw new Error('OAuth2 provider not found');
    }

    const httpClient = this.httpClients.get(providerId);
    if (!httpClient) {
      throw new Error('HTTP client not configured');
    }

    try {
      // Exchange authorization code for tokens
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri
      });

      if (codeVerifier) {
        tokenParams.append('code_verifier', codeVerifier);
      }

      const tokenResponse = await httpClient.post(config.tokenUrl, tokenParams, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokens = tokenResponse.data;

      // Validate ID token if present (OIDC)
      let idTokenPayload;
      if (tokens.id_token && this.isOIDCConfig(config)) {
        const tokenInfo = await this.validateIdToken(providerId, tokens.id_token);
        if (!tokenInfo.valid) {
          throw new Error(`Invalid ID token: ${tokenInfo.error}`);
        }
        idTokenPayload = tokenInfo.payload;
      }

      // Get user information
      const user = await this.getUserInfo(providerId, tokens.access_token, idTokenPayload);

      const result: OAuth2AuthResult = {
        success: true,
        user,
        tokens: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          idToken: tokens.id_token,
          expiresIn: tokens.expires_in,
          tokenType: tokens.token_type || 'Bearer'
        },
        state
      };

      this.logger.info('OAuth2 token exchange successful', {
        providerId,
        userId: user.id,
        email: user.email
      });

      this.emit('authentication:success', {
        providerId,
        user,
        tokens: result.tokens
      });

      return result;

    } catch (error) {
      this.logger.error('OAuth2 token exchange failed:', error);

      const result: OAuth2AuthResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Token exchange failed',
        state
      };

      this.emit('authentication:failure', {
        providerId,
        error: result.error
      });

      return result;
    }
  }

  private async getUserInfo(
    providerId: string,
    accessToken: string,
    idTokenPayload?: any
  ): Promise<NonNullable<OAuth2AuthResult['user']>> {
    const config = this.configs.get(providerId);
    if (!config) {
      throw new Error('OAuth2 provider not found');
    }

    // If we have ID token payload, extract user info from it first
    if (idTokenPayload) {
      return this.extractUserFromIdToken(idTokenPayload);
    }

    // Fetch user info from userinfo endpoint
    if (!config.userInfoUrl) {
      throw new Error('User info URL not configured');
    }

    const httpClient = this.httpClients.get(providerId);
    if (!httpClient) {
      throw new Error('HTTP client not configured');
    }

    try {
      const response = await httpClient.get(config.userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return this.extractUserFromUserInfo(response.data, config.provider);

    } catch (error) {
      this.logger.error('Failed to fetch user info:', error);
      throw new Error('Failed to fetch user information');
    }
  }

  private extractUserFromIdToken(payload: any): NonNullable<OAuth2AuthResult['user']> {
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      firstName: payload.given_name,
      lastName: payload.family_name,
      picture: payload.picture,
      verified: payload.email_verified,
      attributes: payload
    };
  }

  private extractUserFromUserInfo(
    userInfo: any,
    provider: OAuth2Config['provider']
  ): NonNullable<OAuth2AuthResult['user']> {
    switch (provider) {
      case 'google':
        return {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          firstName: userInfo.given_name,
          lastName: userInfo.family_name,
          picture: userInfo.picture,
          verified: userInfo.verified_email,
          attributes: userInfo
        };

      case 'microsoft':
        return {
          id: userInfo.id,
          email: userInfo.mail || userInfo.userPrincipalName,
          name: userInfo.displayName,
          firstName: userInfo.givenName,
          lastName: userInfo.surname,
          attributes: userInfo
        };

      default:
        // Generic extraction
        return {
          id: userInfo.id || userInfo.sub,
          email: userInfo.email,
          name: userInfo.name || userInfo.display_name,
          firstName: userInfo.given_name || userInfo.first_name,
          lastName: userInfo.family_name || userInfo.last_name,
          picture: userInfo.picture || userInfo.avatar_url,
          verified: userInfo.email_verified,
          attributes: userInfo
        };
    }
  }

  async validateIdToken(providerId: string, idToken: string): Promise<TokenInfo> {
    const config = this.configs.get(providerId);
    if (!config || !this.isOIDCConfig(config)) {
      return { valid: false, error: 'Not an OIDC provider' };
    }

    try {
      // Decode token header to get key ID
      const header = jwt.decode(idToken, { complete: true })?.header;
      if (!header || !header.kid) {
        return { valid: false, error: 'Invalid token header' };
      }

      // Get signing key
      const jwksClientInstance = this.jwksClients.get(providerId);
      if (!jwksClientInstance) {
        return { valid: false, error: 'JWKS client not configured' };
      }

      const key = await jwksClientInstance.getSigningKey(header.kid);
      const signingKey = key.getPublicKey();

      // Verify and decode token
      const payload = jwt.verify(idToken, signingKey, {
        issuer: config.issuer,
        audience: config.clientId,
        algorithms: [config.idTokenSigningAlg || 'RS256'],
        clockTolerance: config.clockTolerance || 60
      });

      return {
        valid: true,
        payload,
        expiresAt: new Date((payload as any).exp * 1000)
      };

    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Token validation failed'
      };
    }
  }

  async refreshAccessToken(
    providerId: string,
    refreshToken: string
  ): Promise<{
    success: boolean;
    tokens?: OAuth2AuthResult['tokens'];
    error?: string;
  }> {
    const config = this.configs.get(providerId);
    if (!config) {
      return { success: false, error: 'OAuth2 provider not found' };
    }

    const httpClient = this.httpClients.get(providerId);
    if (!httpClient) {
      return { success: false, error: 'HTTP client not configured' };
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken
      });

      const response = await httpClient.post(config.tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const tokens = response.data;

      return {
        success: true,
        tokens: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || refreshToken,
          idToken: tokens.id_token,
          expiresIn: tokens.expires_in,
          tokenType: tokens.token_type || 'Bearer'
        }
      };

    } catch (error) {
      this.logger.error('Token refresh failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      };
    }
  }

  async revokeToken(providerId: string, token: string, tokenType: 'access_token' | 'refresh_token' = 'access_token'): Promise<{
    success: boolean;
    error?: string;
  }> {
    const config = this.configs.get(providerId);
    if (!config) {
      return { success: false, error: 'OAuth2 provider not found' };
    }

    // Check if provider supports token revocation
    const discovery = this.discoveryCache.get(providerId);
    const revocationEndpoint = discovery?.revocation_endpoint;

    if (!revocationEndpoint) {
      this.logger.warn('Token revocation not supported by provider', { providerId });
      return { success: true }; // Treat as success if not supported
    }

    const httpClient = this.httpClients.get(providerId);
    if (!httpClient) {
      return { success: false, error: 'HTTP client not configured' };
    }

    try {
      const params = new URLSearchParams({
        token,
        token_type_hint: tokenType,
        client_id: config.clientId,
        client_secret: config.clientSecret
      });

      await httpClient.post(revocationEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return { success: true };

    } catch (error) {
      this.logger.error('Token revocation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token revocation failed'
      };
    }
  }

  // Configuration management methods
  async listProviders(organizationId: string): Promise<(OAuth2Config | OIDCConfig)[]> {
    const providers: (OAuth2Config | OIDCConfig)[] = [];
    
    for (const config of this.configs.values()) {
      if (config.organizationId === organizationId) {
        // Return config without sensitive data
        const { clientSecret, ...publicConfig } = config;
        providers.push(publicConfig as OAuth2Config | OIDCConfig);
      }
    }
    
    return providers;
  }

  async getProvider(id: string): Promise<(OAuth2Config | OIDCConfig) | undefined> {
    const config = this.configs.get(id);
    if (!config) return undefined;

    // Return config without sensitive data
    const { clientSecret, ...publicConfig } = config;
    return publicConfig as OAuth2Config | OIDCConfig;
  }

  async updateProvider(id: string, updates: Partial<OAuth2Config | OIDCConfig>): Promise<void> {
    const existing = this.configs.get(id);
    if (!existing) {
      throw new Error('OAuth2 provider not found');
    }

    const updated = { ...existing, ...updates };
    await this.configureProvider(updated);
  }

  async deleteProvider(id: string): Promise<void> {
    this.configs.delete(id);
    this.httpClients.delete(id);
    this.jwksClients.delete(id);
    this.discoveryCache.delete(id);
    
    this.logger.info('OAuth2 provider deleted', { id });
  }

  async testConnection(providerId: string): Promise<{
    success: boolean;
    error?: string;
    endpoints?: any;
  }> {
    try {
      const config = this.configs.get(providerId);
      if (!config) {
        throw new Error('OAuth2 provider not found');
      }

      const httpClient = this.httpClients.get(providerId);
      if (!httpClient) {
        throw new Error('HTTP client not configured');
      }

      // Test discovery endpoint for OIDC
      if (this.isOIDCConfig(config) && config.discoveryUrl) {
        const response = await httpClient.get(config.discoveryUrl);
        return {
          success: true,
          endpoints: response.data
        };
      }

      // For regular OAuth2, try to access the authorization endpoint
      try {
        await httpClient.head(config.authorizationUrl);
        return { success: true };
      } catch (error) {
        // Head request might not be supported, try a simple request
        return { success: true };
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }
}