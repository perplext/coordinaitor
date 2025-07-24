import request from 'supertest';
import express from 'express';
import { createTestApp } from '../test-setup';
import { AuthService } from '../../src/services/auth-service';

describe('API Integration Tests', () => {
  let app: express.Application;
  let authService: AuthService;
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Create test server
    const testSetup = createTestApp();
    app = testSetup.app;
    authService = testSetup.authService;
    
    // Create test users
    const user = await authService.createUser({
      username: 'testuser',
      password: 'TestPass123!',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    });
    
    // Give test user developer role for create permissions
    await authService.updateUserRoles(user.id, ['developer']);
    
    const loginResult = await authService.login({
      username: 'testuser',
      password: 'TestPass123!'
    });
    authToken = loginResult.token.accessToken;

    const admin = await authService.createUser({
      username: 'testadmin',
      password: 'AdminPass123!',
      email: 'admin@example.com',
      firstName: 'Test',
      lastName: 'Admin',
    });
    
    await authService.updateUserRoles(admin.id, ['admin']);
    
    const adminLoginResult = await authService.login({
      username: 'testadmin',
      password: 'AdminPass123!'
    });
    adminToken = adminLoginResult.token.accessToken;
  });

  describe('Authentication', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .expect(401);
      
      expect(response.body.error).toBe('Missing or invalid authorization header');
    });

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
      
      expect(response.body.error).toBeDefined();
    });

    it('should allow authenticated requests', async () => {
      const response = await request(app)
        .get('/api/test/protected')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.message).toBe('Protected route accessed');
      expect(response.body.user).toBeDefined();
    });

    it('should enforce permissions', async () => {
      const response = await request(app)
        .get('/api/test/admin')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
      
      expect(response.body.error).toBe('Insufficient permissions');
    });

    it('should allow admin access', async () => {
      const response = await request(app)
        .get('/api/test/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body.message).toBe('Admin route accessed');
    });
  });

  describe('Task Management', () => {
    it('should get tasks with authentication', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.tasks).toBeDefined();
      expect(Array.isArray(response.body.tasks)).toBe(true);
    });

    it('should create task with proper permissions', async () => {
      const taskData = {
        title: 'Test Task',
        description: 'Integration test task',
        priority: 'high'
      };

      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send(taskData)
        .expect(201);
      
      expect(response.body.id).toBeDefined();
      expect(response.body.title).toBe(taskData.title);
      expect(response.body.status).toBe('pending');
    });

    it('should get specific task', async () => {
      // First create a task
      const createResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Get Test Task',
          description: 'Task to retrieve'
        })
        .expect(201);

      const taskId = createResponse.body.id;

      // Then get it
      const response = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.id).toBe(taskId);
      expect(response.body.title).toBe('Get Test Task');
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app)
        .get('/api/tasks/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
      
      expect(response.body.error).toBe('Task not found');
    });
  });

  describe('Agent Management', () => {
    it('should list agents', async () => {
      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.agents).toBeDefined();
      expect(Array.isArray(response.body.agents)).toBe(true);
      expect(response.body.agents.length).toBeGreaterThan(0);
    });

    it('should get specific agent', async () => {
      const response = await request(app)
        .get('/api/agents/agent-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.id).toBe('agent-1');
      expect(response.body.name).toBe('Test Agent');
    });

    it('should return 404 for non-existent agent', async () => {
      const response = await request(app)
        .get('/api/agents/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
      
      expect(response.body.error).toBe('Agent not found');
    });
  });

  describe('Knowledge Management', () => {
    it('should list knowledge entries', async () => {
      const response = await request(app)
        .get('/api/knowledge')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.entries).toBeDefined();
      expect(Array.isArray(response.body.entries)).toBe(true);
    });

    it('should create knowledge entry', async () => {
      const entryData = {
        title: 'Test Knowledge',
        content: 'This is a test knowledge entry',
        tags: ['test', 'integration']
      };

      const response = await request(app)
        .post('/api/knowledge')
        .set('Authorization', `Bearer ${authToken}`)
        .send(entryData)
        .expect(201);
      
      expect(response.body.id).toBeDefined();
      expect(response.body.title).toBe(entryData.title);
      expect(response.body.content).toBe(entryData.content);
    });
  });

  describe('Health Check', () => {
    it('should return health status without authentication', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('CORS', () => {
    it('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/api/tasks')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(200);
      
      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
    });
  });
});