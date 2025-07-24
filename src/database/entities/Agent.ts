import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { Task } from './Task';
import { TaskExecution } from './TaskExecution';
import { AgentMetric } from './AgentMetric';

@Entity('agents')
@Index(['provider'])
@Index(['isActive'])
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  agentId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'varchar', length: 100 })
  provider: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  version: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  endpoint: string;

  @Column({ type: 'jsonb', default: [] })
  capabilities: any[];

  @Column({ type: 'integer', default: 1 })
  maxConcurrentTasks: number;

  @Column({ type: 'integer', default: 300000 })
  timeoutMs: number;

  @Column({ type: 'jsonb', default: {} })
  costConfig: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => Task, task => task.assignedAgent)
  assignedTasks: Task[];

  @OneToMany(() => TaskExecution, execution => execution.agent)
  taskExecutions: TaskExecution[];

  @OneToMany(() => AgentMetric, metric => metric.agent)
  metrics: AgentMetric[];
}