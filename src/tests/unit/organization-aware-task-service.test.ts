import { OrganizationAwareTaskService } from '../../services/organization-aware-task-service';
import { AgentRegistry } from '../../agents/agent-registry';
import { OrganizationConfigService } from '../../services/organization-config-service';
import { Task } from '../../interfaces/task.interface';
import { Agent } from '../../interfaces/agent.interface';

// Mock dependencies
jest.mock('../../agents/agent-registry');
jest.mock('../../services/organization-config-service');

describe('OrganizationAwareTaskService', () => {
  let service: OrganizationAwareTaskService;
  let mockAgentRegistry: jest.Mocked<AgentRegistry>;
  let mockConfigService: jest.Mocked<OrganizationConfigService>;

  const mockTask: Task = {
    id: 'task-123',
    projectId: 'project-123',
    type: 'code-generation',
    title: 'Test Task',
    description: 'Generate a React component',
    dependencies: [],
    status: 'pending',
    priority: 'medium',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockAgent: Partial<Agent> = {
    config: {
      id: 'claude-001',
      name: 'Claude',
      type: 'llm',
      provider: 'anthropic',
      version: '3.5',
      capabilities: ['text-generation', 'code-generation'],
      endpoint: 'https://api.anthropic.com',
      maxConcurrentTasks: 5,
      cost: { inputTokenCost: 0.01, outputTokenCost: 0.02 }
    },
    getStatus: jest.fn().mockReturnValue({
      state: 'idle',
      totalTasksCompleted: 100,
      successRate: 0.95,
      averageResponseTime: 2500,
      lastActivity: new Date()
    })
  };

  const mockOrganizationAgentConfig = {
    id: 'config-123',
    organizationId: 'org-123',
    agentId: 'claude-001',
    enabled: true,
    priority: 1,
    maxConcurrentTasks: 3,
    config: {
      temperature: 0.7,
      maxTokens: 4000,
      rateLimits: {
        requestsPerMinute: 60,
        requestsPerHour: 1000
      },
      costLimits: {
        maxCostPerTask: 5.0,
        maxCostPerDay: 100.0
      },
      features: {
        codeGeneration: true,
        dataAnalysis: false
      }
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    mockAgentRegistry = new AgentRegistry() as jest.Mocked<AgentRegistry>;
    mockConfigService = new OrganizationConfigService(mockAgentRegistry) as jest.Mocked<OrganizationConfigService>;
    
    service = new OrganizationAwareTaskService(mockAgentRegistry, mockConfigService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('findBestAgentForTask', () => {
    it('should find best agents based on organization configuration', async () => {
      const registryScores = [
        { agentId: 'claude-001', score: 0.9 },
        { agentId: 'gpt-001', score: 0.8 },
        { agentId: 'gemini-001', score: 0.7 }
      ];

      mockConfigService.getOrganizationAgentConfigs.mockResolvedValue([
        mockOrganizationAgentConfig,
        {
          ...mockOrganizationAgentConfig,
          agentId: 'gpt-001',
          enabled: false,
          priority: 2
        }
      ]);

      mockAgentRegistry.findBestAgentForTask.mockReturnValue(registryScores);
      mockAgentRegistry.getAgent.mockImplementation((id) => 
        id === 'claude-001' ? mockAgent as Agent : null
      );

      const result = await service.findBestAgentForTask(mockTask, 'org-123');

      expect(result).toHaveLength(1); // Only enabled agents
      expect(result[0].agentId).toBe('claude-001');
      expect(result[0].organizationConfig).toEqual(mockOrganizationAgentConfig);
      expect(result[0].isAvailable).toBe(true);
      expect(result[0].maxConcurrentTasks).toBe(3);
    });

    it('should filter out disabled agents', async () => {
      const registryScores = [
        { agentId: 'claude-001', score: 0.9 },
        { agentId: 'disabled-agent', score: 0.8 }
      ];

      mockConfigService.getOrganizationAgentConfigs.mockResolvedValue([
        mockOrganizationAgentConfig,
        {
          ...mockOrganizationAgentConfig,
          agentId: 'disabled-agent',
          enabled: false
        }
      ]);

      mockAgentRegistry.findBestAgentForTask.mockReturnValue(registryScores);
      mockAgentRegistry.getAgent.mockReturnValue(mockAgent as Agent);

      const result = await service.findBestAgentForTask(mockTask, 'org-123');

      expect(result).toHaveLength(1);
      expect(result[0].agentId).toBe('claude-001');
    });

    it('should sort agents by priority then score', async () => {
      const registryScores = [
        { agentId: 'agent-1', score: 0.9 },
        { agentId: 'agent-2', score: 0.8 },
        { agentId: 'agent-3', score: 0.7 }
      ];

      mockConfigService.getOrganizationAgentConfigs.mockResolvedValue([
        { ...mockOrganizationAgentConfig, agentId: 'agent-1', priority: 3 },
        { ...mockOrganizationAgentConfig, agentId: 'agent-2', priority: 1 },
        { ...mockOrganizationAgentConfig, agentId: 'agent-3', priority: 2 }
      ]);

      mockAgentRegistry.findBestAgentForTask.mockReturnValue(registryScores);
      mockAgentRegistry.getAgent.mockReturnValue(mockAgent as Agent);

      const result = await service.findBestAgentForTask(mockTask, 'org-123');

      expect(result).toHaveLength(3);
      expect(result[0].agentId).toBe('agent-2'); // priority 1
      expect(result[1].agentId).toBe('agent-3'); // priority 2
      expect(result[2].agentId).toBe('agent-1'); // priority 3
    });
  });

  describe('getBestAvailableAgent', () => {
    it('should return the first available agent', async () => {
      const agentScores = [
        {
          agentId: 'claude-001',
          score: 0.9,
          priority: 1,
          organizationConfig: mockOrganizationAgentConfig,
          isAvailable: true,
          maxConcurrentTasks: 3,
          currentLoad: 1
        },
        {
          agentId: 'gpt-001',
          score: 0.8,
          priority: 2,
          organizationConfig: mockOrganizationAgentConfig,
          isAvailable: false,
          maxConcurrentTasks: 2,
          currentLoad: 2
        }
      ];

      jest.spyOn(service, 'findBestAgentForTask').mockResolvedValue(agentScores);

      const result = await service.getBestAvailableAgent(mockTask, 'org-123');

      expect(result).toBe('claude-001');
    });

    it('should return null when no agents are available', async () => {
      const agentScores = [
        {
          agentId: 'claude-001',
          score: 0.9,
          priority: 1,
          organizationConfig: mockOrganizationAgentConfig,
          isAvailable: false,
          maxConcurrentTasks: 3,
          currentLoad: 3
        }
      ];

      jest.spyOn(service, 'findBestAgentForTask').mockResolvedValue(agentScores);

      const result = await service.getBestAvailableAgent(mockTask, 'org-123');

      expect(result).toBeNull();
    });
  });

  describe('checkCostLimits', () => {
    it('should allow task within cost limits', async () => {
      mockConfigService.getOrganizationAgentConfigs.mockResolvedValue([
        mockOrganizationAgentConfig
      ]);

      const result = await service.checkCostLimits('claude-001', 'org-123', 3.0);

      expect(result.allowed).toBe(true);
    });

    it('should reject task exceeding per-task cost limit', async () => {
      mockConfigService.getOrganizationAgentConfigs.mockResolvedValue([
        mockOrganizationAgentConfig
      ]);

      const result = await service.checkCostLimits('claude-001', 'org-123', 10.0);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('per-task limit');
    });

    it('should allow task when no cost limits configured', async () => {
      const configWithoutLimits = {
        ...mockOrganizationAgentConfig,
        config: {
          ...mockOrganizationAgentConfig.config,
          costLimits: undefined
        }
      };

      mockConfigService.getOrganizationAgentConfigs.mockResolvedValue([
        configWithoutLimits
      ]);

      const result = await service.checkCostLimits('claude-001', 'org-123', 100.0);

      expect(result.allowed).toBe(true);
    });
  });

  describe('checkRateLimits', () => {
    it('should allow task when rate limits are configured', async () => {
      mockConfigService.getOrganizationAgentConfigs.mockResolvedValue([
        mockOrganizationAgentConfig
      ]);

      const result = await service.checkRateLimits('claude-001', 'org-123');

      expect(result.allowed).toBe(true);
    });

    it('should allow task when no rate limits configured', async () => {
      const configWithoutLimits = {
        ...mockOrganizationAgentConfig,
        config: {
          ...mockOrganizationAgentConfig.config,
          rateLimits: undefined
        }
      };

      mockConfigService.getOrganizationAgentConfigs.mockResolvedValue([
        configWithoutLimits
      ]);

      const result = await service.checkRateLimits('claude-001', 'org-123');

      expect(result.allowed).toBe(true);
    });
  });

  describe('getAgentConfigForOrganization', () => {
    it('should merge base config with organization config', async () => {
      mockConfigService.getOrganizationAgentConfigs.mockResolvedValue([
        mockOrganizationAgentConfig
      ]);

      mockAgentRegistry.getAgent.mockReturnValue({
        ...mockAgent,
        config: {
          ...mockAgent.config!,
          temperature: 0.5,
          maxTokens: 2000
        }
      } as Agent);

      const result = await service.getAgentConfigForOrganization('claude-001', 'org-123');

      expect(result.temperature).toBe(0.7); // Organization override
      expect(result.maxTokens).toBe(4000); // Organization override
      expect(result.maxConcurrentTasks).toBe(3); // Organization setting
      expect(result.rateLimits).toEqual(mockOrganizationAgentConfig.config.rateLimits);
    });

    it('should return base config when no organization config exists', async () => {
      mockConfigService.getOrganizationAgentConfigs.mockResolvedValue([]);

      mockAgentRegistry.getAgent.mockReturnValue(mockAgent as Agent);

      const result = await service.getAgentConfigForOrganization('claude-001', 'org-123');

      expect(result).toEqual(mockAgent.config);
    });

    it('should throw error when agent not found', async () => {
      mockConfigService.getOrganizationAgentConfigs.mockResolvedValue([]);
      mockAgentRegistry.getAgent.mockReturnValue(null);

      await expect(
        service.getAgentConfigForOrganization('non-existent', 'org-123')
      ).rejects.toThrow('Agent not found');
    });
  });

  describe('validateTaskForOrganization', () => {
    it('should validate task against organization features', async () => {
      const features = [
        {
          id: 'feature-1',
          organizationId: 'org-123',
          featureName: 'apiAccess',
          enabled: true,
          config: {},
          limits: { maxUsage: 1000 },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockConfigService.getOrganizationFeatureConfigs.mockResolvedValue(features);

      const result = await service.validateTaskForOrganization(mockTask, 'org-123');

      expect(result.valid).toBe(true);
    });

    it('should reject task when required feature is disabled', async () => {
      const features = [
        {
          id: 'feature-1',
          organizationId: 'org-123',
          featureName: 'apiAccess',
          enabled: false,
          config: {},
          limits: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockConfigService.getOrganizationFeatureConfigs.mockResolvedValue(features);

      const result = await service.validateTaskForOrganization(mockTask, 'org-123');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('apiAccess');
    });

    it('should check feature limits', async () => {
      const taskWithUsage = {
        ...mockTask,
        context: { estimatedUsage: 1500 }
      };

      const features = [
        {
          id: 'feature-1',
          organizationId: 'org-123',
          featureName: 'apiAccess',
          enabled: true,
          config: {},
          limits: { maxUsage: 1000 },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockConfigService.getOrganizationFeatureConfigs.mockResolvedValue(features);

      const result = await service.validateTaskForOrganization(taskWithUsage, 'org-123');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('exceeds feature limit');
    });
  });

  describe('Error Handling', () => {
    it('should handle config service errors gracefully', async () => {
      mockConfigService.getOrganizationAgentConfigs.mockRejectedValue(
        new Error('Database connection failed')
      );

      mockAgentRegistry.findBestAgentForTask.mockReturnValue([]);

      await expect(
        service.findBestAgentForTask(mockTask, 'org-123')
      ).rejects.toThrow('Database connection failed');
    });

    it('should allow by default when cost limit check fails', async () => {
      mockConfigService.getOrganizationAgentConfigs.mockRejectedValue(
        new Error('Service unavailable')
      );

      const result = await service.checkCostLimits('claude-001', 'org-123', 10.0);

      expect(result.allowed).toBe(true);
    });

    it('should allow by default when task validation fails', async () => {
      mockConfigService.getOrganizationFeatureConfigs.mockRejectedValue(
        new Error('Service unavailable')
      );

      const result = await service.validateTaskForOrganization(mockTask, 'org-123');

      expect(result.valid).toBe(true);
    });
  });
});