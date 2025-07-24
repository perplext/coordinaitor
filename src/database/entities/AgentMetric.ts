import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { Agent } from './Agent';

@Entity('agent_metrics')
@Unique(['agentId', 'date'])
@Index(['agentId'])
@Index(['date'])
export class AgentMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  agentId: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'integer', default: 0 })
  tasksCompleted: number;

  @Column({ type: 'integer', default: 0 })
  tasksFailed: number;

  @Column({ type: 'bigint', default: 0 })
  totalDurationMs: number;

  @Column({ type: 'bigint', default: 0 })
  totalTokensUsed: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  totalCost: number;

  @Column({ type: 'float', nullable: true })
  successRate: number;

  @Column({ type: 'integer', nullable: true })
  avgDurationMs: number;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => Agent, agent => agent.metrics, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;
}