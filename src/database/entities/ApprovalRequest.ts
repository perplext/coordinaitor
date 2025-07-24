import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { Organization } from './Organization';
import { WorkflowExecution } from './WorkflowExecution';
import { User } from './User';
import { ApprovalResponse } from './ApprovalResponse';

@Entity('approval_requests')
@Index(['organizationId'])
@Index(['workflowExecutionId'])
@Index(['status'])
export class ApprovalRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'uuid', nullable: true })
  workflowExecutionId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  workflowStepId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stepName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  workflowName: string;

  @Column({ type: 'uuid', nullable: true })
  requestedById: string;

  @Column({ type: 'uuid', array: true })
  approvers: string[];

  @Column({ type: 'varchar', length: 50, default: 'all' })
  policy: string;

  @Column({ type: 'integer', default: 1 })
  minApprovals: number;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: string;

  @Column({ type: 'timestamp', nullable: true })
  timeoutAt: Date;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => WorkflowExecution, execution => execution.approvalRequests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_execution_id' })
  workflowExecution: WorkflowExecution;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by' })
  requestedBy: User;

  @OneToMany(() => ApprovalResponse, response => response.approvalRequest)
  responses: ApprovalResponse[];
}