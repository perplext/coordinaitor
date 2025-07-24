import { Counter, Histogram, Gauge, Registry } from 'prom-client';
import { Task } from '../interfaces/task.interface';
import { Agent } from '../interfaces/agent.interface';

export class MetricsCollector {
  private registry: Registry;
  
  // Task metrics
  private taskCounter: Counter<string>;
  private taskDuration: Histogram<string>;
  private taskQueueSize: Gauge<string>;
  private taskErrors: Counter<string>;
  
  // Agent metrics
  private agentUtilization: Gauge<string>;
  private agentResponseTime: Histogram<string>;
  private agentErrors: Counter<string>;
  private agentActiveConnections: Gauge<string>;
  
  // System metrics
  private apiRequestDuration: Histogram<string>;
  private apiRequestTotal: Counter<string>;
  private apiErrorTotal: Counter<string>;
  private activeWebsocketConnections: Gauge<string>;
  
  // Workflow metrics
  private workflowExecutions: Counter<string>;
  private workflowDuration: Histogram<string>;
  private workflowStepDuration: Histogram<string>;
  
  // Knowledge metrics
  private knowledgeQueries: Counter<string>;
  private knowledgeRetrievalTime: Histogram<string>;
  private knowledgeEntries: Gauge<string>;

  constructor() {
    this.registry = new Registry();
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // Task metrics
    this.taskCounter = new Counter({
      name: 'orchestrator_tasks_total',
      help: 'Total number of tasks created',
      labelNames: ['type', 'priority', 'status'],
      registers: [this.registry]
    });

    this.taskDuration = new Histogram({
      name: 'orchestrator_task_duration_seconds',
      help: 'Task execution duration in seconds',
      labelNames: ['type', 'priority', 'agent', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
      registers: [this.registry]
    });

    this.taskQueueSize = new Gauge({
      name: 'orchestrator_task_queue_size',
      help: 'Number of tasks in queue',
      labelNames: ['priority', 'status'],
      registers: [this.registry]
    });

    this.taskErrors = new Counter({
      name: 'orchestrator_task_errors_total',
      help: 'Total number of task errors',
      labelNames: ['type', 'error_type', 'agent'],
      registers: [this.registry]
    });

    // Agent metrics
    this.agentUtilization = new Gauge({
      name: 'orchestrator_agent_utilization_ratio',
      help: 'Agent utilization ratio (0-1)',
      labelNames: ['agent_id', 'agent_type', 'provider'],
      registers: [this.registry]
    });

    this.agentResponseTime = new Histogram({
      name: 'orchestrator_agent_response_time_seconds',
      help: 'Agent response time in seconds',
      labelNames: ['agent_id', 'agent_type', 'provider', 'task_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.registry]
    });

    this.agentErrors = new Counter({
      name: 'orchestrator_agent_errors_total',
      help: 'Total number of agent errors',
      labelNames: ['agent_id', 'agent_type', 'error_type'],
      registers: [this.registry]
    });

    this.agentActiveConnections = new Gauge({
      name: 'orchestrator_agent_active_connections',
      help: 'Number of active agent connections',
      labelNames: ['agent_type', 'provider'],
      registers: [this.registry]
    });

    // API metrics
    this.apiRequestDuration = new Histogram({
      name: 'orchestrator_api_request_duration_seconds',
      help: 'API request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry]
    });

    this.apiRequestTotal = new Counter({
      name: 'orchestrator_api_requests_total',
      help: 'Total number of API requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry]
    });

    this.apiErrorTotal = new Counter({
      name: 'orchestrator_api_errors_total',
      help: 'Total number of API errors',
      labelNames: ['method', 'route', 'error_type'],
      registers: [this.registry]
    });

    this.activeWebsocketConnections = new Gauge({
      name: 'orchestrator_websocket_connections_active',
      help: 'Number of active WebSocket connections',
      registers: [this.registry]
    });

    // Workflow metrics
    this.workflowExecutions = new Counter({
      name: 'orchestrator_workflow_executions_total',
      help: 'Total number of workflow executions',
      labelNames: ['workflow_id', 'status'],
      registers: [this.registry]
    });

    this.workflowDuration = new Histogram({
      name: 'orchestrator_workflow_duration_seconds',
      help: 'Workflow execution duration in seconds',
      labelNames: ['workflow_id', 'status'],
      buckets: [1, 5, 10, 30, 60, 300, 600, 1800, 3600],
      registers: [this.registry]
    });

    this.workflowStepDuration = new Histogram({
      name: 'orchestrator_workflow_step_duration_seconds',
      help: 'Workflow step execution duration in seconds',
      labelNames: ['workflow_id', 'step_type', 'status'],
      buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300],
      registers: [this.registry]
    });

    // Knowledge metrics
    this.knowledgeQueries = new Counter({
      name: 'orchestrator_knowledge_queries_total',
      help: 'Total number of knowledge base queries',
      labelNames: ['query_type', 'success'],
      registers: [this.registry]
    });

    this.knowledgeRetrievalTime = new Histogram({
      name: 'orchestrator_knowledge_retrieval_time_seconds',
      help: 'Knowledge retrieval time in seconds',
      labelNames: ['query_type', 'result_count'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
      registers: [this.registry]
    });

    this.knowledgeEntries = new Gauge({
      name: 'orchestrator_knowledge_entries_total',
      help: 'Total number of knowledge entries',
      labelNames: ['type', 'category'],
      registers: [this.registry]
    });
  }

  // Task metric methods
  public recordTaskCreated(task: Task): void {
    this.taskCounter.labels(task.type, task.priority, task.status).inc();
  }

  public recordTaskCompleted(task: Task, duration: number): void {
    this.taskDuration.labels(
      task.type,
      task.priority,
      task.assignedAgent || 'unassigned',
      task.status
    ).observe(duration / 1000); // Convert to seconds
  }

  public recordTaskError(task: Task, errorType: string): void {
    this.taskErrors.labels(
      task.type,
      errorType,
      task.assignedAgent || 'unassigned'
    ).inc();
  }

  public updateTaskQueueSize(queueSizes: Map<string, number>): void {
    queueSizes.forEach((size, key) => {
      const [priority, status] = key.split(':');
      this.taskQueueSize.labels(priority, status).set(size);
    });
  }

  // Agent metric methods
  public updateAgentUtilization(agent: Agent, utilization: number): void {
    this.agentUtilization.labels(
      agent.config.id,
      agent.config.type,
      agent.config.provider
    ).set(utilization);
  }

  public recordAgentResponse(agent: Agent, taskType: string, responseTime: number): void {
    this.agentResponseTime.labels(
      agent.config.id,
      agent.config.type,
      agent.config.provider,
      taskType
    ).observe(responseTime / 1000);
  }

  public recordAgentError(agent: Agent, errorType: string): void {
    this.agentErrors.labels(
      agent.config.id,
      agent.config.type,
      errorType
    ).inc();
  }

  public updateAgentConnections(connectionCounts: Map<string, number>): void {
    connectionCounts.forEach((count, key) => {
      const [agentType, provider] = key.split(':');
      this.agentActiveConnections.labels(agentType, provider).set(count);
    });
  }

  // API metric methods
  public recordApiRequest(method: string, route: string, statusCode: number, duration: number): void {
    const labels = { method, route, status_code: statusCode.toString() };
    this.apiRequestTotal.labels(labels).inc();
    this.apiRequestDuration.labels(labels).observe(duration / 1000);
  }

  public recordApiError(method: string, route: string, errorType: string): void {
    this.apiErrorTotal.labels(method, route, errorType).inc();
  }

  public updateWebsocketConnections(count: number): void {
    this.activeWebsocketConnections.set(count);
  }

  // Workflow metric methods
  public recordWorkflowExecution(workflowId: string, status: string): void {
    this.workflowExecutions.labels(workflowId, status).inc();
  }

  public recordWorkflowDuration(workflowId: string, status: string, duration: number): void {
    this.workflowDuration.labels(workflowId, status).observe(duration / 1000);
  }

  public recordWorkflowStepDuration(workflowId: string, stepType: string, status: string, duration: number): void {
    this.workflowStepDuration.labels(workflowId, stepType, status).observe(duration / 1000);
  }

  // Knowledge metric methods
  public recordKnowledgeQuery(queryType: string, success: boolean): void {
    this.knowledgeQueries.labels(queryType, success.toString()).inc();
  }

  public recordKnowledgeRetrievalTime(queryType: string, resultCount: number, duration: number): void {
    this.knowledgeRetrievalTime.labels(
      queryType,
      resultCount > 10 ? '10+' : resultCount.toString()
    ).observe(duration / 1000);
  }

  public updateKnowledgeEntries(entryCounts: Map<string, number>): void {
    entryCounts.forEach((count, key) => {
      const [type, category] = key.split(':');
      this.knowledgeEntries.labels(type, category).set(count);
    });
  }

  // Utility methods
  public getRegistry(): Registry {
    return this.registry;
  }

  public async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  public reset(): void {
    this.registry.clear();
    this.initializeMetrics();
  }
}