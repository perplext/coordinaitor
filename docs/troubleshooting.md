# Troubleshooting Guide

This comprehensive troubleshooting guide helps you diagnose and resolve common issues with the CoordinAItor system. It covers system-level problems, application-specific issues, performance problems, and provides step-by-step diagnostic procedures.

## Table of Contents

- [Quick Diagnostic Checklist](#quick-diagnostic-checklist)
- [System-Level Issues](#system-level-issues)
- [Application Issues](#application-issues)
- [Database Problems](#database-problems)
- [Network and Connectivity](#network-and-connectivity)
- [Performance Issues](#performance-issues)
- [AI Provider Issues](#ai-provider-issues)
- [Authentication and Authorization](#authentication-and-authorization)
- [Web UI Problems](#web-ui-problems)
- [Deployment Issues](#deployment-issues)
- [Log Analysis](#log-analysis)
- [Monitoring and Alerts](#monitoring-and-alerts)
- [Recovery Procedures](#recovery-procedures)
- [Getting Help](#getting-help)

## Quick Diagnostic Checklist

When encountering issues, run through this quick checklist first:

### ✅ Basic Health Checks

```bash
# 1. Check if services are running
curl http://localhost:3000/health
curl http://localhost:3001  # Web UI

# 2. Check system resources
free -h
df -h
top

# 3. Check logs for errors
tail -f logs/application.log
docker-compose logs -f  # For Docker deployments

# 4. Test database connectivity
psql -h localhost -U postgres -d coordinaitor -c "SELECT 1;"

# 5. Test Redis connectivity
redis-cli ping

# 6. Check environment variables
env | grep -E "(DATABASE_URL|JWT_SECRET|OPENAI_API_KEY)"
```

### 🔍 Common Quick Fixes

1. **Restart Services**: `pm2 restart all` or `docker-compose restart`
2. **Clear Cache**: `redis-cli FLUSHALL` (use with caution)
3. **Check Permissions**: `chmod +x` on executable files
4. **Update Dependencies**: `npm install` or `npm update`
5. **Check Ports**: `netstat -tlnp | grep -E "(3000|3001|5432|6379)"`

## System-Level Issues

### Process Not Starting

#### Symptoms
- Application fails to start
- Process exits immediately
- "Command not found" errors

#### Diagnostic Steps

```bash
# Check Node.js version
node --version
npm --version

# Check if Node.js can find the application
node -e "console.log('Node.js is working')"

# Check file permissions
ls -la dist/index.js
ls -la package.json

# Check for missing dependencies
npm ls --depth=0

# Check environment variables
printenv | grep NODE_ENV
```

#### Common Solutions

1. **Install Missing Dependencies**:
```bash
npm install
cd web && npm install && cd ..
```

2. **Fix File Permissions**:
```bash
chmod +x dist/index.js
chown -R $USER:$USER .
```

3. **Install Correct Node.js Version**:
```bash
# Using nvm
nvm install 18
nvm use 18

# Or update system Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

4. **Set Required Environment Variables**:
```bash
export NODE_ENV=development
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/multi_agent_orchestrator
export JWT_SECRET=your-secret-key-32-characters-long
```

### High CPU Usage

#### Symptoms
- System becomes slow or unresponsive
- High CPU usage in `top` or `htop`
- Application timeouts

#### Diagnostic Steps

```bash
# Check CPU usage by process
top -p $(pgrep -f "node.*orchestrator")
htop

# Check Node.js process details
ps aux | grep node

# Monitor CPU usage over time
iostat -x 1

# Check for infinite loops or heavy operations
strace -p $(pgrep -f "node.*orchestrator")
```

#### Common Solutions

1. **Optimize Database Queries**:
```sql
-- Find slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;

-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_tasks_status ON tasks(status);
```

2. **Scale Application**:
```bash
# Increase PM2 instances
pm2 scale orchestrator-api +2

# Or adjust PM2 configuration
pm2 delete orchestrator-api
pm2 start ecosystem.config.js
```

3. **Optimize Node.js**:
```javascript
// In ecosystem.config.js
module.exports = {
  apps: [{
    name: 'orchestrator-api',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    node_args: [
      '--max-old-space-size=2048',
      '--optimize-for-size'
    ]
  }]
}
```

### Memory Issues

#### Symptoms
- "Out of memory" errors
- Process crashes with heap errors
- System becomes unresponsive

#### Diagnostic Steps

```bash
# Check memory usage
free -h
cat /proc/meminfo

# Check Node.js memory usage
pm2 monit

# Check for memory leaks
node --inspect dist/index.js
# Then open Chrome DevTools for memory profiling

# Monitor memory over time
watch -n 1 'free -h'
```

#### Common Solutions

1. **Increase Memory Limits**:
```javascript
// In ecosystem.config.js
{
  max_memory_restart: '2G',
  node_args: '--max-old-space-size=4096'
}
```

2. **Fix Memory Leaks**:
```javascript
// Add memory monitoring
setInterval(() => {
  const usage = process.memoryUsage();
  if (usage.heapUsed > 1.5 * 1024 * 1024 * 1024) { // 1.5GB
    console.warn('High memory usage detected:', usage);
  }
}, 60000);
```

3. **Optimize Caching**:
```javascript
// Implement cache limits
const cache = new Map();
const MAX_CACHE_SIZE = 1000;

function addToCache(key, value) {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, value);
}
```

## Application Issues

### Application Crashes

#### Symptoms
- Process exits unexpectedly
- "Cannot read property of undefined" errors
- Unhandled promise rejections

#### Diagnostic Steps

```bash
# Check application logs
tail -f logs/api-error.log
pm2 logs orchestrator-api --err

# Check for core dumps
ls -la /var/crash/
dmesg | grep -i "killed"

# Run application in debug mode
NODE_ENV=development node --inspect dist/index.js
```

#### Common Solutions

1. **Handle Uncaught Exceptions**:
```javascript
// Add to main application file
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
```

2. **Add Error Boundaries**:
```javascript
// Add try-catch blocks around critical code
async function criticalOperation() {
  try {
    await riskyOperation();
  } catch (error) {
    logger.error('Critical operation failed:', error);
    // Handle gracefully instead of crashing
  }
}
```

3. **Enable Process Monitoring**:
```bash
# Use PM2 with automatic restart
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### API Endpoints Not Responding

#### Symptoms
- HTTP requests timeout
- 500 Internal Server Error responses
- Connection refused errors

#### Diagnostic Steps

```bash
# Test API connectivity
curl -v http://localhost:3000/health
curl -v http://localhost:3000/api/tasks

# Check if port is listening
netstat -tlnp | grep :3000
lsof -i :3000

# Check application logs
tail -f logs/api-combined.log

# Test with different methods
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

#### Common Solutions

1. **Check Application Status**:
```bash
pm2 status
pm2 restart orchestrator-api
```

2. **Verify Configuration**:
```bash
# Check environment variables
env | grep PORT
env | grep HOST

# Check if another process is using the port
sudo lsof -i :3000
```

3. **Test Database Connection**:
```javascript
// Add database connection test
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Database connected successfully');
  }
});
```

### Real-time Features Not Working

#### Symptoms
- WebSocket connections fail
- Real-time updates not received
- "WebSocket connection failed" errors

#### Diagnostic Steps

```bash
# Test WebSocket connection
wscat -c ws://localhost:3000/ws

# Check WebSocket logs
grep -i websocket logs/application.log

# Test from browser console
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onopen = () => console.log('Connected');
ws.onerror = (error) => console.error('WebSocket error:', error);
```

#### Common Solutions

1. **Check WebSocket Configuration**:
```javascript
// Verify WebSocket server setup
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});
```

2. **Proxy Configuration**:
```nginx
# In nginx.conf
location /ws {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
}
```

3. **Firewall Rules**:
```bash
# Allow WebSocket connections
sudo ufw allow 3000/tcp
sudo ufw reload
```

## Database Problems

### Connection Failures

#### Symptoms
- "Connection refused" errors
- "FATAL: password authentication failed"
- "FATAL: database does not exist"

#### Diagnostic Steps

```bash
# Test PostgreSQL connection
pg_isready -h localhost -p 5432 -U postgres

# Check PostgreSQL status
sudo systemctl status postgresql
sudo systemctl start postgresql

# Test connection with psql
psql -h localhost -U postgres -d multi_agent_orchestrator

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

#### Common Solutions

1. **Start PostgreSQL Service**:
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

2. **Create Database and User**:
```sql
-- Connect as postgres user
sudo -u postgres psql

-- Create database
CREATE DATABASE multi_agent_orchestrator;

-- Create user with password
CREATE USER orchestrator WITH PASSWORD 'secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE multi_agent_orchestrator TO orchestrator;
```

3. **Fix Authentication**:
```bash
# Edit pg_hba.conf
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Add or modify line:
local   all             orchestrator                                md5
host    all             orchestrator        127.0.0.1/32            md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Slow Query Performance

#### Symptoms
- API responses are slow
- Database queries timeout
- High database CPU usage

#### Diagnostic Steps

```sql
-- Enable query statistics
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slow queries
SELECT query, calls, total_time, mean_time, stddev_time
FROM pg_stat_statements
WHERE mean_time > 100  -- queries taking > 100ms
ORDER BY mean_time DESC
LIMIT 20;

-- Check active queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';

-- Check table sizes
SELECT schemaname,tablename,pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### Common Solutions

1. **Add Indexes**:
```sql
-- Analyze query plans
EXPLAIN ANALYZE SELECT * FROM tasks WHERE status = 'active';

-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_tasks_status ON tasks(status);
CREATE INDEX CONCURRENTLY idx_tasks_created_at ON tasks(created_at);
CREATE INDEX CONCURRENTLY idx_tasks_agent_id ON tasks(agent_id);

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY idx_tasks_status_priority ON tasks(status, priority);
```

2. **Optimize Queries**:
```sql
-- Use LIMIT for large result sets
SELECT id, title, status FROM tasks 
WHERE status = 'active' 
ORDER BY created_at DESC 
LIMIT 50;

-- Use EXISTS instead of IN for subqueries
SELECT t.* FROM tasks t 
WHERE EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = t.project_id AND p.status = 'active'
);
```

3. **Configure PostgreSQL**:
```conf
# In postgresql.conf
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 64MB
maintenance_work_mem = 512MB
random_page_cost = 1.1
effective_io_concurrency = 200
```

### Database Connection Pool Exhaustion

#### Symptoms
- "Pool is destroyed" errors
- "Connection timeout" errors
- API becomes unresponsive under load

#### Diagnostic Steps

```sql
-- Check active connections
SELECT count(*), state FROM pg_stat_activity GROUP BY state;

-- Check connection limits
SHOW max_connections;

-- Monitor connection pool
SELECT * FROM pg_stat_activity WHERE application_name LIKE '%orchestrator%';
```

#### Common Solutions

1. **Optimize Connection Pool**:
```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: 5,
  max: 20,
  acquireTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  createTimeoutMillis: 3000,
  destroyTimeoutMillis: 5000,
  reapIntervalMillis: 1000,
  createRetryIntervalMillis: 200
});
```

2. **Implement Connection Cleanup**:
```javascript
// Properly close connections
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

// Add connection monitoring
setInterval(async () => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT 1');
    console.log('Database health check passed');
  } catch (error) {
    console.error('Database health check failed:', error);
  } finally {
    client.release();
  }
}, 60000);
```

3. **Increase PostgreSQL Limits**:
```conf
# In postgresql.conf
max_connections = 200
shared_buffers = 2GB
```

## Network and Connectivity

### DNS Resolution Issues

#### Symptoms
- "ENOTFOUND" errors
- Cannot resolve hostnames
- Intermittent connection failures

#### Diagnostic Steps

```bash
# Test DNS resolution
nslookup your-domain.com
dig your-domain.com

# Check DNS configuration
cat /etc/resolv.conf

# Test with different DNS servers
nslookup your-domain.com 8.8.8.8
```

#### Common Solutions

1. **Update DNS Configuration**:
```bash
# Add reliable DNS servers
echo "nameserver 8.8.8.8" | sudo tee -a /etc/resolv.conf
echo "nameserver 8.8.4.4" | sudo tee -a /etc/resolv.conf
```

2. **Use IP Addresses Temporarily**:
```env
# In .env file, use IP instead of hostname
DATABASE_URL=postgresql://postgres:password@192.168.1.100:5432/database
```

3. **Configure Docker DNS**:
```yaml
# In docker-compose.yml
services:
  api:
    dns:
      - 8.8.8.8
      - 8.8.4.4
```

### Firewall Blocking Connections

#### Symptoms
- Connection refused on specific ports
- Timeouts when connecting to external services
- Works locally but not from other machines

#### Diagnostic Steps

```bash
# Check firewall status
sudo ufw status
sudo iptables -L

# Test port connectivity
telnet localhost 3000
nc -zv localhost 3000

# Check which processes are listening
sudo netstat -tlnp
sudo ss -tlnp
```

#### Common Solutions

1. **Configure UFW**:
```bash
sudo ufw allow 3000/tcp  # API port
sudo ufw allow 3001/tcp  # Web UI port
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw reload
```

2. **Configure iptables**:
```bash
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
sudo iptables-save > /etc/iptables/rules.v4
```

3. **Docker Port Mapping**:
```yaml
# In docker-compose.yml
services:
  api:
    ports:
      - "3000:3000"
    networks:
      - orchestrator-network
```

### SSL/TLS Certificate Issues

#### Symptoms
- SSL certificate errors
- "Certificate has expired" warnings
- Mixed content warnings

#### Diagnostic Steps

```bash
# Check certificate validity
openssl x509 -in certificate.crt -text -noout
openssl s_client -connect your-domain.com:443

# Check certificate expiration
echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates

# Test SSL configuration
curl -vI https://your-domain.com
```

#### Common Solutions

1. **Renew Let's Encrypt Certificate**:
```bash
sudo certbot renew
sudo systemctl reload nginx
```

2. **Fix Certificate Chain**:
```bash
# Combine certificates in correct order
cat certificate.crt intermediate.crt root.crt > fullchain.crt
```

3. **Update Nginx SSL Configuration**:
```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/fullchain.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
}
```

## Performance Issues

### High Response Times

#### Symptoms
- API requests take longer than 5 seconds
- Timeouts in web UI
- Poor user experience

#### Diagnostic Steps

```bash
# Test API response times
time curl http://localhost:3000/api/tasks

# Monitor with Apache Bench
ab -n 100 -c 10 http://localhost:3000/api/tasks

# Use wrk for load testing
wrk -t12 -c400 -d30s http://localhost:3000/api/tasks

# Check application logs for slow operations
grep -i "slow\|timeout" logs/application.log
```

#### Common Solutions

1. **Add Caching**:
```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes

app.get('/api/tasks', async (req, res) => {
  const cacheKey = `tasks_${JSON.stringify(req.query)}`;
  let tasks = cache.get(cacheKey);
  
  if (!tasks) {
    tasks = await taskService.getAllTasks(req.query);
    cache.set(cacheKey, tasks);
  }
  
  res.json(tasks);
});
```

2. **Optimize Database Queries**:
```javascript
// Use pagination
const tasks = await db.query(`
  SELECT * FROM tasks 
  WHERE status = $1 
  ORDER BY created_at DESC 
  LIMIT $2 OFFSET $3
`, [status, limit, offset]);

// Use select specific columns
const tasks = await db.query(`
  SELECT id, title, status, created_at 
  FROM tasks 
  WHERE status = $1
`, [status]);
```

3. **Implement Connection Pooling**:
```javascript
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Memory Leaks

#### Symptoms
- Memory usage continuously increases
- Application becomes slow over time
- Out of memory crashes

#### Diagnostic Steps

```bash
# Monitor memory usage over time
watch -n 5 'ps -p $(pgrep -f node) -o pid,ppid,cmd,%mem,%cpu --sort=-%mem'

# Use Node.js built-in profiler
node --inspect --heap-prof dist/index.js

# Generate heap dump
kill -USR2 $(pgrep -f node)
```

#### Common Solutions

1. **Fix Event Listener Leaks**:
```javascript
// Remove event listeners when done
const cleanup = () => {
  eventEmitter.removeAllListeners();
  process.removeListener('SIGINT', cleanup);
};
process.on('SIGINT', cleanup);
```

2. **Clear Intervals and Timeouts**:
```javascript
// Store references and clear them
const intervals = [];
const interval = setInterval(() => {
  // Do something
}, 1000);
intervals.push(interval);

// Clear on shutdown
process.on('SIGINT', () => {
  intervals.forEach(clearInterval);
});
```

3. **Implement Memory Monitoring**:
```javascript
setInterval(() => {
  const usage = process.memoryUsage();
  if (usage.heapUsed > 500 * 1024 * 1024) { // 500MB
    console.warn('High memory usage:', {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB'
    });
  }
}, 30000);
```

## AI Provider Issues

### API Key Authentication Failures

#### Symptoms
- "Invalid API key" errors
- 401 Unauthorized responses from AI providers
- "Quota exceeded" errors

#### Diagnostic Steps

```bash
# Test API keys directly
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

curl -H "x-api-key: $ANTHROPIC_API_KEY" \
  https://api.anthropic.com/v1/messages

# Check environment variables
echo $OPENAI_API_KEY | cut -c1-10
echo $ANTHROPIC_API_KEY | cut -c1-10

# Test with curl
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Hello"}]}'
```

#### Common Solutions

1. **Verify API Keys**:
```bash
# Check API key format
if [[ $OPENAI_API_KEY =~ ^sk-[a-zA-Z0-9]{48}$ ]]; then
  echo "OpenAI API key format is correct"
else
  echo "OpenAI API key format is incorrect"
fi
```

2. **Update Environment Variables**:
```bash
# Set in current session
export OPENAI_API_KEY=sk-your-new-key
export ANTHROPIC_API_KEY=sk-ant-your-new-key

# Add to .env file
echo "OPENAI_API_KEY=sk-your-new-key" >> .env
```

3. **Implement API Key Rotation**:
```javascript
const apiKeys = [
  process.env.OPENAI_API_KEY_1,
  process.env.OPENAI_API_KEY_2,
  process.env.OPENAI_API_KEY_3
].filter(Boolean);

let currentKeyIndex = 0;

function getNextApiKey() {
  const key = apiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
  return key;
}
```

### Rate Limit Errors

#### Symptoms
- "Rate limit exceeded" errors
- 429 Too Many Requests responses
- Delayed responses from AI providers

#### Diagnostic Steps

```bash
# Check current usage
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/usage

# Monitor rate limits in logs
grep -i "rate.*limit" logs/application.log

# Check API provider status pages
curl -s https://status.openai.com/api/v2/status.json
```

#### Common Solutions

1. **Implement Rate Limiting**:
```javascript
const rateLimit = require('express-rate-limit');

const openaiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'Rate limit exceeded for OpenAI API'
});

app.use('/api/ai/openai', openaiLimiter);
```

2. **Add Retry Logic with Exponential Backoff**:
```javascript
async function callOpenAI(prompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }]
      });
    } catch (error) {
      if (error.status === 429 && i < retries - 1) {
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

3. **Queue Requests**:
```javascript
const Queue = require('bull');
const aiQueue = new Queue('AI requests', process.env.REDIS_URL);

// Process queue with concurrency limit
aiQueue.process(5, async (job) => {
  const { prompt, model } = job.data;
  return await callAI(prompt, model);
});

// Add requests to queue
async function queueAIRequest(prompt, model) {
  return aiQueue.add('ai-request', { prompt, model }, {
    attempts: 3,
    backoff: 'exponential',
    delay: 1000
  });
}
```

### Model Availability Issues

#### Symptoms
- "Model not found" errors
- Unexpected model responses
- Degraded AI performance

#### Diagnostic Steps

```bash
# Check available models
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# Test specific model
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"Test"}],"max_tokens":10}'
```

#### Common Solutions

1. **Implement Model Fallbacks**:
```javascript
const modelFallbacks = {
  'gpt-4': ['gpt-4-turbo', 'gpt-3.5-turbo'],
  'claude-3-opus': ['claude-3-sonnet', 'claude-3-haiku'],
  'gemini-pro': ['gemini-pro-vision']
};

async function callAIWithFallback(prompt, primaryModel) {
  const modelsToTry = [primaryModel, ...(modelFallbacks[primaryModel] || [])];
  
  for (const model of modelsToTry) {
    try {
      return await callAI(prompt, model);
    } catch (error) {
      if (error.status === 404 && modelsToTry.indexOf(model) < modelsToTry.length - 1) {
        console.warn(`Model ${model} not available, trying fallback`);
        continue;
      }
      throw error;
    }
  }
}
```

2. **Add Model Health Checks**:
```javascript
async function checkModelHealth() {
  const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus'];
  const results = {};
  
  for (const model of models) {
    try {
      await callAI('Test', model);
      results[model] = 'healthy';
    } catch (error) {
      results[model] = 'unhealthy';
      console.error(`Model ${model} health check failed:`, error.message);
    }
  }
  
  return results;
}

// Run health checks periodically
setInterval(checkModelHealth, 300000); // Every 5 minutes
```

## Authentication and Authorization

### JWT Token Issues

#### Symptoms
- "Invalid token" errors
- "Token expired" messages
- Authentication loops

#### Diagnostic Steps

```bash
# Decode JWT token (without verification)
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." | cut -d. -f2 | base64 -d | jq

# Test token validation
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:3000/api/auth/verify

# Check JWT secret
echo $JWT_SECRET | wc -c  # Should be at least 32 characters
```

#### Common Solutions

1. **Fix JWT Secret**:
```bash
# Generate secure JWT secret
openssl rand -base64 32

# Update environment variable
export JWT_SECRET="generated-secure-secret-key-here"
```

2. **Implement Token Refresh**:
```javascript
app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const newAccessToken = jwt.sign(
      { userId: decoded.userId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    res.json({ accessToken: newAccessToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});
```

3. **Add Token Validation**:
```javascript
const validateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

### Session Management Issues

#### Symptoms
- Users get logged out unexpectedly
- Session data is lost
- Multiple login required

#### Diagnostic Steps

```bash
# Check Redis for session data
redis-cli KEYS "sess:*"
redis-cli GET "sess:session-id-here"

# Check session configuration
grep -i session config/default.json

# Monitor session activity
redis-cli MONITOR | grep sess
```

#### Common Solutions

1. **Configure Session Store**:
```javascript
const session = require('express-session');
const RedisStore = require('connect-redis')(session);

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
```

2. **Fix Cookie Configuration**:
```javascript
// For development with different domains
app.use(session({
  cookie: {
    secure: false, // Allow HTTP in development
    sameSite: 'lax', // Allow cross-site requests
    domain: '.localhost' // Allow subdomains
  }
}));
```

### Permission Denied Errors

#### Symptoms
- 403 Forbidden responses
- "Access denied" messages
- Features not accessible to users

#### Diagnostic Steps

```bash
# Check user roles in database
psql -d multi_agent_orchestrator -c "SELECT id, email, role FROM users;"

# Test API with different user tokens
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3000/api/admin/users
curl -H "Authorization: Bearer $USER_TOKEN" http://localhost:3000/api/admin/users

# Check authorization middleware logs
grep -i "authorization\|permission" logs/application.log
```

#### Common Solutions

1. **Fix Role-Based Access Control**:
```javascript
const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (roles && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

// Usage
app.get('/api/admin/users', validateToken, authorize(['admin']), getUsersHandler);
app.get('/api/tasks', validateToken, authorize(['admin', 'user']), getTasksHandler);
```

2. **Implement Resource-Based Permissions**:
```javascript
const canAccessTask = async (userId, taskId) => {
  const task = await db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
  if (!task.rows.length) return false;
  
  // Check if user owns the task or is admin
  const user = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
  return task.rows[0].created_by === userId || user.rows[0].role === 'admin';
};

app.get('/api/tasks/:id', validateToken, async (req, res) => {
  if (!await canAccessTask(req.user.id, req.params.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  // Continue with handler
});
```

## Web UI Problems

### Page Not Loading

#### Symptoms
- Blank white page
- "Cannot GET /" errors
- CSS/JS files not loading

#### Diagnostic Steps

```bash
# Check if web server is running
curl -I http://localhost:3001

# Check browser developer tools
# - Console for JavaScript errors
# - Network tab for failed requests
# - Sources tab for missing files

# Check nginx logs (if using nginx)
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log

# Check file permissions
ls -la web/build/
ls -la web/build/static/
```

#### Common Solutions

1. **Rebuild Web Application**:
```bash
cd web
npm install
npm run build
cd ..
```

2. **Fix Static File Serving**:
```javascript
// In Express app
app.use(express.static(path.join(__dirname, '../web/build')));

// Catch-all handler for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../web/build/index.html'));
});
```

3. **Configure Nginx for SPA**:
```nginx
server {
    listen 80;
    root /path/to/web/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### API Connection Errors

#### Symptoms
- "Network Error" in browser
- CORS errors in console
- API calls failing from web UI

#### Diagnostic Steps

```bash
# Test API from same machine
curl http://localhost:3000/api/health

# Check CORS configuration
curl -H "Origin: http://localhost:3001" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     http://localhost:3000/api/tasks

# Check browser network tab for actual errors
# Check browser console for CORS errors
```

#### Common Solutions

1. **Fix CORS Configuration**:
```javascript
const cors = require('cors');

app.use(cors({
  origin: [
    'http://localhost:3001',
    'http://localhost:3000',
    process.env.WEB_URL
  ].filter(Boolean),
  credentials: true,
  optionsSuccessStatus: 200
}));
```

2. **Update API Base URL**:
```javascript
// In web/src/config.js
const config = {
  apiBaseUrl: process.env.REACT_APP_API_URL || 
              (process.env.NODE_ENV === 'development' 
                ? 'http://localhost:3000' 
                : '/api'),
  wsUrl: process.env.REACT_APP_WS_URL || 
         (process.env.NODE_ENV === 'development' 
           ? 'ws://localhost:3000' 
           : `wss://${window.location.host}`)
};
```

3. **Add Proxy Configuration**:
```json
// In web/package.json
{
  "name": "orchestrator-web",
  "proxy": "http://localhost:3000",
  "scripts": {
    "start": "react-scripts start"
  }
}
```

### Real-time Updates Not Working

#### Symptoms
- Live updates not appearing
- WebSocket connection failures
- "Connection lost" messages

#### Diagnostic Steps

```bash
# Test WebSocket connection
wscat -c ws://localhost:3000

# Check browser developer tools
# - Console for WebSocket errors
# - Network tab for WebSocket connection
# - Application tab for WebSocket frames

# Check server logs for WebSocket activity
grep -i websocket logs/application.log
```

#### Common Solutions

1. **Fix WebSocket Configuration**:
```javascript
// Client-side (React)
useEffect(() => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  const socket = io(wsUrl, {
    transports: ['websocket', 'polling'],
    upgrade: true,
    rememberUpgrade: true
  });

  socket.on('connect', () => {
    console.log('WebSocket connected');
  });

  socket.on('disconnect', () => {
    console.log('WebSocket disconnected');
  });

  return () => socket.disconnect();
}, []);
```

2. **Add Reconnection Logic**:
```javascript
const socket = io(wsUrl, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxReconnectionAttempts: 5
});

socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
});

socket.on('reconnect_error', (error) => {
  console.error('Reconnection failed:', error);
});
```

## Deployment Issues

### Docker Container Issues

#### Symptoms
- Containers not starting
- "Exit code 1" errors
- Port binding failures

#### Diagnostic Steps

```bash
# Check container status
docker ps -a
docker-compose ps

# Check container logs
docker logs orchestrator-api
docker-compose logs api

# Check Docker system
docker system df
docker system prune --dry-run

# Test container locally
docker run -it orchestrator-api:latest /bin/sh
```

#### Common Solutions

1. **Fix Dockerfile Issues**:
```dockerfile
# Use specific Node.js version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Build application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S orchestrator -u 1001
USER orchestrator

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

2. **Fix Docker Compose Configuration**:
```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

3. **Check Resource Limits**:
```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### Kubernetes Deployment Issues

#### Symptoms
- Pods not starting
- ImagePullBackOff errors
- Service not accessible

#### Diagnostic Steps

```bash
# Check pod status
kubectl get pods -n orchestrator
kubectl describe pod orchestrator-api-xxx -n orchestrator

# Check logs
kubectl logs orchestrator-api-xxx -n orchestrator
kubectl logs -f deployment/orchestrator-api -n orchestrator

# Check services
kubectl get services -n orchestrator
kubectl describe service orchestrator-api-service -n orchestrator

# Check ingress
kubectl get ingress -n orchestrator
kubectl describe ingress orchestrator-ingress -n orchestrator
```

#### Common Solutions

1. **Fix Image Pull Issues**:
```bash
# Create image pull secret
kubectl create secret docker-registry regcred \
  --docker-server=your-registry.com \
  --docker-username=username \
  --docker-password=password \
  --docker-email=email@example.com \
  -n orchestrator

# Reference in deployment
spec:
  template:
    spec:
      imagePullSecrets:
      - name: regcred
```

2. **Fix Resource Issues**:
```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
      - name: api
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "1"
```

3. **Fix Service Configuration**:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: orchestrator-api-service
spec:
  selector:
    app: orchestrator-api
  ports:
  - port: 3000
    targetPort: 3000
    protocol: TCP
  type: ClusterIP
```

## Log Analysis

### Reading Application Logs

#### Log Levels and Meanings

```bash
# ERROR: Critical issues requiring immediate attention
grep "ERROR" logs/application.log

# WARN: Potential issues that should be monitored
grep "WARN" logs/application.log

# INFO: General application flow information
grep "INFO" logs/application.log

# DEBUG: Detailed information for troubleshooting
grep "DEBUG" logs/application.log
```

#### Common Log Patterns

```bash
# Database connection issues
grep -i "database\|postgres\|connection" logs/application.log

# Authentication problems
grep -i "auth\|token\|login\|unauthorized" logs/application.log

# Performance issues
grep -i "slow\|timeout\|performance" logs/application.log

# AI provider issues
grep -i "openai\|anthropic\|api.*error" logs/application.log

# Memory issues
grep -i "memory\|heap\|oom" logs/application.log
```

### Structured Log Analysis

#### Using jq for JSON Logs

```bash
# Filter by log level
cat logs/application.log | jq 'select(.level == "error")'

# Filter by timestamp
cat logs/application.log | jq 'select(.timestamp > "2024-01-15T00:00:00Z")'

# Group by error type
cat logs/application.log | jq -r 'select(.level == "error") | .error.type' | sort | uniq -c

# Find slow queries
cat logs/application.log | jq 'select(.duration > 1000)' | jq '.query'
```

#### Log Aggregation with ELK Stack

```bash
# Install Filebeat
curl -L -O https://artifacts.elastic.co/downloads/beats/filebeat/filebeat-8.0.0-linux-x86_64.tar.gz
tar xzvf filebeat-8.0.0-linux-x86_64.tar.gz

# Configure Filebeat
cat > filebeat.yml << EOF
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /path/to/logs/*.log
  fields:
    service: orchestrator
  fields_under_root: true

output.elasticsearch:
  hosts: ["localhost:9200"]

setup.kibana:
  host: "localhost:5601"
EOF

# Start Filebeat
./filebeat -e -c filebeat.yml
```

### Error Pattern Recognition

#### Identifying Common Issues

```bash
# Create error analysis scripts
cat > analyze_errors.sh << 'EOF'
#!/bin/bash

echo "=== Top 10 Error Types ==="
grep -i error logs/application.log | \
  sed 's/.*ERROR \([^:]*\):.*/\1/' | \
  sort | uniq -c | sort -nr | head -10

echo "=== Database Connection Errors ==="
grep -c "connection.*error\|ECONNREFUSED.*postgres" logs/application.log

echo "=== Rate Limit Errors ==="
grep -c "rate.*limit\|429" logs/application.log

echo "=== Memory Errors ==="
grep -c "memory\|heap.*out" logs/application.log

echo "=== Authentication Errors ==="
grep -c "authentication.*failed\|invalid.*token" logs/application.log
EOF

chmod +x analyze_errors.sh
./analyze_errors.sh
```

## Monitoring and Alerts

### Setting Up Health Checks

#### Application Health Endpoint

```javascript
// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version
  };

  try {
    // Check database
    await db.query('SELECT 1');
    health.database = 'connected';
  } catch (error) {
    health.database = 'error';
    health.status = 'degraded';
  }

  try {
    // Check Redis
    await redis.ping();
    health.redis = 'connected';
  } catch (error) {
    health.redis = 'error';
    health.status = 'degraded';
  }

  // Check memory usage
  const memoryUsage = process.memoryUsage();
  health.memory = {
    rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
  };

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

#### External Health Check Script

```bash
#!/bin/bash
# health_check.sh

HEALTH_URL="http://localhost:3000/health"
TIMEOUT=10
MAX_RETRIES=3

check_health() {
  local attempt=1
  
  while [ $attempt -le $MAX_RETRIES ]; do
    response=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$HEALTH_URL")
    http_code="${response##*]}"
    
    if [ "$http_code" = "200" ]; then
      echo "✅ Health check passed (attempt $attempt)"
      return 0
    else
      echo "❌ Health check failed: HTTP $http_code (attempt $attempt)"
      attempt=$((attempt + 1))
      sleep 5
    fi
  done
  
  echo "🚨 Health check failed after $MAX_RETRIES attempts"
  return 1
}

# Send alert if health check fails
if ! check_health; then
  # Send notification (email, Slack, etc.)
  echo "Application health check failed" | mail -s "Orchestrator Alert" admin@example.com
fi
```

### Prometheus Monitoring

#### Custom Metrics

```javascript
const promClient = require('prom-client');

// Create custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const taskProcessingDuration = new promClient.Histogram({
  name: 'task_processing_duration_seconds',
  help: 'Duration of task processing in seconds',
  labelNames: ['task_type', 'agent_id'],
  buckets: [1, 5, 10, 30, 60, 300]
});

const activeConnections = new promClient.Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections'
});

// Middleware to track request duration
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });
  
  next();
});
```

#### Alert Rules

```yaml
# prometheus_alerts.yml
groups:
- name: orchestrator
  rules:
  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High response time detected"
      description: "95th percentile response time is {{ $value }}s"

  - alert: HighErrorRate
    expr: rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.1
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value | humanizePercentage }}"

  - alert: DatabaseDown
    expr: up{job="postgres"} == 0
    for: 30s
    labels:
      severity: critical
    annotations:
      summary: "Database is down"
      description: "PostgreSQL database is not responding"
```

## Recovery Procedures

### Automatic Recovery

#### Application Recovery Script

```bash
#!/bin/bash
# auto_recovery.sh

APP_NAME="orchestrator-api"
HEALTH_URL="http://localhost:3000/health"
MAX_RESTART_ATTEMPTS=3
RESTART_DELAY=30

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a /var/log/orchestrator-recovery.log
}

check_health() {
  curl -sf --max-time 10 "$HEALTH_URL" > /dev/null
}

restart_application() {
  log "Attempting to restart application..."
  pm2 restart "$APP_NAME"
  sleep $RESTART_DELAY
}

main() {
  if check_health; then
    log "Application is healthy"
    exit 0
  fi

  log "Application health check failed, attempting recovery"
  
  for attempt in $(seq 1 $MAX_RESTART_ATTEMPTS); do
    log "Recovery attempt $attempt of $MAX_RESTART_ATTEMPTS"
    
    restart_application
    
    if check_health; then
      log "Application recovered successfully"
      exit 0
    fi
    
    log "Recovery attempt $attempt failed"
  done
  
  log "All recovery attempts failed, manual intervention required"
  
  # Send alert
  echo "Orchestrator application recovery failed after $MAX_RESTART_ATTEMPTS attempts" | \
    mail -s "CRITICAL: Orchestrator Recovery Failed" admin@example.com
  
  exit 1
}

main "$@"
```

#### Database Recovery Script

```bash
#!/bin/bash
# db_recovery.sh

DB_NAME="multi_agent_orchestrator"
DB_USER="postgres"
BACKUP_DIR="/backups/database"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

check_db_health() {
  pg_isready -h localhost -p 5432 -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1
}

restart_postgresql() {
  log "Restarting PostgreSQL service..."
  sudo systemctl restart postgresql
  sleep 10
}

restore_from_backup() {
  local latest_backup=$(ls -t "$BACKUP_DIR"/full_backup_*.dump.gz | head -1)
  
  if [ -z "$latest_backup" ]; then
    log "No backup found in $BACKUP_DIR"
    return 1
  fi
  
  log "Restoring from backup: $latest_backup"
  
  # Create new database
  createdb "${DB_NAME}_restored" -U "$DB_USER"
  
  # Restore backup
  gunzip -c "$latest_backup" | pg_restore -U "$DB_USER" -d "${DB_NAME}_restored"
  
  # Switch databases
  psql -U "$DB_USER" -c "ALTER DATABASE $DB_NAME RENAME TO ${DB_NAME}_corrupted;"
  psql -U "$DB_USER" -c "ALTER DATABASE ${DB_NAME}_restored RENAME TO $DB_NAME;"
  
  log "Database restored successfully"
}

main() {
  if check_db_health; then
    log "Database is healthy"
    exit 0
  fi
  
  log "Database health check failed, attempting recovery"
  
  # Try restarting PostgreSQL
  restart_postgresql
  
  if check_db_health; then
    log "Database recovered after restart"
    exit 0
  fi
  
  # Try restoring from backup
  if restore_from_backup; then
    if check_db_health; then
      log "Database recovered from backup"
      exit 0
    fi
  fi
  
  log "Database recovery failed, manual intervention required"
  exit 1
}

main "$@"
```

### Manual Recovery Procedures

#### Complete System Recovery

1. **Assess the Situation**:
```bash
# Check system status
systemctl status orchestrator-api postgresql redis nginx

# Check logs for recent errors
journalctl -u orchestrator-api --since "1 hour ago"
tail -f /var/log/syslog

# Check resource usage
df -h
free -h
top
```

2. **Database Recovery**:
```bash
# Stop application
pm2 stop orchestrator-api

# Check database status
sudo systemctl status postgresql
pg_isready -h localhost -p 5432

# If database is corrupted, restore from backup
sudo -u postgres psql << EOF
DROP DATABASE IF EXISTS multi_agent_orchestrator;
CREATE DATABASE multi_agent_orchestrator;
GRANT ALL PRIVILEGES ON DATABASE multi_agent_orchestrator TO orchestrator;
\q
EOF

# Restore latest backup
latest_backup=$(ls -t /backups/database/full_backup_*.dump.gz | head -1)
gunzip -c "$latest_backup" | sudo -u postgres pg_restore -d multi_agent_orchestrator
```

3. **Application Recovery**:
```bash
# Update application code
cd /path/to/orchestrator
git pull origin main
npm install
npm run build

# Reset configuration
cp .env.backup .env
source .env

# Start application
pm2 start ecosystem.config.js
pm2 save
```

4. **Verify Recovery**:
```bash
# Check health
curl http://localhost:3000/health

# Check web UI
curl http://localhost:3001

# Check logs
pm2 logs orchestrator-api

# Run smoke tests
npm run test:smoke
```

## Getting Help

### Before Asking for Help

1. **Gather Information**:
   - Error messages and stack traces
   - Application logs
   - System information (OS, Node.js version, etc.)
   - Steps to reproduce the issue
   - What you've already tried

2. **Search Existing Resources**:
   - Check this troubleshooting guide
   - Search the documentation
   - Look for similar issues in GitHub issues
   - Check community forums

3. **Create a Minimal Reproduction**:
   - Isolate the problem
   - Create a simple test case
   - Document the expected vs actual behavior

### How to Report Issues

#### Issue Template

```markdown
## Bug Report

**Environment:**
- OS: [e.g., Ubuntu 20.04, macOS 12.0, Windows 11]
- Node.js version: [e.g., 18.17.0]
- npm version: [e.g., 9.6.7]
- Application version: [e.g., 1.0.0]
- Deployment method: [e.g., Docker, PM2, Kubernetes]

**Describe the bug:**
A clear and concise description of what the bug is.

**To Reproduce:**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Expected behavior:**
A clear and concise description of what you expected to happen.

**Actual behavior:**
What actually happened instead.

**Error logs:**
```
[Paste relevant error logs here]
```

**Screenshots:**
If applicable, add screenshots to help explain your problem.

**Additional context:**
Add any other context about the problem here.
```

### Getting Community Help

#### Discord/Slack Channels
- **#general**: General questions and discussions
- **#troubleshooting**: Specific technical issues
- **#development**: Development-related questions
- **#deployment**: Deployment and infrastructure questions

#### GitHub Issues
- **Bug Reports**: Use the bug report template
- **Feature Requests**: Use the feature request template
- **Questions**: Use the question template

#### Community Forums
- Stack Overflow (tag: coordinaitor)
- Reddit communities
- Developer forums

#### Professional Support
- Enterprise support packages
- Consulting services
- Custom development

---

## Quick Reference

### Emergency Checklist
1. ✅ Check system resources (`top`, `df -h`, `free -h`)
2. ✅ Verify services are running (`systemctl status`, `pm2 status`)
3. ✅ Check application logs (`tail -f logs/*.log`)
4. ✅ Test basic connectivity (`curl health endpoints`)
5. ✅ Restart services if needed (`pm2 restart`, `systemctl restart`)
6. ✅ Check for recent changes (deployments, config updates)

### Common Commands
```bash
# Health checks
curl http://localhost:3000/health
pg_isready -h localhost -p 5432
redis-cli ping

# Service management
pm2 status
pm2 restart orchestrator-api
pm2 logs orchestrator-api

# System monitoring
htop
iostat -x 1
netstat -tlnp

# Log analysis
tail -f logs/application.log
grep -i error logs/application.log
journalctl -u orchestrator-api -f
```

### Support Contacts
- **Documentation**: [docs link]
- **Community Forum**: [forum link]
- **GitHub Issues**: [issues link]
- **Emergency Support**: [emergency contact]

---

*This troubleshooting guide is continuously updated based on common issues and user feedback. If you encounter an issue not covered here, please report it so we can improve this guide.*