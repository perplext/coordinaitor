import { EventEmitter } from 'events';
import { AgentRegistry } from '../agents/agent-registry';
import { OrganizationConfigService, OrganizationAgentConfig } from './organization-config-service';
import { Task } from '../interfaces/task.interface';
import { Agent } from '../interfaces/agent.interface';
import winston from 'winston';

export interface OrganizationAwareAgentScore {
  agentId: string;
  score: number;
  priority: number;
  organizationConfig?: OrganizationAgentConfig;
  isAvailable: boolean;
  maxConcurrentTasks: number;
  currentLoad: number;
}

export class OrganizationAwareTaskService extends EventEmitter {
  private agentRegistry: AgentRegistry;
  private configService: OrganizationConfigService;
  private logger: winston.Logger;

  constructor(agentRegistry: AgentRegistry, configService: OrganizationConfigService) {
    super();
    this.agentRegistry = agentRegistry;
    this.configService = configService;

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        }),
        new winston.transports.File({ 
          filename: 'logs/organization-aware-task-service.log',
          maxsize: 10485760,
          maxFiles: 5
        })
      ]
    });
  }

  /**
   * Find best agent for task considering organization configuration
   */
  async findBestAgentForTask(task: Task, organizationId: string): Promise<OrganizationAwareAgentScore[]> {
    try {
      // Get organization agent configurations
      const agentConfigs = await this.configService.getOrganizationAgentConfigs(organizationId);
      
      // Get available agents from registry
      const registryScores = this.agentRegistry.findBestAgentForTask(task);
      
      // Filter agents based on organization configuration
      const organizationAgentScores: OrganizationAwareAgentScore[] = [];

      for (const registryScore of registryScores) {
        const agentConfig = agentConfigs.find(config => config.agentId === registryScore.agentId);
        
        // Skip agents that are not configured or disabled for this organization
        if (!agentConfig || !agentConfig.enabled) {
          continue;
        }

        const agent = this.agentRegistry.getAgent(registryScore.agentId);
        if (!agent) {
          continue;
        }

        // Calculate current load and availability
        const agentStatus = agent.getStatus();
        const currentLoad = this.calculateAgentLoad(agent);
        const isAvailable = this.isAgentAvailable(agent, agentConfig, currentLoad);

        const organizationScore: OrganizationAwareAgentScore = {
          agentId: registryScore.agentId,
          score: this.calculateOrganizationAwareScore(registryScore.score, agentConfig, currentLoad),
          priority: agentConfig.priority,
          organizationConfig: agentConfig,
          isAvailable,
          maxConcurrentTasks: agentConfig.maxConcurrentTasks,
          currentLoad
        };

        organizationAgentScores.push(organizationScore);
      }

      // Sort by priority (lower number = higher priority), then by score
      organizationAgentScores.sort((a, b) => {
        // First sort by priority
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        // Then by score (higher score = better)
        return b.score - a.score;
      });

      this.logger.debug('Organization-aware agent scores calculated', {
        organizationId,
        taskId: task.id,
        taskType: task.type,
        availableAgents: organizationAgentScores.filter(s => s.isAvailable).length,
        totalAgents: organizationAgentScores.length
      });

      return organizationAgentScores;
    } catch (error) {
      this.logger.error('Failed to find best agent for task:', error);
      throw error;
    }
  }

  /**
   * Get best available agent considering organization configuration
   */
  async getBestAvailableAgent(task: Task, organizationId: string): Promise<string | null> {
    const agentScores = await this.findBestAgentForTask(task, organizationId);
    
    // Find the first available agent
    const availableAgent = agentScores.find(score => score.isAvailable);
    
    if (availableAgent) {
      this.logger.info('Best available agent selected', {
        organizationId,
        taskId: task.id,
        agentId: availableAgent.agentId,
        priority: availableAgent.priority,
        score: availableAgent.score
      });
      
      return availableAgent.agentId;
    }

    this.logger.warn('No available agents found', {
      organizationId,
      taskId: task.id,
      taskType: task.type,
      totalAgents: agentScores.length
    });

    return null;
  }

  /**
   * Check if agent meets organization-specific cost limits
   */
  async checkCostLimits(agentId: string, organizationId: string, estimatedCost: number): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const agentConfigs = await this.configService.getOrganizationAgentConfigs(organizationId);
      const agentConfig = agentConfigs.find(config => config.agentId === agentId);

      if (!agentConfig || !agentConfig.config.costLimits) {
        return { allowed: true };
      }

      const costLimits = agentConfig.config.costLimits;

      // Check per-task cost limit
      if (costLimits.maxCostPerTask && estimatedCost > costLimits.maxCostPerTask) {
        return {
          allowed: false,
          reason: `Estimated cost ($${estimatedCost.toFixed(2)}) exceeds per-task limit ($${costLimits.maxCostPerTask.toFixed(2)})`
        };
      }

      // TODO: Check daily and monthly limits by querying actual usage
      // This would require integration with billing service to get current usage

      return { allowed: true };
    } catch (error) {
      this.logger.error('Failed to check cost limits:', error);
      // Allow by default if we can't check limits
      return { allowed: true };
    }
  }

  /**
   * Check if agent meets organization-specific rate limits
   */
  async checkRateLimits(agentId: string, organizationId: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const agentConfigs = await this.configService.getOrganizationAgentConfigs(organizationId);
      const agentConfig = agentConfigs.find(config => config.agentId === agentId);

      if (!agentConfig || !agentConfig.config.rateLimits) {
        return { allowed: true };
      }

      const rateLimits = agentConfig.config.rateLimits;

      // TODO: Implement actual rate limit checking
      // This would require tracking agent usage over time periods
      // For now, we'll assume rate limits are enforced elsewhere

      return { allowed: true };
    } catch (error) {
      this.logger.error('Failed to check rate limits:', error);
      // Allow by default if we can't check limits
      return { allowed: true };
    }
  }

  /**
   * Get agent configuration with organization customizations
   */
  async getAgentConfigForOrganization(agentId: string, organizationId: string): Promise<any> {
    try {
      const agentConfigs = await this.configService.getOrganizationAgentConfigs(organizationId);
      const agentConfig = agentConfigs.find(config => config.agentId === agentId);

      // Get base agent configuration
      const agent = this.agentRegistry.getAgent(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const baseConfig = agent.config;

      // Merge with organization-specific configuration
      if (agentConfig && agentConfig.config) {
        return {
          ...baseConfig,
          // Override with organization-specific settings
          endpoint: agentConfig.config.endpoint || baseConfig.endpoint,
          model: agentConfig.config.model || baseConfig.model,
          temperature: agentConfig.config.temperature ?? baseConfig.temperature,
          maxTokens: agentConfig.config.maxTokens || baseConfig.maxTokens,
          systemPrompt: agentConfig.config.systemPrompt || baseConfig.systemPrompt,
          maxConcurrentTasks: agentConfig.maxConcurrentTasks,
          // Organization-specific settings
          rateLimits: agentConfig.config.rateLimits,
          costLimits: agentConfig.config.costLimits,
          features: agentConfig.config.features
        };
      }

      return baseConfig;
    } catch (error) {
      this.logger.error('Failed to get agent config for organization:', error);
      throw error;
    }
  }

  /**
   * Calculate organization-aware score for agent
   */
  private calculateOrganizationAwareScore(baseScore: number, agentConfig: OrganizationAgentConfig, currentLoad: number): number {
    let adjustedScore = baseScore;

    // Adjust score based on current load (prefer less loaded agents)
    const loadFactor = Math.max(0, 1 - (currentLoad / agentConfig.maxConcurrentTasks));
    adjustedScore *= loadFactor;

    // Apply organization-specific scoring adjustments if configured
    if (agentConfig.metadata?.scoringMultiplier) {
      adjustedScore *= agentConfig.metadata.scoringMultiplier;
    }

    return adjustedScore;
  }

  /**
   * Calculate current load for agent
   */
  private calculateAgentLoad(agent: Agent): number {
    const status = agent.getStatus();
    
    // For now, we'll use a simple heuristic based on agent state
    switch (status.state) {
      case 'idle':
        return 0;
      case 'busy':
        return 1; // Assume fully loaded when busy
      case 'error':
        return Number.MAX_SAFE_INTEGER; // Avoid error agents
      default:
        return 0.5; // Unknown state, assume moderate load
    }
  }

  /**
   * Check if agent is available considering organization limits
   */
  private isAgentAvailable(agent: Agent, agentConfig: OrganizationAgentConfig, currentLoad: number): boolean {
    // Check if agent is enabled for the organization
    if (!agentConfig.enabled) {
      return false;
    }

    // Check if agent is below its concurrent task limit
    if (currentLoad >= agentConfig.maxConcurrentTasks) {
      return false;
    }

    // Check agent health
    const status = agent.getStatus();
    if (status.state === 'error') {
      return false;
    }

    return true;
  }

  /**
   * Validate task against organization feature configuration
   */
  async validateTaskForOrganization(task: Task, organizationId: string): Promise<{ valid: boolean; reason?: string }> {
    try {
      const features = await this.configService.getOrganizationFeatureConfigs(organizationId);
      
      // Check if required features are enabled
      const requiredFeatures = this.getRequiredFeaturesForTask(task);
      
      for (const featureName of requiredFeatures) {
        const featureConfig = features.find(f => f.featureName === featureName);
        
        if (!featureConfig || !featureConfig.enabled) {
          return {
            valid: false,
            reason: `Required feature '${featureName}' is not enabled for this organization`
          };
        }

        // Check feature-specific limits
        if (featureConfig.limits) {
          const limitCheck = this.checkFeatureLimits(task, featureConfig.limits);
          if (!limitCheck.valid) {
            return limitCheck;
          }
        }
      }

      return { valid: true };
    } catch (error) {
      this.logger.error('Failed to validate task for organization:', error);
      // Allow by default if validation fails
      return { valid: true };
    }
  }

  /**
   * Get required features for a task based on task type and content
   */
  private getRequiredFeaturesForTask(task: Task): string[] {
    const features: string[] = [];

    // Map task types to required features
    switch (task.type) {
      case 'code-generation':
        features.push('apiAccess');
        break;
      case 'data-analysis':
        features.push('analytics');
        break;
      case 'collaboration':
        features.push('collaboration');
        break;
      default:
        features.push('apiAccess');
    }

    // Check task context for additional feature requirements
    if (task.context?.useWebSearch) {
      features.push('webSearch');
    }

    if (task.context?.requiresIntegration) {
      features.push('repositoryIntegration');
    }

    return features;
  }

  /**
   * Check feature-specific limits
   */
  private checkFeatureLimits(task: Task, limits: any): { valid: boolean; reason?: string } {
    // Implement feature-specific limit checking logic
    // This would depend on the specific limits configured

    if (limits.maxUsage && task.context?.estimatedUsage > limits.maxUsage) {
      return {
        valid: false,
        reason: `Task estimated usage (${task.context.estimatedUsage}) exceeds feature limit (${limits.maxUsage})`
      };
    }

    return { valid: true };
  }
}

export default OrganizationAwareTaskService;