import { Task } from '../interfaces/task.interface';
import { Agent } from '../interfaces/agent.interface';
import winston from 'winston';

export interface TaskPattern {
  id: string;
  taskType: string;
  keywords: string[];
  complexity: 'easy' | 'medium' | 'hard';
  preferredAgents: { agentId: string; successRate: number; avgDuration: number }[];
  successFactors: string[];
  commonFailures: string[];
  executionTime: { min: number; max: number; avg: number };
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}

export interface AgentPattern {
  agentId: string;
  agentType: string;
  provider: string;
  specialties: string[];
  performance: {
    successRate: number;
    avgResponseTime: number;
    totalTasks: number;
    taskTypePerformance: Map<string, { successRate: number; avgTime: number }>;
  };
  learningData: {
    commonSuccessPatterns: string[];
    commonFailurePatterns: string[];
    timeOfDayPerformance: Map<number, number>; // hour -> success rate
    workloadOptimal: { minTasks: number; maxTasks: number };
  };
  lastUpdated: Date;
}

export interface CollaborationPattern {
  agentCombination: string[];
  taskTypes: string[];
  successRate: number;
  synergy: number; // 0-1, how much better than individual agents
  avgDuration: number;
  usageCount: number;
  contexts: string[];
}

export class PatternLearningService {
  private logger: winston.Logger;
  private taskPatterns: Map<string, TaskPattern>;
  private agentPatterns: Map<string, AgentPattern>;
  private collaborationPatterns: CollaborationPattern[];
  private learningEnabled: boolean;

  constructor(learningEnabled = true) {
    this.learningEnabled = learningEnabled;
    this.taskPatterns = new Map();
    this.agentPatterns = new Map();
    this.collaborationPatterns = [];
    
    this.logger = winston.createLogger({
      level: 'debug',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  /**
   * Update patterns based on completed task
   */
  public async updatePatterns(task: Task, agent: Agent, executionData: {
    duration: number;
    success: boolean;
    error?: string;
    collaborationAgents?: string[];
  }): Promise<void> {
    if (!this.learningEnabled) {
      this.logger.debug('Pattern learning disabled, skipping update');
      return;
    }

    try {
      // Update task patterns
      await this.updateTaskPattern(task, agent, executionData);
      
      // Update agent patterns
      await this.updateAgentPattern(agent, task, executionData);
      
      // Update collaboration patterns if applicable
      if (executionData.collaborationAgents && executionData.collaborationAgents.length > 0) {
        await this.updateCollaborationPattern(task, agent, executionData.collaborationAgents, executionData);
      }

      this.logger.debug(`Updated patterns for task ${task.id} and agent ${agent.config.id}`);
    } catch (error) {
      this.logger.error('Error updating patterns:', error);
    }
  }

  /**
   * Recommend best agent for a task based on learned patterns
   */
  public recommendAgent(task: Task, availableAgents: Agent[]): { 
    agent: Agent; 
    confidence: number; 
    reasoning: string;
  } | null {
    if (!this.learningEnabled || availableAgents.length === 0) {
      return null;
    }

    const taskKeywords = this.extractKeywords(task.prompt);
    const taskComplexity = this.estimateComplexity(task);
    
    let bestMatch: { agent: Agent; score: number; reasoning: string } | null = null;

    for (const agent of availableAgents) {
      const score = this.calculateAgentScore(agent, task, taskKeywords, taskComplexity);
      const reasoning = this.generateRecommendationReasoning(agent, task, score);
      
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { agent, score, reasoning };
      }
    }

    return bestMatch ? {
      agent: bestMatch.agent,
      confidence: Math.min(bestMatch.score, 1.0),
      reasoning: bestMatch.reasoning
    } : null;
  }

  /**
   * Suggest agent collaboration for complex tasks
   */
  public suggestCollaboration(task: Task, availableAgents: Agent[]): {
    agents: Agent[];
    expectedSynergy: number;
    reasoning: string;
  } | null {
    if (!this.learningEnabled || availableAgents.length < 2) {
      return null;
    }

    const taskComplexity = this.estimateComplexity(task);
    if (taskComplexity !== 'hard') {
      return null; // Only suggest collaboration for hard tasks
    }

    const taskKeywords = this.extractKeywords(task.prompt);
    
    // Find best collaboration pattern
    let bestCollaboration: CollaborationPattern | null = null;
    let bestScore = 0;

    for (const pattern of this.collaborationPatterns) {
      const score = this.calculateCollaborationScore(pattern, task, taskKeywords);
      if (score > bestScore) {
        bestScore = score;
        bestCollaboration = pattern;
      }
    }

    if (!bestCollaboration || bestScore < 0.6) {
      return null;
    }

    // Find available agents that match the pattern
    const matchingAgents = availableAgents.filter(agent =>
      bestCollaboration!.agentCombination.some(agentType =>
        agent.config.type === agentType || agent.config.provider === agentType
      )
    );

    if (matchingAgents.length < 2) {
      return null;
    }

    return {
      agents: matchingAgents.slice(0, 3), // Limit to 3 agents max
      expectedSynergy: bestCollaboration.synergy,
      reasoning: `Based on ${bestCollaboration.usageCount} similar tasks, this agent combination shows ${(bestCollaboration.synergy * 100).toFixed(1)}% better performance than individual agents`
    };
  }

  /**
   * Get task execution prediction
   */
  public predictTaskExecution(task: Task, agent: Agent): {
    estimatedDuration: number;
    successProbability: number;
    potentialIssues: string[];
    recommendations: string[];
  } {
    const taskKeywords = this.extractKeywords(task.prompt);
    const agentPattern = this.agentPatterns.get(agent.config.id);
    
    let estimatedDuration = 300000; // Default 5 minutes
    let successProbability = 0.7; // Default 70%
    const potentialIssues: string[] = [];
    const recommendations: string[] = [];

    // Use agent pattern data if available
    if (agentPattern) {
      const taskTypePerf = agentPattern.performance.taskTypePerformance.get(task.type);
      if (taskTypePerf) {
        estimatedDuration = taskTypePerf.avgTime;
        successProbability = taskTypePerf.successRate;
      } else {
        estimatedDuration = agentPattern.performance.avgResponseTime;
        successProbability = agentPattern.performance.successRate;
      }

      // Check for common failure patterns
      for (const failurePattern of agentPattern.learningData.commonFailurePatterns) {
        if (taskKeywords.some(keyword => failurePattern.includes(keyword))) {
          potentialIssues.push(`Previous failures with similar ${failurePattern} tasks`);
          successProbability *= 0.8; // Reduce probability
        }
      }

      // Check time of day performance
      const currentHour = new Date().getHours();
      const hourPerformance = agentPattern.learningData.timeOfDayPerformance.get(currentHour);
      if (hourPerformance && hourPerformance < successProbability * 0.8) {
        potentialIssues.push(`Agent typically performs below average at this time of day`);
        recommendations.push(`Consider scheduling this task for peak performance hours`);
      }
    }

    // Find similar task patterns
    for (const [patternId, pattern] of this.taskPatterns) {
      const similarity = this.calculateTaskSimilarity(task, pattern);
      if (similarity > 0.7) {
        const agentPerf = pattern.preferredAgents.find(p => p.agentId === agent.config.id);
        if (agentPerf) {
          estimatedDuration = agentPerf.avgDuration;
          successProbability = agentPerf.successRate;
        }

        // Add common failure insights
        pattern.commonFailures.forEach(failure => {
          if (!potentialIssues.includes(failure)) {
            potentialIssues.push(failure);
          }
        });
        break;
      }
    }

    return {
      estimatedDuration: Math.round(estimatedDuration),
      successProbability: Math.max(0.1, Math.min(1.0, successProbability)),
      potentialIssues,
      recommendations
    };
  }

  private async updateTaskPattern(task: Task, agent: Agent, executionData: any): Promise<void> {
    const taskKey = this.generateTaskPatternKey(task);
    const keywords = this.extractKeywords(task.prompt);
    
    let pattern = this.taskPatterns.get(taskKey);
    
    if (!pattern) {
      pattern = {
        id: taskKey,
        taskType: task.type,
        keywords,
        complexity: this.estimateComplexity(task),
        preferredAgents: [],
        successFactors: [],
        commonFailures: [],
        executionTime: { min: executionData.duration, max: executionData.duration, avg: executionData.duration },
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0
      };
    }

    // Update agent performance in this pattern
    const agentPerfIndex = pattern.preferredAgents.findIndex(p => p.agentId === agent.config.id);
    if (agentPerfIndex >= 0) {
      const agentPerf = pattern.preferredAgents[agentPerfIndex];
      const totalTasks = agentPerf.successRate * pattern.usageCount + 1;
      const newSuccessRate = executionData.success ? 
        (agentPerf.successRate * (totalTasks - 1) + 1) / totalTasks :
        (agentPerf.successRate * (totalTasks - 1)) / totalTasks;
      
      agentPerf.successRate = newSuccessRate;
      agentPerf.avgDuration = (agentPerf.avgDuration + executionData.duration) / 2;
    } else {
      pattern.preferredAgents.push({
        agentId: agent.config.id,
        successRate: executionData.success ? 1.0 : 0.0,
        avgDuration: executionData.duration
      });
    }

    // Update execution time stats
    pattern.executionTime.min = Math.min(pattern.executionTime.min, executionData.duration);
    pattern.executionTime.max = Math.max(pattern.executionTime.max, executionData.duration);
    pattern.executionTime.avg = (pattern.executionTime.avg * pattern.usageCount + executionData.duration) / (pattern.usageCount + 1);

    // Track failure patterns
    if (!executionData.success && executionData.error) {
      const errorPattern = this.extractErrorPattern(executionData.error);
      if (!pattern.commonFailures.includes(errorPattern)) {
        pattern.commonFailures.push(errorPattern);
      }
    }

    pattern.usageCount++;
    pattern.updatedAt = new Date();
    
    this.taskPatterns.set(taskKey, pattern);
  }

  private async updateAgentPattern(agent: Agent, task: Task, executionData: any): Promise<void> {
    let pattern = this.agentPatterns.get(agent.config.id);
    
    if (!pattern) {
      pattern = {
        agentId: agent.config.id,
        agentType: agent.config.type,
        provider: agent.config.provider,
        specialties: [],
        performance: {
          successRate: 0,
          avgResponseTime: 0,
          totalTasks: 0,
          taskTypePerformance: new Map()
        },
        learningData: {
          commonSuccessPatterns: [],
          commonFailurePatterns: [],
          timeOfDayPerformance: new Map(),
          workloadOptimal: { minTasks: 1, maxTasks: 5 }
        },
        lastUpdated: new Date()
      };
    }

    // Update overall performance
    const totalTasks = pattern.performance.totalTasks + 1;
    pattern.performance.successRate = 
      (pattern.performance.successRate * pattern.performance.totalTasks + (executionData.success ? 1 : 0)) / totalTasks;
    pattern.performance.avgResponseTime = 
      (pattern.performance.avgResponseTime * pattern.performance.totalTasks + executionData.duration) / totalTasks;
    pattern.performance.totalTasks = totalTasks;

    // Update task type specific performance
    const taskTypePerf = pattern.performance.taskTypePerformance.get(task.type) || { successRate: 0, avgTime: 0 };
    const taskTypeCount = pattern.performance.taskTypePerformance.has(task.type) ? 
      Math.round(taskTypePerf.successRate * totalTasks) : 1;
    
    taskTypePerf.successRate = 
      (taskTypePerf.successRate * (taskTypeCount - 1) + (executionData.success ? 1 : 0)) / taskTypeCount;
    taskTypePerf.avgTime = 
      (taskTypePerf.avgTime * (taskTypeCount - 1) + executionData.duration) / taskTypeCount;
    
    pattern.performance.taskTypePerformance.set(task.type, taskTypePerf);

    // Update time-of-day performance
    const hour = new Date().getHours();
    const hourSuccessRate = pattern.learningData.timeOfDayPerformance.get(hour) || 0.5;
    const hourCount = Array.from(pattern.learningData.timeOfDayPerformance.values()).length || 1;
    const newHourRate = (hourSuccessRate * (hourCount - 1) + (executionData.success ? 1 : 0)) / hourCount;
    pattern.learningData.timeOfDayPerformance.set(hour, newHourRate);

    pattern.lastUpdated = new Date();
    this.agentPatterns.set(agent.config.id, pattern);
  }

  private async updateCollaborationPattern(
    task: Task, 
    primaryAgent: Agent, 
    collaborationAgents: string[], 
    executionData: any
  ): Promise<void> {
    const agentCombination = [primaryAgent.config.id, ...collaborationAgents].sort();
    const taskTypes = [task.type];
    
    let pattern = this.collaborationPatterns.find(p => 
      p.agentCombination.length === agentCombination.length &&
      p.agentCombination.every(agent => agentCombination.includes(agent))
    );

    if (!pattern) {
      pattern = {
        agentCombination,
        taskTypes,
        successRate: executionData.success ? 1.0 : 0.0,
        synergy: 0.1, // Will be calculated
        avgDuration: executionData.duration,
        usageCount: 1,
        contexts: this.extractKeywords(task.prompt)
      };
      this.collaborationPatterns.push(pattern);
    } else {
      // Update existing pattern
      const totalCount = pattern.usageCount + 1;
      pattern.successRate = (pattern.successRate * pattern.usageCount + (executionData.success ? 1 : 0)) / totalCount;
      pattern.avgDuration = (pattern.avgDuration * pattern.usageCount + executionData.duration) / totalCount;
      pattern.usageCount = totalCount;
      
      // Add new task type if not present
      if (!pattern.taskTypes.includes(task.type)) {
        pattern.taskTypes.push(task.type);
      }
    }
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - in production, you'd use NLP
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Remove common words
    const commonWords = ['with', 'that', 'this', 'from', 'they', 'have', 'will', 'been', 'were', 'said'];
    return words.filter(word => !commonWords.includes(word)).slice(0, 10);
  }

  private estimateComplexity(task: Task): 'easy' | 'medium' | 'hard' {
    const indicators = {
      easy: ['simple', 'basic', 'quick', 'list', 'show', 'get'],
      medium: ['create', 'build', 'implement', 'design', 'analyze'],
      hard: ['complex', 'advanced', 'integrate', 'optimize', 'refactor', 'architect']
    };

    const prompt = task.prompt.toLowerCase();
    let easyScore = 0;
    let mediumScore = 0;
    let hardScore = 0;

    for (const word of indicators.easy) {
      if (prompt.includes(word)) easyScore++;
    }
    for (const word of indicators.medium) {
      if (prompt.includes(word)) mediumScore++;
    }
    for (const word of indicators.hard) {
      if (prompt.includes(word)) hardScore++;
    }

    // Consider task length and dependencies
    if (prompt.length > 500) hardScore++;
    if (task.dependencies && task.dependencies.length > 2) hardScore++;

    if (hardScore >= mediumScore && hardScore >= easyScore) return 'hard';
    if (mediumScore >= easyScore) return 'medium';
    return 'easy';
  }

  private calculateAgentScore(agent: Agent, task: Task, keywords: string[], complexity: string): number {
    let score = 0.5; // Base score

    const agentPattern = this.agentPatterns.get(agent.config.id);
    if (agentPattern) {
      // Weight by overall success rate
      score += agentPattern.performance.successRate * 0.4;
      
      // Weight by task type performance
      const taskTypePerf = agentPattern.performance.taskTypePerformance.get(task.type);
      if (taskTypePerf) {
        score += taskTypePerf.successRate * 0.3;
      }

      // Check for specialty match
      const specialtyMatch = agentPattern.specialties.some(specialty =>
        keywords.some(keyword => specialty.toLowerCase().includes(keyword))
      );
      if (specialtyMatch) {
        score += 0.2;
      }
    }

    return Math.min(score, 1.0);
  }

  private calculateCollaborationScore(pattern: CollaborationPattern, task: Task, keywords: string[]): number {
    let score = pattern.successRate * 0.4;
    
    // Task type match
    if (pattern.taskTypes.includes(task.type)) {
      score += 0.3;
    }
    
    // Context/keyword match
    const contextMatches = keywords.filter(keyword =>
      pattern.contexts.some(context => context.includes(keyword))
    ).length;
    score += (contextMatches / keywords.length) * 0.3;
    
    return Math.min(score, 1.0);
  }

  private calculateTaskSimilarity(task: Task, pattern: TaskPattern): number {
    if (task.type !== pattern.taskType) return 0;
    
    const taskKeywords = this.extractKeywords(task.prompt);
    const commonKeywords = taskKeywords.filter(keyword => 
      pattern.keywords.includes(keyword)
    ).length;
    
    return commonKeywords / Math.max(taskKeywords.length, pattern.keywords.length);
  }

  private generateTaskPatternKey(task: Task): string {
    const keywords = this.extractKeywords(task.prompt).slice(0, 3).join('-');
    return `${task.type}-${keywords}`;
  }

  private generateRecommendationReasoning(agent: Agent, task: Task, score: number): string {
    const agentPattern = this.agentPatterns.get(agent.config.id);
    const reasons = [];
    
    if (agentPattern) {
      if (agentPattern.performance.successRate > 0.8) {
        reasons.push(`High success rate (${(agentPattern.performance.successRate * 100).toFixed(1)}%)`);
      }
      
      const taskTypePerf = agentPattern.performance.taskTypePerformance.get(task.type);
      if (taskTypePerf && taskTypePerf.successRate > 0.8) {
        reasons.push(`Excellent performance with ${task.type} tasks`);
      }
      
      if (agentPattern.performance.avgResponseTime < 30000) {
        reasons.push('Fast response time');
      }
    }
    
    if (reasons.length === 0) {
      reasons.push('Based on general capabilities');
    }
    
    return reasons.join(', ');
  }

  private extractErrorPattern(error: string): string {
    // Extract meaningful error patterns
    if (error.includes('timeout')) return 'timeout';
    if (error.includes('network')) return 'network_error';
    if (error.includes('authentication')) return 'auth_error';
    if (error.includes('rate limit')) return 'rate_limit';
    if (error.includes('syntax')) return 'syntax_error';
    return 'unknown_error';
  }

  // Export/Import patterns for persistence
  public exportPatterns(): any {
    return {
      taskPatterns: Array.from(this.taskPatterns.entries()),
      agentPatterns: Array.from(this.agentPatterns.entries()),
      collaborationPatterns: this.collaborationPatterns,
      timestamp: new Date()
    };
  }

  public importPatterns(data: any): void {
    if (data.taskPatterns) {
      this.taskPatterns = new Map(data.taskPatterns);
    }
    if (data.agentPatterns) {
      this.agentPatterns = new Map(data.agentPatterns);
    }
    if (data.collaborationPatterns) {
      this.collaborationPatterns = data.collaborationPatterns;
    }
    
    this.logger.info('Imported patterns from external data');
  }
}