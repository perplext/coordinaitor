import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { Organization } from './Organization';
import { Project } from './Project';
import { Agent } from './Agent';
import { User } from './User';
import { TaskExecution } from './TaskExecution';
import { CollaborationSession } from './CollaborationSession';

@Entity('tasks')
@Index(['organizationId'])
@Index(['projectId'])
@Index(['status'])
@Index(['assignedAgentId'])
@Index(['createdById'])
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'uuid', nullable: true })
  projectId: string;

  @Column({ type: 'uuid', nullable: true })
  parentTaskId: string;

  @Column({ type: 'varchar', length: 50, default: 'implementation' })
  type: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: string;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  priority: string;

  @Column({ type: 'uuid', nullable: true })
  assignedAgentId: string;

  @Column({ type: 'uuid', array: true, default: [] })
  dependencies: string[];

  @Column({ type: 'jsonb', default: [] })
  requirements: any[];

  @Column({ type: 'jsonb', default: {} })
  input: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  output: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  error: string;

  @Column({ type: 'integer', nullable: true })
  estimatedDuration: number;

  @Column({ type: 'integer', nullable: true })
  actualDuration: number;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => Project, project => project.tasks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_task_id' })
  parentTask: Task;

  @OneToMany(() => Task, task => task.parentTask)
  subtasks: Task[];

  @ManyToOne(() => Agent, agent => agent.assignedTasks)
  @JoinColumn({ name: 'assigned_agent' })
  assignedAgent: Agent;

  @ManyToOne(() => User, user => user.createdTasks)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @OneToMany(() => TaskExecution, execution => execution.task)
  executions: TaskExecution[];

  @OneToMany(() => CollaborationSession, session => session.task)
  collaborationSessions: CollaborationSession[];
}