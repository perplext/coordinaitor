import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Organization } from './Organization';
import { RepositoryIntegration } from './RepositoryIntegration';
import { AutomationExecution } from './AutomationExecution';

export interface AutomationTriggerConditions {
  branchPattern?: string;
  labelPattern?: string;
  authorPattern?: string;
  pathPattern?: string;
  messagePattern?: string;
  fileExtensions?: string[];
  excludePaths?: string[];
  minimumChanges?: number;
  timeRange?: {
    start?: string;
    end?: string;
    timezone?: string;
  };
}

export interface AutomationTriggers {
  events: string[];
  conditions: AutomationTriggerConditions;
  schedule?: {
    cron?: string;
    timezone?: string;
    enabled?: boolean;
  };
}

export interface TaskAction {
  title: string;
  description: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedAgents?: string[];
  metadata?: Record<string, any>;
  estimatedHours?: number;
  deadline?: string;
  dependencies?: string[];
}

export interface PullRequestAction {
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  draft?: boolean;
  reviewers?: string[];
  assignees?: string[];
  labels?: string[];
  autoMerge?: boolean;
  deleteBranchAfterMerge?: boolean;
}

export interface IssueAction {
  title: string;
  description: string;
  labels?: string[];
  assignees?: string[];
  milestone?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface CommentAction {
  body: string;
  position?: number;
  path?: string;
  line?: number;
}

export interface WorkflowAction {
  workflowId: string;
  inputs?: Record<string, any>;
  ref?: string;
  waitForCompletion?: boolean;
  timeoutMinutes?: number;
}

export interface NotificationAction {
  channels: string[];
  message: string;
  severity?: 'info' | 'warning' | 'error' | 'success';
  attachments?: Array<{
    title: string;
    content: string;
    contentType?: string;
  }>;
}

export interface AutomationActions {
  createTask?: TaskAction;
  createPR?: PullRequestAction;
  createIssue?: IssueAction;
  addComment?: CommentAction;
  assignReviewers?: {
    reviewers: string[];
    requestTeams?: string[];
  };
  runWorkflow?: WorkflowAction;
  sendNotification?: NotificationAction;
  webhook?: {
    url: string;
    method?: 'POST' | 'PUT' | 'PATCH';
    headers?: Record<string, string>;
    body?: Record<string, any>;
  };
}

@Entity('automation_rules')
@Index(['organizationId'])
@Index(['repositoryIntegrationId'])
@Index(['enabled'])
@Index(['ruleType'])
@Index(['repositoryPattern'])
export class AutomationRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, organization => organization.automationRules, { onDelete: 'CASCADE' })
  organization: Organization;

  @Column({ name: 'repository_integration_id', nullable: true })
  repositoryIntegrationId?: string;

  @ManyToOne(() => RepositoryIntegration, integration => integration.automationRules, { 
    onDelete: 'CASCADE',
    nullable: true 
  })
  repositoryIntegration?: RepositoryIntegration;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'repository_pattern', default: '.*' })
  repositoryPattern: string;

  @Column({ name: 'rule_type', default: 'event_triggered' })
  ruleType: 'event_triggered' | 'scheduled' | 'manual';

  @Column({ default: true })
  enabled: boolean;

  @Column({
    type: 'jsonb',
    name: 'triggers'
  })
  triggers: AutomationTriggers;

  @Column({
    type: 'jsonb',
    name: 'actions'
  })
  actions: AutomationActions;

  @Column({ name: 'execution_order', default: 0 })
  executionOrder: number;

  @Column({ name: 'max_executions_per_hour', nullable: true })
  maxExecutionsPerHour?: number;

  @Column({ name: 'max_executions_per_day', nullable: true })
  maxExecutionsPerDay?: number;

  @Column({ name: 'cooldown_minutes', default: 0 })
  cooldownMinutes: number;

  @Column({ name: 'last_executed_at', nullable: true })
  lastExecutedAt?: Date;

  @Column({ name: 'execution_count', default: 0 })
  executionCount: number;

  @Column({ name: 'success_count', default: 0 })
  successCount: number;

  @Column({ name: 'failure_count', default: 0 })
  failureCount: number;

  @Column({ name: 'average_execution_time_ms', nullable: true })
  averageExecutionTimeMs?: number;

  @Column({ name: 'is_template', default: false })
  isTemplate: boolean;

  @Column({ name: 'template_category', nullable: true })
  templateCategory?: string;

  @Column({ name: 'created_by_user_id', nullable: true })
  createdByUserId?: string;

  @Column({ name: 'updated_by_user_id', nullable: true })
  updatedByUserId?: string;

  @OneToMany(() => AutomationExecution, execution => execution.automationRule)
  executions: AutomationExecution[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Virtual properties
  get successRate(): number {
    if (this.executionCount === 0) return 0;
    return (this.successCount / this.executionCount) * 100;
  }

  get isWithinCooldown(): boolean {
    if (!this.lastExecutedAt || this.cooldownMinutes === 0) return false;
    const cooldownEnd = new Date(this.lastExecutedAt.getTime() + (this.cooldownMinutes * 60 * 1000));
    return new Date() < cooldownEnd;
  }

  get canExecute(): boolean {
    return this.enabled && !this.isWithinCooldown;
  }

  get hasRateLimit(): boolean {
    return !!(this.maxExecutionsPerHour || this.maxExecutionsPerDay);
  }

  get supportedEvents(): string[] {
    return this.triggers?.events || [];
  }

  get hasConditions(): boolean {
    const conditions = this.triggers?.conditions;
    if (!conditions) return false;
    
    return !!(
      conditions.branchPattern ||
      conditions.labelPattern ||
      conditions.authorPattern ||
      conditions.pathPattern ||
      conditions.messagePattern ||
      conditions.fileExtensions?.length ||
      conditions.excludePaths?.length
    );
  }

  get actionTypes(): string[] {
    const actions = this.actions;
    const types: string[] = [];
    
    if (actions.createTask) types.push('create_task');
    if (actions.createPR) types.push('create_pr');
    if (actions.createIssue) types.push('create_issue');
    if (actions.addComment) types.push('add_comment');
    if (actions.assignReviewers) types.push('assign_reviewers');
    if (actions.runWorkflow) types.push('run_workflow');
    if (actions.sendNotification) types.push('send_notification');
    if (actions.webhook) types.push('webhook');
    
    return types;
  }
}