import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PRDDecompositionService } from '../../src/services/prd-decomposition-service';
import { AgentRegistry } from '../../src/agents/agent-registry';
import { PatternLearningService } from '../../src/services/pattern-learning';
import { Project, Task } from '../../src/interfaces/task.interface';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('../../src/agents/agent-registry');
jest.mock('../../src/services/pattern-learning');

describe('PRDDecompositionService', () => {
  let service: PRDDecompositionService;
  let mockAgentRegistry: jest.Mocked<AgentRegistry>;
  let mockPatternLearning: jest.Mocked<PatternLearningService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAgentRegistry = new AgentRegistry() as jest.Mocked<AgentRegistry>;
    mockPatternLearning = new PatternLearningService() as jest.Mocked<PatternLearningService>;
    service = new PRDDecompositionService(mockAgentRegistry, mockPatternLearning);
  });

  describe('decomposePRD', () => {
    it('should decompose a web application PRD', async () => {
      const project: Project = {
        id: uuidv4(),
        name: 'E-commerce Platform',
        description: 'Build a modern e-commerce platform',
        prd: `# E-commerce Platform PRD

## Overview
We need to build a modern e-commerce platform with user authentication, product catalog, shopping cart, and checkout functionality.

## Functional Requirements
- User registration and authentication
- Product browsing and search
- Shopping cart management
- Secure checkout process
- Order tracking

## Technical Requirements
- React frontend
- Node.js backend
- PostgreSQL database
- Redis for caching
- Stripe integration for payments

## Timeline
- Phase 1: MVP in 3 months
- Phase 2: Advanced features in 6 months`,
        requirements: [],
        tasks: [],
        milestones: [],
        status: 'planning',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.decomposePRD(project);

      // Check requirements were extracted
      expect(result.requirements.length).toBeGreaterThan(0);
      expect(result.requirements.some(r => r.description.includes('authentication'))).toBe(true);
      expect(result.requirements.some(r => r.description.includes('checkout'))).toBe(true);

      // Check tasks were generated
      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.tasks.some(t => t.type === 'requirement')).toBe(true);
      expect(result.tasks.some(t => t.type === 'design')).toBe(true);
      expect(result.tasks.some(t => t.type === 'implementation')).toBe(true);
      expect(result.tasks.some(t => t.type === 'test')).toBe(true);
      expect(result.tasks.some(t => t.type === 'deployment')).toBe(true);

      // Check milestones were created
      expect(result.milestones.length).toBeGreaterThan(0);
      expect(result.milestones.some(m => m.name.includes('Complete'))).toBe(true);

      // Check dependencies were established
      expect(result.dependencies.size).toBeGreaterThan(0);

      // Check duration and risks
      expect(result.estimatedDuration).toBeGreaterThan(0);
      expect(Array.isArray(result.riskFactors)).toBe(true);
    });

    it('should detect mobile app project type', async () => {
      const project: Project = {
        id: uuidv4(),
        name: 'Mobile Banking App',
        description: 'Native mobile app for iOS and Android',
        prd: `# Mobile Banking App

## Overview
Develop a secure mobile banking application for iOS and Android platforms.

## Requirements
- Native iOS and Android apps
- Biometric authentication
- Account management
- Transaction history
- Push notifications`,
        requirements: [],
        tasks: [],
        milestones: [],
        status: 'planning',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.decomposePRD(project);

      // Should have mobile-specific tasks
      expect(result.tasks.some(t => t.title.includes('Mobile'))).toBe(true);
      expect(result.tasks.some(t => t.title.includes('Platform Integration'))).toBe(true);
      expect(result.tasks.some(t => t.title.includes('App Store'))).toBe(true);
    });

    it('should handle API service projects', async () => {
      const project: Project = {
        id: uuidv4(),
        name: 'Payment Processing API',
        description: 'RESTful API for payment processing',
        prd: `# Payment Processing API

## Overview
Build a secure RESTful API for processing payments.

## Requirements
- RESTful API design
- OAuth 2.0 authentication
- Payment processing endpoints
- Webhook support
- Rate limiting`,
        requirements: [],
        tasks: [],
        milestones: [],
        status: 'planning',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.decomposePRD(project);

      // Should have API-specific tasks
      expect(result.tasks.some(t => t.title.includes('API Contract'))).toBe(true);
      expect(result.tasks.some(t => t.title.includes('API Documentation'))).toBe(true);
      expect(result.tasks.length).toBeLessThan(15); // API projects typically have fewer tasks
    });

    it('should extract different requirement types', async () => {
      const project: Project = {
        id: uuidv4(),
        name: 'Test Project',
        description: 'Test project with various requirements',
        prd: `# Test Project

## Functional Requirements
- User must be able to login
- System should send email notifications
- Platform could support multiple languages

## User Stories
- As a user, I want to reset my password
- As an admin, I want to manage users

## Technical Requirements
- Must use TypeScript
- Should implement caching
- Database must be PostgreSQL

## Acceptance Criteria
- All tests must pass
- Performance: page load < 2 seconds`,
        requirements: [],
        tasks: [],
        milestones: [],
        status: 'planning',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.decomposePRD(project);

      // Check different requirement types
      const functionalReqs = result.requirements.filter(r => r.type === 'functional');
      const userStories = result.requirements.filter(r => r.type === 'user-story');
      const technicalReqs = result.requirements.filter(r => r.type === 'technical');

      expect(functionalReqs.length).toBeGreaterThan(0);
      expect(userStories.length).toBeGreaterThan(0);
      expect(technicalReqs.length).toBeGreaterThan(0);

      // Check priority detection
      expect(result.requirements.some(r => r.priority === 'critical')).toBe(true);
      expect(result.requirements.some(r => r.priority === 'high')).toBe(true);
    });

    it('should identify risk factors', async () => {
      const project: Project = {
        id: uuidv4(),
        name: 'High-Risk Project',
        description: 'Complex project with multiple risks',
        prd: `# High-Risk Project

## Overview
Build a real-time trading platform with machine learning predictions that needs to handle millions of transactions and integrate with multiple third-party APIs.

## Requirements
- Real-time data processing
- Machine learning models for predictions
- Integration with 5 different payment providers
- Compliance with financial regulations
- Must scale to 10 million users`,
        requirements: [],
        tasks: [],
        milestones: [],
        status: 'planning',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.decomposePRD(project);

      // Should identify multiple risk factors
      expect(result.riskFactors.length).toBeGreaterThan(0);
      expect(result.riskFactors.some(r => r.includes('Real-time'))).toBe(true);
      expect(result.riskFactors.some(r => r.includes('ML') || r.includes('machine learning'))).toBe(true);
      expect(result.riskFactors.some(r => r.includes('integration'))).toBe(true);
      expect(result.riskFactors.some(r => r.includes('Scale') || r.includes('scale'))).toBe(true);
      expect(result.riskFactors.some(r => r.includes('compliance') || r.includes('Compliance'))).toBe(true);
    });

    it('should create proper task dependencies', async () => {
      const project: Project = {
        id: uuidv4(),
        name: 'Simple Web App',
        description: 'Basic web application',
        prd: '# Simple Web App\n\nBuild a simple web application with frontend and backend.',
        requirements: [],
        tasks: [],
        milestones: [],
        status: 'planning',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.decomposePRD(project);

      // Check that implementation tasks depend on design tasks
      const designTasks = result.tasks.filter(t => t.type === 'design');
      const implTasks = result.tasks.filter(t => t.type === 'implementation');
      
      expect(designTasks.length).toBeGreaterThan(0);
      expect(implTasks.length).toBeGreaterThan(0);

      // At least some implementation tasks should have dependencies
      const implTasksWithDeps = implTasks.filter(t => t.dependencies && t.dependencies.length > 0);
      expect(implTasksWithDeps.length).toBeGreaterThan(0);

      // Test tasks should depend on implementation
      const testTasks = result.tasks.filter(t => t.type === 'test');
      const testTasksWithDeps = testTasks.filter(t => t.dependencies && t.dependencies.length > 0);
      expect(testTasksWithDeps.length).toBeGreaterThan(0);
    });

    it('should calculate project duration based on critical path', async () => {
      const project: Project = {
        id: uuidv4(),
        name: 'Duration Test Project',
        description: 'Project to test duration calculation',
        prd: '# Test Project\n\nSimple project for testing duration calculation.',
        requirements: [],
        tasks: [],
        milestones: [],
        status: 'planning',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.decomposePRD(project);

      // Duration should be reasonable (between 10 and 365 days for most projects)
      expect(result.estimatedDuration).toBeGreaterThan(10);
      expect(result.estimatedDuration).toBeLessThan(365);

      // Duration should account for task dependencies (not just sum of all tasks)
      const totalTaskHours = result.tasks.reduce((sum, task) => 
        sum + (task.metadata?.estimatedHours || 16), 0
      );
      const totalTaskDays = totalTaskHours / 8;
      
      // Critical path duration should be less than sum of all tasks
      expect(result.estimatedDuration).toBeLessThan(totalTaskDays);
    });

    it('should handle PRD without explicit sections', async () => {
      const project: Project = {
        id: uuidv4(),
        name: 'Simple Project',
        description: 'A simple project without formal PRD',
        prd: `We need to build a todo list application. 
        Users should be able to create, edit, and delete tasks.
        Tasks should have due dates and priorities.
        The app needs user authentication and should work on mobile devices.`,
        requirements: [],
        tasks: [],
        milestones: [],
        status: 'planning',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await service.decomposePRD(project);

      // Should still generate tasks and requirements
      expect(result.requirements.length).toBeGreaterThan(0);
      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.milestones.length).toBeGreaterThan(0);
    });
  });

  describe('refineDecomposition', () => {
    it('should add new tasks to decomposition', async () => {
      const project: Project = {
        id: uuidv4(),
        name: 'Test Project',
        description: 'Test project',
        prd: 'Simple test project',
        requirements: [],
        tasks: [],
        milestones: [],
        status: 'planning',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const initialResult = await service.decomposePRD(project);
      const initialTaskCount = initialResult.tasks.length;

      const refinedResult = await service.refineDecomposition(initialResult, {
        tasksToAdd: [
          {
            title: 'Performance Testing',
            description: 'Conduct performance testing',
            type: 'test',
            priority: 'high',
            estimatedHours: 16
          }
        ]
      });

      expect(refinedResult.tasks.length).toBe(initialTaskCount + 1);
      expect(refinedResult.tasks.some(t => t.title === 'Performance Testing')).toBe(true);
    });

    it('should remove tasks from decomposition', async () => {
      const project: Project = {
        id: uuidv4(),
        name: 'Test Project',
        description: 'Test project',
        prd: 'Simple test project',
        requirements: [],
        tasks: [],
        milestones: [],
        status: 'planning',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const initialResult = await service.decomposePRD(project);
      const taskToRemove = initialResult.tasks[0];
      const initialTaskCount = initialResult.tasks.length;

      const refinedResult = await service.refineDecomposition(initialResult, {
        tasksToRemove: [taskToRemove.id]
      });

      expect(refinedResult.tasks.length).toBe(initialTaskCount - 1);
      expect(refinedResult.tasks.find(t => t.id === taskToRemove.id)).toBeUndefined();

      // Dependencies should be cleaned up
      refinedResult.tasks.forEach(task => {
        if (task.dependencies) {
          expect(task.dependencies).not.toContain(taskToRemove.id);
        }
      });
    });

    it('should update task dependencies', async () => {
      const project: Project = {
        id: uuidv4(),
        name: 'Test Project',
        description: 'Test project',
        prd: 'Simple test project',
        requirements: [],
        tasks: [],
        milestones: [],
        status: 'planning',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const initialResult = await service.decomposePRD(project);
      const task1 = initialResult.tasks[0];
      const task2 = initialResult.tasks[1];

      const refinedResult = await service.refineDecomposition(initialResult, {
        dependenciesToAdd: [{ from: task1.id, to: task2.id }]
      });

      const updatedTask2 = refinedResult.tasks.find(t => t.id === task2.id);
      expect(updatedTask2?.dependencies).toContain(task1.id);
    });

    it('should recalculate duration after refinement', async () => {
      const project: Project = {
        id: uuidv4(),
        name: 'Test Project',
        description: 'Test project',
        prd: 'Simple test project',
        requirements: [],
        tasks: [],
        milestones: [],
        status: 'planning',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const initialResult = await service.decomposePRD(project);
      const initialDuration = initialResult.estimatedDuration;

      // Add a task with high estimated hours
      const refinedResult = await service.refineDecomposition(initialResult, {
        tasksToAdd: [
          {
            title: 'Complex Feature',
            description: 'Implement complex feature',
            type: 'implementation',
            priority: 'high',
            estimatedHours: 80 // 10 days
          }
        ]
      });

      // Duration might increase if the new task is on the critical path
      expect(refinedResult.estimatedDuration).toBeGreaterThanOrEqual(initialDuration);
    });
  });
});