import 'reflect-metadata';
import { DatabaseService } from './database-service';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  console.log('Starting database seed...');
  
  const db = DatabaseService.getInstance();
  
  try {
    await db.initialize();
    console.log('Database connected');

    // Get repositories
    const orgRepo = db.getRepository('Organization');
    const userRepo = db.getRepository('User');
    const roleRepo = db.getRepository('Role');
    const userRoleRepo = db.getRepository('UserRole');

    // Create test organization
    const testOrg = await orgRepo.save({
      name: 'Test Organization',
      slug: 'test-org',
      description: 'Test organization for development',
      settings: {
        features: {
          multiAgent: true,
          collaboration: true,
          approvals: true,
          knowledge: true
        }
      }
    });
    console.log('Created test organization');

    // Get admin role
    const adminRole = await roleRepo.findOne({
      where: { name: 'Administrator', organizationId: testOrg.id }
    });

    const developerRole = await roleRepo.findOne({
      where: { name: 'Developer', organizationId: testOrg.id }
    });

    // Create test users
    const adminPassword = await bcrypt.hash('admin123', 10);
    const adminUser = await userRepo.save({
      organizationId: testOrg.id,
      email: 'admin@example.com',
      username: 'admin',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      isActive: true
    });
    console.log('Created admin user');

    // Assign admin role
    if (adminRole) {
      await userRoleRepo.save({
        userId: adminUser.id,
        roleId: adminRole.id
      });
    }

    const devPassword = await bcrypt.hash('dev123', 10);
    const devUser = await userRepo.save({
      organizationId: testOrg.id,
      email: 'developer@example.com',
      username: 'developer',
      passwordHash: devPassword,
      firstName: 'Dev',
      lastName: 'User',
      isActive: true
    });
    console.log('Created developer user');

    // Assign developer role
    if (developerRole) {
      await userRoleRepo.save({
        userId: devUser.id,
        roleId: developerRole.id
      });
    }

    // Create sample project
    const projectRepo = db.getRepository('Project');
    const sampleProject = await projectRepo.save({
      organizationId: testOrg.id,
      name: 'Sample AI Project',
      description: 'A sample project to demonstrate the orchestrator capabilities',
      prd: `# Sample AI Project PRD

## Overview
Build an AI-powered task management system that helps teams organize and track their work.

## Requirements

### Functional Requirements
1. User authentication and authorization
2. Create, read, update, and delete tasks
3. Assign tasks to team members
4. Track task progress and status
5. Generate reports and analytics

### Technical Requirements
1. RESTful API backend
2. React-based frontend
3. PostgreSQL database
4. Redis for caching
5. Docker containerization

## Milestones
1. Phase 1: Core API Development (2 weeks)
2. Phase 2: Frontend Implementation (3 weeks)
3. Phase 3: Testing and Deployment (1 week)`,
      status: 'planning',
      createdById: adminUser.id
    });
    console.log('Created sample project');

    // Create sample tasks
    const taskRepo = db.getRepository('Task');
    const tasks = [
      {
        organizationId: testOrg.id,
        projectId: sampleProject.id,
        type: 'requirement',
        title: 'Define API endpoints and data models',
        description: 'Create OpenAPI specification for all API endpoints and define database schemas',
        status: 'pending',
        priority: 'high',
        createdById: adminUser.id
      },
      {
        organizationId: testOrg.id,
        projectId: sampleProject.id,
        type: 'design',
        title: 'Design system architecture',
        description: 'Create high-level architecture diagram and component design',
        status: 'pending',
        priority: 'high',
        createdById: adminUser.id
      },
      {
        organizationId: testOrg.id,
        projectId: sampleProject.id,
        type: 'implementation',
        title: 'Implement authentication service',
        description: 'Build JWT-based authentication with role-based access control',
        status: 'pending',
        priority: 'critical',
        createdById: devUser.id
      }
    ];

    for (const task of tasks) {
      await taskRepo.save(task);
    }
    console.log('Created sample tasks');

    console.log('Database seed completed successfully!');
    console.log('\nTest credentials:');
    console.log('Admin: admin@example.com / admin123');
    console.log('Developer: developer@example.com / dev123');

    await db.close();
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

// Run seed
seed().then(() => process.exit(0));