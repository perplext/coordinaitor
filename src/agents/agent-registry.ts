import { AgentConfig, AgentCapability, BaseAgent } from '../interfaces/agent.interface';
import { Task } from '../interfaces/task.interface';
import winston from 'winston';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import path from 'path';

interface AgentScore {
  agentId: string;
  score: number;
  reasons: string[];
}

export class AgentRegistry {
  private agents: Map<string, BaseAgent> = new Map();
  private agentConfigs: Map<string, AgentConfig> = new Map();
  private logger: winston.Logger;
  private capabilityIndex: Map<string, Set<string>> = new Map();

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  public async loadConfigurations(configPath: string): Promise<void> {
    try {
      const configFile = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(configFile) as { agents: AgentConfig[] };
      
      for (const agentConfig of config.agents) {
        this.agentConfigs.set(agentConfig.id, agentConfig);
        this.indexCapabilities(agentConfig);
      }

      this.logger.info(`Loaded ${config.agents.length} agent configurations`);
    } catch (error) {
      this.logger.error('Failed to load agent configurations', error);
      throw error;
    }
  }

  private indexCapabilities(config: AgentConfig): void {
    for (const capability of config.capabilities) {
      if (!this.capabilityIndex.has(capability.name)) {
        this.capabilityIndex.set(capability.name, new Set());
      }
      this.capabilityIndex.get(capability.name)!.add(config.id);

      if (!this.capabilityIndex.has(capability.category)) {
        this.capabilityIndex.set(capability.category, new Set());
      }
      this.capabilityIndex.get(capability.category)!.add(config.id);
    }
  }

  public registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.config.id, agent);
    this.logger.info(`Agent registered: ${agent.config.name} (${agent.config.id})`);
  }

  public unregisterAgent(agentId: string): void {
    if (this.agents.delete(agentId)) {
      this.logger.info(`Agent unregistered: ${agentId}`);
    }
  }

  public getAgent(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId);
  }

  public getAgentConfig(agentId: string): AgentConfig | undefined {
    return this.agentConfigs.get(agentId);
  }

  public getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  public getAvailableAgents(): BaseAgent[] {
    return this.getAllAgents().filter(agent => {
      const status = agent.getStatus();
      return status.state === 'idle';
    });
  }

  public findBestAgentForTask(task: Task): AgentScore[] {
    const scores: AgentScore[] = [];

    for (const [agentId, agent] of this.agents) {
      const score = this.calculateAgentScore(agent, task);
      scores.push(score);
    }

    return scores.sort((a, b) => b.score - a.score);
  }

  private calculateAgentScore(agent: BaseAgent, task: Task): AgentScore {
    const score: AgentScore = {
      agentId: agent.config.id,
      score: 0,
      reasons: []
    };

    const status = agent.getStatus();
    
    if (status.state !== 'idle') {
      score.score -= 50;
      score.reasons.push(`Agent is ${status.state}`);
      return score;
    }

    const capabilities = agent.getCapabilities();
    
    for (const capability of capabilities) {
      if (capability.category === task.type || 
          (task.type === 'implementation' && capability.category === 'development')) {
        score.score += 20;
        score.reasons.push(`Matches task type: ${capability.category}`);
      }

      if (task.metadata?.languages) {
        const matchingLanguages = capability.languages?.filter(lang => 
          task.metadata?.languages?.includes(lang)
        ) || [];
        score.score += matchingLanguages.length * 10;
        if (matchingLanguages.length > 0) {
          score.reasons.push(`Supports languages: ${matchingLanguages.join(', ')}`);
        }
      }

      if (task.metadata?.frameworks) {
        const matchingFrameworks = capability.frameworks?.filter(fw => 
          task.metadata?.frameworks?.includes(fw)
        ) || [];
        score.score += matchingFrameworks.length * 10;
        if (matchingFrameworks.length > 0) {
          score.reasons.push(`Supports frameworks: ${matchingFrameworks.join(', ')}`);
        }
      }

      if (task.priority === 'critical' && capability.complexity === 'complex') {
        score.score += 15;
        score.reasons.push('Can handle complex critical tasks');
      }
    }

    if (status.successRate > 90) {
      score.score += 10;
      score.reasons.push(`High success rate: ${status.successRate.toFixed(1)}%`);
    }

    if (status.averageResponseTime < 5000) {
      score.score += 5;
      score.reasons.push('Fast response time');
    }

    const cost = agent.getCost();
    if (cost) {
      if (task.priority === 'low' && cost.perRequest && cost.perRequest > 0.1) {
        score.score -= 10;
        score.reasons.push('High cost for low priority task');
      }
    }

    return score;
  }

  public getAgentsByCapability(capability: string): BaseAgent[] {
    const agentIds = this.capabilityIndex.get(capability);
    if (!agentIds) return [];

    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter(agent => agent !== undefined) as BaseAgent[];
  }

  public getAgentsByCategory(category: string): BaseAgent[] {
    return this.getAgentsByCapability(category);
  }

  public async healthCheck(): Promise<Map<string, any>> {
    const health = new Map<string, any>();

    for (const [agentId, agent] of this.agents) {
      const status = agent.getStatus();
      health.set(agentId, {
        name: agent.config.name,
        state: status.state,
        lastActivity: status.lastActivity,
        successRate: status.successRate,
        tasksCompleted: status.totalTasksCompleted
      });
    }

    return health;
  }
}