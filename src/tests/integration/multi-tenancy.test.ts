import request from 'supertest';
import { Express } from 'express';
import { DatabaseService } from '../../database/database-service';
import { OrganizationService } from '../../services/organization-service';
import { UserInvitationService } from '../../services/user-invitation-service';
import { BillingService } from '../../services/billing-service';
import { OrganizationConfigService } from '../../services/organization-config-service';
import { AgentRegistry } from '../../agents/agent-registry';

describe('Multi-Tenancy Integration Tests', () => {
  let app: Express;
  let db: DatabaseService;
  let organizationService: OrganizationService;
  let invitationService: UserInvitationService;
  let billingService: BillingService;
  let configService: OrganizationConfigService;
  let testOrg1Id: string;
  let testOrg2Id: string;
  let adminToken1: string;
  let adminToken2: string;
  let memberToken1: string;

  beforeAll(async () => {
    // Initialize test database
    db = DatabaseService.getInstance();
    await db.initialize();
    
    // Initialize services
    organizationService = new OrganizationService();
    invitationService = new UserInvitationService();
    billingService = new BillingService({ provider: 'internal', currency: 'USD', taxRate: 0.08 });
    const agentRegistry = new AgentRegistry();
    configService = new OrganizationConfigService(agentRegistry);
    
    // Create test organizations
    const org1 = await organizationService.createOrganization({
      name: 'test-org-1',
      displayName: 'Test Organization 1',
      subdomain: 'testorg1',
      tier: 'professional',
      contactEmail: 'admin@testorg1.com',
      billingEmail: 'billing@testorg1.com',
      industry: 'technology',
      size: 'medium',
      timezone: 'America/New_York',
      language: 'en',
      currency: 'USD'
    });
    testOrg1Id = org1.id;
    
    const org2 = await organizationService.createOrganization({
      name: 'test-org-2',
      displayName: 'Test Organization 2',
      subdomain: 'testorg2',
      tier: 'starter',
      contactEmail: 'admin@testorg2.com',
      billingEmail: 'billing@testorg2.com',
      industry: 'finance',
      size: 'small',
      timezone: 'America/Los_Angeles',
      language: 'en',
      currency: 'USD'
    });
    testOrg2Id = org2.id;
    
    // Create test users and tokens
    adminToken1 = 'test-admin-token-org1';
    adminToken2 = 'test-admin-token-org2';
    memberToken1 = 'test-member-token-org1';
  });

  afterAll(async () => {
    // Clean up test data
    await db.executeQuery('DELETE FROM organizations WHERE id IN ($1, $2)', [testOrg1Id, testOrg2Id]);
    await db.close();
  });

  describe('Organization Isolation', () => {
    it('should isolate organizations by subdomain', async () => {
      // Test subdomain-based tenant resolution
      const response1 = await request(app)
        .get('/api/organizations/' + testOrg1Id)
        .set('Host', 'testorg1.platform.com')
        .set('Authorization', `Bearer ${adminToken1}`)
        .expect(200);
      
      expect(response1.body.organization.id).toBe(testOrg1Id);
      expect(response1.body.organization.name).toBe('test-org-1');
      
      const response2 = await request(app)
        .get('/api/organizations/' + testOrg2Id)
        .set('Host', 'testorg2.platform.com')
        .set('Authorization', `Bearer ${adminToken2}`)
        .expect(200);
      
      expect(response2.body.organization.id).toBe(testOrg2Id);
      expect(response2.body.organization.name).toBe('test-org-2');
    });

    it('should isolate organizations by header', async () => {
      // Test header-based tenant resolution
      const response1 = await request(app)
        .get('/api/organizations/' + testOrg1Id)
        .set('X-Tenant-ID', testOrg1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .expect(200);
      
      expect(response1.body.organization.id).toBe(testOrg1Id);
      
      const response2 = await request(app)
        .get('/api/organizations/' + testOrg2Id)
        .set('X-Tenant-ID', testOrg2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .expect(200);
      
      expect(response2.body.organization.id).toBe(testOrg2Id);
    });

    it('should prevent cross-tenant data access', async () => {
      // Try to access org1 data with org2 tenant context
      await request(app)
        .get('/api/organizations/' + testOrg1Id)
        .set('X-Tenant-ID', testOrg2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .expect(403); // Should be forbidden due to tenant mismatch
    });
  });

  describe('User Invitation Multi-Tenancy', () => {
    let invitationId1: string;
    let invitationId2: string;

    it('should create tenant-isolated invitations', async () => {
      // Create invitation for org1
      const invitation1 = await request(app)
        .post('/api/invitations')
        .set('X-Tenant-ID', testOrg1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          email: 'newuser1@testorg1.com',
          role: 'member',
          personalMessage: 'Welcome to Test Org 1!'
        })
        .expect(201);
      
      invitationId1 = invitation1.body.invitation.id;
      expect(invitation1.body.invitation.organizationId).toBe(testOrg1Id);
      
      // Create invitation for org2
      const invitation2 = await request(app)
        .post('/api/invitations')
        .set('X-Tenant-ID', testOrg2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .send({
          email: 'newuser2@testorg2.com',
          role: 'member',
          personalMessage: 'Welcome to Test Org 2!'
        })
        .expect(201);
      
      invitationId2 = invitation2.body.invitation.id;
      expect(invitation2.body.invitation.organizationId).toBe(testOrg2Id);
    });

    it('should only show organization-specific invitations', async () => {
      // Get invitations for org1
      const invitations1 = await request(app)
        .get('/api/invitations')
        .set('X-Tenant-ID', testOrg1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .expect(200);
      
      const org1Invitations = invitations1.body.invitations;
      expect(org1Invitations.every(inv => inv.organizationId === testOrg1Id)).toBe(true);
      expect(org1Invitations.some(inv => inv.id === invitationId1)).toBe(true);
      expect(org1Invitations.some(inv => inv.id === invitationId2)).toBe(false);
      
      // Get invitations for org2
      const invitations2 = await request(app)
        .get('/api/invitations')
        .set('X-Tenant-ID', testOrg2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .expect(200);
      
      const org2Invitations = invitations2.body.invitations;
      expect(org2Invitations.every(inv => inv.organizationId === testOrg2Id)).toBe(true);
      expect(org2Invitations.some(inv => inv.id === invitationId2)).toBe(true);
      expect(org2Invitations.some(inv => inv.id === invitationId1)).toBe(false);
    });

    it('should prevent cross-tenant invitation access', async () => {
      // Try to revoke org1 invitation from org2 context
      await request(app)
        .delete(`/api/invitations/${invitationId1}`)
        .set('X-Tenant-ID', testOrg2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .expect(404); // Should not find invitation in different tenant
      
      // Try to revoke org2 invitation from org1 context
      await request(app)
        .delete(`/api/invitations/${invitationId2}`)
        .set('X-Tenant-ID', testOrg1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .expect(404); // Should not find invitation in different tenant
    });
  });

  describe('Billing Multi-Tenancy', () => {
    it('should track usage separately per organization', async () => {
      // Record usage for org1
      await billingService.recordUsage(testOrg1Id, 'tasks', 10, { type: 'test' });
      await billingService.recordUsage(testOrg1Id, 'api_calls', 100, { endpoint: '/test' });
      
      // Record usage for org2
      await billingService.recordUsage(testOrg2Id, 'tasks', 5, { type: 'test' });
      await billingService.recordUsage(testOrg2Id, 'api_calls', 50, { endpoint: '/test' });
      
      // Get usage for org1
      const usage1 = await request(app)
        .get('/api/billing/usage')
        .set('X-Tenant-ID', testOrg1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .expect(200);
      
      expect(usage1.body.usage.tasks.total).toBe(10);
      expect(usage1.body.usage.api_calls.total).toBe(100);
      
      // Get usage for org2
      const usage2 = await request(app)
        .get('/api/billing/usage')
        .set('X-Tenant-ID', testOrg2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .expect(200);
      
      expect(usage2.body.usage.tasks.total).toBe(5);
      expect(usage2.body.usage.api_calls.total).toBe(50);
    });

    it('should have separate billing plans per organization', async () => {
      // Get current subscription for org1 (professional)
      const subscription1 = await request(app)
        .get('/api/billing/subscription')
        .set('X-Tenant-ID', testOrg1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .expect(200);
      
      expect(subscription1.body.subscription.planId).toBe('professional');
      
      // Get current subscription for org2 (starter)
      const subscription2 = await request(app)
        .get('/api/billing/subscription')
        .set('X-Tenant-ID', testOrg2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .expect(200);
      
      expect(subscription2.body.subscription.planId).toBe('starter');
    });
  });

  describe('Organization Configuration Multi-Tenancy', () => {
    it('should maintain separate agent configurations per organization', async () => {
      // Configure agents for org1
      await request(app)
        .put('/api/organization-config/agents/claude-001')
        .set('X-Tenant-ID', testOrg1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          enabled: true,
          priority: 1,
          maxConcurrentTasks: 10,
          config: {
            temperature: 0.7,
            maxTokens: 4000
          }
        })
        .expect(200);
      
      // Configure agents for org2 (different settings)
      await request(app)
        .put('/api/organization-config/agents/claude-001')
        .set('X-Tenant-ID', testOrg2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .send({
          enabled: true,
          priority: 5,
          maxConcurrentTasks: 3,
          config: {
            temperature: 0.5,
            maxTokens: 2000
          }
        })
        .expect(200);
      
      // Verify org1 configuration
      const config1 = await request(app)
        .get('/api/organization-config/agents/claude-001')
        .set('X-Tenant-ID', testOrg1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .expect(200);
      
      expect(config1.body.config.priority).toBe(1);
      expect(config1.body.config.maxConcurrentTasks).toBe(10);
      expect(config1.body.config.config.temperature).toBe(0.7);
      
      // Verify org2 configuration
      const config2 = await request(app)
        .get('/api/organization-config/agents/claude-001')
        .set('X-Tenant-ID', testOrg2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .expect(200);
      
      expect(config2.body.config.priority).toBe(5);
      expect(config2.body.config.maxConcurrentTasks).toBe(3);
      expect(config2.body.config.config.temperature).toBe(0.5);
    });

    it('should maintain separate feature configurations per organization', async () => {
      // Configure features for org1
      await request(app)
        .put('/api/organization-config/features/webhooks')
        .set('X-Tenant-ID', testOrg1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          enabled: true,
          config: {
            maxWebhooks: 20,
            allowedDomains: ['*.testorg1.com']
          }
        })
        .expect(200);
      
      // Configure features for org2 (different settings)
      await request(app)
        .put('/api/organization-config/features/webhooks')
        .set('X-Tenant-ID', testOrg2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .send({
          enabled: false,
          config: {
            maxWebhooks: 5,
            allowedDomains: ['*.testorg2.com']
          }
        })
        .expect(200);
      
      // Verify configurations are separate
      const features1 = await request(app)
        .get('/api/organization-config/features')
        .set('X-Tenant-ID', testOrg1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .expect(200);
      
      const webhookFeature1 = features1.body.features.find(f => f.featureName === 'webhooks');
      expect(webhookFeature1.enabled).toBe(true);
      expect(webhookFeature1.config.maxWebhooks).toBe(20);
      
      const features2 = await request(app)
        .get('/api/organization-config/features')
        .set('X-Tenant-ID', testOrg2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .expect(200);
      
      const webhookFeature2 = features2.body.features.find(f => f.featureName === 'webhooks');
      expect(webhookFeature2.enabled).toBe(false);
      expect(webhookFeature2.config.maxWebhooks).toBe(5);
    });
  });

  describe('Task Execution Multi-Tenancy', () => {
    it('should execute tasks with organization-specific configurations', async () => {
      // Create task for org1
      const task1 = await request(app)
        .post('/api/tasks')
        .set('X-Tenant-ID', testOrg1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          prompt: 'Test task for org1',
          type: 'general',
          priority: 'medium'
        })
        .expect(200);
      
      expect(task1.body.task.organizationId).toBe(testOrg1Id);
      
      // Create task for org2
      const task2 = await request(app)
        .post('/api/tasks')
        .set('X-Tenant-ID', testOrg2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .send({
          prompt: 'Test task for org2',
          type: 'general',
          priority: 'medium'
        })
        .expect(200);
      
      expect(task2.body.task.organizationId).toBe(testOrg2Id);
    });

    it('should isolate task listings by organization', async () => {
      // Get tasks for org1
      const tasks1 = await request(app)
        .get('/api/tasks')
        .set('X-Tenant-ID', testOrg1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .expect(200);
      
      // All tasks should belong to org1
      expect(tasks1.body.tasks.every(task => task.organizationId === testOrg1Id)).toBe(true);
      
      // Get tasks for org2
      const tasks2 = await request(app)
        .get('/api/tasks')
        .set('X-Tenant-ID', testOrg2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .expect(200);
      
      // All tasks should belong to org2
      expect(tasks2.body.tasks.every(task => task.organizationId === testOrg2Id)).toBe(true);
    });
  });

  describe('Analytics Multi-Tenancy', () => {
    it('should provide organization-specific analytics', async () => {
      // Get analytics for org1
      const analytics1 = await request(app)
        .get('/api/analytics/snapshot')
        .set('X-Tenant-ID', testOrg1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .expect(200);
      
      // Get analytics for org2
      const analytics2 = await request(app)
        .get('/api/analytics/snapshot')
        .set('X-Tenant-ID', testOrg2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .expect(200);
      
      // Analytics should be different for each organization
      expect(analytics1.body).not.toEqual(analytics2.body);
    });
  });

  describe('Permission Isolation', () => {
    it('should enforce role-based permissions within organizations', async () => {
      // Member should not be able to access billing
      await request(app)
        .get('/api/billing/subscription')
        .set('X-Tenant-ID', testOrg1Id)
        .set('Authorization', `Bearer ${memberToken1}`)
        .expect(403); // Forbidden
      
      // Member should not be able to invite users
      await request(app)
        .post('/api/invitations')
        .set('X-Tenant-ID', testOrg1Id)
        .set('Authorization', `Bearer ${memberToken1}`)
        .send({
          email: 'test@example.com',
          role: 'member'
        })
        .expect(403); // Forbidden
    });

    it('should prevent admin of one org from accessing another org', async () => {
      // Admin of org1 should not access org2 data
      await request(app)
        .get('/api/organizations/' + testOrg2Id)
        .set('X-Tenant-ID', testOrg2Id)
        .set('Authorization', `Bearer ${adminToken1}`) // org1 admin token
        .expect(403); // Forbidden
      
      // Admin of org2 should not access org1 data
      await request(app)
        .get('/api/organizations/' + testOrg1Id)
        .set('X-Tenant-ID', testOrg1Id)
        .set('Authorization', `Bearer ${adminToken2}`) // org2 admin token
        .expect(403); // Forbidden
    });
  });

  describe('Data Consistency', () => {
    it('should maintain referential integrity across tenant boundaries', async () => {
      // Verify that invitations reference correct organizations
      const result = await db.executeQuery(
        'SELECT organization_id FROM user_invitations WHERE organization_id IN ($1, $2)',
        [testOrg1Id, testOrg2Id]
      );
      
      const orgIds = result.rows.map(row => row.organization_id);
      expect(orgIds).toContain(testOrg1Id);
      expect(orgIds).toContain(testOrg2Id);
    });

    it('should clean up related data when organization is deleted', async () => {
      // Create a temporary organization for testing deletion
      const tempOrg = await organizationService.createOrganization({
        name: 'temp-org',
        displayName: 'Temporary Organization',
        subdomain: 'temporg',
        tier: 'free',
        createdBy: 'test-admin',
        contactEmail: 'temp@example.com',
        billingEmail: 'temp@example.com',
        industry: 'test',
        size: 'small',
        timezone: 'UTC',
        language: 'en',
        currency: 'USD'
      });
      
      // Create invitation for temp org
      const invitation = await invitationService.sendInvitation({
        organizationId: tempOrg.id,
        email: 'temp@example.com',
        role: 'member',
        invitedBy: 'test-user-id'
      });
      
      // Delete organization
      await organizationService.deleteOrganization(tempOrg.id);
      
      // Verify related data is cleaned up (should be handled by cascade delete)
      const invitationCheck = await db.query(
        'SELECT id FROM user_invitations WHERE organization_id = $1',
        [tempOrg.id]
      );
      
      expect(invitationCheck.rows).toHaveLength(0);
    });
  });
});

// Helper function to setup test app with all middleware
async function createTestApp(): Promise<Express> {
  // This would create a test version of the main app
  // with all the middleware and routes configured
  // Implementation would be similar to src/index.ts but for testing
  const express = require('express');
  const app = express();
  
  // Add all necessary middleware and routes
  // ... (implementation would mirror main app setup)
  
  return app;
}