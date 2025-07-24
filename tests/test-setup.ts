import express from 'express';
import { AuthService } from '../src/services/auth-service';
import { createAuthRoutes } from '../src/routes/auth-routes';
import { createAuthMiddleware } from '../src/middleware/auth-middleware';

export function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // Enable CORS for testing
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Initialize auth service with test secret
  const authService = new AuthService('test-jwt-secret');
  const authMiddleware = createAuthMiddleware(authService);
  const authRoutes = createAuthRoutes(authService);
  
  // Auth routes (no authentication required)
  app.use('/api/auth', authRoutes);
  
  // Public health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date() });
  });
  
  // Protected test endpoints
  app.get('/api/test/protected', authMiddleware.authenticate, (req, res) => {
    res.json({ message: 'Protected route accessed', user: req.user });
  });
  
  app.get('/api/test/admin', 
    authMiddleware.authenticate, 
    authMiddleware.requirePermission('admin:access'), 
    (req, res) => {
      res.json({ message: 'Admin route accessed', user: req.user });
  });
  
  // Simple task endpoints for testing
  const tasks = new Map();
  
  app.get('/api/tasks', 
    authMiddleware.authenticate, 
    authMiddleware.requirePermission('tasks:read'), 
    (req, res) => {
      res.json({ tasks: Array.from(tasks.values()) });
  });
  
  app.post('/api/tasks', 
    authMiddleware.authenticate, 
    authMiddleware.requirePermission('tasks:create'), 
    (req, res) => {
      const task = {
        id: Date.now().toString(),
        ...req.body,
        createdAt: new Date(),
        status: 'pending'
      };
      tasks.set(task.id, task);
      res.status(201).json(task);
  });
  
  app.get('/api/tasks/:id', 
    authMiddleware.authenticate, 
    authMiddleware.requirePermission('tasks:read'), 
    (req, res) => {
      const task = tasks.get(req.params.id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(task);
  });
  
  // Simple agent endpoints for testing
  const agents = [
    { id: 'agent-1', name: 'Test Agent', type: 'cli', status: 'idle' },
    { id: 'agent-2', name: 'Code Agent', type: 'code', status: 'busy' }
  ];
  
  app.get('/api/agents', 
    authMiddleware.authenticate, 
    authMiddleware.requirePermission('agents:read'), 
    (req, res) => {
      res.json({ agents });
  });
  
  app.get('/api/agents/:id', 
    authMiddleware.authenticate, 
    authMiddleware.requirePermission('agents:read'), 
    (req, res) => {
      const agent = agents.find(a => a.id === req.params.id);
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      res.json(agent);
  });
  
  // Simple knowledge endpoints for testing
  const knowledge = new Map();
  
  app.get('/api/knowledge', 
    authMiddleware.authenticate, 
    authMiddleware.requirePermission('knowledge:read'), 
    (req, res) => {
      res.json({ entries: Array.from(knowledge.values()) });
  });
  
  app.post('/api/knowledge', 
    authMiddleware.authenticate, 
    authMiddleware.requirePermission('knowledge:create'), 
    (req, res) => {
      const entry = {
        id: Date.now().toString(),
        ...req.body,
        createdAt: new Date()
      };
      knowledge.set(entry.id, entry);
      res.status(201).json(entry);
  });
  
  return { app, authService };
}