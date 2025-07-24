import { EventEmitter } from 'events';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Task } from '../interfaces/task.interface';
import { Agent } from '../interfaces/agent.interface';

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  type: 'solution' | 'pattern' | 'snippet' | 'documentation' | 'error' | 'best-practice';
  tags: string[];
  metadata: {
    taskId?: string;
    projectId?: string;
    agentId?: string;
    language?: string;
    framework?: string;
    category?: string;
    difficulty?: 'easy' | 'medium' | 'hard' | 'expert';
    votes?: number;
    views?: number;
    lastViewed?: Date;
  };
  relatedEntries?: string[]; // IDs of related entries
  source?: {
    type: 'task' | 'manual' | 'import' | 'external';
    reference?: string;
    author?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // User ID
  isPublic: boolean;
  version: number;
  searchVector?: string; // For full-text search
}

export interface KnowledgeSearchQuery {
  query?: string;
  type?: KnowledgeEntry['type'];
  tags?: string[];
  language?: string;
  framework?: string;
  category?: string;
  difficulty?: string;
  taskId?: string;
  projectId?: string;
  agentId?: string;
  createdBy?: string;
  isPublic?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'date' | 'views' | 'votes';
  sortOrder?: 'asc' | 'desc';
}

export interface KnowledgeStats {
  totalEntries: number;
  entriesByType: Record<KnowledgeEntry['type'], number>;
  entriesByLanguage: Record<string, number>;
  entriesByFramework: Record<string, number>;
  topTags: Array<{ tag: string; count: number }>;
  topContributors: Array<{ userId: string; count: number }>;
  recentlyViewed: KnowledgeEntry[];
  mostViewed: KnowledgeEntry[];
  highestRated: KnowledgeEntry[];
}

export interface LearningPattern {
  id: string;
  pattern: string;
  description: string;
  occurrences: number;
  examples: Array<{
    taskId: string;
    snippet: string;
    outcome: 'success' | 'failure';
  }>;
  recommendations: string[];
  confidence: number;
}

export class KnowledgeService extends EventEmitter {
  private entries: Map<string, KnowledgeEntry> = new Map();
  private patterns: Map<string, LearningPattern> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map(); // tag -> entry IDs
  private typeIndex: Map<string, Set<string>> = new Map(); // type -> entry IDs
  private taskIndex: Map<string, Set<string>> = new Map(); // taskId -> entry IDs
  private patternLearningService?: any; // PatternLearningService
  private logger: winston.Logger;
  private storagePath: string;
  private autoLearn: boolean;

  constructor(storagePath: string = './knowledge', autoLearn: boolean = true) {
    super();
    this.storagePath = storagePath;
    this.autoLearn = autoLearn;
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
      await this.loadKnowledge();
      this.logger.info('Knowledge service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize knowledge service', error);
    }
  }

  private async loadKnowledge(): Promise<void> {
    try {
      const entriesPath = path.join(this.storagePath, 'entries.json');
      const patternsPath = path.join(this.storagePath, 'patterns.json');

      // Load entries
      try {
        const entriesData = await fs.readFile(entriesPath, 'utf-8');
        const entries = JSON.parse(entriesData);
        entries.forEach((entry: KnowledgeEntry) => {
          this.entries.set(entry.id, {
            ...entry,
            createdAt: new Date(entry.createdAt),
            updatedAt: new Date(entry.updatedAt),
            metadata: {
              ...entry.metadata,
              lastViewed: entry.metadata.lastViewed ? new Date(entry.metadata.lastViewed) : undefined
            }
          });
          this.indexEntry(entry);
        });
      } catch (error) {
        this.logger.info('No existing knowledge entries found');
      }

      // Load patterns
      try {
        const patternsData = await fs.readFile(patternsPath, 'utf-8');
        const patterns = JSON.parse(patternsData);
        patterns.forEach((pattern: LearningPattern) => {
          this.patterns.set(pattern.id, pattern);
        });
      } catch (error) {
        this.logger.info('No existing patterns found');
      }
    } catch (error) {
      this.logger.error('Failed to load knowledge', error);
    }
  }

  private async saveKnowledge(): Promise<void> {
    try {
      const entriesPath = path.join(this.storagePath, 'entries.json');
      const patternsPath = path.join(this.storagePath, 'patterns.json');

      await fs.writeFile(
        entriesPath,
        JSON.stringify(Array.from(this.entries.values()), null, 2)
      );

      await fs.writeFile(
        patternsPath,
        JSON.stringify(Array.from(this.patterns.values()), null, 2)
      );
    } catch (error) {
      this.logger.error('Failed to save knowledge', error);
    }
  }

  private indexEntry(entry: KnowledgeEntry): void {
    // Index by tags
    entry.tags.forEach(tag => {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(entry.id);
    });

    // Index by type
    if (!this.typeIndex.has(entry.type)) {
      this.typeIndex.set(entry.type, new Set());
    }
    this.typeIndex.get(entry.type)!.add(entry.id);

    // Index by task
    if (entry.metadata.taskId) {
      if (!this.taskIndex.has(entry.metadata.taskId)) {
        this.taskIndex.set(entry.metadata.taskId, new Set());
      }
      this.taskIndex.get(entry.metadata.taskId)!.add(entry.id);
    }
  }

  public async createEntry(
    title: string,
    content: string,
    type: KnowledgeEntry['type'],
    createdBy: string,
    metadata?: Partial<KnowledgeEntry['metadata']>,
    tags: string[] = [],
    isPublic: boolean = true
  ): Promise<KnowledgeEntry> {
    const entry: KnowledgeEntry = {
      id: uuidv4(),
      title,
      content,
      type,
      tags,
      metadata: {
        views: 0,
        votes: 0,
        ...metadata
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy,
      isPublic,
      version: 1,
      searchVector: this.generateSearchVector(title, content, tags)
    };

    this.entries.set(entry.id, entry);
    this.indexEntry(entry);
    await this.saveKnowledge();

    this.emit('entry:created', entry);
    this.logger.info(`Knowledge entry created: ${entry.id}`);

    return entry;
  }

  public async updateEntry(
    entryId: string,
    updates: Partial<KnowledgeEntry>,
    updatedBy: string
  ): Promise<KnowledgeEntry | null> {
    const entry = this.entries.get(entryId);
    if (!entry) return null;

    // Check if user can update (creator or admin)
    if (entry.createdBy !== updatedBy && !updates.isPublic) {
      throw new Error('Unauthorized to update this entry');
    }

    const updatedEntry = {
      ...entry,
      ...updates,
      id: entry.id, // Prevent ID change
      createdAt: entry.createdAt, // Preserve creation date
      createdBy: entry.createdBy, // Preserve creator
      updatedAt: new Date(),
      version: entry.version + 1
    };

    if (updates.title || updates.content || updates.tags) {
      updatedEntry.searchVector = this.generateSearchVector(
        updatedEntry.title,
        updatedEntry.content,
        updatedEntry.tags
      );
    }

    this.entries.set(entryId, updatedEntry);
    await this.saveKnowledge();

    this.emit('entry:updated', updatedEntry);
    return updatedEntry;
  }

  public async deleteEntry(entryId: string, deletedBy: string): Promise<boolean> {
    const entry = this.entries.get(entryId);
    if (!entry) return false;

    // Check if user can delete (creator or admin)
    if (entry.createdBy !== deletedBy) {
      throw new Error('Unauthorized to delete this entry');
    }

    this.entries.delete(entryId);
    
    // Remove from indexes
    entry.tags.forEach(tag => {
      this.tagIndex.get(tag)?.delete(entryId);
    });
    this.typeIndex.get(entry.type)?.delete(entryId);
    if (entry.metadata.taskId) {
      this.taskIndex.get(entry.metadata.taskId)?.delete(entryId);
    }

    await this.saveKnowledge();
    
    this.emit('entry:deleted', entry);
    return true;
  }

  public async search(query: KnowledgeSearchQuery): Promise<KnowledgeEntry[]> {
    let results = Array.from(this.entries.values());

    // Filter by type
    if (query.type) {
      results = results.filter(entry => entry.type === query.type);
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter(entry =>
        query.tags!.some(tag => entry.tags.includes(tag))
      );
    }

    // Filter by metadata
    if (query.language) {
      results = results.filter(entry => entry.metadata.language === query.language);
    }
    if (query.framework) {
      results = results.filter(entry => entry.metadata.framework === query.framework);
    }
    if (query.category) {
      results = results.filter(entry => entry.metadata.category === query.category);
    }
    if (query.difficulty) {
      results = results.filter(entry => entry.metadata.difficulty === query.difficulty);
    }
    if (query.taskId) {
      results = results.filter(entry => entry.metadata.taskId === query.taskId);
    }
    if (query.projectId) {
      results = results.filter(entry => entry.metadata.projectId === query.projectId);
    }
    if (query.agentId) {
      results = results.filter(entry => entry.metadata.agentId === query.agentId);
    }
    if (query.createdBy) {
      results = results.filter(entry => entry.createdBy === query.createdBy);
    }
    if (query.isPublic !== undefined) {
      results = results.filter(entry => entry.isPublic === query.isPublic);
    }

    // Text search
    if (query.query) {
      const searchTerms = query.query.toLowerCase().split(' ');
      results = results.filter(entry => {
        const searchableText = `${entry.title} ${entry.content} ${entry.tags.join(' ')}`.toLowerCase();
        return searchTerms.every(term => searchableText.includes(term));
      });
    }

    // Sort results
    const sortBy = query.sortBy || 'relevance';
    const sortOrder = query.sortOrder || 'desc';
    
    results.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
        case 'views':
          comparison = (a.metadata.views || 0) - (b.metadata.views || 0);
          break;
        case 'votes':
          comparison = (a.metadata.votes || 0) - (b.metadata.votes || 0);
          break;
        case 'relevance':
          if (query.query) {
            const aRelevance = this.calculateRelevance(a, query.query);
            const bRelevance = this.calculateRelevance(b, query.query);
            comparison = aRelevance - bRelevance;
          }
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Pagination
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    results = results.slice(offset, offset + limit);

    // Update view count
    results.forEach(entry => {
      entry.metadata.views = (entry.metadata.views || 0) + 1;
      entry.metadata.lastViewed = new Date();
    });

    await this.saveKnowledge();
    return results;
  }

  public async learnFromTask(task: Task, agent: Agent): Promise<void> {
    if (!this.autoLearn || task.status !== 'completed') return;

    try {
      // Extract knowledge from successful task
      const knowledge = await this.extractKnowledge(task, agent);
      
      if (knowledge.length > 0) {
        for (const item of knowledge) {
          await this.createEntry(
            item.title,
            item.content,
            item.type,
            'system',
            {
              taskId: task.id,
              projectId: task.projectId,
              agentId: agent.config.id,
              language: item.language,
              framework: item.framework,
              difficulty: this.assessDifficulty(task)
            },
            item.tags,
            true
          );
        }
      }

      // Update patterns
      await this.updatePatterns(task, agent);
      
      this.logger.info(`Learned from task ${task.id}`);
    } catch (error) {
      this.logger.error('Failed to learn from task', error);
    }
  }

  private async extractKnowledge(task: Task, agent: Agent): Promise<Array<{
    title: string;
    content: string;
    type: KnowledgeEntry['type'];
    tags: string[];
    language?: string;
    framework?: string;
  }>> {
    const knowledge = [];

    // Extract solution if task was successful
    if (task.output) {
      const solution = {
        title: `Solution: ${task.title}`,
        content: this.formatSolution(task),
        type: 'solution' as const,
        tags: this.extractTags(task),
        language: this.detectLanguage(task),
        framework: this.detectFramework(task)
      };
      knowledge.push(solution);
    }

    // Extract patterns from task
    const patterns = this.identifyPatterns(task);
    for (const pattern of patterns) {
      knowledge.push({
        title: `Pattern: ${pattern.name}`,
        content: pattern.description,
        type: 'pattern' as const,
        tags: [...pattern.tags, 'pattern']
      });
    }

    // Extract code snippets
    const snippets = this.extractCodeSnippets(task);
    for (const snippet of snippets) {
      knowledge.push({
        title: `Code: ${snippet.title}`,
        content: snippet.code,
        type: 'snippet' as const,
        tags: snippet.tags,
        language: snippet.language
      });
    }

    return knowledge;
  }

  private formatSolution(task: Task): string {
    let content = `## Task\n${task.description}\n\n`;
    content += `## Solution\n`;
    
    if (typeof task.output === 'string') {
      content += task.output;
    } else if (task.output?.content) {
      content += task.output.content;
    } else {
      content += JSON.stringify(task.output, null, 2);
    }

    if (task.actualDuration) {
      content += `\n\n## Performance\n`;
      content += `- Duration: ${(task.actualDuration / 1000).toFixed(2)}s\n`;
      content += `- Agent: ${task.assignedAgent}\n`;
    }

    return content;
  }

  private extractTags(task: Task): string[] {
    const tags = [task.type as string];
    
    // Add tags based on task content
    const content = JSON.stringify(task).toLowerCase();
    
    const technologies = [
      'react', 'vue', 'angular', 'typescript', 'javascript',
      'python', 'java', 'go', 'rust', 'nodejs', 'express',
      'docker', 'kubernetes', 'aws', 'azure', 'gcp'
    ];
    
    technologies.forEach(tech => {
      if (content.includes(tech)) {
        tags.push(tech);
      }
    });

    return [...new Set(tags)];
  }

  private detectLanguage(task: Task): string | undefined {
    const content = JSON.stringify(task).toLowerCase();
    const languages = {
      'typescript': ['.ts', 'typescript', 'interface', 'type '],
      'javascript': ['.js', 'javascript', 'const ', 'let ', 'var '],
      'python': ['.py', 'python', 'def ', 'import ', 'from '],
      'java': ['.java', 'public class', 'private ', 'protected '],
      'go': ['.go', 'golang', 'func ', 'package '],
      'rust': ['.rs', 'rust', 'fn ', 'let mut', 'impl ']
    };

    for (const [lang, patterns] of Object.entries(languages)) {
      if (patterns.some(pattern => content.includes(pattern))) {
        return lang;
      }
    }

    return undefined;
  }

  private detectFramework(task: Task): string | undefined {
    const content = JSON.stringify(task).toLowerCase();
    const frameworks = {
      'react': ['react', 'usestate', 'useeffect', 'jsx'],
      'vue': ['vue', 'v-model', 'v-for', 'v-if'],
      'angular': ['angular', '@component', '@injectable'],
      'express': ['express', 'app.get', 'app.post', 'router'],
      'django': ['django', 'models.model', 'views.py'],
      'flask': ['flask', 'app.route', 'flask_'],
      'spring': ['spring', '@autowired', '@controller']
    };

    for (const [framework, patterns] of Object.entries(frameworks)) {
      if (patterns.some(pattern => content.includes(pattern))) {
        return framework;
      }
    }

    return undefined;
  }

  private identifyPatterns(task: Task): Array<{
    name: string;
    description: string;
    tags: string[];
  }> {
    const patterns = [];
    const content = JSON.stringify(task).toLowerCase();

    // Common patterns to look for
    const patternDefinitions = [
      {
        name: 'Repository Pattern',
        keywords: ['repository', 'getall', 'getbyid', 'create', 'update', 'delete'],
        description: 'Data access pattern that encapsulates data access logic'
      },
      {
        name: 'Factory Pattern',
        keywords: ['factory', 'create', 'build', 'instantiate'],
        description: 'Creational pattern for object instantiation'
      },
      {
        name: 'Observer Pattern',
        keywords: ['observer', 'subscribe', 'emit', 'listener', 'event'],
        description: 'Behavioral pattern for event handling'
      },
      {
        name: 'Singleton Pattern',
        keywords: ['singleton', 'instance', 'getinstance'],
        description: 'Creational pattern ensuring single instance'
      }
    ];

    for (const pattern of patternDefinitions) {
      const matchCount = pattern.keywords.filter(keyword => 
        content.includes(keyword)
      ).length;
      
      if (matchCount >= 2) {
        patterns.push({
          name: pattern.name,
          description: pattern.description,
          tags: ['design-pattern', ...pattern.keywords.slice(0, 3)]
        });
      }
    }

    return patterns;
  }

  private extractCodeSnippets(task: Task): Array<{
    title: string;
    code: string;
    tags: string[];
    language?: string;
  }> {
    const snippets = [];
    
    // This is a simplified version - in reality, you'd want more sophisticated parsing
    if (task.output && typeof task.output === 'string') {
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      let match;
      
      while ((match = codeBlockRegex.exec(task.output)) !== null) {
        const language = match[1];
        const code = match[2].trim();
        
        if (code.length > 50) { // Only save meaningful snippets
          snippets.push({
            title: this.generateSnippetTitle(code),
            code,
            tags: ['code', language || 'snippet'].filter(Boolean),
            language
          });
        }
      }
    }

    return snippets;
  }

  private generateSnippetTitle(code: string): string {
    // Try to extract a meaningful title from the code
    const lines = code.split('\n');
    
    // Look for function/class definitions
    for (const line of lines) {
      if (line.includes('function ') || line.includes('def ') || 
          line.includes('class ') || line.includes('interface ')) {
        return line.trim().substring(0, 50);
      }
    }
    
    // Default to first line
    return lines[0].trim().substring(0, 50);
  }

  private assessDifficulty(task: Task): 'easy' | 'medium' | 'hard' | 'expert' {
    // Simple heuristic based on task properties
    const factors = {
      duration: task.actualDuration || task.estimatedDuration || 0,
      retries: task.retryCount || 0,
      dependencies: task.dependencies?.length || 0,
      complexity: task.metadata?.complexity || 'medium'
    };

    let score = 0;
    
    // Duration factor
    if (factors.duration > 3600000) score += 3; // > 1 hour
    else if (factors.duration > 600000) score += 2; // > 10 min
    else if (factors.duration > 60000) score += 1; // > 1 min
    
    // Retry factor
    score += factors.retries;
    
    // Dependencies factor
    if (factors.dependencies > 5) score += 2;
    else if (factors.dependencies > 2) score += 1;
    
    // Complexity factor
    if (factors.complexity === 'high') score += 2;
    else if (factors.complexity === 'medium') score += 1;
    
    if (score >= 7) return 'expert';
    if (score >= 5) return 'hard';
    if (score >= 2) return 'medium';
    return 'easy';
  }

  private async updatePatterns(task: Task, agent: Agent, executionData?: {
    duration: number;
    success: boolean;
    error?: string;
  }): Promise<void> {
    // Import PatternLearningService when needed to avoid circular deps
    const { PatternLearningService } = await import('./pattern-learning');
    
    if (!this.patternLearningService) {
      this.patternLearningService = new PatternLearningService(true);
    }

    if (executionData) {
      await this.patternLearningService.updatePatterns(task, agent, executionData);
      this.logger.debug(`Updated learning patterns for task ${task.id} with agent ${agent.config.id}`);
    } else {
      this.logger.debug('No execution data provided, skipping pattern update');
    }
  }

  private generateSearchVector(title: string, content: string, tags: string[]): string {
    // Simple search vector - in production, you'd use proper text indexing
    return `${title} ${content} ${tags.join(' ')}`.toLowerCase();
  }

  private calculateRelevance(entry: KnowledgeEntry, query: string): number {
    const searchTerms = query.toLowerCase().split(' ');
    const searchableText = `${entry.title} ${entry.content} ${entry.tags.join(' ')}`.toLowerCase();
    
    let relevance = 0;
    searchTerms.forEach(term => {
      // Title matches are worth more
      if (entry.title.toLowerCase().includes(term)) relevance += 3;
      // Tag matches are worth more
      if (entry.tags.some(tag => tag.toLowerCase().includes(term))) relevance += 2;
      // Content matches
      if (entry.content.toLowerCase().includes(term)) relevance += 1;
    });
    
    // Boost by popularity
    relevance += (entry.metadata.votes || 0) * 0.1;
    relevance += (entry.metadata.views || 0) * 0.01;
    
    return relevance;
  }

  public async getStats(): Promise<KnowledgeStats> {
    const entries = Array.from(this.entries.values());
    
    const stats: KnowledgeStats = {
      totalEntries: entries.length,
      entriesByType: {} as Record<KnowledgeEntry['type'], number>,
      entriesByLanguage: {},
      entriesByFramework: {},
      topTags: [],
      topContributors: [],
      recentlyViewed: [],
      mostViewed: [],
      highestRated: []
    };

    // Count by type
    entries.forEach(entry => {
      stats.entriesByType[entry.type] = (stats.entriesByType[entry.type] || 0) + 1;
      
      if (entry.metadata.language) {
        stats.entriesByLanguage[entry.metadata.language] = 
          (stats.entriesByLanguage[entry.metadata.language] || 0) + 1;
      }
      
      if (entry.metadata.framework) {
        stats.entriesByFramework[entry.metadata.framework] = 
          (stats.entriesByFramework[entry.metadata.framework] || 0) + 1;
      }
    });

    // Count tags
    const tagCounts = new Map<string, number>();
    entries.forEach(entry => {
      entry.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    
    stats.topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Count contributors
    const contributorCounts = new Map<string, number>();
    entries.forEach(entry => {
      contributorCounts.set(entry.createdBy, 
        (contributorCounts.get(entry.createdBy) || 0) + 1);
    });
    
    stats.topContributors = Array.from(contributorCounts.entries())
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Recently viewed
    stats.recentlyViewed = entries
      .filter(e => e.metadata.lastViewed)
      .sort((a, b) => 
        (b.metadata.lastViewed?.getTime() || 0) - 
        (a.metadata.lastViewed?.getTime() || 0)
      )
      .slice(0, 10);

    // Most viewed
    stats.mostViewed = entries
      .sort((a, b) => (b.metadata.views || 0) - (a.metadata.views || 0))
      .slice(0, 10);

    // Highest rated
    stats.highestRated = entries
      .sort((a, b) => (b.metadata.votes || 0) - (a.metadata.votes || 0))
      .slice(0, 10);

    return stats;
  }

  public async vote(entryId: string, userId: string, value: 1 | -1): Promise<void> {
    const entry = this.entries.get(entryId);
    if (!entry) throw new Error('Entry not found');

    entry.metadata.votes = (entry.metadata.votes || 0) + value;
    await this.saveKnowledge();
    
    this.emit('entry:voted', { entryId, userId, value });
  }

  public async getRelatedEntries(entryId: string, limit: number = 5): Promise<KnowledgeEntry[]> {
    const entry = this.entries.get(entryId);
    if (!entry) return [];

    // Find related entries based on tags and metadata
    const related = Array.from(this.entries.values())
      .filter(e => e.id !== entryId)
      .map(e => ({
        entry: e,
        score: this.calculateSimilarity(entry, e)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.entry);

    return related;
  }

  private calculateSimilarity(entry1: KnowledgeEntry, entry2: KnowledgeEntry): number {
    let score = 0;

    // Tag similarity
    const commonTags = entry1.tags.filter(tag => entry2.tags.includes(tag));
    score += commonTags.length * 2;

    // Type match
    if (entry1.type === entry2.type) score += 3;

    // Metadata similarity
    if (entry1.metadata.language === entry2.metadata.language) score += 2;
    if (entry1.metadata.framework === entry2.metadata.framework) score += 2;
    if (entry1.metadata.category === entry2.metadata.category) score += 1;
    if (entry1.metadata.projectId === entry2.metadata.projectId) score += 1;

    return score;
  }

  public async exportKnowledge(format: 'json' | 'markdown' = 'json'): Promise<string> {
    const entries = Array.from(this.entries.values());

    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    }

    // Markdown format
    let markdown = '# Knowledge Base Export\n\n';
    markdown += `Generated on: ${new Date().toISOString()}\n\n`;
    markdown += `Total entries: ${entries.length}\n\n`;

    // Group by type
    const entriesByType = entries.reduce((acc, entry) => {
      if (!acc[entry.type]) acc[entry.type] = [];
      acc[entry.type].push(entry);
      return acc;
    }, {} as Record<string, KnowledgeEntry[]>);

    for (const [type, typeEntries] of Object.entries(entriesByType)) {
      markdown += `## ${type.charAt(0).toUpperCase() + type.slice(1)}s\n\n`;
      
      for (const entry of typeEntries) {
        markdown += `### ${entry.title}\n\n`;
        markdown += `**Tags:** ${entry.tags.join(', ')}\n`;
        markdown += `**Created:** ${entry.createdAt.toISOString()}\n`;
        if (entry.metadata.language) {
          markdown += `**Language:** ${entry.metadata.language}\n`;
        }
        if (entry.metadata.framework) {
          markdown += `**Framework:** ${entry.metadata.framework}\n`;
        }
        markdown += '\n';
        markdown += entry.content;
        markdown += '\n\n---\n\n';
      }
    }

    return markdown;
  }
}