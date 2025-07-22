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
import winston from 'winston';

export class TaskOrchestrator extends EventEmitter {
  private tasks: Map<string, Task> = new Map();
  private projects: Map<string, Project> = new Map();
  private taskQueue: Task[] = [];
  private runningTasks: Map<string, { agentId: string, startTime: Date }> = new Map();
  private logger: winston.Logger;
  private gitService: GitService | null = null;
  private notificationService: NotificationService | null = null;

  constructor(
    private agentRegistry: AgentRegistry,
    private communicationHub: CommunicationHubImplementation,
    gitConfig?: GitConfig,
    notificationConfig?: NotificationConfig
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

    this.startTaskProcessor();
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
      metadata: params.context
    };

    this.tasks.set(task.id, task);
    this.taskQueue.push(task);
    this.sortTaskQueue();
    
    this.logger.info(`Task created: ${task.id} - ${task.title}`);
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
      context: { projectId }
    });

    const result = await this.executeTask(decompositionTask.id);
    
    const tasks = this.parseTaskDecomposition(result.result.content, projectId);
    
    project.tasks = tasks.map(t => t.id);
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
            createdAt: new Date()
          };
          
          tasks.push(task);
          this.tasks.set(task.id, task);
        }
      }
    }
    
    return tasks;
  }

  public async executeTask(taskId: string): Promise<any> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const agentScores = this.agentRegistry.findBestAgentForTask(task);
    if (agentScores.length === 0) {
      throw new Error('No available agents for this task');
    }

    const bestAgent = this.agentRegistry.getAgent(agentScores[0].agentId);
    if (!bestAgent) {
      throw new Error('Agent not found');
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
      
      this.logger.error(`Task ${taskId} execution error:`, error);
      this.emit('task:error', { task, error });
      
      throw error;
    } finally {
      this.runningTasks.delete(taskId);
    }
  }

  private startTaskProcessor(): void {
    setInterval(() => {
      this.processPendingTasks();
    }, 5000);
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

  public getRunningTasks(): Map<string, { agentId: string, startTime: Date }> {
    return new Map(this.runningTasks);
  }
}