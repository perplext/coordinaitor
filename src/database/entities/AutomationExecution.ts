import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { AutomationRule } from './AutomationRule';
import { Organization } from './Organization';
import { RepositoryIntegration } from './RepositoryIntegration';
import { WebhookEvent } from './WebhookEvent';

export type AutomationExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
export type AutomationExecutionTrigger = 'webhook' | 'schedule' | 'manual' | 'api';

export interface ExecutionContext {
  triggeredBy: AutomationExecutionTrigger;
  userId?: string;
  webhookEventId?: string;
  scheduledJobId?: string;
  parentExecutionId?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface ExecutionResults {
  tasksCreated?: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    assignedAgents?: string[];
  }>;
  prsCreated?: Array<{
    id: string;
    number: number;
    title: string;
    url: string;
    status: string;
  }>;
  issuesCreated?: Array<{
    id: string;
    number: number;
    title: string;
    url: string;
    status: string;
  }>;
  commentsAdded?: Array<{
    id: string;
    url: string;
    body: string;
    target: string;
  }>;
  reviewersAssigned?: Array<{
    pullRequestId: string;
    reviewers: string[];
    teams?: string[];
  }>;
  workflowsTriggered?: Array<{
    workflowId: string;
    runId: string;
    status: string;
    url?: string;
  }>;
  notificationsSent?: Array<{
    channel: string;
    messageId?: string;
    status: string;
  }>;
  webhooksCalled?: Array<{
    url: string;
    method: string;
    statusCode: number;
    responseTime: number;
  }>;
  errors?: Array<{
    action: string;
    error: string;
    details?: any;
    timestamp: string;
  }>;
  warnings?: Array<{
    action: string;
    message: string;
    details?: any;
    timestamp: string;
  }>;
}

export interface ExecutionMetrics {
  totalDurationMs: number;
  actionDurations: Record<string, number>;
  memoryUsageMB?: number;
  cpuUsagePercent?: number;
  networkRequests?: number;
  cacheHits?: number;
  cacheMisses?: number;
}

@Entity('automation_executions')
@Index(['automationRuleId'])
@Index(['organizationId'])
@Index(['repositoryIntegrationId'])
@Index(['status'])
@Index(['triggeredBy'])
@Index(['startedAt'])
@Index(['repositoryName'])
@Index(['eventType'])
export class AutomationExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'automation_rule_id' })
  automationRuleId: string;

  @ManyToOne(() => AutomationRule, rule => rule.executions, { onDelete: 'CASCADE' })
  automationRule: AutomationRule;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  organization: Organization;

  @Column({ name: 'repository_integration_id', nullable: true })
  repositoryIntegrationId?: string;

  @ManyToOne(() => RepositoryIntegration, { onDelete: 'SET NULL', nullable: true })
  repositoryIntegration?: RepositoryIntegration;

  @Column({ name: 'webhook_event_id', nullable: true })
  webhookEventId?: string;

  @ManyToOne(() => WebhookEvent, { onDelete: 'SET NULL', nullable: true })
  webhookEvent?: WebhookEvent;

  @Column({ name: 'repository_name' })
  repositoryName: string;

  @Column({ name: 'event_type', nullable: true })
  eventType?: string;

  @Column({ name: 'event_action', nullable: true })
  eventAction?: string;

  @Column({
    type: 'enum',
    enum: ['webhook', 'schedule', 'manual', 'api'],
    name: 'triggered_by'
  })
  triggeredBy: AutomationExecutionTrigger;

  @Column({
    type: 'jsonb',
    name: 'execution_context'
  })
  executionContext: ExecutionContext;

  @Column({
    type: 'jsonb',
    name: 'event_data',
    nullable: true
  })
  eventData?: any;

  @Column({
    type: 'enum',
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled', 'timeout'],
    default: 'pending'
  })
  status: AutomationExecutionStatus;

  @Column({ name: 'started_at', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  @Column({ name: 'duration_ms', nullable: true })
  durationMs?: number;

  @Column({
    type: 'jsonb',
    name: 'execution_results',
    nullable: true
  })
  executionResults?: ExecutionResults;

  @Column({
    type: 'jsonb',
    name: 'execution_metrics',
    nullable: true
  })
  executionMetrics?: ExecutionMetrics;

  @Column({ name: 'error_message', nullable: true })
  errorMessage?: string;

  @Column({ name: 'error_stack', nullable: true })
  errorStack?: string;

  @Column({ name: 'error_code', nullable: true })
  errorCode?: string;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @Column({ name: 'max_retries', default: 0 })
  maxRetries: number;

  @Column({ name: 'next_retry_at', nullable: true })
  nextRetryAt?: Date;

  @Column({ name: 'timeout_seconds', nullable: true })
  timeoutSeconds?: number;

  @Column({ name: 'progress_percentage', default: 0 })
  progressPercentage: number;

  @Column({ name: 'current_step', nullable: true })
  currentStep?: string;

  @Column({ name: 'total_steps', nullable: true })
  totalSteps?: number;

  @Column({ name: 'logs', type: 'text', nullable: true })
  logs?: string;

  @Column({ name: 'execution_node', nullable: true })
  executionNode?: string;

  @Column({ name: 'execution_version', nullable: true })
  executionVersion?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Virtual properties
  get isCompleted(): boolean {
    return ['completed', 'failed', 'cancelled', 'timeout'].includes(this.status);
  }

  get isSuccessful(): boolean {
    return this.status === 'completed' && !this.errorMessage;
  }

  get canRetry(): boolean {
    return this.status === 'failed' && this.retryCount < this.maxRetries;
  }

  get shouldRetry(): boolean {
    return this.canRetry && (!this.nextRetryAt || this.nextRetryAt <= new Date());
  }

  get isRunning(): boolean {
    return this.status === 'running';
  }

  get isPending(): boolean {
    return this.status === 'pending';
  }

  get executionTime(): number | null {
    if (this.startedAt && this.completedAt) {
      return this.completedAt.getTime() - this.startedAt.getTime();
    }
    return null;
  }

  get successRate(): number {
    const results = this.executionResults;
    if (!results) return 0;

    const totalActions = (results.tasksCreated?.length || 0) +
                        (results.prsCreated?.length || 0) +
                        (results.issuesCreated?.length || 0) +
                        (results.commentsAdded?.length || 0) +
                        (results.reviewersAssigned?.length || 0) +
                        (results.workflowsTriggered?.length || 0) +
                        (results.notificationsSent?.length || 0) +
                        (results.webhooksCalled?.length || 0);

    const errors = results.errors?.length || 0;
    
    if (totalActions === 0) return 100;
    return ((totalActions - errors) / totalActions) * 100;
  }

  get summary(): string {
    const ruleName = 'Unknown Rule'; // Would need to join with AutomationRule
    const repo = this.repositoryName;
    const trigger = this.triggeredBy;
    return `${ruleName} on ${repo} (${trigger})`;
  }

  get hasErrors(): boolean {
    return !!(this.errorMessage || this.executionResults?.errors?.length);
  }

  get hasWarnings(): boolean {
    return !!(this.executionResults?.warnings?.length);
  }
}