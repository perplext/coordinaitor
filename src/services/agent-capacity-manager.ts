import { EventEmitter } from 'events';
import winston from 'winston';
import { AgentConfig, AgentStatus } from '../interfaces/agent.interface';
import { Task } from '../interfaces/task.interface';

export interface AgentCapacityInfo {
  agentId: string;
  maxConcurrentTasks: number;
  currentTasks: Set<string>;
  queuedTasks: string[];
  totalProcessed: number;
  averageTaskDuration: number;
  lastTaskCompletedAt?: Date;
  utilizationPercentage: number;
}

export interface CapacityMetrics {
  totalCapacity: number;
  usedCapacity: number;
  availableCapacity: number;
  queuedTasks: number;
  agentUtilization: Map<string, number>;
  bottleneckAgents: string[];
  underutilizedAgents: string[];
}

export class AgentCapacityManager extends EventEmitter {
  private agentCapacities: Map<string, AgentCapacityInfo> = new Map();
  private taskToAgent: Map<string, string> = new Map();
  private taskDurations: Map<string, { agentId: string; duration: number }> = new Map();
  private logger: winston.Logger;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor() {
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

    // Start metrics collection
    this.startMetricsCollection();
  }

  /**
   * Register an agent with the capacity manager
   */
  public registerAgent(config: AgentConfig): void {
    const capacityInfo: AgentCapacityInfo = {
      agentId: config.id,
      maxConcurrentTasks: config.maxConcurrentTasks || 1,
      currentTasks: new Set(),
      queuedTasks: [],
      totalProcessed: 0,
      averageTaskDuration: 0,
      utilizationPercentage: 0
    };

    this.agentCapacities.set(config.id, capacityInfo);
    this.logger.info(`Registered agent ${config.id} with capacity ${config.maxConcurrentTasks}`);
    
    this.emit('agent:registered', { agentId: config.id, capacity: config.maxConcurrentTasks });
  }

  /**
   * Unregister an agent
   */
  public unregisterAgent(agentId: string): void {
    const capacity = this.agentCapacities.get(agentId);
    if (!capacity) return;

    // Move queued tasks back to global queue
    if (capacity.queuedTasks.length > 0) {
      this.emit('tasks:requeue', { tasks: capacity.queuedTasks, reason: 'agent_unregistered' });
    }

    // Current tasks will need to be handled by the orchestrator
    if (capacity.currentTasks.size > 0) {
      this.emit('tasks:orphaned', { 
        tasks: Array.from(capacity.currentTasks), 
        agentId 
      });
    }

    this.agentCapacities.delete(agentId);
    this.logger.info(`Unregistered agent ${agentId}`);
  }

  /**
   * Check if an agent can accept a new task
   */
  public canAgentAcceptTask(agentId: string): boolean {
    const capacity = this.agentCapacities.get(agentId);
    if (!capacity) return false;

    return capacity.currentTasks.size < capacity.maxConcurrentTasks;
  }

  /**
   * Get the best available agent for a task based on capacity and load
   */
  public getBestAvailableAgent(eligibleAgentIds: string[]): string | null {
    let bestAgent: string | null = null;
    let lowestUtilization = Infinity;
    let shortestQueue = Infinity;

    for (const agentId of eligibleAgentIds) {
      const capacity = this.agentCapacities.get(agentId);
      if (!capacity) continue;

      // Skip if agent is at full capacity
      if (capacity.currentTasks.size >= capacity.maxConcurrentTasks) {
        continue;
      }

      // Prefer agents with lower utilization and shorter queues
      const score = capacity.utilizationPercentage + (capacity.queuedTasks.length * 10);
      
      if (score < lowestUtilization) {
        lowestUtilization = score;
        bestAgent = agentId;
      }
    }

    return bestAgent;
  }

  /**
   * Assign a task to an agent
   */
  public assignTask(agentId: string, taskId: string): boolean {
    const capacity = this.agentCapacities.get(agentId);
    if (!capacity) {
      this.logger.error(`Agent ${agentId} not registered`);
      return false;
    }

    if (!this.canAgentAcceptTask(agentId)) {
      // Add to agent's queue if at capacity
      capacity.queuedTasks.push(taskId);
      this.logger.info(`Task ${taskId} queued for agent ${agentId} (queue size: ${capacity.queuedTasks.length})`);
      
      this.emit('task:queued', { agentId, taskId, queueSize: capacity.queuedTasks.length });
      return false;
    }

    // Assign the task
    capacity.currentTasks.add(taskId);
    this.taskToAgent.set(taskId, agentId);
    this.updateUtilization(agentId);

    this.logger.info(`Task ${taskId} assigned to agent ${agentId} (${capacity.currentTasks.size}/${capacity.maxConcurrentTasks})`);
    
    this.emit('task:assigned', { 
      agentId, 
      taskId, 
      currentLoad: capacity.currentTasks.size,
      maxCapacity: capacity.maxConcurrentTasks 
    });

    // Check if we can process queued tasks
    this.processQueuedTasks(agentId);

    return true;
  }

  /**
   * Mark a task as completed
   */
  public completeTask(taskId: string, duration?: number): void {
    const agentId = this.taskToAgent.get(taskId);
    if (!agentId) {
      this.logger.warn(`No agent found for task ${taskId}`);
      return;
    }

    const capacity = this.agentCapacities.get(agentId);
    if (!capacity) return;

    // Remove task from current tasks
    capacity.currentTasks.delete(taskId);
    capacity.totalProcessed++;
    capacity.lastTaskCompletedAt = new Date();

    // Update average duration if provided
    if (duration !== undefined && duration > 0) {
      this.taskDurations.set(taskId, { agentId, duration });
      this.updateAverageTaskDuration(agentId);
    }

    this.taskToAgent.delete(taskId);
    this.updateUtilization(agentId);

    this.logger.info(`Task ${taskId} completed by agent ${agentId} (${capacity.currentTasks.size}/${capacity.maxConcurrentTasks})`);
    
    this.emit('task:completed', { 
      agentId, 
      taskId, 
      duration,
      currentLoad: capacity.currentTasks.size 
    });

    // Process queued tasks
    this.processQueuedTasks(agentId);
  }

  /**
   * Mark a task as failed
   */
  public failTask(taskId: string): void {
    const agentId = this.taskToAgent.get(taskId);
    if (!agentId) return;

    const capacity = this.agentCapacities.get(agentId);
    if (!capacity) return;

    capacity.currentTasks.delete(taskId);
    this.taskToAgent.delete(taskId);
    this.updateUtilization(agentId);

    this.emit('task:failed', { agentId, taskId });

    // Process queued tasks
    this.processQueuedTasks(agentId);
  }

  /**
   * Process queued tasks for an agent
   */
  private processQueuedTasks(agentId: string): void {
    const capacity = this.agentCapacities.get(agentId);
    if (!capacity) return;

    while (capacity.queuedTasks.length > 0 && this.canAgentAcceptTask(agentId)) {
      const nextTaskId = capacity.queuedTasks.shift()!;
      
      // Re-emit for orchestrator to handle
      this.emit('task:dequeued', { agentId, taskId: nextTaskId });
    }
  }

  /**
   * Update agent utilization percentage
   */
  private updateUtilization(agentId: string): void {
    const capacity = this.agentCapacities.get(agentId);
    if (!capacity) return;

    capacity.utilizationPercentage = 
      (capacity.currentTasks.size / capacity.maxConcurrentTasks) * 100;
  }

  /**
   * Update average task duration for an agent
   */
  private updateAverageTaskDuration(agentId: string): void {
    const capacity = this.agentCapacities.get(agentId);
    if (!capacity) return;

    const agentDurations = Array.from(this.taskDurations.values())
      .filter(td => td.agentId === agentId)
      .map(td => td.duration);

    if (agentDurations.length > 0) {
      capacity.averageTaskDuration = 
        agentDurations.reduce((sum, d) => sum + d, 0) / agentDurations.length;
    }
  }

  /**
   * Get capacity metrics
   */
  public getCapacityMetrics(): CapacityMetrics {
    let totalCapacity = 0;
    let usedCapacity = 0;
    let queuedTasks = 0;
    const agentUtilization = new Map<string, number>();
    const bottleneckAgents: string[] = [];
    const underutilizedAgents: string[] = [];

    for (const [agentId, capacity] of this.agentCapacities) {
      totalCapacity += capacity.maxConcurrentTasks;
      usedCapacity += capacity.currentTasks.size;
      queuedTasks += capacity.queuedTasks.length;
      
      agentUtilization.set(agentId, capacity.utilizationPercentage);

      // Identify bottlenecks (>80% utilization with queued tasks)
      if (capacity.utilizationPercentage > 80 && capacity.queuedTasks.length > 0) {
        bottleneckAgents.push(agentId);
      }

      // Identify underutilized agents (<20% utilization)
      if (capacity.utilizationPercentage < 20) {
        underutilizedAgents.push(agentId);
      }
    }

    return {
      totalCapacity,
      usedCapacity,
      availableCapacity: totalCapacity - usedCapacity,
      queuedTasks,
      agentUtilization,
      bottleneckAgents,
      underutilizedAgents
    };
  }

  /**
   * Get detailed capacity info for an agent
   */
  public getAgentCapacity(agentId: string): AgentCapacityInfo | undefined {
    return this.agentCapacities.get(agentId);
  }

  /**
   * Get all agent capacities
   */
  public getAllAgentCapacities(): Map<string, AgentCapacityInfo> {
    return new Map(this.agentCapacities);
  }

  /**
   * Rebalance tasks across agents
   */
  public async rebalanceTasks(): Promise<void> {
    const metrics = this.getCapacityMetrics();
    
    if (metrics.bottleneckAgents.length === 0 || metrics.underutilizedAgents.length === 0) {
      return; // No rebalancing needed
    }

    this.logger.info('Starting task rebalancing', {
      bottlenecks: metrics.bottleneckAgents,
      underutilized: metrics.underutilizedAgents
    });

    // Move tasks from bottleneck agents to underutilized ones
    for (const bottleneckId of metrics.bottleneckAgents) {
      const bottleneck = this.agentCapacities.get(bottleneckId);
      if (!bottleneck || bottleneck.queuedTasks.length === 0) continue;

      for (const underutilizedId of metrics.underutilizedAgents) {
        const underutilized = this.agentCapacities.get(underutilizedId);
        if (!underutilized) continue;

        const availableSlots = underutilized.maxConcurrentTasks - underutilized.currentTasks.size;
        if (availableSlots <= 0) continue;

        // Move tasks from bottleneck queue to underutilized agent
        const tasksToMove = bottleneck.queuedTasks.splice(0, availableSlots);
        
        for (const taskId of tasksToMove) {
          this.emit('task:rebalanced', {
            taskId,
            fromAgent: bottleneckId,
            toAgent: underutilizedId
          });
        }

        if (bottleneck.queuedTasks.length === 0) break;
      }
    }
  }

  /**
   * Start periodic metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const metrics = this.getCapacityMetrics();
      
      this.emit('metrics:updated', metrics);

      // Log warnings for bottlenecks
      if (metrics.bottleneckAgents.length > 0) {
        this.logger.warn('Agent bottlenecks detected', {
          agents: metrics.bottleneckAgents,
          queuedTasks: metrics.queuedTasks
        });
      }

      // Consider rebalancing if needed
      if (metrics.queuedTasks > 10 && metrics.availableCapacity > 0) {
        this.rebalanceTasks().catch(err => 
          this.logger.error('Failed to rebalance tasks:', err)
        );
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop the capacity manager
   */
  public stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  /**
   * Update agent configuration (e.g., change max concurrent tasks)
   */
  public updateAgentCapacity(agentId: string, maxConcurrentTasks: number): void {
    const capacity = this.agentCapacities.get(agentId);
    if (!capacity) return;

    const oldCapacity = capacity.maxConcurrentTasks;
    capacity.maxConcurrentTasks = maxConcurrentTasks;
    
    this.updateUtilization(agentId);
    
    this.logger.info(`Updated agent ${agentId} capacity from ${oldCapacity} to ${maxConcurrentTasks}`);
    
    this.emit('capacity:updated', {
      agentId,
      oldCapacity,
      newCapacity: maxConcurrentTasks
    });

    // Process queued tasks if capacity increased
    if (maxConcurrentTasks > oldCapacity) {
      this.processQueuedTasks(agentId);
    }
  }

  /**
   * Get load balancing recommendations
   */
  public getLoadBalancingRecommendations(): {
    scaleUp: string[];
    scaleDown: string[];
    redistribute: Array<{ from: string; to: string; taskCount: number }>;
  } {
    const recommendations = {
      scaleUp: [] as string[],
      scaleDown: [] as string[],
      redistribute: [] as Array<{ from: string; to: string; taskCount: number }>
    };

    const metrics = this.getCapacityMetrics();

    // Recommend scaling up for bottleneck agents
    for (const agentId of metrics.bottleneckAgents) {
      const capacity = this.agentCapacities.get(agentId);
      if (capacity && capacity.queuedTasks.length > capacity.maxConcurrentTasks) {
        recommendations.scaleUp.push(agentId);
      }
    }

    // Recommend scaling down for consistently underutilized agents
    for (const agentId of metrics.underutilizedAgents) {
      const capacity = this.agentCapacities.get(agentId);
      if (capacity && capacity.maxConcurrentTasks > 1 && capacity.totalProcessed < 10) {
        recommendations.scaleDown.push(agentId);
      }
    }

    // Recommend task redistribution
    for (const bottleneckId of metrics.bottleneckAgents) {
      const bottleneck = this.agentCapacities.get(bottleneckId);
      if (!bottleneck) continue;

      for (const underutilizedId of metrics.underutilizedAgents) {
        const underutilized = this.agentCapacities.get(underutilizedId);
        if (!underutilized) continue;

        const tasksToRedistribute = Math.min(
          bottleneck.queuedTasks.length,
          underutilized.maxConcurrentTasks - underutilized.currentTasks.size
        );

        if (tasksToRedistribute > 0) {
          recommendations.redistribute.push({
            from: bottleneckId,
            to: underutilizedId,
            taskCount: tasksToRedistribute
          });
        }
      }
    }

    return recommendations;
  }
}