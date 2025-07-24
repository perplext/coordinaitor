import { EventEmitter } from 'events';
import * as saml from 'samlify';
import winston from 'winston';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { DatabaseService } from '../database/database-service';

export interface SAMLConfig {
  organizationId: string;
  entityId: string;
  assertionConsumerServiceUrl: string;
  singleLogoutServiceUrl?: string;
  nameIdFormat?: string;
  signAuthnRequests?: boolean;
  wantAssertionsSigned?: boolean;
  wantResponseSigned?: boolean;
  privateCert?: string;
  publicCert?: string;
  metadata?: string;
}

export interface IdentityProviderConfig {
  id: string;
  organizationId: string;
  name: string;
  entityId: string;
  ssoUrl: string;
  sloUrl?: string;
  metadata?: string;
  publicCert: string;
  nameIdFormat?: string;
  attributeMapping?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    groups?: string;
    department?: string;
    [key: string]: string | undefined;
  };
  enabled: boolean;
  autoProvisionUsers?: boolean;
  defaultRole?: string;
  allowedDomains?: string[];
}

export interface SAMLAuthResult {
  success: boolean;
  user?: {
    nameId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    attributes?: Record<string, any>;
  };
  error?: string;
  sessionId?: string;
  relayState?: string;
}

export class SAMLService extends EventEmitter {
  private logger: winston.Logger;
  private db: DatabaseService;
  private serviceProviders: Map<string, saml.ServiceProvider> = new Map();
  private identityProviders: Map<string, saml.IdentityProvider> = new Map();
  private configs: Map<string, SAMLConfig> = new Map();
  private idpConfigs: Map<string, IdentityProviderConfig> = new Map();

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
          filename: 'logs/saml-service.log',
          maxsize: 10485760,
          maxFiles: 5
        })
      ]
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.loadConfigurations();
      this.logger.info('SAML service initialized successfully', {
        serviceProviders: this.serviceProviders.size,
        identityProviders: this.identityProviders.size
      });
    } catch (error) {
      this.logger.error('Failed to initialize SAML service:', error);
      throw error;
    }
  }

  private async loadConfigurations(): Promise<void> {
    // Load configurations from database
    // For now, create a default configuration
    await this.createDefaultConfiguration();
  }

  private async createDefaultConfiguration(): Promise<void> {
    const defaultConfig: SAMLConfig = {
      organizationId: 'default',
      entityId: process.env.SAML_ENTITY_ID || 'urn:multi-agent-orchestrator',
      assertionConsumerServiceUrl: process.env.SAML_ACS_URL || 'http://localhost:3000/auth/saml/acs',
      singleLogoutServiceUrl: process.env.SAML_SLO_URL || 'http://localhost:3000/auth/saml/slo',
      nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      signAuthnRequests: true,
      wantAssertionsSigned: true,
      wantResponseSigned: true
    };

    await this.configureSAML('default', defaultConfig);
  }

  async configureSAML(organizationId: string, config: SAMLConfig): Promise<void> {
    try {
      // Generate or load certificates
      const { privateCert, publicCert } = await this.ensureCertificates(organizationId);

      const spConfig = {
        entityID: config.entityId,
        authnRequestsSigned: config.signAuthnRequests,
        wantAssertionsSigned: config.wantAssertionsSigned,
        wantResponseSigned: config.wantResponseSigned,
        nameIDFormat: [config.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'],
        assertionConsumerService: [{
          Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
          Location: config.assertionConsumerServiceUrl,
          isDefault: true,
          index: 0
        }],
        singleLogoutService: config.singleLogoutServiceUrl ? [{
          Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
          Location: config.singleLogoutServiceUrl
        }] : undefined,
        signingCert: publicCert,
        privateKey: privateCert,
        encryptCert: publicCert
      };

      const serviceProvider = saml.ServiceProvider(spConfig);
      this.serviceProviders.set(organizationId, serviceProvider);
      this.configs.set(organizationId, { ...config, privateCert, publicCert });

      this.logger.info('SAML Service Provider configured', {
        organizationId,
        entityId: config.entityId
      });

    } catch (error) {
      this.logger.error('Failed to configure SAML Service Provider:', error);
      throw error;
    }
  }

  async configureIdentityProvider(config: IdentityProviderConfig): Promise<void> {
    try {
      let idpConfig: any;

      if (config.metadata) {
        // Configure from metadata
        idpConfig = {
          metadata: config.metadata
        };
      } else {
        // Configure manually
        idpConfig = {
          entityID: config.entityId,
          singleSignOnService: [{
            Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
            Location: config.ssoUrl
          }],
          singleLogoutService: config.sloUrl ? [{
            Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
            Location: config.sloUrl
          }] : undefined,
          nameIDFormat: [config.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'],
          signingCert: config.publicCert
        };
      }

      const identityProvider = saml.IdentityProvider(idpConfig);
      this.identityProviders.set(config.id, identityProvider);
      this.idpConfigs.set(config.id, config);

      this.logger.info('SAML Identity Provider configured', {
        id: config.id,
        organizationId: config.organizationId,
        name: config.name,
        entityId: config.entityId
      });

    } catch (error) {
      this.logger.error('Failed to configure SAML Identity Provider:', error);
      throw error;
    }
  }

  async generateAuthRequest(organizationId: string, idpId: string, relayState?: string): Promise<{
    url: string;
    id: string;
    context: string;
  }> {
    const serviceProvider = this.serviceProviders.get(organizationId);
    const identityProvider = this.identityProviders.get(idpId);

    if (!serviceProvider || !identityProvider) {
      throw new Error('Service Provider or Identity Provider not configured');
    }

    try {
      const { context, entityEndpoint } = serviceProvider.createLoginRequest(
        identityProvider,
        'redirect',
        {
          relayState,
          allowCreate: true,
          isPassive: false,
          forceAuthn: false
        }
      );

      const requestId = this.extractRequestId(context);

      this.logger.info('SAML authentication request generated', {
        organizationId,
        idpId,
        requestId,
        hasRelayState: !!relayState
      });

      return {
        url: entityEndpoint,
        id: requestId,
        context
      };

    } catch (error) {
      this.logger.error('Failed to generate SAML auth request:', error);
      throw error;
    }
  }

  async processAuthResponse(
    organizationId: string,
    idpId: string,
    samlResponse: string,
    relayState?: string
  ): Promise<SAMLAuthResult> {
    const serviceProvider = this.serviceProviders.get(organizationId);
    const identityProvider = this.identityProviders.get(idpId);
    const idpConfig = this.idpConfigs.get(idpId);

    if (!serviceProvider || !identityProvider || !idpConfig) {
      throw new Error('Service Provider or Identity Provider not configured');
    }

    try {
      const { extract } = await serviceProvider.parseLoginResponse(identityProvider, 'post', {
        body: { SAMLResponse: samlResponse, RelayState: relayState }
      });

      const attributes = extract.attributes || {};
      const nameId = extract.nameID;

      // Map attributes based on configuration
      const user = await this.mapUserAttributes(nameId, attributes, idpConfig);

      // Auto-provision user if enabled
      if (idpConfig.autoProvisionUsers) {
        await this.autoProvisionUser(user, idpConfig);
      }

      // Generate session
      const sessionId = this.generateSessionId();

      this.logger.info('SAML authentication successful', {
        organizationId,
        idpId,
        nameId,
        email: user.email,
        sessionId
      });

      this.emit('authentication:success', {
        organizationId,
        idpId,
        user,
        sessionId
      });

      return {
        success: true,
        user,
        sessionId,
        relayState
      };

    } catch (error) {
      this.logger.error('SAML authentication failed:', error);

      this.emit('authentication:failure', {
        organizationId,
        idpId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  async generateLogoutRequest(
    organizationId: string,
    idpId: string,
    nameId: string,
    sessionId?: string
  ): Promise<{ url: string; id: string }> {
    const serviceProvider = this.serviceProviders.get(organizationId);
    const identityProvider = this.identityProviders.get(idpId);

    if (!serviceProvider || !identityProvider) {
      throw new Error('Service Provider or Identity Provider not configured');
    }

    try {
      const { context, entityEndpoint } = serviceProvider.createLogoutRequest(
        identityProvider,
        'redirect',
        {
          nameID: nameId,
          sessionIndex: sessionId
        }
      );

      const requestId = this.extractRequestId(context);

      this.logger.info('SAML logout request generated', {
        organizationId,
        idpId,
        nameId,
        requestId
      });

      return {
        url: entityEndpoint,
        id: requestId
      };

    } catch (error) {
      this.logger.error('Failed to generate SAML logout request:', error);
      throw error;
    }
  }

  async processLogoutResponse(
    organizationId: string,
    idpId: string,
    samlResponse: string
  ): Promise<{ success: boolean; error?: string }> {
    const serviceProvider = this.serviceProviders.get(organizationId);
    const identityProvider = this.identityProviders.get(idpId);

    if (!serviceProvider || !identityProvider) {
      throw new Error('Service Provider or Identity Provider not configured');
    }

    try {
      await serviceProvider.parseLogoutResponse(identityProvider, 'redirect', {
        query: { SAMLResponse: samlResponse }
      });

      this.logger.info('SAML logout successful', {
        organizationId,
        idpId
      });

      this.emit('logout:success', { organizationId, idpId });

      return { success: true };

    } catch (error) {
      this.logger.error('SAML logout failed:', error);

      this.emit('logout:failure', {
        organizationId,
        idpId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed'
      };
    }
  }

  async getServiceProviderMetadata(organizationId: string): Promise<string> {
    const serviceProvider = this.serviceProviders.get(organizationId);
    if (!serviceProvider) {
      throw new Error('Service Provider not configured');
    }

    return serviceProvider.getMetadata();
  }

  async validateIdPMetadata(metadata: string): Promise<{
    valid: boolean;
    entityId?: string;
    ssoUrl?: string;
    sloUrl?: string;
    certificates?: string[];
    error?: string;
  }> {
    try {
      const tempIdP = saml.IdentityProvider({ metadata });
      const info = tempIdP.entityMeta;

      return {
        valid: true,
        entityId: info.entityID,
        ssoUrl: info.singleSignOnService?.[0]?.Location,
        sloUrl: info.singleLogoutService?.[0]?.Location,
        certificates: info.signingCert ? [info.signingCert] : []
      };

    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid metadata'
      };
    }
  }

  private async mapUserAttributes(
    nameId: string,
    attributes: Record<string, any>,
    config: IdentityProviderConfig
  ): Promise<SAMLAuthResult['user']> {
    const mapping = config.attributeMapping || {};

    const user = {
      nameId,
      email: this.extractAttribute(attributes, mapping.email || 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress') || nameId,
      firstName: this.extractAttribute(attributes, mapping.firstName || 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'),
      lastName: this.extractAttribute(attributes, mapping.lastName || 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'),
      attributes: attributes
    };

    // Validate required fields
    if (!user.email) {
      throw new Error('Email attribute is required');
    }

    // Check allowed domains
    if (config.allowedDomains && config.allowedDomains.length > 0) {
      const emailDomain = user.email.split('@')[1];
      if (!config.allowedDomains.includes(emailDomain)) {
        throw new Error(`Domain ${emailDomain} is not allowed`);
      }
    }

    return user;
  }

  private extractAttribute(attributes: Record<string, any>, key: string): string | undefined {
    const value = attributes[key];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }

  private async autoProvisionUser(
    user: NonNullable<SAMLAuthResult['user']>,
    config: IdentityProviderConfig
  ): Promise<void> {
    try {
      // Check if user already exists
      // Implementation would depend on your user service
      this.logger.info('Auto-provisioning user', {
        email: user.email,
        organizationId: config.organizationId
      });

      this.emit('user:provisioned', {
        user,
        organizationId: config.organizationId,
        defaultRole: config.defaultRole
      });

    } catch (error) {
      this.logger.error('Failed to auto-provision user:', error);
      throw error;
    }
  }

  private async ensureCertificates(organizationId: string): Promise<{
    privateCert: string;
    publicCert: string;
  }> {
    const certDir = path.join(process.cwd(), 'certs', 'saml', organizationId);
    const privateKeyPath = path.join(certDir, 'private.key');
    const publicCertPath = path.join(certDir, 'public.crt');

    try {
      // Try to load existing certificates
      const privateCert = await fs.readFile(privateKeyPath, 'utf8');
      const publicCert = await fs.readFile(publicCertPath, 'utf8');
      return { privateCert, publicCert };

    } catch (error) {
      // Generate new certificates if they don't exist
      this.logger.info('Generating new SAML certificates', { organizationId });
      return await this.generateCertificates(certDir);
    }
  }

  private async generateCertificates(certDir: string): Promise<{
    privateCert: string;
    publicCert: string;
  }> {
    // Create directory if it doesn't exist
    await fs.mkdir(certDir, { recursive: true });

    // Generate private key
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    // Generate self-signed certificate
    const cert = this.generateSelfSignedCert(privateKey, publicKey);

    // Save certificates
    await fs.writeFile(path.join(certDir, 'private.key'), privateKey);
    await fs.writeFile(path.join(certDir, 'public.crt'), cert);

    return {
      privateCert: privateKey,
      publicCert: cert
    };
  }

  private generateSelfSignedCert(privateKey: string, publicKey: string): string {
    // This is a simplified implementation
    // In production, you might want to use a more robust certificate generation
    const subject = '/C=US/ST=State/L=City/O=Organization/CN=multi-agent-orchestrator';
    
    // For now, return the public key as a basic certificate
    // In a real implementation, you'd generate a proper X.509 certificate
    return publicKey;
  }

  private extractRequestId(context: string): string {
    // Extract request ID from SAML context
    // This is a simplified implementation
    return crypto.randomBytes(16).toString('hex');
  }

  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Configuration management methods
  async listIdentityProviders(organizationId: string): Promise<IdentityProviderConfig[]> {
    const providers: IdentityProviderConfig[] = [];
    
    for (const [id, config] of this.idpConfigs.entries()) {
      if (config.organizationId === organizationId) {
        providers.push(config);
      }
    }
    
    return providers;
  }

  async getIdentityProvider(id: string): Promise<IdentityProviderConfig | undefined> {
    return this.idpConfigs.get(id);
  }

  async updateIdentityProvider(id: string, updates: Partial<IdentityProviderConfig>): Promise<void> {
    const existing = this.idpConfigs.get(id);
    if (!existing) {
      throw new Error('Identity Provider not found');
    }

    const updated = { ...existing, ...updates };
    await this.configureIdentityProvider(updated);
  }

  async deleteIdentityProvider(id: string): Promise<void> {
    this.identityProviders.delete(id);
    this.idpConfigs.delete(id);
    
    this.logger.info('Identity Provider deleted', { id });
  }

  async testConnection(idpId: string): Promise<{
    success: boolean;
    error?: string;
    metadata?: any;
  }> {
    try {
      const config = this.idpConfigs.get(idpId);
      if (!config) {
        throw new Error('Identity Provider not found');
      }

      // Test connection by validating metadata or making a test request
      if (config.metadata) {
        const validation = await this.validateIdPMetadata(config.metadata);
        return {
          success: validation.valid,
          error: validation.error,
          metadata: validation
        };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }
}