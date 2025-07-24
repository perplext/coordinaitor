import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { RepositoryIntegration } from './RepositoryIntegration';
import { Organization } from './Organization';

export type WebhookEventType = 'push' | 'pull_request' | 'issues' | 'release' | 'tag_push' | 'wiki' | 'pipeline' | 'deployment';
export type WebhookEventStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export interface WebhookEventData {
  action?: string;
  repository?: {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    description?: string;
    private: boolean;
    default_branch: string;
  };
  sender?: {
    id: number;
    login: string;
    avatar_url: string;
    html_url: string;
  };
  pull_request?: any;
  issue?: any;
  commits?: any[];
  ref?: string;
  before?: string;
  after?: string;
  release?: any;
  [key: string]: any;
}

export interface ProcessingResults {
  tasksCreated?: string[];
  prsCreated?: string[];
  issuesCreated?: string[];
  commentsAdded?: string[];
  automationRulesTriggered?: string[];
  errors?: string[];
  warnings?: string[];
  executionTimeMs?: number;
}

@Entity('webhook_events')
@Index(['repositoryIntegrationId'])
@Index(['organizationId'])
@Index(['eventType'])
@Index(['status'])
@Index(['receivedAt'])
@Index(['repositoryName'])
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'repository_integration_id' })
  repositoryIntegrationId: string;

  @ManyToOne(() => RepositoryIntegration, integration => integration.webhookEvents, { onDelete: 'CASCADE' })
  repositoryIntegration: RepositoryIntegration;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  organization: Organization;

  @Column({
    type: 'enum',
    enum: ['push', 'pull_request', 'issues', 'release', 'tag_push', 'wiki', 'pipeline', 'deployment'],
    name: 'event_type'
  })
  eventType: WebhookEventType;

  @Column({ name: 'repository_name' })
  repositoryName: string;

  @Column({ name: 'repository_id' })
  repositoryId: string;

  @Column({ name: 'webhook_delivery_id', nullable: true })
  webhookDeliveryId?: string;

  @Column({ name: 'event_action', nullable: true })
  eventAction?: string;

  @Column({
    type: 'jsonb',
    name: 'event_data'
  })
  eventData: WebhookEventData;

  @Column({
    type: 'enum',
    enum: ['pending', 'processing', 'completed', 'failed', 'skipped'],
    default: 'pending'
  })
  status: WebhookEventStatus;

  @Column({ name: 'processing_started_at', nullable: true })
  processingStartedAt?: Date;

  @Column({ name: 'processing_completed_at', nullable: true })
  processingCompletedAt?: Date;

  @Column({ name: 'processing_duration_ms', nullable: true })
  processingDurationMs?: number;

  @Column({
    type: 'jsonb',
    name: 'processing_results',
    nullable: true
  })
  processingResults?: ProcessingResults;

  @Column({ name: 'error_message', nullable: true })
  errorMessage?: string;

  @Column({ name: 'error_stack', nullable: true })
  errorStack?: string;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @Column({ name: 'max_retries', default: 3 })
  maxRetries: number;

  @Column({ name: 'next_retry_at', nullable: true })
  nextRetryAt?: Date;

  @Column({ name: 'received_at' })
  receivedAt: Date;

  @Column({ name: 'signature_verified', default: false })
  signatureVerified: boolean;

  @Column({ name: 'raw_headers', type: 'jsonb', nullable: true })
  rawHeaders?: Record<string, string>;

  @Column({ name: 'raw_payload_hash', nullable: true })
  rawPayloadHash?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Virtual properties
  get isProcessed(): boolean {
    return this.status === 'completed' || this.status === 'failed' || this.status === 'skipped';
  }

  get canRetry(): boolean {
    return this.status === 'failed' && this.retryCount < this.maxRetries;
  }

  get shouldRetry(): boolean {
    return this.canRetry && (!this.nextRetryAt || this.nextRetryAt <= new Date());
  }

  get processingDuration(): number | null {
    if (this.processingStartedAt && this.processingCompletedAt) {
      return this.processingCompletedAt.getTime() - this.processingStartedAt.getTime();
    }
    return null;
  }

  get isSuccessful(): boolean {
    return this.status === 'completed' && !this.errorMessage;
  }

  get summary(): string {
    const repo = this.repositoryName;
    const action = this.eventAction ? ` (${this.eventAction})` : '';
    return `${this.eventType}${action} on ${repo}`;
  }
}