import request from 'supertest';
import { Express } from 'express';
import { DatabaseService } from '../../database/database-service';

describe('End-to-End Multi-Tenant Workflow', () => {
  let app: Express;
  let db: DatabaseService;
  
  // Test data
  let org1Id: string;
  let org2Id: string;
  let adminToken1: string;
  let adminToken2: string;
  let memberToken1: string;
  let invitationToken1: string;
  let invitationToken2: string;

  beforeAll(async () => {
    // Initialize test environment
    db = DatabaseService.getInstance();
    await db.initialize();
    
    // Setup test app (this would import the actual app)
    // app = createTestApp();
  });

  afterAll(async () => {
    // Cleanup test data
    if (org1Id) {
      await db.executeQuery('DELETE FROM organizations WHERE id = $1', [org1Id]);
    }
    if (org2Id) {
      await db.executeQuery('DELETE FROM organizations WHERE id = $2', [org2Id]);
    }
    await db.close();
  });

  describe('Complete Multi-Tenant User Journey', () => {
    it('should complete full organization setup and user management workflow', async () => {
      // Step 1: Create Organization 1
      const org1Response = await request(app)
        .post('/api/organizations')
        .send({
          name: 'e2e-test-org-1',
          displayName: 'E2E Test Organization 1',
          subdomain: 'e2etest1',
          tier: 'professional',
          contactEmail: 'admin@e2etest1.com',
          billingEmail: 'billing@e2etest1.com',
          industry: 'technology',
          size: 'medium',
          timezone: 'America/New_York',
          language: 'en',
          currency: 'USD'
        })
        .expect(201);

      org1Id = org1Response.body.organization.id;
      adminToken1 = org1Response.body.adminToken; // Assuming token is returned

      expect(org1Response.body.organization.name).toBe('e2e-test-org-1');
      expect(org1Response.body.organization.tier).toBe('professional');

      // Step 2: Create Organization 2
      const org2Response = await request(app)
        .post('/api/organizations')
        .send({
          name: 'e2e-test-org-2',
          displayName: 'E2E Test Organization 2',
          subdomain: 'e2etest2',
          tier: 'starter',
          contactEmail: 'admin@e2etest2.com',
          billingEmail: 'billing@e2etest2.com',
          industry: 'finance',
          size: 'small',
          timezone: 'America/Los_Angeles',
          language: 'en',
          currency: 'USD'
        })
        .expect(201);

      org2Id = org2Response.body.organization.id;
      adminToken2 = org2Response.body.adminToken;

      expect(org2Response.body.organization.name).toBe('e2e-test-org-2');
      expect(org2Response.body.organization.tier).toBe('starter');

      // Step 3: Configure billing for Org 1
      const billingResponse = await request(app)
        .post('/api/billing/subscription')
        .set('X-Tenant-ID', org1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          planId: 'professional',
          paymentMethodId: 'test-payment-method'
        })
        .expect(201);

      expect(billingResponse.body.subscription.planId).toBe('professional');
      expect(billingResponse.body.subscription.status).toBe('active');

      // Step 4: Configure agents for Org 1
      const agentConfigResponse = await request(app)
        .put('/api/organization-config/agents/claude-001')
        .set('X-Tenant-ID', org1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          enabled: true,
          priority: 1,
          maxConcurrentTasks: 10,
          config: {
            temperature: 0.7,
            maxTokens: 4000,
            rateLimits: {
              requestsPerMinute: 100,
              requestsPerHour: 2000
            },
            costLimits: {
              maxCostPerTask: 10.0,
              maxCostPerDay: 200.0
            }
          }
        })
        .expect(200);

      expect(agentConfigResponse.body.config.enabled).toBe(true);
      expect(agentConfigResponse.body.config.priority).toBe(1);

      // Step 5: Configure different agent settings for Org 2
      const agentConfig2Response = await request(app)
        .put('/api/organization-config/agents/claude-001')
        .set('X-Tenant-ID', org2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .send({
          enabled: true,
          priority: 5,
          maxConcurrentTasks: 3,
          config: {
            temperature: 0.5,
            maxTokens: 2000,
            rateLimits: {
              requestsPerMinute: 30,
              requestsPerHour: 500
            },
            costLimits: {
              maxCostPerTask: 2.0,
              maxCostPerDay: 50.0
            }
          }
        })
        .expect(200);

      expect(agentConfig2Response.body.config.maxConcurrentTasks).toBe(3);
      expect(agentConfig2Response.body.config.config.temperature).toBe(0.5);

      // Step 6: Send invitations from Org 1
      const invitation1Response = await request(app)
        .post('/api/invitations')
        .set('X-Tenant-ID', org1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .send({
          email: 'member1@e2etest1.com',
          role: 'member',
          personalMessage: 'Welcome to our tech organization!'
        })
        .expect(201);

      invitationToken1 = invitation1Response.body.invitation.token;
      expect(invitation1Response.body.invitation.organizationId).toBe(org1Id);

      // Step 7: Send invitations from Org 2
      const invitation2Response = await request(app)
        .post('/api/invitations')
        .set('X-Tenant-ID', org2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .send({
          email: 'member2@e2etest2.com',
          role: 'member',
          personalMessage: 'Welcome to our finance organization!'
        })
        .expect(201);

      invitationToken2 = invitation2Response.body.invitation.token;
      expect(invitation2Response.body.invitation.organizationId).toBe(org2Id);

      // Step 8: Accept invitation for Org 1
      const acceptResponse1 = await request(app)
        .post(`/api/invitations/accept/${invitationToken1}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          preferences: {
            notifications: { email: true, slack: false, inApp: true },
            timezone: 'America/New_York',
            language: 'en',
            theme: 'dark'
          }
        })
        .expect(200);

      expect(acceptResponse1.body.user.role).toBe('member');
      expect(acceptResponse1.body.user.organizationId).toBe(org1Id);
      
      memberToken1 = acceptResponse1.body.memberToken; // Assuming token is returned

      // Step 9: Accept invitation for Org 2
      const acceptResponse2 = await request(app)
        .post(`/api/invitations/accept/${invitationToken2}`)
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
          preferences: {
            notifications: { email: true, slack: true, inApp: true },
            timezone: 'America/Los_Angeles',
            language: 'en',
            theme: 'light'
          }
        })
        .expect(200);

      expect(acceptResponse2.body.user.role).toBe('member');
      expect(acceptResponse2.body.user.organizationId).toBe(org2Id);

      // Step 10: Test task creation with organization-specific configurations
      const task1Response = await request(app)
        .post('/api/tasks')
        .set('X-Tenant-ID', org1Id)
        .set('Authorization', `Bearer ${memberToken1}`)
        .send({
          prompt: 'Create a React component for user authentication',
          type: 'code-generation',
          priority: 'high',
          context: {
            framework: 'React',
            language: 'TypeScript'
          }
        })
        .expect(200);

      expect(task1Response.body.task.organizationId).toBe(org1Id);
      expect(task1Response.body.task.type).toBe('code-generation');

      const task2Response = await request(app)
        .post('/api/tasks')
        .set('X-Tenant-ID', org2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .send({
          prompt: 'Analyze financial data trends',
          type: 'data-analysis',
          priority: 'medium',
          context: {
            dataType: 'financial',
            period: 'quarterly'
          }
        })
        .expect(200);

      expect(task2Response.body.task.organizationId).toBe(org2Id);
      expect(task2Response.body.task.type).toBe('data-analysis');

      // Step 11: Verify tenant isolation - get tasks for each org
      const org1TasksResponse = await request(app)
        .get('/api/tasks')
        .set('X-Tenant-ID', org1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .expect(200);

      const org1Tasks = org1TasksResponse.body.tasks;
      expect(org1Tasks.every(task => task.organizationId === org1Id)).toBe(true);
      expect(org1Tasks.some(task => task.prompt.includes('React component'))).toBe(true);
      expect(org1Tasks.some(task => task.prompt.includes('financial data'))).toBe(false);

      const org2TasksResponse = await request(app)
        .get('/api/tasks')
        .set('X-Tenant-ID', org2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .expect(200);

      const org2Tasks = org2TasksResponse.body.tasks;
      expect(org2Tasks.every(task => task.organizationId === org2Id)).toBe(true);
      expect(org2Tasks.some(task => task.prompt.includes('financial data'))).toBe(true);
      expect(org2Tasks.some(task => task.prompt.includes('React component'))).toBe(false);

      // Step 12: Test cross-tenant access prevention
      await request(app)
        .get('/api/tasks')
        .set('X-Tenant-ID', org2Id)
        .set('Authorization', `Bearer ${adminToken1}`) // Org1 admin trying to access Org2
        .expect(403);

      await request(app)
        .get('/api/invitations')
        .set('X-Tenant-ID', org1Id)
        .set('Authorization', `Bearer ${adminToken2}`) // Org2 admin trying to access Org1
        .expect(403);

      // Step 13: Test billing isolation
      const org1UsageResponse = await request(app)
        .get('/api/billing/usage')
        .set('X-Tenant-ID', org1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .expect(200);

      const org2UsageResponse = await request(app)
        .get('/api/billing/usage')
        .set('X-Tenant-ID', org2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .expect(200);

      // Usage should be tracked separately
      expect(org1UsageResponse.body.usage).not.toEqual(org2UsageResponse.body.usage);

      // Step 14: Test user management within organizations
      const org1UsersResponse = await request(app)
        .get('/api/invitations/users')
        .set('X-Tenant-ID', org1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .expect(200);

      const org1Users = org1UsersResponse.body.users;
      expect(org1Users.every(user => user.organizationId === org1Id)).toBe(true);
      expect(org1Users.some(user => user.email === 'member1@e2etest1.com')).toBe(true);

      const org2UsersResponse = await request(app)
        .get('/api/invitations/users')
        .set('X-Tenant-ID', org2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .expect(200);

      const org2Users = org2UsersResponse.body.users;
      expect(org2Users.every(user => user.organizationId === org2Id)).toBe(true);
      expect(org2Users.some(user => user.email === 'member2@e2etest2.com')).toBe(true);

      // Step 15: Test analytics isolation
      const org1AnalyticsResponse = await request(app)
        .get('/api/analytics/snapshot')
        .set('X-Tenant-ID', org1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .expect(200);

      const org2AnalyticsResponse = await request(app)
        .get('/api/analytics/snapshot')
        .set('X-Tenant-ID', org2Id)
        .set('Authorization', `Bearer ${adminToken2}`)
        .expect(200);

      // Analytics should be organization-specific
      expect(org1AnalyticsResponse.body.organizationId).toBe(org1Id);
      expect(org2AnalyticsResponse.body.organizationId).toBe(org2Id);

      // Step 16: Test subdomain-based tenant resolution
      const subdomainResponse1 = await request(app)
        .get('/api/organizations/' + org1Id)
        .set('Host', 'e2etest1.platform.com')
        .set('Authorization', `Bearer ${adminToken1}`)
        .expect(200);

      expect(subdomainResponse1.body.organization.id).toBe(org1Id);

      const subdomainResponse2 = await request(app)
        .get('/api/organizations/' + org2Id)
        .set('Host', 'e2etest2.platform.com')
        .set('Authorization', `Bearer ${adminToken2}`)
        .expect(200);

      expect(subdomainResponse2.body.organization.id).toBe(org2Id);

      console.log('✅ Complete multi-tenant workflow test passed successfully');
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle concurrent requests from different tenants', async () => {
      const promises = [
        // Concurrent requests from different tenants
        request(app)
          .get('/api/analytics/snapshot')
          .set('X-Tenant-ID', org1Id)
          .set('Authorization', `Bearer ${adminToken1}`),
        
        request(app)
          .get('/api/analytics/snapshot')
          .set('X-Tenant-ID', org2Id)
          .set('Authorization', `Bearer ${adminToken2}`),
        
        request(app)
          .post('/api/tasks')
          .set('X-Tenant-ID', org1Id)
          .set('Authorization', `Bearer ${adminToken1}`)
          .send({
            prompt: 'Concurrent task 1',
            type: 'general'
          }),
        
        request(app)
          .post('/api/tasks')
          .set('X-Tenant-ID', org2Id)
          .set('Authorization', `Bearer ${adminToken2}`)
          .send({
            prompt: 'Concurrent task 2',
            type: 'general'
          })
      ];

      const results = await Promise.all(promises);
      
      // All requests should succeed
      results.forEach(result => {
        expect(result.status).toBeLessThan(400);
      });

      // Analytics results should be different
      expect(results[0].body).not.toEqual(results[1].body);
      
      // Tasks should belong to correct organizations
      expect(results[2].body.task.organizationId).toBe(org1Id);
      expect(results[3].body.task.organizationId).toBe(org2Id);
    });

    it('should handle invalid tenant contexts gracefully', async () => {
      // Request with non-existent tenant ID
      await request(app)
        .get('/api/tasks')
        .set('X-Tenant-ID', 'non-existent-org')
        .set('Authorization', `Bearer ${adminToken1}`)
        .expect(404);

      // Request with malformed tenant ID
      await request(app)
        .get('/api/tasks')
        .set('X-Tenant-ID', 'invalid-uuid')
        .set('Authorization', `Bearer ${adminToken1}`)
        .expect(400);

      // Request without tenant context when required
      await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${adminToken1}`)
        .expect(400);
    });

    it('should maintain data consistency under stress', async () => {
      // Create multiple concurrent invitations
      const invitationPromises = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/invitations')
          .set('X-Tenant-ID', org1Id)
          .set('Authorization', `Bearer ${adminToken1}`)
          .send({
            email: `stress-test-${i}@e2etest1.com`,
            role: 'member'
          })
      );

      const invitationResults = await Promise.all(invitationPromises);
      
      // All invitations should succeed
      invitationResults.forEach(result => {
        expect(result.status).toBe(201);
        expect(result.body.invitation.organizationId).toBe(org1Id);
      });

      // Verify all invitations are properly isolated
      const invitationsResponse = await request(app)
        .get('/api/invitations')
        .set('X-Tenant-ID', org1Id)
        .set('Authorization', `Bearer ${adminToken1}`)
        .expect(200);

      const stressTestInvitations = invitationsResponse.body.invitations.filter(
        inv => inv.email.startsWith('stress-test-')
      );
      
      expect(stressTestInvitations).toHaveLength(10);
      stressTestInvitations.forEach(inv => {
        expect(inv.organizationId).toBe(org1Id);
      });
    });
  });
});