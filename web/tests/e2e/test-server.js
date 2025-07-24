const express = require('express');
const cors = require('cors');

function createTestServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  // Mock auth endpoints
  app.post('/api/auth/login', (req, res) => {
    if (req.body.username === 'testuser' && req.body.password === 'TestPass123!') {
      res.json({
        token: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token'
        },
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          roles: ['developer']
        }
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });
  
  app.post('/api/auth/register', (req, res) => {
    res.json({
      token: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token'
      },
      user: {
        id: '2',
        username: req.body.username,
        email: req.body.email,
        roles: ['viewer']
      }
    });
  });
  
  app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true });
  });
  
  // Mock tasks endpoints
  let tasks = [
    { id: '1', title: 'Sample Task 1', status: 'pending', priority: 'medium' },
    { id: '2', title: 'Sample Task 2', status: 'completed', priority: 'high' }
  ];
  
  app.get('/api/tasks', (req, res) => {
    res.json({ tasks });
  });
  
  app.post('/api/tasks', (req, res) => {
    const newTask = {
      id: Date.now().toString(),
      ...req.body,
      status: 'pending',
      createdAt: new Date()
    };
    tasks.push(newTask);
    res.status(201).json(newTask);
  });
  
  app.put('/api/tasks/:id', (req, res) => {
    const taskIndex = tasks.findIndex(t => t.id === req.params.id);
    if (taskIndex !== -1) {
      tasks[taskIndex] = { ...tasks[taskIndex], ...req.body };
      res.json(tasks[taskIndex]);
    } else {
      res.status(404).json({ error: 'Task not found' });
    }
  });
  
  app.delete('/api/tasks/:id', (req, res) => {
    tasks = tasks.filter(t => t.id !== req.params.id);
    res.json({ success: true });
  });
  
  // Mock dashboard data
  app.get('/api/dashboard/stats', (req, res) => {
    res.json({
      totalTasks: tasks.length,
      activeTasks: tasks.filter(t => t.status === 'pending').length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      successRate: 75
    });
  });
  
  return app;
}

module.exports = createTestServer;