import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1706140000000 implements MigrationInterface {
  name = 'InitialSchema1706140000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create organizations table
    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "slug" character varying(255) NOT NULL,
        "description" text,
        "settings" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_organizations_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_organizations" PRIMARY KEY ("id")
      )
    `);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid,
        "email" character varying(255) NOT NULL,
        "username" character varying(255) NOT NULL,
        "passwordHash" character varying(255) NOT NULL,
        "firstName" character varying(255) NOT NULL,
        "lastName" character varying(255) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "lastLogin" TIMESTAMP,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // Create roles table
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid,
        "name" character varying(255) NOT NULL,
        "description" text,
        "isSystem" boolean NOT NULL DEFAULT false,
        "permissions" jsonb NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_roles_org_name" UNIQUE ("organizationId", "name"),
        CONSTRAINT "PK_roles" PRIMARY KEY ("id")
      )
    `);

    // Create user_roles table
    await queryRunner.query(`
      CREATE TABLE "user_roles" (
        "userId" uuid NOT NULL,
        "roleId" uuid NOT NULL,
        "grantedBy" uuid,
        "grantedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_roles" PRIMARY KEY ("userId", "roleId")
      )
    `);

    // Create agents table
    await queryRunner.query(`
      CREATE TABLE "agents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "agentId" character varying(255) NOT NULL,
        "name" character varying(255) NOT NULL,
        "type" character varying(50) NOT NULL,
        "provider" character varying(100) NOT NULL,
        "version" character varying(50),
        "endpoint" character varying(500),
        "capabilities" jsonb NOT NULL DEFAULT '[]',
        "maxConcurrentTasks" integer NOT NULL DEFAULT 1,
        "timeoutMs" integer NOT NULL DEFAULT 300000,
        "costConfig" jsonb NOT NULL DEFAULT '{}',
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_agents_agentId" UNIQUE ("agentId"),
        CONSTRAINT "PK_agents" PRIMARY KEY ("id")
      )
    `);

    // Create projects table
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "description" text,
        "prd" text,
        "status" character varying(50) NOT NULL DEFAULT 'planning',
        "requirements" jsonb NOT NULL DEFAULT '[]',
        "milestones" jsonb NOT NULL DEFAULT '[]',
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "createdById" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_projects" PRIMARY KEY ("id")
      )
    `);

    // Create tasks table
    await queryRunner.query(`
      CREATE TABLE "tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "projectId" uuid,
        "parentTaskId" uuid,
        "type" character varying(50) NOT NULL DEFAULT 'implementation',
        "title" character varying(500) NOT NULL,
        "description" text,
        "status" character varying(50) NOT NULL DEFAULT 'pending',
        "priority" character varying(20) NOT NULL DEFAULT 'medium',
        "assignedAgentId" uuid,
        "dependencies" uuid[] NOT NULL DEFAULT '{}',
        "requirements" jsonb NOT NULL DEFAULT '[]',
        "input" jsonb NOT NULL DEFAULT '{}',
        "output" jsonb,
        "error" text,
        "estimatedDuration" integer,
        "actualDuration" integer,
        "startedAt" TIMESTAMP,
        "completedAt" TIMESTAMP,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "createdById" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tasks" PRIMARY KEY ("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX "IDX_users_organizationId" ON "users" ("organizationId")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_username" ON "users" ("username")`);
    await queryRunner.query(`CREATE INDEX "IDX_roles_organizationId" ON "roles" ("organizationId")`);
    await queryRunner.query(`CREATE INDEX "IDX_agents_provider" ON "agents" ("provider")`);
    await queryRunner.query(`CREATE INDEX "IDX_agents_isActive" ON "agents" ("isActive")`);
    await queryRunner.query(`CREATE INDEX "IDX_projects_organizationId" ON "projects" ("organizationId")`);
    await queryRunner.query(`CREATE INDEX "IDX_projects_status" ON "projects" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_projects_createdById" ON "projects" ("createdById")`);
    await queryRunner.query(`CREATE INDEX "IDX_tasks_organizationId" ON "tasks" ("organizationId")`);
    await queryRunner.query(`CREATE INDEX "IDX_tasks_projectId" ON "tasks" ("projectId")`);
    await queryRunner.query(`CREATE INDEX "IDX_tasks_status" ON "tasks" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_tasks_assignedAgentId" ON "tasks" ("assignedAgentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_tasks_createdById" ON "tasks" ("createdById")`);

    // Add foreign key constraints
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_users_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "roles" ADD CONSTRAINT "FK_roles_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_user_roles_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_user_roles_role" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_user_roles_grantedBy" FOREIGN KEY ("grantedBy") REFERENCES "users"("id") ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_projects_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_projects_createdBy" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_organization" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_parentTask" FOREIGN KEY ("parentTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_assignedAgent" FOREIGN KEY ("assignedAgentId") REFERENCES "agents"("id") ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_createdBy" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_createdBy"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_assignedAgent"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_parentTask"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_project"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_organization"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_projects_createdBy"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_projects_organization"`);
    await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_user_roles_grantedBy"`);
    await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_user_roles_role"`);
    await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_user_roles_user"`);
    await queryRunner.query(`ALTER TABLE "roles" DROP CONSTRAINT "FK_roles_organization"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_organization"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_tasks_createdById"`);
    await queryRunner.query(`DROP INDEX "IDX_tasks_assignedAgentId"`);
    await queryRunner.query(`DROP INDEX "IDX_tasks_status"`);
    await queryRunner.query(`DROP INDEX "IDX_tasks_projectId"`);
    await queryRunner.query(`DROP INDEX "IDX_tasks_organizationId"`);
    await queryRunner.query(`DROP INDEX "IDX_projects_createdById"`);
    await queryRunner.query(`DROP INDEX "IDX_projects_status"`);
    await queryRunner.query(`DROP INDEX "IDX_projects_organizationId"`);
    await queryRunner.query(`DROP INDEX "IDX_agents_isActive"`);
    await queryRunner.query(`DROP INDEX "IDX_agents_provider"`);
    await queryRunner.query(`DROP INDEX "IDX_roles_organizationId"`);
    await queryRunner.query(`DROP INDEX "IDX_users_username"`);
    await queryRunner.query(`DROP INDEX "IDX_users_email"`);
    await queryRunner.query(`DROP INDEX "IDX_users_organizationId"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(`DROP TABLE "agents"`);
    await queryRunner.query(`DROP TABLE "user_roles"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "organizations"`);
  }
}