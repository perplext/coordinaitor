import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentRegistry } from '../agents/agent-registry';
import { CommunicationHubImplementation } from '../communication/communication-hub';
import { 
  Task, 
  Project, 
  TaskDecomposition, 
  TaskDependency 
} from '../interfaces/task.interface';
import { AgentRequest } from '../interfaces/agent.interface';
import { GitService, GitConfig } from '../services/git-service';
import { NotificationService, NotificationConfig } from '../services/notification-service';
import { CollaborationManager, CollaborationStrategy } from '../collaboration/collaboration-manager';
import { MLEstimationService, TaskEstimation } from '../services/ml-estimation-service';
import { SecurityScannerService, SecurityScanResult, ScannerConfig } from '../services/security-scanner-service';
import { PRDDecompositionService, DecompositionResult } from '../services/prd-decomposition-service';
import { PatternLearningService } from '../services/pattern-learning';
import { AgentCapacityManager } from '../services/agent-capacity-manager';
import winston from 'winston';

export class TaskOrchestrator extends EventEmitter {
  private tasks: Map<string, Task> = new Map();
  private projects: Map<string, Project> = new Map();
  private taskQueue: Task[] = [];
  private runningTasks: Map<string, { agentId: string, startTime: Date }> = new Map();
  private logger: winston.Logger;
  private gitService: GitService | null = null;
  private notificationService: NotificationService | null = null;
  private collaborationManager: CollaborationManager;
  private mlEstimationService: MLEstimationService;
  private securityScanner: SecurityScannerService;
  private prdDecompositionService: PRDDecompositionService;
  private agentCapacityManager: AgentCapacityManager;
  private taskProcessorInterval: NodeJS.Timeout | null = null;

  constructor(
    private agentRegistry: AgentRegistry,
    private communicationHub: CommunicationHubImplementation,
    gitConfig?: GitConfig,
    notificationConfig?: NotificationConfig,
    securityConfig?: ScannerConfig
  ) {
    super();
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    if (gitConfig) {
      this.gitService = new GitService(gitConfig);
      this.gitService.initialize().catch(err => {
        this.logger.error('Failed to initialize Git service:', err);
      });
    }

    if (notificationConfig) {
      this.notificationService = new NotificationService(notificationConfig);
    }

    this.collaborationManager = new CollaborationManager(agentRegistry, communicationHub);
    this.setupCollaborationHandlers();

    this.mlEstimationService = new MLEstimationService();
    this.setupMLHandlers();

    this.securityScanner = new SecurityScannerService(securityConfig);
    this.setupSecurityHandlers();

    const patternLearning = new PatternLearningService();
    this.prdDecompositionService = new PRDDecompositionService(agentRegistry, patternLearning);

    this.agentCapacityManager = new AgentCapacityManager();
    this.setupCapacityHandlers();
    
    // Register all agents with capacity manager
    for (const agent of agentRegistry.getAllAgents()) {
      this.agentCapacityManager.registerAgent(agent.config);
    }

    this.startTaskProcessor();
  }

  private setupCapacityHandlers(): void {
    // Handle task assignment events
    this.agentCapacityManager.on('task:assigned', ({ agentId, taskId, currentLoad, maxCapacity }) => {
      this.logger.info(`Task ${taskId} assigned to agent ${agentId} (${currentLoad}/${maxCapacity})`);
    });

    // Handle task queueing
    this.agentCapacityManager.on('task:queued', ({ agentId, taskId, queueSize }) => {
      this.logger.info(`Task ${taskId} queued for agent ${agentId} (queue size: ${queueSize})`);
      this.emit('task:queued', { agentId, taskId, queueSize });
    });

    // Handle task dequeuing
    this.agentCapacityManager.on('task:dequeued', ({ agentId, taskId }) => {
      // Re-attempt to execute the dequeued task
      this.executeTask(taskId).catch(error => {
        this.logger.error(`Failed to execute dequeued task ${taskId}:`, error);
      });
    });

    // Handle orphaned tasks (when agent is unregistered)
    this.agentCapacityManager.on('tasks:orphaned', ({ tasks, agentId }) => {
      this.logger.warn(`Agent ${agentId} unregistered with ${tasks.length} active tasks`);
      // Mark tasks as failed and requeue them
      tasks.forEach(taskId => {
        const task = this.tasks.get(taskId);
        if (task) {
          task.status = 'failed';
          task.error = 'Agent disconnected';
          this.taskQueue.push(task);
        }
      });
    });

    // Handle rebalancing events
    this.agentCapacityManager.on('task:rebalanced', ({ taskId, fromAgent, toAgent }) => {
      this.logger.info(`Task ${taskId} rebalanced from ${fromAgent} to ${toAgent}`);
    });

    // Monitor capacity metrics
    this.agentCapacityManager.on('metrics:updated', (metrics) => {
      if (metrics.bottleneckAgents.length > 0) {
        this.emit('capacity:bottleneck', { 
          agents: metrics.bottleneckAgents,
          queuedTasks: metrics.queuedTasks 
        });
      }
    });
  }

  private setupSecurityHandlers(): void {
    this.securityScanner.on('scan:completed', (result) => {
      this.logger.info(`Security scan completed: ${result.tool} found ${result.findings.length} issues`);
    });

    this.securityScanner.on('policy:violated', ({ task, violations }) => {
      this.logger.error(`Security policy violations for task ${task.id}:`, violations);
      this.emit('security:violation', { task, violations });
    });
  }

  private setupMLHandlers(): void {
    // Update ML model when tasks complete
    this.on('task:completed', async ({ task, response }) => {
      if (task.actualDuration && task.assignedAgent) {
        const agentCount = task.metadata?.collaborationAgents?.length || 1;
        const cost = response?.cost || 0;
        
        await this.mlEstimationService.updateModel(
          task,
          task.actualDuration,
          true,
          agentCount,
          cost
        );
      }
    });

    this.on('task:failed', async ({ task }) => {
      if (task.actualDuration && task.assignedAgent) {
        const agentCount = task.metadata?.collaborationAgents?.length || 1;
        
        await this.mlEstimationService.updateModel(
          task,
          task.actualDuration,
          false,
          agentCount
        );
      }
    });
  }

  private setupCollaborationHandlers(): void {
    this.collaborationManager.on('session:completed', (session) => {
      this.logger.info(`Collaboration session ${session.id} completed for task ${session.taskId}`);
      
      const task = this.tasks.get(session.taskId);
      if (task && session.results.length > 0) {
        task.output = session.results;
        task.status = 'completed';
        task.completedAt = new Date();
        this.emit('task:completed', { task, collaboration: true });
      }
    });

    this.collaborationManager.on('session:failed', ({ session, error }) => {
      this.logger.error(`Collaboration session ${session.id} failed:`, error);
      
      const task = this.tasks.get(session.taskId);
      if (task) {
        task.status = 'failed';
        task.error = error.message;
        this.emit('task:failed', { task, error, collaboration: true });
      }
    });
  }

  public async createTask(params: {
    prompt: string;
    type?: Task['type'];
    priority?: Task['priority'];
    context?: any;
    projectId?: string;
    dependencies?: string[];
  }): Promise<Task> {
    const task: Task = {
      id: uuidv4(),
      projectId: params.projectId || '',
      type: params.type || 'implementation',
      title: this.generateTaskTitle(params.prompt),
      description: params.prompt,
      dependencies: params.dependencies || [],
      status: 'pending',
      priority: params.priority || 'medium',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: params.context
    };

    // Get ML estimation
    const availableAgents = this.agentRegistry.getAllAgents();
    const estimation = await this.mlEstimationService.estimateTask(task, availableAgents);
    
    task.estimatedDuration = estimation.estimatedDuration;
    task.metadata = {
      ...task.metadata,
      mlEstimation: estimation
    };

    this.tasks.set(task.id, task);
    this.taskQueue.push(task);
    this.sortTaskQueue();
    
    this.logger.info(`Task created: ${task.id} - ${task.title} (estimated: ${estimation.estimatedDuration}ms)`);
    this.emit('task:created', task);
    
    return task;
  }

  public async createProject(params: {
    name: string;
    description: string;
    prd?: string;
  }): Promise<Project> {
    const project: Project = {
      id: uuidv4(),
      name: params.name,
      description: params.description,
      prd: params.prd,
      tasks: [],
      milestones: [],
      status: 'planning',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.projects.set(project.id, project);
    
    this.logger.info(`Project created: ${project.id} - ${project.name}`);
    this.emit('project:created', project);
    
    return project;
  }

  public async decomposeProject(projectId: string): Promise<Task[]> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    try {
      // Use the new PRD decomposition service
      const decompositionResult = await this.prdDecompositionService.decomposePRD(project);
      
      // Store requirements
      project.requirements = decompositionResult.requirements;
      
      // Store milestones
      project.milestones = decompositionResult.milestones;
      
      // Add tasks to orchestrator
      decompositionResult.tasks.forEach(task => {
        this.tasks.set(task.id, task);
      });
      
      // Update project
      project.tasks = decompositionResult.tasks;
      project.status = 'active';
      project.updatedAt = new Date();
      project.metadata = {
        ...project.metadata,
        estimatedDuration: decompositionResult.estimatedDuration,
        riskFactors: decompositionResult.riskFactors,
        decompositionDate: new Date()
      };
      
      // Emit decomposition event
      this.emit('project:decomposed', {
        project,
        decomposition: decompositionResult
      });
      
      this.logger.info(`Project ${project.name} decomposed into ${decompositionResult.tasks.length} tasks`);
      
      return decompositionResult.tasks;
    } catch (error) {
      this.logger.error('Failed to decompose project:', error);
      
      // Fallback to basic decomposition
      return this.basicProjectDecomposition(project);
    }
  }

  private async basicProjectDecomposition(project: Project): Promise<Task[]> {
    // Fallback method using the original approach
    const decompositionTask = await this.createTask({
      prompt: `Analyze the following project and create a detailed task breakdown:

Project: ${project.name}
Description: ${project.description}
${project.prd ? `PRD: ${project.prd}` : ''}

Create a comprehensive list of tasks including:
1. Requirements analysis
2. Design tasks
3. Implementation tasks
4. Testing tasks
5. Deployment tasks

For each task, specify:
- Clear title and description
- Task type (requirement/design/implementation/test/deployment)
- Priority (critical/high/medium/low)
- Estimated duration
- Dependencies on other tasks
- Required skills or technologies`,
      type: 'requirement',
      priority: 'high',
      context: { projectId: project.id }
    });

    const result = await this.executeTask(decompositionTask.id, false);
    
    const tasks = this.parseTaskDecomposition(result.result.content, project.id);
    
    project.tasks = tasks;
    project.status = 'active';
    project.updatedAt = new Date();
    
    return tasks;
  }

  private parseTaskDecomposition(content: string, projectId: string): Task[] {
    const tasks: Task[] = [];
    
    const sections = content.split(/\n(?=\d+\.|#{1,3}\s)/);
    
    for (const section of sections) {
      if (section.trim()) {
        const titleMatch = section.match(/^(?:\d+\.\s*|#{1,3}\s*)(.+?)(?:\n|$)/);
        if (titleMatch) {
          const title = titleMatch[1].trim();
          const description = section.substring(titleMatch[0].length).trim();
          
          const typeMatch = section.match(/type:\s*(requirement|design|implementation|test|deployment)/i);
          const priorityMatch = section.match(/priority:\s*(critical|high|medium|low)/i);
          
          const task: Task = {
            id: uuidv4(),
            projectId,
            type: (typeMatch?.[1] as Task['type']) || 'implementation',
            title,
            description: description || title,
            dependencies: [],
            status: 'pending',
            priority: (priorityMatch?.[1] as Task['priority']) || 'medium',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          tasks.push(task);
          this.tasks.set(task.id, task);
        }
      }
    }
    
    return tasks;
  }

  public async executeTask(taskId: string, useCollaboration: boolean = false): Promise<any> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Check if task requires collaboration
    if (useCollaboration || this.requiresCollaboration(task)) {
      return this.executeTaskWithCollaboration(task);
    }

    // Get eligible agents for the task
    const agentScores = this.agentRegistry.findBestAgentForTask(task);
    if (agentScores.length === 0) {
      throw new Error('No suitable agent found');
    }

    // Get eligible agent IDs
    const eligibleAgentIds = agentScores.map(score => score.agentId);
    
    // Use capacity manager to find the best available agent
    const selectedAgentId = this.agentCapacityManager.getBestAvailableAgent(eligibleAgentIds);
    
    if (!selectedAgentId) {
      // All eligible agents are at capacity - try to assign to queue
      const firstAgentId = agentScores[0].agentId;
      const queued = this.agentCapacityManager.assignTask(firstAgentId, taskId);
      
      if (!queued) {
        throw new Error('No agents available and failed to queue task');
      }
      
      // Task has been queued, return a pending response
      return {
        taskId,
        agentId: firstAgentId,
        success: false,
        status: 'queued',
        error: 'Task queued - all agents at capacity',
        duration: 0
      };
    }

    const bestAgent = this.agentRegistry.getAgent(selectedAgentId);
    if (!bestAgent) {
      throw new Error('Agent not found');
    }

    // Use capacity manager to assign the task
    const assigned = this.agentCapacityManager.assignTask(selectedAgentId, taskId);
    if (!assigned) {
      // This shouldn't happen if getBestAvailableAgent worked correctly
      throw new Error('Failed to assign task to agent');
    }

    task.assignedAgent = bestAgent.config.id;
    task.status = 'assigned';
    task.startedAt = new Date();
    
    this.runningTasks.set(taskId, {
      agentId: bestAgent.config.id,
      startTime: new Date()
    });

    this.logger.info(`Task ${taskId} assigned to agent ${bestAgent.config.name}`);
    this.emit('task:assigned', { task, agent: bestAgent.config });

    try {
      task.status = 'in_progress';
      
      const request: AgentRequest = {
        taskId,
        prompt: task.description,
        context: task.metadata,
        priority: task.priority
      };

      const response = await bestAgent.execute(request);
      
      if (response.success) {
        task.status = 'completed';
        task.output = response.result;
        task.completedAt = new Date();
        task.actualDuration = response.duration;
        
        this.logger.info(`Task ${taskId} completed successfully`);
        
        // Run security scan if task involves code changes
        if (this.shouldRunSecurityScan(task)) {
          try {
            const scanResults = await this.runSecurityScan(task);
            task.metadata = {
              ...task.metadata,
              securityScan: {
                completed: true,
                results: scanResults.map(r => ({
                  tool: r.tool,
                  findings: r.summary,
                  status: r.status
                }))
              }
            };
          } catch (error) {
            this.logger.error('Security scan failed:', error);
          }
        }
        
        // Auto-commit changes if Git is enabled
        if (this.gitService) {
          try {
            const commitInfo = await this.gitService.autoCommitChanges(task.id, task.title);
            if (commitInfo) {
              this.logger.info(`Auto-committed changes: ${commitInfo.hash}`);
              task.metadata = { 
                ...task.metadata, 
                gitCommit: commitInfo.hash 
              };
            }
          } catch (error) {
            this.logger.error('Git auto-commit failed:', error);
          }
        }
        
        // Notify capacity manager of task completion
        this.agentCapacityManager.completeTask(taskId, response.duration);
        
        this.emit('task:completed', { task, response });

        // Send notification
        if (this.notificationService) {
          this.notificationService.notifyTaskCompleted(
            task,
            bestAgent.config,
            response.duration
          ).catch(err => {
            this.logger.error('Failed to send task completion notification:', err);
          });
        }
      } else {
        task.status = 'failed';
        task.error = response.error;
        
        // Notify capacity manager of task failure
        this.agentCapacityManager.failTask(taskId);
        
        this.logger.error(`Task ${taskId} failed: ${response.error}`);
        this.emit('task:failed', { task, error: response.error });

        // Send notification
        if (this.notificationService) {
          this.notificationService.notifyTaskFailed(
            task,
            response.error || 'Unknown error',
            bestAgent.config
          ).catch(err => {
            this.logger.error('Failed to send task failure notification:', err);
          });
        }
      }

      return response;
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      
      // Notify capacity manager of task failure
      this.agentCapacityManager.failTask(taskId);
      
      this.logger.error(`Task ${taskId} execution error:`, error);
      this.emit('task:error', { task, error });
      
      // Return a failed response instead of throwing
      return {
        taskId,
        agentId: bestAgent.config.id,
        success: false,
        status: 'failed',
        error: task.error,
        duration: Date.now() - (task.startedAt?.getTime() || Date.now())
      };
    } finally {
      this.runningTasks.delete(taskId);
    }
  }

  private startTaskProcessor(): void {
    this.taskProcessorInterval = setInterval(() => {
      this.processPendingTasks();
    }, 5000);
  }

  public stopTaskProcessor(): void {
    if (this.taskProcessorInterval) {
      clearInterval(this.taskProcessorInterval);
      this.taskProcessorInterval = null;
    }
    
    // Also stop the capacity manager
    this.agentCapacityManager.stop();
  }

  private async processPendingTasks(): Promise<void> {
    const availableAgents = this.agentRegistry.getAvailableAgents();
    if (availableAgents.length === 0) return;

    const maxConcurrentTasks = parseInt(process.env.MAX_CONCURRENT_TASKS || '10');
    if (this.runningTasks.size >= maxConcurrentTasks) return;

    const pendingTasks = this.taskQueue.filter(task => {
      if (task.status !== 'pending') return false;
      
      if (task.dependencies && task.dependencies.length > 0) {
        const allDependenciesCompleted = task.dependencies.every(depId => {
          const depTask = this.tasks.get(depId);
          return depTask && depTask.status === 'completed';
        });
        if (!allDependenciesCompleted) return false;
      }
      
      return true;
    });

    for (const task of pendingTasks) {
      if (this.runningTasks.size >= maxConcurrentTasks) break;
      
      try {
        await this.executeTask(task.id);
      } catch (error) {
        this.logger.error(`Failed to execute task ${task.id}:`, error);
      }
    }
  }

  private sortTaskQueue(): void {
    this.taskQueue.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private generateTaskTitle(prompt: string): string {
    const firstLine = prompt.split('\n')[0];
    const title = firstLine.substring(0, 100);
    return title.length < firstLine.length ? title + '...' : title;
  }

  public getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  public getProject(projectId: string): Project | undefined {
    return this.projects.get(projectId);
  }

  public getTasksByProject(projectId: string): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.projectId === projectId);
  }

  public updateTask(taskId: string, updates: Partial<Task>): Task | undefined {
    const task = this.tasks.get(taskId);
    if (!task) {
      return undefined;
    }
    
    const updatedTask = {
      ...task,
      ...updates,
      id: task.id, // Prevent ID change
      updatedAt: new Date()
    };
    
    this.tasks.set(taskId, updatedTask);
    this.emit('task:updated', { task: updatedTask });
    
    return updatedTask;
  }

  public deleteTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }
    
    this.tasks.delete(taskId);
    this.emit('task:deleted', { taskId });
    
    // Remove task from project
    if (task.projectId) {
      const project = this.projects.get(task.projectId);
      if (project) {
        project.tasks = project.tasks.filter(t => t.id !== taskId);
        project.updatedAt = new Date();
      }
    }
    
    return true;
  }

  public deleteProject(projectId: string): boolean {
    const project = this.projects.get(projectId);
    if (!project) {
      return false;
    }
    
    this.projects.delete(projectId);
    this.emit('project:deleted', { projectId });
    
    return true;
  }

  public getAllProjects(): Project[] {
    return Array.from(this.projects.values());
  }

  public getRunningTasks(): Map<string, { agentId: string, startTime: Date }> {
    return new Map(this.runningTasks);
  }

  public async getTasks(filters?: {
    status?: Task['status'];
    type?: Task['type'];
    priority?: Task['priority'];
  }): Promise<Task[]> {
    let tasks = Array.from(this.tasks.values());
    
    if (filters) {
      if (filters.status) {
        tasks = tasks.filter(task => task.status === filters.status);
      }
      if (filters.type) {
        tasks = tasks.filter(task => task.type === filters.type);
      }
      if (filters.priority) {
        tasks = tasks.filter(task => task.priority === filters.priority);
      }
    }
    
    return tasks;
  }

  private async resolveDependencyChain(taskId: string): Promise<Task[]> {
    const chain: Task[] = [];
    const visited = new Set<string>();
    
    const resolve = (id: string): void => {
      if (visited.has(id)) {
        throw new Error('Circular dependency detected');
      }
      
      visited.add(id);
      const task = this.tasks.get(id);
      
      if (!task) {
        throw new Error(`Task ${id} not found in dependency chain`);
      }
      
      // Resolve dependencies first
      if (task.dependencies && task.dependencies.length > 0) {
        for (const depId of task.dependencies) {
          resolve(depId);
        }
      }
      
      // Add task after its dependencies
      if (!chain.find(t => t.id === id)) {
        chain.push(task);
      }
    };
    
    resolve(taskId);
    return chain;
  }

  private requiresCollaboration(task: Task): boolean {
    // Check ML estimation recommendation first
    if (task.metadata?.mlEstimation) {
      const estimation = task.metadata.mlEstimation as TaskEstimation;
      if (estimation.recommendedStrategy === 'collaboration') {
        return true;
      }
    }

    // Determine if task requires collaboration based on complexity
    const complexityIndicators = [
      'multiple agents',
      'cross-functional',
      'full stack',
      'end-to-end',
      'comprehensive',
      'integrate',
      'coordinate'
    ];

    const description = task.description.toLowerCase();
    const hasComplexityIndicator = complexityIndicators.some(indicator => 
      description.includes(indicator)
    );

    // High priority complex tasks benefit from collaboration
    const isHighComplexity = task.priority === 'critical' || 
      (task.priority === 'high' && hasComplexityIndicator);

    // Large tasks with multiple requirements
    const hasMultipleRequirements = task.requirements && task.requirements.length > 3;

    return isHighComplexity || hasMultipleRequirements || hasComplexityIndicator;
  }

  private async executeTaskWithCollaboration(task: Task): Promise<any> {
    this.logger.info(`Executing task ${task.id} with collaboration`);

    // Determine collaboration strategy
    const strategy = this.determineCollaborationStrategy(task);

    try {
      // Create collaboration session
      const session = await this.collaborationManager.createCollaborationSession(task, strategy);
      
      task.status = 'in_progress';
      task.metadata = {
        ...task.metadata,
        collaborationSessionId: session.id,
        collaborationAgents: session.agents
      };

      // Execute collaboration
      const results = await this.collaborationManager.executeCollaborationSession(session.id);
      
      // Process results
      const synthesizedResult = this.synthesizeCollaborationResults(results);
      
      task.status = 'completed';
      task.output = synthesizedResult;
      task.completedAt = new Date();
      task.actualDuration = Date.now() - task.startedAt!.getTime();

      this.logger.info(`Task ${task.id} completed with collaboration`);
      
      // Auto-commit if enabled
      if (this.gitService) {
        try {
          const commitInfo = await this.gitService.autoCommitChanges(
            task.id, 
            `[Collaboration] ${task.title}`
          );
          if (commitInfo) {
            task.metadata.gitCommit = commitInfo.hash;
          }
        } catch (error) {
          this.logger.error('Git auto-commit failed:', error);
        }
      }

      // Send notification
      if (this.notificationService) {
        this.notificationService.notifyTaskCompleted(
          task,
          { id: 'collaboration', name: 'Multi-Agent Collaboration' } as any,
          task.actualDuration
        ).catch(err => {
          this.logger.error('Failed to send notification:', err);
        });
      }

      return synthesizedResult;
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Collaboration failed';
      
      this.logger.error(`Task ${task.id} collaboration failed:`, error);
      this.emit('task:error', { task, error });
      
      throw error;
    }
  }

  private determineCollaborationStrategy(task: Task): CollaborationStrategy {
    const description = task.description.toLowerCase();

    // Consensus for design and architecture decisions
    if (task.type === 'design' || description.includes('architecture')) {
      return { type: 'consensus', config: {} };
    }

    // Parallel for independent components
    if (description.includes('frontend') && description.includes('backend')) {
      return { type: 'parallel', config: {} };
    }

    // Hierarchical for complex multi-step tasks
    if (task.priority === 'critical' || (task.requirements && task.requirements.length > 5)) {
      return { type: 'hierarchical', config: {} };
    }

    // Default to sequential
    return { type: 'sequential', config: {} };
  }

  private synthesizeCollaborationResults(results: any[]): any {
    // Combine results from multiple agents
    const synthesis = {
      summary: 'Task completed through multi-agent collaboration',
      results: results,
      combinedOutput: {},
      metadata: {
        agentCount: new Set(results.map(r => r.agentId)).size,
        totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
        timestamp: new Date()
      }
    };

    // Merge outputs
    for (const result of results) {
      if (result.output && typeof result.output === 'object') {
        Object.assign(synthesis.combinedOutput, result.output);
      }
    }

    return synthesis;
  }

  public getCollaborationSessions() {
    return this.collaborationManager.getAllSessions();
  }

  public getCollaborationSession(sessionId: string) {
    return this.collaborationManager.getSession(sessionId);
  }

  public async getTaskEstimation(taskId: string): Promise<TaskEstimation | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    if (task.metadata?.mlEstimation) {
      return task.metadata.mlEstimation as TaskEstimation;
    }

    // Generate new estimation
    const availableAgents = this.agentRegistry.getAllAgents();
    const estimation = await this.mlEstimationService.estimateTask(task, availableAgents);
    
    task.metadata = {
      ...task.metadata,
      mlEstimation: estimation
    };

    return estimation;
  }

  public getMLModelStats() {
    return this.mlEstimationService.getModelStats();
  }

  private shouldRunSecurityScan(task: Task): boolean {
    // Run security scans for implementation, deployment, and review tasks
    return ['implementation', 'deployment', 'review'].includes(task.type);
  }

  private async runSecurityScan(task: Task): Promise<SecurityScanResult[]> {
    // Use project path or current working directory
    const scanPath = this.gitService?.repoPath || process.cwd();
    
    this.logger.info(`Running security scan for task ${task.id} in ${scanPath}`);
    const results = await this.securityScanner.scanTask(task, scanPath);
    
    // Generate and save report
    if (results.length > 0) {
      const report = await this.securityScanner.generateSecurityReport(results);
      // Could save report to file or attach to task
      this.emit('security:report', { task, report, results });
    }
    
    return results;
  }

  public async runManualSecurityScan(taskId: string): Promise<SecurityScanResult[]> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }
    
    return this.runSecurityScan(task);
  }

  public getSecurityScanResults(taskId?: string): SecurityScanResult[] {
    return this.securityScanner.getScanResults(taskId);
  }

  /**
   * Get capacity metrics for all agents
   */
  public getCapacityMetrics() {
    return this.agentCapacityManager.getCapacityMetrics();
  }

  /**
   * Get capacity info for a specific agent
   */
  public getAgentCapacity(agentId: string) {
    return this.agentCapacityManager.getAgentCapacity(agentId);
  }

  /**
   * Update an agent's max concurrent tasks
   */
  public updateAgentCapacity(agentId: string, maxConcurrentTasks: number) {
    this.agentCapacityManager.updateAgentCapacity(agentId, maxConcurrentTasks);
  }

  /**
   * Get load balancing recommendations
   */
  public getLoadBalancingRecommendations() {
    return this.agentCapacityManager.getLoadBalancingRecommendations();
  }

  /**
   * Manually trigger task rebalancing
   */
  public async rebalanceTasks() {
    return this.agentCapacityManager.rebalanceTasks();
  }
}