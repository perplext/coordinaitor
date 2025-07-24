import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Organization } from './Organization';
import { WebhookEvent } from './WebhookEvent';
import { AutomationRule } from './AutomationRule';

export type RepositoryProvider = 'github' | 'gitlab';

export interface TaskCreationRules {
  issueLabels?: string[];
  prLabels?: string[];
  autoAssign?: boolean;
  assignedAgents?: string[];
  defaultPriority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface RepositorySettings {
  enabledEvents: string[];
  taskCreationRules: TaskCreationRules;
  webhookSecret?: string;
  autoCreateBranches?: boolean;
  branchNamingPattern?: string;
  autoMergePRs?: boolean;
  requireApproval?: boolean;
}

@Entity('repository_integrations')
@Index(['organizationId'])
@Index(['repositoryId'])
@Index(['provider'])
@Index(['repositoryName'])
export class RepositoryIntegration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, organization => organization.repositoryIntegrations, { onDelete: 'CASCADE' })
  organization: Organization;

  @Column({ name: 'repository_id' })
  repositoryId: string;

  @Column({ name: 'repository_name' })
  repositoryName: string;

  @Column({ name: 'repository_url', nullable: true })
  repositoryUrl?: string;

  @Column({ name: 'repository_description', nullable: true })
  repositoryDescription?: string;

  @Column({
    type: 'enum',
    enum: ['github', 'gitlab'],
    default: 'github'
  })
  provider: RepositoryProvider;

  @Column({ name: 'webhook_url', nullable: true })
  webhookUrl?: string;

  @Column({ name: 'webhook_id', nullable: true })
  webhookId?: string;

  @Column({ name: 'auto_create_tasks', default: false })
  autoCreateTasks: boolean;

  @Column({ name: 'auto_create_pr', default: false })
  autoCreatePR: boolean;

  @Column({ name: 'branch_prefix', nullable: true })
  branchPrefix?: string;

  @Column({ name: 'default_branch', default: 'main' })
  defaultBranch: string;

  @Column({
    type: 'jsonb',
    default: () => "'{\"enabledEvents\": [\"push\", \"pull_request\", \"issues\"], \"taskCreationRules\": {}}'"
  })
  settings: RepositorySettings;

  @Column({ name: 'last_sync_at', nullable: true })
  lastSyncAt?: Date;

  @Column({ name: 'sync_status', default: 'pending' })
  syncStatus: 'pending' | 'syncing' | 'completed' | 'error';

  @Column({ name: 'sync_error', nullable: true })
  syncError?: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'access_token_encrypted', nullable: true })
  accessTokenEncrypted?: string;

  @Column({ name: 'access_token_expires_at', nullable: true })
  accessTokenExpiresAt?: Date;

  @OneToMany(() => WebhookEvent, event => event.repositoryIntegration)
  webhookEvents: WebhookEvent[];

  @OneToMany(() => AutomationRule, rule => rule.repositoryIntegration)
  automationRules: AutomationRule[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Virtual properties
  get isWebhookConfigured(): boolean {
    return !!this.webhookUrl && !!this.webhookId;
  }

  get supportedEvents(): string[] {
    return this.settings?.enabledEvents || [];
  }

  get hasValidToken(): boolean {
    return !!this.accessTokenEncrypted && 
           (!this.accessTokenExpiresAt || this.accessTokenExpiresAt > new Date());
  }
}