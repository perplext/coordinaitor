import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { User } from './User';
import { Role } from './Role';
import { Project } from './Project';
import { ApiKey } from './ApiKey';
import { RepositoryIntegration } from './RepositoryIntegration';
import { AutomationRule } from './AutomationRule';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => User, user => user.organization)
  users: User[];

  @OneToMany(() => Role, role => role.organization)
  roles: Role[];

  @OneToMany(() => Project, project => project.organization)
  projects: Project[];

  @OneToMany(() => ApiKey, apiKey => apiKey.organization)
  apiKeys: ApiKey[];

  @OneToMany(() => RepositoryIntegration, integration => integration.organization)
  repositoryIntegrations: RepositoryIntegration[];

  @OneToMany(() => AutomationRule, rule => rule.organization)
  automationRules: AutomationRule[];
}