import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { Organization } from './Organization';
import { User } from './User';
import { Task } from './Task';

@Entity('projects')
@Index(['organizationId'])
@Index(['status'])
@Index(['createdById'])
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  prd: string;

  @Column({ type: 'varchar', length: 50, default: 'planning' })
  status: string;

  @Column({ type: 'jsonb', default: [] })
  requirements: any[];

  @Column({ type: 'jsonb', default: [] })
  milestones: any[];

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Organization, organization => organization.projects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => User, user => user.createdProjects)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @OneToMany(() => Task, task => task.project)
  tasks: Task[];
}