import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Organization } from './entities/Organization';
import { User } from './entities/User';
import { Role } from './entities/Role';
import { UserRole } from './entities/UserRole';
import { ApiKey } from './entities/ApiKey';
import { Agent } from './entities/Agent';
import { Project } from './entities/Project';
import { Task } from './entities/Task';
import { TaskExecution } from './entities/TaskExecution';
import { Workflow } from './entities/Workflow';
import { WorkflowExecution } from './entities/WorkflowExecution';
import { Template } from './entities/Template';
import { KnowledgeEntry } from './entities/KnowledgeEntry';
import { AuditLog } from './entities/AuditLog';
import { CollaborationSession } from './entities/CollaborationSession';
import { AgentMetric } from './entities/AgentMetric';
import { ApprovalRequest } from './entities/ApprovalRequest';
import { ApprovalResponse } from './entities/ApprovalResponse';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'orchestrator',
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.DB_LOGGING === 'true',
  entities: [
    Organization,
    User,
    Role,
    UserRole,
    ApiKey,
    Agent,
    Project,
    Task,
    TaskExecution,
    Workflow,
    WorkflowExecution,
    Template,
    KnowledgeEntry,
    AuditLog,
    CollaborationSession,
    AgentMetric,
    ApprovalRequest,
    ApprovalResponse,
  ],
  migrations: ['src/database/migrations/*.ts'],
  subscribers: ['src/database/subscribers/*.ts'],
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false,
});