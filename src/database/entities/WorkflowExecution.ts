import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { Workflow } from './Workflow';
import { User } from './User';
import { ApprovalRequest } from './ApprovalRequest';

@Entity('workflow_executions')
@Index(['workflowId'])
@Index(['status'])
export class WorkflowExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workflowId: string;

  @Column({ type: 'varchar', length: 50 })
  status: string;

  @Column({ type: 'jsonb', default: {} })
  variables: Record<string, any>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  currentStep: string;

  @Column({ type: 'jsonb', default: {} })
  results: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  error: string;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  triggeredById: string;

  // Relations
  @ManyToOne(() => Workflow, workflow => workflow.executions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow: Workflow;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'triggered_by' })
  triggeredBy: User;

  @OneToMany(() => ApprovalRequest, approval => approval.workflowExecution)
  approvalRequests: ApprovalRequest[];
}