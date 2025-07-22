import { EventEmitter } from 'events';
import { Task } from '../interfaces/task.interface';
import { Agent } from '../interfaces/agent.interface';
import winston from 'winston';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface TaskEstimation {
  taskId: string;
  estimatedDuration: number; // milliseconds
  confidence: number; // 0-1
  complexity: 'low' | 'medium' | 'high' | 'very-high';
  requiredAgents: number;
  recommendedStrategy?: 'single' | 'collaboration';
  similarTasks: SimilarTask[];
  factors: EstimationFactor[];
  estimatedCost?: number;
}

export interface SimilarTask {
  taskId: string;
  similarity: number; // 0-1
  actualDuration: number;
  actualCost?: number;
  agentsUsed: number;
  wasSuccessful: boolean;
}

export interface EstimationFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

export interface TaskFeatures {
  type: string;
  priority: string;
  descriptionLength: number;
  keywordCount: Record<string, number>;
  hasRequirements: boolean;
  requirementCount: number;
  hasDependencies: boolean;
  dependencyCount: number;
  estimatedLOC?: number;
  involvedTechnologies: string[];
  complexity: number; // calculated
}

export interface ModelData {
  tasks: Array<{
    features: TaskFeatures;
    actualDuration: number;
    wasSuccessful: boolean;
    agentsUsed: number;
    cost?: number;
  }>;
  lastUpdated: Date;
}

export class MLEstimationService extends EventEmitter {
  private logger: winston.Logger;
  private modelData: ModelData;
  private modelPath: string;
  private keywords: Map<string, number> = new Map();
  private technologyPatterns: Map<string, RegExp> = new Map();

  constructor(modelPath: string = './ml-models/task-estimation.json') {
    super();
    
    this.modelPath = modelPath;
    this.modelData = {
      tasks: [],
      lastUpdated: new Date()
    };

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.initializeKeywords();
    this.initializeTechnologyPatterns();
    this.loadModel();
  }

  private initializeKeywords(): void {
    // Keywords that indicate complexity
    const complexityKeywords = {
      // High complexity
      'architecture': 3,
      'refactor': 3,
      'migrate': 3,
      'integrate': 3,
      'optimization': 3,
      'performance': 3,
      'security': 3,
      'distributed': 4,
      'microservices': 4,
      'scalability': 3,
      
      // Medium complexity
      'implement': 2,
      'create': 2,
      'develop': 2,
      'design': 2,
      'api': 2,
      'database': 2,
      'authentication': 2,
      'validation': 2,
      
      // Low complexity
      'fix': 1,
      'update': 1,
      'add': 1,
      'remove': 1,
      'change': 1,
      'modify': 1,
      'test': 1,
      'document': 1
    };

    for (const [keyword, weight] of Object.entries(complexityKeywords)) {
      this.keywords.set(keyword, weight);
    }
  }

  private initializeTechnologyPatterns(): void {
    this.technologyPatterns.set('react', /react|jsx|tsx|component|hooks|redux/i);
    this.technologyPatterns.set('angular', /angular|ng-|directive|service/i);
    this.technologyPatterns.set('vue', /vue|vuex|composition api/i);
    this.technologyPatterns.set('node', /node|express|fastify|nest|npm/i);
    this.technologyPatterns.set('python', /python|django|flask|pip|pandas/i);
    this.technologyPatterns.set('java', /java|spring|maven|gradle/i);
    this.technologyPatterns.set('go', /golang|go |goroutine|channel/i);
    this.technologyPatterns.set('rust', /rust|cargo|crate/i);
    this.technologyPatterns.set('docker', /docker|container|kubernetes|k8s/i);
    this.technologyPatterns.set('aws', /aws|amazon|s3|ec2|lambda/i);
    this.technologyPatterns.set('azure', /azure|microsoft cloud/i);
    this.technologyPatterns.set('gcp', /google cloud|gcp|firebase/i);
    this.technologyPatterns.set('database', /database|sql|postgres|mysql|mongodb|redis/i);
    this.technologyPatterns.set('api', /api|rest|graphql|grpc|endpoint/i);
    this.technologyPatterns.set('ml', /machine learning|ml|ai|neural|tensorflow|pytorch/i);
  }

  private async loadModel(): Promise<void> {
    try {
      const modelDir = path.dirname(this.modelPath);
      await fs.mkdir(modelDir, { recursive: true });
      
      const data = await fs.readFile(this.modelPath, 'utf-8');
      this.modelData = JSON.parse(data);
      this.logger.info(`Loaded ML model with ${this.modelData.tasks.length} training samples`);
    } catch (error) {
      this.logger.info('No existing model found, starting with empty model');
      await this.saveModel();
    }
  }

  private async saveModel(): Promise<void> {
    try {
      await fs.writeFile(
        this.modelPath, 
        JSON.stringify(this.modelData, null, 2)
      );
      this.logger.info('ML model saved successfully');
    } catch (error) {
      this.logger.error('Failed to save ML model:', error);
    }
  }

  public async estimateTask(task: Task, availableAgents: Agent[]): Promise<TaskEstimation> {
    const features = this.extractFeatures(task);
    const similarTasks = this.findSimilarTasks(features);
    const factors = this.analyzeFactors(features, task);
    
    // Calculate estimates based on similar tasks and features
    const estimation = this.calculateEstimation(
      features, 
      similarTasks, 
      factors, 
      availableAgents
    );

    estimation.taskId = task.id;
    
    this.logger.info(`Estimated task ${task.id}: ${estimation.estimatedDuration}ms, complexity: ${estimation.complexity}`);
    this.emit('estimation:complete', estimation);
    
    return estimation;
  }

  private extractFeatures(task: Task): TaskFeatures {
    const description = task.description.toLowerCase();
    const keywordCount: Record<string, number> = {};
    let complexityScore = 0;

    // Count keywords
    for (const [keyword, weight] of this.keywords) {
      const count = (description.match(new RegExp(keyword, 'gi')) || []).length;
      if (count > 0) {
        keywordCount[keyword] = count;
        complexityScore += count * weight;
      }
    }

    // Detect technologies
    const involvedTechnologies: string[] = [];
    for (const [tech, pattern] of this.technologyPatterns) {
      if (pattern.test(description)) {
        involvedTechnologies.push(tech);
      }
    }

    // Estimate lines of code based on task type and description
    const estimatedLOC = this.estimateLinesOfCode(task);

    return {
      type: task.type,
      priority: task.priority,
      descriptionLength: description.length,
      keywordCount,
      hasRequirements: !!task.requirements && task.requirements.length > 0,
      requirementCount: task.requirements?.length || 0,
      hasDependencies: !!task.dependencies && task.dependencies.length > 0,
      dependencyCount: task.dependencies?.length || 0,
      estimatedLOC,
      involvedTechnologies,
      complexity: complexityScore
    };
  }

  private estimateLinesOfCode(task: Task): number {
    const baseEstimates: Record<Task['type'], number> = {
      requirement: 0,
      design: 50,
      implementation: 200,
      test: 100,
      deployment: 50,
      review: 0
    };

    let estimate = baseEstimates[task.type];
    
    // Adjust based on description indicators
    const description = task.description.toLowerCase();
    
    if (description.includes('simple') || description.includes('basic')) {
      estimate *= 0.5;
    } else if (description.includes('complex') || description.includes('comprehensive')) {
      estimate *= 2;
    }

    if (description.includes('api')) estimate += 100;
    if (description.includes('database')) estimate += 150;
    if (description.includes('ui') || description.includes('frontend')) estimate += 150;
    if (description.includes('full stack')) estimate *= 2;

    return Math.round(estimate);
  }

  private findSimilarTasks(features: TaskFeatures): SimilarTask[] {
    const similarTasks: SimilarTask[] = [];
    
    for (const historicalTask of this.modelData.tasks) {
      const similarity = this.calculateSimilarity(features, historicalTask.features);
      
      if (similarity > 0.3) { // Threshold for similarity
        similarTasks.push({
          taskId: `historical-${similarTasks.length}`,
          similarity,
          actualDuration: historicalTask.actualDuration,
          actualCost: historicalTask.cost,
          agentsUsed: historicalTask.agentsUsed,
          wasSuccessful: historicalTask.wasSuccessful
        });
      }
    }

    // Sort by similarity
    similarTasks.sort((a, b) => b.similarity - a.similarity);
    
    // Return top 5 most similar
    return similarTasks.slice(0, 5);
  }

  private calculateSimilarity(features1: TaskFeatures, features2: TaskFeatures): number {
    let similarity = 0;
    let factors = 0;

    // Type match
    if (features1.type === features2.type) {
      similarity += 0.3;
    }
    factors += 0.3;

    // Priority match
    if (features1.priority === features2.priority) {
      similarity += 0.1;
    }
    factors += 0.1;

    // Description length similarity
    const lengthRatio = Math.min(features1.descriptionLength, features2.descriptionLength) / 
                       Math.max(features1.descriptionLength, features2.descriptionLength);
    similarity += lengthRatio * 0.1;
    factors += 0.1;

    // Keyword overlap
    const keywords1 = new Set(Object.keys(features1.keywordCount));
    const keywords2 = new Set(Object.keys(features2.keywordCount));
    const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
    const union = new Set([...keywords1, ...keywords2]);
    
    if (union.size > 0) {
      similarity += (intersection.size / union.size) * 0.2;
    }
    factors += 0.2;

    // Technology overlap
    const tech1 = new Set(features1.involvedTechnologies);
    const tech2 = new Set(features2.involvedTechnologies);
    const techIntersection = new Set([...tech1].filter(x => tech2.has(x)));
    const techUnion = new Set([...tech1, ...tech2]);
    
    if (techUnion.size > 0) {
      similarity += (techIntersection.size / techUnion.size) * 0.2;
    }
    factors += 0.2;

    // Complexity similarity
    const complexityRatio = Math.min(features1.complexity, features2.complexity) / 
                           Math.max(features1.complexity, features2.complexity || 1);
    similarity += complexityRatio * 0.1;
    factors += 0.1;

    return similarity / factors;
  }

  private analyzeFactors(features: TaskFeatures, task: Task): EstimationFactor[] {
    const factors: EstimationFactor[] = [];

    // Task type factor
    const typeComplexity: Record<Task['type'], string> = {
      requirement: 'low',
      design: 'medium',
      implementation: 'high',
      test: 'medium',
      deployment: 'medium',
      review: 'low'
    };

    factors.push({
      name: 'Task Type',
      impact: typeComplexity[task.type] === 'high' ? 'negative' : 'neutral',
      weight: 0.2,
      description: `${task.type} tasks typically require ${typeComplexity[task.type]} effort`
    });

    // Priority factor
    if (task.priority === 'critical' || task.priority === 'high') {
      factors.push({
        name: 'High Priority',
        impact: 'negative',
        weight: 0.15,
        description: 'High priority tasks often require more careful implementation'
      });
    }

    // Technology factors
    if (features.involvedTechnologies.length > 3) {
      factors.push({
        name: 'Multiple Technologies',
        impact: 'negative',
        weight: 0.2,
        description: `Involves ${features.involvedTechnologies.length} different technologies`
      });
    }

    // Dependencies
    if (features.hasDependencies) {
      factors.push({
        name: 'Dependencies',
        impact: 'negative',
        weight: 0.1 * features.dependencyCount,
        description: `Has ${features.dependencyCount} dependencies to coordinate`
      });
    }

    // Complexity keywords
    if (features.complexity > 10) {
      factors.push({
        name: 'High Complexity',
        impact: 'negative',
        weight: 0.3,
        description: 'Description contains multiple complexity indicators'
      });
    }

    // Positive factors
    if (task.type === 'test' && features.keywordCount['unit']) {
      factors.push({
        name: 'Unit Testing',
        impact: 'positive',
        weight: 0.2,
        description: 'Unit tests are typically faster to implement'
      });
    }

    if (features.descriptionLength < 100) {
      factors.push({
        name: 'Clear Scope',
        impact: 'positive',
        weight: 0.1,
        description: 'Concise description suggests well-defined scope'
      });
    }

    return factors;
  }

  private calculateEstimation(
    features: TaskFeatures,
    similarTasks: SimilarTask[],
    factors: EstimationFactor[],
    availableAgents: Agent[]
  ): TaskEstimation {
    // Base duration estimates by type (in milliseconds)
    const baseDurations: Record<Task['type'], number> = {
      requirement: 30 * 60 * 1000, // 30 minutes
      design: 60 * 60 * 1000, // 1 hour
      implementation: 120 * 60 * 1000, // 2 hours
      test: 60 * 60 * 1000, // 1 hour
      deployment: 45 * 60 * 1000, // 45 minutes
      review: 30 * 60 * 1000 // 30 minutes
    };

    let estimatedDuration = baseDurations[features.type];
    let confidence = 0.5; // Base confidence

    // Adjust based on similar tasks
    if (similarTasks.length > 0) {
      const weightedDuration = similarTasks.reduce((sum, task) => 
        sum + (task.actualDuration * task.similarity), 0
      );
      const totalWeight = similarTasks.reduce((sum, task) => sum + task.similarity, 0);
      
      if (totalWeight > 0) {
        const historicalDuration = weightedDuration / totalWeight;
        // Blend historical and base estimate
        estimatedDuration = (estimatedDuration + historicalDuration) / 2;
        confidence = Math.min(0.9, confidence + (totalWeight / similarTasks.length) * 0.4);
      }
    }

    // Apply factors
    let totalImpact = 1.0;
    for (const factor of factors) {
      if (factor.impact === 'negative') {
        totalImpact += factor.weight;
      } else if (factor.impact === 'positive') {
        totalImpact -= factor.weight * 0.5; // Positive impacts are usually smaller
      }
    }
    estimatedDuration *= Math.max(0.5, totalImpact);

    // Determine complexity
    let complexity: TaskEstimation['complexity'];
    if (features.complexity < 5) {
      complexity = 'low';
    } else if (features.complexity < 10) {
      complexity = 'medium';
    } else if (features.complexity < 20) {
      complexity = 'high';
    } else {
      complexity = 'very-high';
    }

    // Determine required agents and strategy
    const requiredAgents = this.calculateRequiredAgents(features, complexity);
    const recommendedStrategy = requiredAgents > 1 ? 'collaboration' : 'single';

    // Estimate cost
    const estimatedCost = this.estimateCost(
      estimatedDuration, 
      requiredAgents, 
      availableAgents
    );

    return {
      taskId: '',
      estimatedDuration: Math.round(estimatedDuration),
      confidence,
      complexity,
      requiredAgents,
      recommendedStrategy,
      similarTasks,
      factors,
      estimatedCost
    };
  }

  private calculateRequiredAgents(features: TaskFeatures, complexity: string): number {
    let requiredAgents = 1;

    // Multiple technologies might benefit from specialists
    if (features.involvedTechnologies.length > 2) {
      requiredAgents = Math.min(features.involvedTechnologies.length, 3);
    }

    // High complexity tasks benefit from collaboration
    if (complexity === 'high' || complexity === 'very-high') {
      requiredAgents = Math.max(requiredAgents, 2);
    }

    // Certain keywords indicate need for collaboration
    const collaborationKeywords = ['full stack', 'end-to-end', 'integrate', 'cross-functional'];
    const description = Object.keys(features.keywordCount).join(' ');
    
    if (collaborationKeywords.some(keyword => description.includes(keyword))) {
      requiredAgents = Math.max(requiredAgents, 2);
    }

    return requiredAgents;
  }

  private estimateCost(duration: number, agents: number, availableAgents: Agent[]): number {
    if (availableAgents.length === 0) return 0;

    // Calculate average cost per hour across available agents
    let totalHourlyCost = 0;
    let agentCount = 0;

    for (const agent of availableAgents) {
      if (agent.config.cost) {
        if (agent.config.cost.monthly) {
          // Convert monthly to hourly (assuming 720 hours/month)
          totalHourlyCost += agent.config.cost.monthly / 720;
          agentCount++;
        } else if (agent.config.cost.perRequest) {
          // Estimate requests per hour based on task duration
          const requestsPerHour = 3600000 / duration; // ms in hour / task duration
          totalHourlyCost += agent.config.cost.perRequest * requestsPerHour;
          agentCount++;
        }
      }
    }

    if (agentCount === 0) return 0;

    const avgHourlyCost = totalHourlyCost / agentCount;
    const hours = duration / 3600000; // Convert ms to hours
    
    return avgHourlyCost * hours * agents;
  }

  public async updateModel(task: Task, actualDuration: number, wasSuccessful: boolean, agentsUsed: number, cost?: number): Promise<void> {
    const features = this.extractFeatures(task);
    
    this.modelData.tasks.push({
      features,
      actualDuration,
      wasSuccessful,
      agentsUsed,
      cost
    });

    // Keep only last 1000 tasks
    if (this.modelData.tasks.length > 1000) {
      this.modelData.tasks = this.modelData.tasks.slice(-1000);
    }

    this.modelData.lastUpdated = new Date();
    await this.saveModel();
    
    this.logger.info(`Model updated with task ${task.id} results`);
    this.emit('model:updated', { taskId: task.id });
  }

  public getModelStats(): {
    totalTasks: number;
    successRate: number;
    avgDuration: number;
    lastUpdated: Date;
  } {
    const totalTasks = this.modelData.tasks.length;
    const successfulTasks = this.modelData.tasks.filter(t => t.wasSuccessful).length;
    const totalDuration = this.modelData.tasks.reduce((sum, t) => sum + t.actualDuration, 0);

    return {
      totalTasks,
      successRate: totalTasks > 0 ? successfulTasks / totalTasks : 0,
      avgDuration: totalTasks > 0 ? totalDuration / totalTasks : 0,
      lastUpdated: this.modelData.lastUpdated
    };
  }

  public async exportModel(exportPath: string): Promise<void> {
    await fs.writeFile(exportPath, JSON.stringify(this.modelData, null, 2));
    this.logger.info(`Model exported to ${exportPath}`);
  }

  public async importModel(importPath: string): Promise<void> {
    const data = await fs.readFile(importPath, 'utf-8');
    const importedData = JSON.parse(data) as ModelData;
    
    // Merge with existing data
    this.modelData.tasks.push(...importedData.tasks);
    this.modelData.lastUpdated = new Date();
    
    await this.saveModel();
    this.logger.info(`Imported ${importedData.tasks.length} tasks from ${importPath}`);
  }
}