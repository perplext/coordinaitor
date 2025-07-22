import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { CommunicationHubImplementation } from './communication/communication-hub';
import { AgentRegistry } from './agents/agent-registry';
import { TaskOrchestrator } from './orchestration/task-orchestrator';
import { ClaudeAgent } from './agents/implementations/claude-agent';
import { GeminiAgent } from './agents/implementations/gemini-agent';
import { CodexAgent } from './agents/implementations/codex-agent';
import { AgentConfig } from './interfaces/agent.interface';
import { TemplateService } from './services/template-service';
import { WorkflowService } from './services/workflow-service';
import { NotificationService } from './services/notification-service';
import { AnalyticsService } from './services/analytics-service';
import winston from 'winston';
import path from 'path';

dotenv.config();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ filename: 'orchestrator.log' })
  ]
});

async function main() {
  logger.info('Starting Multi-Agent Orchestrator');

  const app = express();
  const httpServer = createServer(app);
  const port = process.env.PORT || 3000;

  const communicationHub = new CommunicationHubImplementation();
  await communicationHub.initialize(4000);

  const agentRegistry = new AgentRegistry();
  const configPath = path.join(__dirname, '../config/agents.yaml');
  await agentRegistry.loadConfigurations(configPath);

  const claudeConfig = agentRegistry.getAgentConfig('claude-001');
  if (claudeConfig) {
    const claudeAgent = new ClaudeAgent(claudeConfig);
    await claudeAgent.initialize();
    agentRegistry.registerAgent(claudeAgent);
    communicationHub.registerAgent(claudeConfig.id);
  }

  const geminiConfig = agentRegistry.getAgentConfig('gemini-001');
  if (geminiConfig) {
    const geminiAgent = new GeminiAgent(geminiConfig);
    await geminiAgent.initialize();
    agentRegistry.registerAgent(geminiAgent);
    communicationHub.registerAgent(geminiConfig.id);
  }

  const codexConfig = agentRegistry.getAgentConfig('codex-001');
  if (codexConfig) {
    const codexAgent = new CodexAgent(codexConfig);
    await codexAgent.initialize();
    agentRegistry.registerAgent(codexAgent);
    communicationHub.registerAgent(codexConfig.id);
  }

  // Git configuration
  const gitConfig = process.env.ENABLE_GIT === 'true' ? {
    repoPath: process.env.GIT_REPO_PATH || process.cwd(),
    author: {
      name: process.env.GIT_AUTHOR_NAME || 'Multi-Agent Orchestrator',
      email: process.env.GIT_AUTHOR_EMAIL || 'orchestrator@example.com'
    },
    autoCommit: process.env.GIT_AUTO_COMMIT !== 'false',
    commitPrefix: process.env.GIT_COMMIT_PREFIX || '[AI-Task]',
    branch: process.env.GIT_BRANCH
  } : undefined;

  // Notification configuration
  const notificationConfig = {
    slack: process.env.SLACK_WEBHOOK_URL ? {
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_CHANNEL,
      username: process.env.SLACK_USERNAME || 'Multi-Agent Orchestrator',
      iconEmoji: process.env.SLACK_ICON_EMOJI || ':robot_face:'
    } : undefined,
    teams: process.env.TEAMS_WEBHOOK_URL ? {
      webhookUrl: process.env.TEAMS_WEBHOOK_URL
    } : undefined
  };

  // Security configuration
  const securityConfig = {
    enabled: process.env.ENABLE_SECURITY_SCAN !== 'false',
    tools: {
      npm: true,
      trivy: process.env.ENABLE_TRIVY === 'true',
      semgrep: process.env.ENABLE_SEMGREP === 'true',
      gitleaks: process.env.ENABLE_GITLEAKS === 'true',
      eslintSecurity: true
    },
    policy: {
      blockOnCritical: process.env.BLOCK_ON_CRITICAL !== 'false',
      blockOnHigh: process.env.BLOCK_ON_HIGH === 'true'
    }
  };

  const taskOrchestrator = new TaskOrchestrator(agentRegistry, communicationHub, gitConfig, notificationConfig, securityConfig);
  
  // Initialize services
  const templateService = new TemplateService(path.join(__dirname, '../templates'));
  const notificationService = notificationConfig.slack || notificationConfig.teams 
    ? new NotificationService(notificationConfig) 
    : null;
  const workflowService = new WorkflowService(
    taskOrchestrator, 
    templateService, 
    notificationService,
    path.join(__dirname, '../workflows')
  );
  const analyticsService = new AnalyticsService();
  
  // Connect analytics to task orchestrator
  taskOrchestrator.on('task:completed', ({ task }) => {
    analyticsService.recordTask(task);
  });
  
  taskOrchestrator.on('task:failed', ({ task }) => {
    analyticsService.recordTask(task);
  });

  app.use(express.json());
  
  // Enable CORS for development
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Serve static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../../web/dist')));
  }

  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date() });
  });

  app.get('/api/agents', async (req, res) => {
    const agents = agentRegistry.getAllAgents();
    const agentStatuses = agents.map(agent => ({
      id: agent.config.id,
      name: agent.config.name,
      type: agent.config.type,
      provider: agent.config.provider,
      version: agent.config.version,
      status: agent.getStatus(),
      capabilities: agent.config.capabilities,
      endpoint: agent.config.endpoint,
      maxConcurrentTasks: agent.config.maxConcurrentTasks,
      cost: agent.config.cost
    }));
    res.json({ agents: agentStatuses });
  });

  app.get('/api/agents/:id/metrics', async (req, res) => {
    const agent = agentRegistry.getAgent(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    const status = agent.getStatus();
    const health = await agentRegistry.healthCheck();
    const agentHealth = health.get(req.params.id);
    
    res.json({
      agentId: req.params.id,
      status,
      health: agentHealth,
      metrics: {
        totalTasks: status.totalTasksCompleted,
        successRate: status.successRate,
        averageResponseTime: status.averageResponseTime,
        currentLoad: status.state === 'busy' ? 1 : 0,
        lastActivity: status.lastActivity
      }
    });
  });

  app.post('/api/tasks', async (req, res) => {
    try {
      const { prompt, type, priority, context, useCollaboration } = req.body;
      const task = await taskOrchestrator.createTask({
        prompt,
        type: type || 'general',
        priority: priority || 'medium',
        context
      });
      
      const result = await taskOrchestrator.executeTask(task.id, useCollaboration);
      res.json({ task, result });
    } catch (error) {
      logger.error('Task execution failed', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.get('/api/tasks', async (req, res) => {
    try {
      const { status, projectId, agentId } = req.query;
      let tasks = Array.from(taskOrchestrator['tasks'].values());
      
      if (status) {
        tasks = tasks.filter(t => t.status === status);
      }
      if (projectId) {
        tasks = tasks.filter(t => t.projectId === projectId);
      }
      if (agentId) {
        tasks = tasks.filter(t => t.assignedAgent === agentId);
      }
      
      res.json({ tasks });
    } catch (error) {
      logger.error('Failed to get tasks', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/tasks/:id', async (req, res) => {
    const task = taskOrchestrator.getTask(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  });

  app.put('/api/tasks/:id', async (req, res) => {
    try {
      const task = taskOrchestrator.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Update task properties
      Object.assign(task, req.body);
      res.json({ task });
    } catch (error) {
      logger.error('Failed to update task', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/projects', async (req, res) => {
    try {
      const projects = Array.from(taskOrchestrator['projects'].values());
      res.json({ projects });
    } catch (error) {
      logger.error('Failed to get projects', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/api/projects', async (req, res) => {
    try {
      const { name, description, prd } = req.body;
      const project = await taskOrchestrator.createProject({
        name,
        description,
        prd
      });
      
      const tasks = await taskOrchestrator.decomposeProject(project.id);
      res.json({ project, tasks });
    } catch (error) {
      logger.error('Project creation failed', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.get('/api/projects/:id', async (req, res) => {
    const project = taskOrchestrator.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  });

  app.get('/api/projects/:id/tasks', async (req, res) => {
    try {
      const tasks = taskOrchestrator.getTasksByProject(req.params.id);
      res.json({ tasks });
    } catch (error) {
      logger.error('Failed to get project tasks', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Git endpoints
  app.get('/api/git/status', async (req, res) => {
    if (!taskOrchestrator['gitService']) {
      return res.status(404).json({ error: 'Git integration not enabled' });
    }
    try {
      const status = await taskOrchestrator['gitService'].getStatus();
      const branch = await taskOrchestrator['gitService'].getCurrentBranch();
      res.json({ branch, ...status });
    } catch (error) {
      logger.error('Failed to get git status', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/git/history', async (req, res) => {
    if (!taskOrchestrator['gitService']) {
      return res.status(404).json({ error: 'Git integration not enabled' });
    }
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const history = await taskOrchestrator['gitService'].getCommitHistory(limit);
      res.json({ commits: history });
    } catch (error) {
      logger.error('Failed to get git history', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Template endpoints
  app.get('/api/templates', (req, res) => {
    const templates = templateService.getAllTemplates();
    res.json({ templates });
  });

  app.get('/api/templates/:id', (req, res) => {
    const template = templateService.getTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  });

  app.post('/api/templates', (req, res) => {
    try {
      const template = templateService.createTemplate(req.body);
      res.json(template);
    } catch (error) {
      logger.error('Failed to create template', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.put('/api/templates/:id', (req, res) => {
    const template = templateService.updateTemplate(req.params.id, req.body);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  });

  app.delete('/api/templates/:id', async (req, res) => {
    try {
      await templateService.deleteTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete template', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/api/templates/:id/apply', async (req, res) => {
    try {
      const task = templateService.applyTemplate(req.params.id, req.body.variables || {});
      res.json({ task });
    } catch (error) {
      logger.error('Failed to apply template', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Workflow endpoints
  app.get('/api/workflows', (req, res) => {
    const workflows = workflowService.getAllWorkflows();
    res.json({ workflows });
  });

  app.get('/api/workflows/:id', (req, res) => {
    const workflow = workflowService.getWorkflow(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json(workflow);
  });

  app.post('/api/workflows', (req, res) => {
    try {
      const workflow = workflowService.createWorkflow(req.body);
      res.json(workflow);
    } catch (error) {
      logger.error('Failed to create workflow', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/api/workflows/:id/execute', async (req, res) => {
    try {
      const execution = await workflowService.executeWorkflow(req.params.id, req.body.variables || {});
      res.json({ execution });
    } catch (error) {
      logger.error('Failed to execute workflow', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/workflows/:id/executions', (req, res) => {
    const executions = workflowService.getWorkflowExecutions(req.params.id);
    res.json({ executions });
  });

  app.get('/api/executions/:id', (req, res) => {
    const execution = workflowService.getExecution(req.params.id);
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }
    res.json(execution);
  });

  app.post('/api/git/commit', async (req, res) => {
    if (!taskOrchestrator['gitService']) {
      return res.status(404).json({ error: 'Git integration not enabled' });
    }
    try {
      const { message, files } = req.body;
      await taskOrchestrator['gitService'].addFiles(files || '*');
      const commit = await taskOrchestrator['gitService'].commit(message);
      res.json({ commit });
    } catch (error) {
      logger.error('Failed to create commit', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      const project = taskOrchestrator.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Delete all project tasks
      const tasks = taskOrchestrator.getTasksByProject(req.params.id);
      tasks.forEach(task => {
        taskOrchestrator['tasks'].delete(task.id);
      });
      
      // Delete project
      taskOrchestrator['projects'].delete(req.params.id);
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete project', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Analytics endpoints
  app.get('/api/analytics/snapshot', (req, res) => {
    const snapshot = analyticsService.getCurrentSnapshot();
    res.json(snapshot);
  });

  app.get('/api/analytics/agents', (req, res) => {
    const agents = agentRegistry.getAllAgents();
    const metrics = analyticsService.getAgentMetrics(agents);
    res.json({ metrics });
  });

  app.get('/api/analytics/projects', (req, res) => {
    const projects = Array.from(taskOrchestrator['projects'].values());
    const metrics = analyticsService.getProjectMetrics(projects);
    res.json({ metrics });
  });

  app.get('/api/analytics/tasks', (req, res) => {
    const metrics = analyticsService.getTaskMetrics();
    res.json(metrics);
  });

  app.get('/api/analytics/costs', (req, res) => {
    const agents = agentRegistry.getAllAgents();
    const metrics = analyticsService.getCostMetrics(agents);
    res.json(metrics);
  });

  app.get('/api/analytics/insights', (req, res) => {
    const insights = analyticsService.getPerformanceInsights();
    res.json({ insights });
  });

  // Collaboration endpoints
  app.get('/api/collaboration/sessions', (req, res) => {
    const sessions = taskOrchestrator.getCollaborationSessions();
    res.json({ sessions });
  });

  app.get('/api/collaboration/sessions/:id', (req, res) => {
    const session = taskOrchestrator.getCollaborationSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Collaboration session not found' });
    }
    res.json(session);
  });

  app.post('/api/tasks/:id/collaborate', async (req, res) => {
    try {
      const task = taskOrchestrator.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const result = await taskOrchestrator.executeTask(task.id, true);
      res.json({ task, result });
    } catch (error) {
      logger.error('Collaboration execution failed', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // ML Estimation endpoints
  app.get('/api/tasks/:id/estimation', async (req, res) => {
    try {
      const estimation = await taskOrchestrator.getTaskEstimation(req.params.id);
      if (!estimation) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(estimation);
    } catch (error) {
      logger.error('Failed to get task estimation', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/ml/model-stats', (req, res) => {
    const stats = taskOrchestrator.getMLModelStats();
    res.json(stats);
  });

  // Security endpoints
  app.post('/api/tasks/:id/security-scan', async (req, res) => {
    try {
      const results = await taskOrchestrator.runManualSecurityScan(req.params.id);
      res.json({ results });
    } catch (error) {
      logger.error('Failed to run security scan', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/security/scans', (req, res) => {
    const { taskId } = req.query;
    const results = taskOrchestrator.getSecurityScanResults(taskId as string);
    res.json({ results });
  });

  app.get('/api/security/scans/:taskId/report', async (req, res) => {
    try {
      const results = taskOrchestrator.getSecurityScanResults(req.params.taskId);
      if (results.length === 0) {
        return res.status(404).json({ error: 'No security scan results found for this task' });
      }
      
      const securityScanner = (taskOrchestrator as any).securityScanner;
      const report = await securityScanner.generateSecurityReport(results);
      
      res.setHeader('Content-Type', 'text/markdown');
      res.send(report);
    } catch (error) {
      logger.error('Failed to generate security report', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Catch-all route for SPA in production
  if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../../web/dist/index.html'));
    });
  }

  httpServer.listen(port, () => {
    logger.info(`Orchestrator API listening on port ${port}`);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    
    const agents = agentRegistry.getAllAgents();
    for (const agent of agents) {
      await agent.shutdown();
    }
    
    await communicationHub.shutdown();
    httpServer.close();
    process.exit(0);
  });
}

main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});