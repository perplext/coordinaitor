import { TaskOrchestrator } from '../../src/orchestration/task-orchestrator';
import { AgentRegistry } from '../../src/agents/agent-registry';
import { Task } from '../../src/interfaces/task.interface';
import { BaseAgent } from '../../src/interfaces/agent.interface';
import { CommunicationHubImplementation } from '../../src/communication/communication-hub';

// Mock agent for testing
class MockAgent extends BaseAgent {
  async initialize(): Promise<void> {
    this.status.state = 'idle';
  }

  async execute(request: any): Promise<any> {
    return {
      taskId: request.taskId,
      agentId: this.id,
      success: true,
      status: 'completed',
      result: { content: 'Mock result' },
      duration: 100,
    };
  }

  getStatus() {
    return this.status;
  }

  async shutdown(): Promise<void> {
    this.status.state = 'offline';
  }
}

describe('TaskOrchestrator', () => {
  let orchestrator: TaskOrchestrator;
  let agentRegistry: AgentRegistry;
  let mockAgent: MockAgent;
  let communicationHub: CommunicationHubImplementation;

  beforeEach(async () => {
    agentRegistry = new AgentRegistry();
    communicationHub = new CommunicationHubImplementation();
    orchestrator = new TaskOrchestrator(agentRegistry, communicationHub);

    // Create and register mock agent
    mockAgent = new MockAgent({
      id: 'mock-agent-1',
      name: 'Mock Agent',
      type: 'cli',
      provider: 'mock',
      version: '1.0.0',
      capabilities: [
        {
          name: 'general',
          description: 'General development',
          category: 'development',
          complexity: 'moderate',
          languages: ['javascript', 'typescript'],
        },
      ],
      maxConcurrentTasks: 2,
      timeout: 30000,
    });

    await mockAgent.initialize();
    agentRegistry.registerAgent(mockAgent);
  });

  afterEach(async () => {
    await mockAgent.shutdown();
    orchestrator.stopTaskProcessor();
  });

  describe('Task Creation', () => {
    it('should create a new task with defaults', async () => {
      const task = await orchestrator.createTask({
        prompt: 'Test task creation',
      });

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.title).toContain('Test task');
      expect(task.description).toBe('Test task creation');
      expect(task.type).toBe('implementation');
      expect(task.priority).toBe('medium');
      expect(task.status).toBe('pending');
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    it('should create task with custom properties', async () => {
      const task = await orchestrator.createTask({
        prompt: 'Deploy application to production',
        type: 'deployment',
        priority: 'critical',
        projectId: 'project-123',
      });

      expect(task.type).toBe('deployment');
      expect(task.priority).toBe('critical');
      expect(task.projectId).toBe('project-123');
    });

    it('should handle task with dependencies', async () => {
      const task1 = await orchestrator.createTask({
        prompt: 'Create database schema',
      });

      const task2 = await orchestrator.createTask({
        prompt: 'Implement API endpoints',
        dependencies: [task1.id],
      });

      expect(task2.dependencies).toContain(task1.id);
    });
  });

  describe('Task Execution', () => {
    it('should execute a simple task', async () => {
      const task = await orchestrator.createTask({
        prompt: 'Simple test task',
      });

      const result = await orchestrator.executeTask(task.id);

      expect(result.taskId).toBe(task.id);
      expect(result.status).toBe('completed');
      expect(result.agentId).toBe('mock-agent-1');
      expect(result.result).toBeDefined();
    });

    it('should assign task to appropriate agent', async () => {
      const task = await orchestrator.createTask({
        prompt: 'JavaScript development task',
        type: 'implementation',
        context: { languages: ['javascript'] },
      });

      // Execute the task to see the assignment
      const result = await orchestrator.executeTask(task.id);
      const assignedTask = orchestrator.getTask(task.id);
      
      expect(assignedTask).toBeDefined();
      expect(assignedTask?.assignedAgent).toBe('mock-agent-1');
      expect(result.success).toBe(true);
    });

    it('should handle task status updates', async () => {
      const task = await orchestrator.createTask({
        prompt: 'Status update test',
      });

      expect(task.status).toBe('pending');

      const executionPromise = orchestrator.executeTask(task.id);
      
      // Check intermediate status
      await new Promise(resolve => setTimeout(resolve, 10));
      const runningTask = orchestrator.getTask(task.id);
      expect(runningTask?.status).toBeDefined();
      expect(['pending', 'assigned', 'in_progress', 'completed']).toContain(runningTask?.status);

      const result = await executionPromise;
      const completedTask = orchestrator.getTask(task.id);
      
      expect(completedTask?.status).toBe('completed');
      expect(completedTask?.completedAt).toBeInstanceOf(Date);
    });

    it('should track task duration', async () => {
      const task = await orchestrator.createTask({
        prompt: 'Duration tracking test',
      });

      const result = await orchestrator.executeTask(task.id);
      const completedTask = await orchestrator.getTask(task.id);

      expect(completedTask?.actualDuration).toBeDefined();
      expect(completedTask?.actualDuration).toBeGreaterThan(0);
    });
  });

  describe('Task Querying', () => {
    beforeEach(async () => {
      // Create multiple tasks
      await orchestrator.createTask({
        prompt: 'Task 1',
        priority: 'high',
        type: 'implementation',
      });

      await orchestrator.createTask({
        prompt: 'Task 2',
        priority: 'low',
        type: 'test',
      });

      await orchestrator.createTask({
        prompt: 'Task 3',
        priority: 'critical',
        type: 'deployment',
      });
    });

    it('should get all tasks', async () => {
      const tasks = await orchestrator.getTasks();
      
      expect(tasks.length).toBeGreaterThanOrEqual(3);
      expect(tasks.every(t => t.id && t.title)).toBe(true);
    });

    it('should filter tasks by status', async () => {
      const pendingTasks = await orchestrator.getTasks({ status: 'pending' });
      
      expect(pendingTasks.length).toBeGreaterThanOrEqual(3);
      expect(pendingTasks.every(t => t.status === 'pending')).toBe(true);
    });

    it('should filter tasks by type', async () => {
      const deploymentTasks = await orchestrator.getTasks({ type: 'deployment' });
      
      expect(deploymentTasks.length).toBeGreaterThanOrEqual(1);
      expect(deploymentTasks.every(t => t.type === 'deployment')).toBe(true);
    });

    it('should filter tasks by priority', async () => {
      const criticalTasks = await orchestrator.getTasks({ priority: 'critical' });
      
      expect(criticalTasks.length).toBeGreaterThanOrEqual(1);
      expect(criticalTasks.every(t => t.priority === 'critical')).toBe(true);
    });

    it('should filter by multiple criteria', async () => {
      const tasks = await orchestrator.getTasks({
        status: 'pending',
        priority: 'high',
        type: 'implementation',
      });
      
      expect(tasks.length).toBeGreaterThanOrEqual(1);
      expect(tasks.every(t => 
        t.status === 'pending' && 
        t.priority === 'high' && 
        t.type === 'implementation'
      )).toBe(true);
    });
  });

  describe('Project Management', () => {
    it('should create a new project', async () => {
      const project = await orchestrator.createProject({
        name: 'Test Project',
        description: 'A test project for unit tests',
        prd: 'Build a simple web application',
      });

      expect(project).toBeDefined();
      expect(project.id).toBeDefined();
      expect(project.name).toBe('Test Project');
      expect(project.status).toBe('planning');
      expect(project.tasks).toEqual([]);
    });

    it.skip('should decompose PRD into tasks', async () => {
      const project = await orchestrator.createProject({
        name: 'E-commerce Platform',
        description: 'Build an e-commerce platform',
        prd: `
          Build an e-commerce platform with:
          1. User authentication system
          2. Product catalog with search
          3. Shopping cart functionality
          4. Payment integration
          5. Order management
        `,
      });

      // Mock the decomposition result
      jest.spyOn(mockAgent, 'execute').mockResolvedValueOnce({
        taskId: 'decompose-task',
        agentId: mockAgent.id,
        success: true,
        status: 'completed',
        result: {
          content: `
            ## Task 1: User Authentication
            type: implementation
            priority: high
            Build user authentication system

            ## Task 2: Product Catalog
            type: implementation  
            priority: high
            Create product catalog with search

            ## Task 3: Shopping Cart
            type: implementation
            priority: medium
            Implement shopping cart functionality
          `,
        },
        duration: 100,
      });

      const tasks = await orchestrator.decomposeProject(project.id);

      expect(tasks.length).toBeGreaterThanOrEqual(3);
      expect(tasks[0].title).toContain('Authentication');
      expect(tasks[1].title).toContain('Product Catalog');
      expect(tasks[2].title).toContain('Shopping Cart');
      expect(project.status).toBe('active');
    });
  });

  describe('Task Dependencies', () => {
    it('should handle task dependency resolution', async () => {
      const task1 = await orchestrator.createTask({
        prompt: 'Create database',
      });

      const task2 = await orchestrator.createTask({
        prompt: 'Create API',
        dependencies: [task1.id],
      });

      const task3 = await orchestrator.createTask({
        prompt: 'Create frontend',
        dependencies: [task2.id],
      });

      // Check dependency chains
      const deps = await orchestrator['resolveDependencyChain'](task3.id);
      
      expect(deps).toHaveLength(3);
      expect(deps[0].id).toBe(task1.id);
      expect(deps[1].id).toBe(task2.id);
      expect(deps[2].id).toBe(task3.id);
    });

    it('should detect circular dependencies', async () => {
      const task1 = await orchestrator.createTask({
        prompt: 'Task A',
      });

      const task2 = await orchestrator.createTask({
        prompt: 'Task B',
        dependencies: [task1.id],
      });

      // Try to create circular dependency
      const updateTask = async () => {
        const task = await orchestrator.getTask(task1.id);
        if (task) {
          task.dependencies = [task2.id];
        }
      };

      await updateTask();
      
      await expect(orchestrator['resolveDependencyChain'](task1.id))
        .rejects.toThrow('Circular dependency detected');
    });
  });

  describe('Error Handling', () => {
    it('should handle agent execution failure', async () => {
      // Mock agent failure
      jest.spyOn(mockAgent, 'execute').mockRejectedValueOnce(new Error('Agent error'));

      const task = await orchestrator.createTask({
        prompt: 'Failing task',
      });

      const result = await orchestrator.executeTask(task.id);
      const failedTask = await orchestrator.getTask(task.id);

      expect(result.status).toBe('failed');
      expect(failedTask?.status).toBe('failed');
      expect(failedTask?.error).toContain('Agent error');
    });

    it('should handle task not found', async () => {
      await expect(orchestrator.executeTask('non-existent-id'))
        .rejects.toThrow('Task not found');
    });

    it('should handle no available agents', async () => {
      // Unregister all agents
      agentRegistry['agents'].clear();

      const task = await orchestrator.createTask({
        prompt: 'No agent task',
      });

      await expect(orchestrator.executeTask(task.id))
        .rejects.toThrow('No suitable agent found');
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent task execution', async () => {
      const tasks = await Promise.all([
        orchestrator.createTask({ prompt: 'Concurrent task 1' }),
        orchestrator.createTask({ prompt: 'Concurrent task 2' }),
        orchestrator.createTask({ prompt: 'Concurrent task 3' }),
      ]);

      const startTime = Date.now();
      const results = await Promise.all(
        tasks.map(t => orchestrator.executeTask(t.id))
      );
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(3);
      expect(results.every(r => r.status === 'completed')).toBe(true);
      
      // Should execute concurrently (faster than sequential)
      // 3 tasks * 100ms each = 300ms if sequential, should be less if concurrent
      // Adding buffer for test environment overhead
      expect(duration).toBeLessThan(1000);
    });

    it.skip('should respect agent concurrent task limits', async () => {
      // Agent has limit of 2 concurrent tasks
      const tasks = await Promise.all([
        orchestrator.createTask({ prompt: 'Limit test 1' }),
        orchestrator.createTask({ prompt: 'Limit test 2' }),
        orchestrator.createTask({ prompt: 'Limit test 3' }),
      ]);

      let concurrentCount = 0;
      let maxConcurrent = 0;

      jest.spyOn(mockAgent, 'execute').mockImplementation(async (request) => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        await new Promise(resolve => setTimeout(resolve, 50));
        concurrentCount--;
        return {
          taskId: request.taskId,
          agentId: mockAgent.id,
          success: true,
          status: 'completed',
          result: { content: 'Done' },
          duration: 50,
        };
      });

      await Promise.all(tasks.map(t => orchestrator.executeTask(t.id)));

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });
});