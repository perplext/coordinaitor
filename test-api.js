const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Mock data
const users = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@test.com',
    password: '$2a$10$YourHashedPasswordHere', // password: admin123
    role: 'admin'
  }
];

const tasks = [
  {
    id: '1',
    title: 'Test Task',
    description: 'This is a test task',
    status: 'pending',
    priority: 'high',
    assignedTo: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const agents = [
  {
    id: 'claude-1',
    name: 'Claude Agent',
    type: 'api',
    provider: 'Anthropic',
    status: 'idle',
    capabilities: ['planning', 'development', 'testing'],
    maxConcurrentTasks: 3,
    config: {}
  },
  {
    id: 'gpt-1',
    name: 'GPT-4 Agent',
    type: 'api',
    provider: 'OpenAI',
    status: 'idle',
    capabilities: ['design', 'development', 'security'],
    maxConcurrentTasks: 5,
    config: {}
  }
];

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  // For testing, accept admin@test.com / admin123
  if (email === 'admin@test.com' && password === 'admin123') {
    const token = jwt.sign({ id: '1', email, role: 'admin' }, 'test-secret', { expiresIn: '24h' });
    res.json({
      success: true,
      token,
      user: { id: '1', username: 'admin', email, role: 'admin' }
    });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  // Mock registration
  const newUser = {
    id: Date.now().toString(),
    username,
    email,
    role: 'user'
  };
  
  users.push({ ...newUser, password: await bcrypt.hash(password, 10) });
  
  const token = jwt.sign({ id: newUser.id, email, role: 'user' }, 'test-secret', { expiresIn: '24h' });
  res.json({
    success: true,
    token,
    user: newUser
  });
});

// Task endpoints
app.get('/api/tasks', (req, res) => {
  res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
  const newTask = {
    id: Date.now().toString(),
    ...req.body,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  tasks.push(newTask);
  res.json(newTask);
});

app.get('/api/tasks/:id', (req, res) => {
  const task = tasks.find(t => t.id === req.params.id);
  if (task) {
    res.json(task);
  } else {
    res.status(404).json({ message: 'Task not found' });
  }
});

// Agent endpoints
app.get('/api/agents', (req, res) => {
  res.json(agents);
});

app.get('/api/agents/:id', (req, res) => {
  const agent = agents.find(a => a.id === req.params.id);
  if (agent) {
    res.json(agent);
  } else {
    res.status(404).json({ message: 'Agent not found' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Start server
app.listen(port, () => {
  console.log(`Test API server running at http://localhost:${port}`);
  console.log('\nAvailable endpoints:');
  console.log('  POST /api/auth/login     - Login (admin@test.com / admin123)');
  console.log('  POST /api/auth/register  - Register new user');
  console.log('  GET  /api/tasks          - List tasks');
  console.log('  POST /api/tasks          - Create task');
  console.log('  GET  /api/tasks/:id      - Get task by ID');
  console.log('  GET  /api/agents         - List agents');
  console.log('  GET  /api/agents/:id     - Get agent by ID');
  console.log('  GET  /health             - Health check');
});