import { Request, Response, NextFunction } from 'express';
import { TenantIsolationMiddleware, TenantIsolationConfig } from '../../middleware/tenant-isolation-middleware';
import { OrganizationService } from '../../services/organization-service';

// Mock the OrganizationService
jest.mock('../../services/organization-service');

describe('TenantIsolationMiddleware', () => {
  let middleware: TenantIsolationMiddleware;
  let mockOrganizationService: jest.Mocked<OrganizationService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockOrganizationService = new OrganizationService() as jest.Mocked<OrganizationService>;
    mockReq = {
      headers: {},
      hostname: 'localhost',
      path: '/api/test',
      method: 'GET'
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn()
    };
    mockNext = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Subdomain Strategy', () => {
    beforeEach(() => {
      const config: TenantIsolationConfig = {
        enabled: true,
        multiTenantStrategy: 'subdomain',
        allowedDomains: ['platform.com']
      };
      middleware = new TenantIsolationMiddleware(config, mockOrganizationService);
    });

    it('should extract organization from subdomain', async () => {
      const mockOrg = {
        id: 'org-123',
        name: 'test-org',
        subdomain: 'testorg'
      };

      mockOrganizationService.getOrganizationBySubdomain.mockResolvedValue(mockOrg as any);
      mockReq.hostname = 'testorg.platform.com';

      const isolateMiddleware = middleware.isolate();
      await isolateMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockOrganizationService.getOrganizationBySubdomain).toHaveBeenCalledWith('testorg');
      expect(mockReq.tenant).toEqual({
        organization: mockOrg,
        isMultiTenant: true,
        strategy: 'subdomain'
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle invalid subdomain', async () => {
      mockOrganizationService.getOrganizationBySubdomain.mockResolvedValue(null);
      mockReq.hostname = 'invalid.platform.com';

      const isolateMiddleware = middleware.isolate();
      await isolateMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Organization not found',
        code: 'TENANT_NOT_FOUND'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle non-subdomain hostnames', async () => {
      mockReq.hostname = 'localhost';

      const isolateMiddleware = middleware.isolate();
      await isolateMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.tenant).toEqual({
        organization: null,
        isMultiTenant: false,
        strategy: 'subdomain'
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Domain Strategy', () => {
    beforeEach(() => {
      const config: TenantIsolationConfig = {
        enabled: true,
        multiTenantStrategy: 'domain'
      };
      middleware = new TenantIsolationMiddleware(config, mockOrganizationService);
    });

    it('should extract organization from custom domain', async () => {
      const mockOrg = {
        id: 'org-456',
        name: 'custom-org',
        domain: 'custom.example.com'
      };

      mockOrganizationService.getOrganizationByDomain.mockResolvedValue(mockOrg as any);
      mockReq.hostname = 'custom.example.com';

      const isolateMiddleware = middleware.isolate();
      await isolateMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockOrganizationService.getOrganizationByDomain).toHaveBeenCalledWith('custom.example.com');
      expect(mockReq.tenant).toEqual({
        organization: mockOrg,
        isMultiTenant: true,
        strategy: 'domain'
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Header Strategy', () => {
    beforeEach(() => {
      const config: TenantIsolationConfig = {
        enabled: true,
        multiTenantStrategy: 'header',
        tenantHeaderName: 'X-Tenant-ID'
      };
      middleware = new TenantIsolationMiddleware(config, mockOrganizationService);
    });

    it('should extract organization from header', async () => {
      const mockOrg = {
        id: 'org-789',
        name: 'header-org'
      };

      mockOrganizationService.getOrganization.mockResolvedValue(mockOrg as any);
      mockReq.headers = { 'x-tenant-id': 'org-789' };

      const isolateMiddleware = middleware.isolate();
      await isolateMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockOrganizationService.getOrganization).toHaveBeenCalledWith('org-789');
      expect(mockReq.tenant).toEqual({
        organization: mockOrg,
        isMultiTenant: true,
        strategy: 'header'
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing tenant header when required', async () => {
      const config: TenantIsolationConfig = {
        enabled: true,
        multiTenantStrategy: 'header',
        tenantHeaderName: 'X-Tenant-ID',
        requireTenantHeader: true
      };
      middleware = new TenantIsolationMiddleware(config, mockOrganizationService);

      mockReq.headers = {};

      const isolateMiddleware = middleware.isolate();
      await isolateMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Tenant header X-Tenant-ID is required',
        code: 'TENANT_HEADER_REQUIRED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Path Strategy', () => {
    beforeEach(() => {
      const config: TenantIsolationConfig = {
        enabled: true,
        multiTenantStrategy: 'path'
      };
      middleware = new TenantIsolationMiddleware(config, mockOrganizationService);
    });

    it('should extract organization from path', async () => {
      const mockOrg = {
        id: 'org-abc',
        name: 'path-org'
      };

      mockOrganizationService.getOrganization.mockResolvedValue(mockOrg as any);
      mockReq.path = '/api/org/org-abc/tasks';

      const isolateMiddleware = middleware.isolate();
      await isolateMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockOrganizationService.getOrganization).toHaveBeenCalledWith('org-abc');
      expect(mockReq.tenant).toEqual({
        organization: mockOrg,
        isMultiTenant: true,
        strategy: 'path'
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle path without organization segment', async () => {
      mockReq.path = '/api/health';

      const isolateMiddleware = middleware.isolate();
      await isolateMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.tenant).toEqual({
        organization: null,
        isMultiTenant: false,
        strategy: 'path'
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Fallback Strategy', () => {
    beforeEach(() => {
      const config: TenantIsolationConfig = {
        enabled: true,
        multiTenantStrategy: 'subdomain',
        fallbackStrategy: 'header',
        tenantHeaderName: 'X-Tenant-ID'
      };
      middleware = new TenantIsolationMiddleware(config, mockOrganizationService);
    });

    it('should fall back to header when subdomain fails', async () => {
      const mockOrg = {
        id: 'org-fallback',
        name: 'fallback-org'
      };

      mockOrganizationService.getOrganizationBySubdomain.mockResolvedValue(null);
      mockOrganizationService.getOrganization.mockResolvedValue(mockOrg as any);
      
      mockReq.hostname = 'invalid.platform.com';
      mockReq.headers = { 'x-tenant-id': 'org-fallback' };

      const isolateMiddleware = middleware.isolate();
      await isolateMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockOrganizationService.getOrganizationBySubdomain).toHaveBeenCalled();
      expect(mockOrganizationService.getOrganization).toHaveBeenCalledWith('org-fallback');
      expect(mockReq.tenant).toEqual({
        organization: mockOrg,
        isMultiTenant: true,
        strategy: 'header'
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Default Organization', () => {
    beforeEach(() => {
      const config: TenantIsolationConfig = {
        enabled: true,
        multiTenantStrategy: 'header',
        defaultOrganizationId: 'default-org-123'
      };
      middleware = new TenantIsolationMiddleware(config, mockOrganizationService);
    });

    it('should use default organization when no tenant is resolved', async () => {
      const mockDefaultOrg = {
        id: 'default-org-123',
        name: 'default-organization'
      };

      mockOrganizationService.getOrganization.mockResolvedValue(mockDefaultOrg as any);
      mockReq.headers = {};

      const isolateMiddleware = middleware.isolate();
      await isolateMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockOrganizationService.getOrganization).toHaveBeenCalledWith('default-org-123');
      expect(mockReq.tenant).toEqual({
        organization: mockDefaultOrg,
        isMultiTenant: false,
        strategy: 'header'
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Disabled Multi-Tenancy', () => {
    beforeEach(() => {
      const config: TenantIsolationConfig = {
        enabled: false
      };
      middleware = new TenantIsolationMiddleware(config, mockOrganizationService);
    });

    it('should skip tenant resolution when disabled', async () => {
      const isolateMiddleware = middleware.isolate();
      await isolateMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockOrganizationService.getOrganization).not.toHaveBeenCalled();
      expect(mockOrganizationService.getOrganizationBySubdomain).not.toHaveBeenCalled();
      expect(mockReq.tenant).toEqual({
        organization: null,
        isMultiTenant: false,
        strategy: null
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      const config: TenantIsolationConfig = {
        enabled: true,
        multiTenantStrategy: 'header',
        tenantHeaderName: 'X-Tenant-ID'
      };
      middleware = new TenantIsolationMiddleware(config, mockOrganizationService);
    });

    it('should handle database errors gracefully', async () => {
      mockOrganizationService.getOrganization.mockRejectedValue(new Error('Database connection failed'));
      mockReq.headers = { 'x-tenant-id': 'org-123' };

      const isolateMiddleware = middleware.isolate();
      await isolateMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Tenant resolution failed',
        code: 'TENANT_RESOLUTION_ERROR'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Cross-Origin Resource Sharing', () => {
    beforeEach(() => {
      const config: TenantIsolationConfig = {
        enabled: true,
        multiTenantStrategy: 'subdomain',
        allowedDomains: ['platform.com']
      };
      middleware = new TenantIsolationMiddleware(config, mockOrganizationService);
    });

    it('should set appropriate CORS headers for tenant requests', async () => {
      const mockOrg = {
        id: 'org-cors',
        name: 'cors-org',
        subdomain: 'corsorg'
      };

      mockOrganizationService.getOrganizationBySubdomain.mockResolvedValue(mockOrg as any);
      mockReq.hostname = 'corsorg.platform.com';

      const isolateMiddleware = middleware.isolate();
      await isolateMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Tenant-ID', 'org-cors');
      expect(mockNext).toHaveBeenCalled();
    });
  });
});