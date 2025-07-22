import { EventEmitter } from 'events';
import { 
  BaseAgent, 
  AgentConfig, 
  AgentStatus, 
  AgentRequest, 
  AgentResponse 
} from '../interfaces/agent.interface';
import { MCPClient } from '../communication/mcp-client';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

export abstract class BaseAgentImplementation extends BaseAgent {
  protected status: AgentStatus;
  protected logger: winston.Logger;
  protected eventEmitter: EventEmitter;
  protected mcpClient: MCPClient | null = null;
  protected currentTask: AgentRequest | null = null;
  protected taskHistory: AgentResponse[] = [];
  protected startTime: Date;

  constructor(config: AgentConfig) {
    super(config);
    
    this.startTime = new Date();
    this.eventEmitter = new EventEmitter();
    
    this.status = {
      id: config.id,
      state: 'idle',
      lastActivity: new Date(),
      totalTasksCompleted: 0,
      successRate: 0,
      averageResponseTime: 0
    };

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${this.config.name}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: `logs/agent-${config.id}.log`,
          maxsize: 10485760,
          maxFiles: 5
        })
      ]
    });
  }

  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing agent');
      
      if (this.config.endpoint && this.config.endpoint.startsWith('http')) {
        const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:4000';
        const mcpSecretKey = process.env.MCP_SECRET_KEY || 'default-secret';
        this.mcpClient = new MCPClient(mcpServerUrl, mcpSecretKey);
        await this.mcpClient.connect();
      }

      await this.onInitialize();
      
      this.status.state = 'idle';
      this.logger.info('Agent initialized successfully');
      this.emit('initialized', { agentId: this.config.id });
    } catch (error) {
      this.logger.error('Failed to initialize agent', error);
      this.status.state = 'error';
      throw error;
    }
  }

  public async execute(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    this.currentTask = request;
    this.status.state = 'busy';
    this.status.currentTask = request.taskId;
    this.status.lastActivity = new Date();

    const response: AgentResponse = {
      taskId: request.taskId,
      agentId: this.config.id,
      success: false,
      duration: 0
    };

    try {
      this.logger.info(`Executing task ${request.taskId}`, {
        priority: request.priority,
        hasContext: !!request.context
      });

      this.emit('task:started', { agentId: this.config.id, taskId: request.taskId });

      const timeout = request.timeout || this.config.timeout || 300000;
      const result = await Promise.race([
        this.onExecute(request),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Task timeout')), timeout)
        )
      ]);

      response.result = result;
      response.success = true;
      
      this.logger.info(`Task ${request.taskId} completed successfully`);
    } catch (error) {
      response.error = error instanceof Error ? error.message : 'Unknown error';
      response.success = false;
      
      this.logger.error(`Task ${request.taskId} failed`, error);
    } finally {
      response.duration = Date.now() - startTime;
      
      this.taskHistory.push(response);
      this.updateStatistics();
      
      this.currentTask = null;
      this.status.state = 'idle';
      this.status.currentTask = undefined;
      
      this.emit('task:completed', {
        agentId: this.config.id,
        taskId: request.taskId,
        success: response.success,
        duration: response.duration
      });
    }

    return response;
  }

  public getStatus(): AgentStatus {
    return { ...this.status };
  }

  public async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down agent');
      
      if (this.currentTask) {
        this.logger.warn('Shutting down with active task', { taskId: this.currentTask.taskId });
      }

      if (this.mcpClient) {
        await this.mcpClient.disconnect();
      }

      await this.onShutdown();
      
      this.status.state = 'offline';
      this.logger.info('Agent shut down successfully');
      this.emit('shutdown', { agentId: this.config.id });
    } catch (error) {
      this.logger.error('Error during shutdown', error);
      throw error;
    }
  }

  protected abstract onInitialize(): Promise<void>;
  protected abstract onExecute(request: AgentRequest): Promise<any>;
  protected abstract onShutdown(): Promise<void>;

  protected emit(event: string, data: any): void {
    this.eventEmitter.emit(event, data);
  }

  public on(event: string, handler: (data: any) => void): void {
    this.eventEmitter.on(event, handler);
  }

  public off(event: string, handler: (data: any) => void): void {
    this.eventEmitter.off(event, handler);
  }

  private updateStatistics(): void {
    const completedTasks = this.taskHistory.filter(t => t.taskId !== '');
    const successfulTasks = completedTasks.filter(t => t.success);
    
    this.status.totalTasksCompleted = completedTasks.length;
    this.status.successRate = completedTasks.length > 0
      ? (successfulTasks.length / completedTasks.length) * 100
      : 0;
    
    if (completedTasks.length > 0) {
      const totalDuration = completedTasks.reduce((sum, task) => sum + task.duration, 0);
      this.status.averageResponseTime = totalDuration / completedTasks.length;
    }
  }

  protected async callMCPTool(toolName: string, input: any): Promise<any> {
    if (!this.mcpClient) {
      throw new Error('MCP client not initialized');
    }
    
    return await this.mcpClient.executeTool(toolName, input);
  }

  public getCapabilities() {
    return this.config.capabilities;
  }

  public getCost() {
    return this.config.cost;
  }
}