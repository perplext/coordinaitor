import { EventEmitter } from 'events';
import { Task, Project } from '../interfaces/task.interface';
import { Agent, AgentStatus } from '../interfaces/agent.interface';
import { Workflow, WorkflowExecution } from '../interfaces/template.interface';
import winston from 'winston';

export interface MetricSnapshot {
  timestamp: Date;
  agents: {
    total: number;
    active: number;
    idle: number;
    error: number;
    offline: number;
  };
  tasks: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    inProgress: number;
    successRate: number;
    averageDuration: number;
  };
  projects: {
    total: number;
    active: number;
    completed: number;
    averageTasksPerProject: number;
  };
  workflows: {
    total: number;
    executions: number;
    successRate: number;
  };
}

export interface AgentMetrics {
  agentId: string;
  name: string;
  provider: string;
  tasksCompleted: number;
  tasksFailed: number;
  successRate: number;
  averageResponseTime: number;
  totalUptime: number;
  totalCost: number;
  utilizationRate: number;
  performance: {
    lastHour: number;
    lastDay: number;
    lastWeek: number;
    lastMonth: number;
  };
}

export interface ProjectMetrics {
  projectId: string;
  name: string;
  status: string;
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  progressPercentage: number;
  estimatedCompletion: Date | null;
  totalDuration: number;
  totalCost: number;
  velocity: number;
}

export interface TaskMetrics {
  byType: Record<string, { count: number; avgDuration: number; successRate: number }>;
  byPriority: Record<string, { count: number; avgDuration: number; successRate: number }>;
  byAgent: Record<string, { count: number; avgDuration: number; successRate: number }>;
  timeline: Array<{ date: Date; completed: number; failed: number }>;
}

export interface CostMetrics {
  totalCost: number;
  costByAgent: Record<string, number>;
  costByProject: Record<string, number>;
  costByDay: Array<{ date: Date; cost: number }>;
  projectedMonthlyCost: number;
}

export class AnalyticsService extends EventEmitter {
  private metrics: MetricSnapshot[] = [];
  private taskHistory: Task[] = [];
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

    // Start collecting metrics every minute
    this.startMetricsCollection();
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 60000); // Every minute
  }

  public stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  private collectMetrics(): void {
    // This would be called with actual data from the orchestrator
    this.emit('metrics:collected', this.getCurrentSnapshot());
  }

  public recordTask(task: Task): void {
    this.taskHistory.push(task);
    
    // Keep only last 10000 tasks
    if (this.taskHistory.length > 10000) {
      this.taskHistory = this.taskHistory.slice(-10000);
    }

    this.emit('task:recorded', task);
  }

  public getCurrentSnapshot(): MetricSnapshot {
    // This method should be called with actual data
    // For now, returning a structure
    return {
      timestamp: new Date(),
      agents: {
        total: 0,
        active: 0,
        idle: 0,
        error: 0,
        offline: 0
      },
      tasks: {
        total: this.taskHistory.length,
        completed: this.taskHistory.filter(t => t.status === 'completed').length,
        failed: this.taskHistory.filter(t => t.status === 'failed').length,
        pending: this.taskHistory.filter(t => t.status === 'pending').length,
        inProgress: this.taskHistory.filter(t => t.status === 'in_progress').length,
        successRate: this.calculateSuccessRate(),
        averageDuration: this.calculateAverageDuration()
      },
      projects: {
        total: 0,
        active: 0,
        completed: 0,
        averageTasksPerProject: 0
      },
      workflows: {
        total: 0,
        executions: 0,
        successRate: 0
      }
    };
  }

  public getAgentMetrics(agents: Agent[]): AgentMetrics[] {
    return agents.map(agent => {
      const agentTasks = this.taskHistory.filter(t => t.assignedAgent === agent.id);
      const completedTasks = agentTasks.filter(t => t.status === 'completed');
      const failedTasks = agentTasks.filter(t => t.status === 'failed');

      return {
        agentId: agent.id,
        name: agent.name,
        provider: agent.provider,
        tasksCompleted: completedTasks.length,
        tasksFailed: failedTasks.length,
        successRate: agentTasks.length > 0 
          ? (completedTasks.length / agentTasks.length) * 100 
          : 0,
        averageResponseTime: this.calculateAverageResponseTime(completedTasks),
        totalUptime: this.calculateUptime(agent),
        totalCost: this.calculateAgentCost(agent, agentTasks),
        utilizationRate: this.calculateUtilizationRate(agent),
        performance: this.calculatePerformanceTrends(agentTasks)
      };
    });
  }

  public getProjectMetrics(projects: Project[]): ProjectMetrics[] {
    return projects.map(project => {
      const projectTasks = this.taskHistory.filter(t => t.projectId === project.id);
      const completedTasks = projectTasks.filter(t => t.status === 'completed');
      const failedTasks = projectTasks.filter(t => t.status === 'failed');

      return {
        projectId: project.id,
        name: project.name,
        status: project.status,
        tasksTotal: projectTasks.length,
        tasksCompleted: completedTasks.length,
        tasksFailed: failedTasks.length,
        progressPercentage: projectTasks.length > 0 
          ? (completedTasks.length / projectTasks.length) * 100 
          : 0,
        estimatedCompletion: this.estimateProjectCompletion(project, projectTasks),
        totalDuration: this.calculateProjectDuration(project),
        totalCost: this.calculateProjectCost(projectTasks),
        velocity: this.calculateProjectVelocity(projectTasks)
      };
    });
  }

  public getTaskMetrics(): TaskMetrics {
    const byType: Record<string, { count: number; avgDuration: number; successRate: number }> = {};
    const byPriority: Record<string, { count: number; avgDuration: number; successRate: number }> = {};
    const byAgent: Record<string, { count: number; avgDuration: number; successRate: number }> = {};

    // Group tasks by type
    const typeGroups = this.groupBy(this.taskHistory, 'type');
    for (const [type, tasks] of Object.entries(typeGroups)) {
      const completed = tasks.filter(t => t.status === 'completed');
      byType[type] = {
        count: tasks.length,
        avgDuration: this.calculateAverageDuration(completed),
        successRate: tasks.length > 0 ? (completed.length / tasks.length) * 100 : 0
      };
    }

    // Group tasks by priority
    const priorityGroups = this.groupBy(this.taskHistory, 'priority');
    for (const [priority, tasks] of Object.entries(priorityGroups)) {
      const completed = tasks.filter(t => t.status === 'completed');
      byPriority[priority] = {
        count: tasks.length,
        avgDuration: this.calculateAverageDuration(completed),
        successRate: tasks.length > 0 ? (completed.length / tasks.length) * 100 : 0
      };
    }

    // Group tasks by agent
    const agentGroups = this.groupBy(this.taskHistory.filter(t => t.assignedAgent), 'assignedAgent');
    for (const [agentId, tasks] of Object.entries(agentGroups)) {
      const completed = tasks.filter(t => t.status === 'completed');
      byAgent[agentId] = {
        count: tasks.length,
        avgDuration: this.calculateAverageDuration(completed),
        successRate: tasks.length > 0 ? (completed.length / tasks.length) * 100 : 0
      };
    }

    // Create timeline
    const timeline = this.createTaskTimeline();

    return { byType, byPriority, byAgent, timeline };
  }

  public getCostMetrics(agents: Agent[]): CostMetrics {
    const costByAgent: Record<string, number> = {};
    const costByProject: Record<string, number> = {};
    let totalCost = 0;

    // Calculate cost by agent
    for (const agent of agents) {
      const agentTasks = this.taskHistory.filter(t => t.assignedAgent === agent.id);
      const cost = this.calculateAgentCost(agent, agentTasks);
      costByAgent[agent.id] = cost;
      totalCost += cost;
    }

    // Calculate cost by project
    const projectGroups = this.groupBy(this.taskHistory.filter(t => t.projectId), 'projectId');
    for (const [projectId, tasks] of Object.entries(projectGroups)) {
      costByProject[projectId] = this.calculateProjectCost(tasks);
    }

    // Create daily cost timeline
    const costByDay = this.createCostTimeline();

    // Project monthly cost based on last 7 days average
    const last7DaysCost = costByDay.slice(-7).reduce((sum, day) => sum + day.cost, 0);
    const projectedMonthlyCost = (last7DaysCost / 7) * 30;

    return {
      totalCost,
      costByAgent,
      costByProject,
      costByDay,
      projectedMonthlyCost
    };
  }

  public getPerformanceInsights(): Array<{
    type: 'info' | 'warning' | 'success';
    title: string;
    message: string;
    metric?: number;
  }> {
    const insights = [];
    const snapshot = this.getCurrentSnapshot();

    // Success rate insight
    if (snapshot.tasks.successRate < 80) {
      insights.push({
        type: 'warning' as const,
        title: 'Low Success Rate',
        message: `Task success rate is ${snapshot.tasks.successRate.toFixed(1)}%. Consider reviewing failed tasks.`,
        metric: snapshot.tasks.successRate
      });
    } else if (snapshot.tasks.successRate > 95) {
      insights.push({
        type: 'success' as const,
        title: 'Excellent Success Rate',
        message: `Task success rate is ${snapshot.tasks.successRate.toFixed(1)}%. Great performance!`,
        metric: snapshot.tasks.successRate
      });
    }

    // Average duration insight
    if (snapshot.tasks.averageDuration > 60000) {
      insights.push({
        type: 'warning' as const,
        title: 'Long Task Duration',
        message: `Average task duration is ${(snapshot.tasks.averageDuration / 1000).toFixed(1)}s. Consider optimizing complex tasks.`,
        metric: snapshot.tasks.averageDuration
      });
    }

    // Pending tasks insight
    if (snapshot.tasks.pending > 20) {
      insights.push({
        type: 'info' as const,
        title: 'High Task Queue',
        message: `${snapshot.tasks.pending} tasks are pending. Consider scaling up agents.`,
        metric: snapshot.tasks.pending
      });
    }

    return insights;
  }

  // Helper methods
  private calculateSuccessRate(): number {
    const completed = this.taskHistory.filter(t => 
      t.status === 'completed' || t.status === 'failed'
    );
    if (completed.length === 0) return 0;
    
    const successful = completed.filter(t => t.status === 'completed');
    return (successful.length / completed.length) * 100;
  }

  private calculateAverageDuration(tasks: Task[] = this.taskHistory): number {
    const completedTasks = tasks.filter(t => 
      t.status === 'completed' && t.actualDuration
    );
    
    if (completedTasks.length === 0) return 0;
    
    const totalDuration = completedTasks.reduce((sum, task) => 
      sum + (task.actualDuration || 0), 0
    );
    
    return totalDuration / completedTasks.length;
  }

  private calculateAverageResponseTime(tasks: Task[]): number {
    return this.calculateAverageDuration(tasks);
  }

  private calculateUptime(agent: Agent): number {
    // This would calculate actual uptime based on agent status history
    return Date.now() - new Date(agent.status.lastActivity).getTime();
  }

  private calculateAgentCost(agent: Agent, tasks: Task[]): number {
    if (!agent.cost) return 0;
    
    let cost = 0;
    
    if (agent.cost.monthly) {
      // Pro-rate monthly cost based on usage
      const hoursUsed = tasks.reduce((sum, task) => 
        sum + ((task.actualDuration || 0) / 3600000), 0
      );
      cost += (agent.cost.monthly / 720) * hoursUsed; // 720 hours in a month
    }
    
    if (agent.cost.perRequest) {
      cost += agent.cost.perRequest * tasks.length;
    }
    
    // Token-based cost would require token tracking
    
    return cost;
  }

  private calculateUtilizationRate(agent: Agent): number {
    // Calculate what percentage of time the agent has been busy
    const now = Date.now();
    const hourAgo = now - 3600000;
    
    // This would need actual status history tracking
    return agent.status.state === 'busy' ? 100 : 0;
  }

  private calculatePerformanceTrends(tasks: Task[]): {
    lastHour: number;
    lastDay: number;
    lastWeek: number;
    lastMonth: number;
  } {
    const now = Date.now();
    const hourAgo = now - 3600000;
    const dayAgo = now - 86400000;
    const weekAgo = now - 604800000;
    const monthAgo = now - 2592000000;

    const calculateSuccessRateForPeriod = (since: number) => {
      const periodTasks = tasks.filter(t => 
        t.createdAt && new Date(t.createdAt).getTime() > since
      );
      const completed = periodTasks.filter(t => t.status === 'completed');
      return periodTasks.length > 0 ? (completed.length / periodTasks.length) * 100 : 0;
    };

    return {
      lastHour: calculateSuccessRateForPeriod(hourAgo),
      lastDay: calculateSuccessRateForPeriod(dayAgo),
      lastWeek: calculateSuccessRateForPeriod(weekAgo),
      lastMonth: calculateSuccessRateForPeriod(monthAgo)
    };
  }

  private estimateProjectCompletion(project: Project, tasks: Task[]): Date | null {
    const pendingTasks = tasks.filter(t => 
      t.status === 'pending' || t.status === 'in_progress'
    );
    
    if (pendingTasks.length === 0) return null;
    
    const completedTasks = tasks.filter(t => t.status === 'completed');
    if (completedTasks.length === 0) return null;
    
    const avgDuration = this.calculateAverageDuration(completedTasks);
    const estimatedRemainingTime = pendingTasks.length * avgDuration;
    
    return new Date(Date.now() + estimatedRemainingTime);
  }

  private calculateProjectDuration(project: Project): number {
    return new Date(project.updatedAt).getTime() - new Date(project.createdAt).getTime();
  }

  private calculateProjectCost(tasks: Task[]): number {
    // This would need to track actual costs per task
    return tasks.length * 0.1; // Placeholder
  }

  private calculateProjectVelocity(tasks: Task[]): number {
    const completedTasks = tasks.filter(t => t.status === 'completed');
    if (completedTasks.length === 0) return 0;
    
    const firstTask = completedTasks[0];
    const lastTask = completedTasks[completedTasks.length - 1];
    
    if (!firstTask.completedAt || !lastTask.completedAt) return 0;
    
    const timeSpan = new Date(lastTask.completedAt).getTime() - 
                    new Date(firstTask.completedAt).getTime();
    
    if (timeSpan === 0) return 0;
    
    // Tasks per day
    return (completedTasks.length / (timeSpan / 86400000));
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const value = String(item[key]);
      if (!groups[value]) groups[value] = [];
      groups[value].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  private createTaskTimeline(): Array<{ date: Date; completed: number; failed: number }> {
    const timeline = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const dayTasks = this.taskHistory.filter(t => {
        if (!t.completedAt) return false;
        const taskDate = new Date(t.completedAt);
        return taskDate.toDateString() === date.toDateString();
      });
      
      timeline.push({
        date,
        completed: dayTasks.filter(t => t.status === 'completed').length,
        failed: dayTasks.filter(t => t.status === 'failed').length
      });
    }
    
    return timeline;
  }

  private createCostTimeline(): Array<{ date: Date; cost: number }> {
    const timeline = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      // This would calculate actual daily costs
      timeline.push({
        date,
        cost: Math.random() * 10 + 5 // Placeholder
      });
    }
    
    return timeline;
  }
}