import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ApprovalRequest } from './ApprovalRequest';
import { User } from './User';

@Entity('approval_responses')
@Index(['approvalRequestId'])
@Index(['approverId'])
export class ApprovalResponse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  approvalRequestId: string;

  @Column({ type: 'uuid' })
  approverId: string;

  @Column({ type: 'varchar', length: 20 })
  decision: string;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @CreateDateColumn()
  respondedAt: Date;

  // Relations
  @ManyToOne(() => ApprovalRequest, request => request.responses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'approval_request_id' })
  approvalRequest: ApprovalRequest;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approver_id' })
  approver: User;
}