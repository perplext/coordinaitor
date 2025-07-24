import { EventEmitter } from 'events';
import { Task, TaskType, TaskPriority } from '../interfaces/task.interface';
import { AgentRegistry } from '../agents/agent-registry';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export interface NLIntent {
  action: 'create' | 'update' | 'query' | 'analyze' | 'execute';
  taskType: TaskType;
  priority: TaskPriority;
  entities: {
    description?: string;
    technology?: string[];
    framework?: string[];
    language?: string[];
    file?: string[];
    timeframe?: string;
    constraints?: string[];
    requirements?: string[];
  };
  confidence: number;
  suggestedAgent?: string;
  collaborationNeeded?: boolean;
}

export interface NLParseResult {
  intent: NLIntent;
  task: Partial<Task>;
  suggestions?: string[];
  clarificationNeeded?: boolean;
  clarificationQuestions?: string[];
}

export class NaturalLanguageService extends EventEmitter {
  private agentRegistry: AgentRegistry;
  private logger: winston.Logger;
  
  // Keywords for task type detection
  private taskTypeKeywords = {
    'code-generation': ['create', 'generate', 'build', 'implement', 'develop', 'write code', 'scaffold'],
    'data-analysis': ['analyze', 'examine', 'investigate', 'study', 'explore data', 'insights', 'metrics'],
    'documentation': ['document', 'explain', 'describe', 'write docs', 'readme', 'api docs', 'comments'],
    'testing': ['test', 'verify', 'validate', 'check', 'unit test', 'integration test', 'e2e test'],
    'review': ['review', 'audit', 'assess', 'evaluate', 'code review', 'pr review', 'examine'],
    'debugging': ['debug', 'fix', 'troubleshoot', 'resolve', 'error', 'bug', 'issue'],
    'refactoring': ['refactor', 'optimize', 'improve', 'clean up', 'restructure', 'modernize'],
    'deployment': ['deploy', 'release', 'publish', 'ship', 'go live', 'production'],
    'security': ['secure', 'vulnerability', 'security scan', 'pen test', 'audit security'],
    'performance': ['optimize performance', 'speed up', 'reduce latency', 'improve efficiency']
  };

  // Keywords for priority detection
  private priorityKeywords = {
    urgent: ['urgent', 'asap', 'immediately', 'critical', 'emergency', 'now', 'high priority'],
    high: ['important', 'high', 'priority', 'soon', 'quickly', 'fast'],
    medium: ['normal', 'regular', 'standard', 'when possible'],
    low: ['low priority', 'backlog', 'nice to have', 'eventually', 'when time permits']
  };

  // Technology and framework detection
  private technologyPatterns = {
    languages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'c++', 'c#', 'ruby', 'php', 'swift', 'kotlin'],
    frameworks: ['react', 'vue', 'angular', 'next.js', 'express', 'django', 'flask', 'spring', 'rails', 'laravel'],
    databases: ['postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb', 'cassandra'],
    cloud: ['aws', 'azure', 'gcp', 'kubernetes', 'docker', 'terraform', 'ansible'],
    ai: ['tensorflow', 'pytorch', 'scikit-learn', 'keras', 'hugging face', 'langchain', 'openai', 'anthropic']
  };

  // Agent capability mapping
  private agentCapabilityMap = {
    'claude-001': ['general', 'code-generation', 'analysis', 'documentation', 'complex-reasoning'],
    'gemini-001': ['general', 'multimodal', 'code-generation', 'data-analysis'],
    'codex-001': ['code-generation', 'code-completion', 'debugging', 'refactoring'],
    'bedrock-001': ['aws-integration', 'enterprise', 'scalable'],
    'amazon-q-001': ['aws-specific', 'cloud-architecture', 'devops'],
    'github-copilot-001': ['code-completion', 'code-generation', 'pair-programming'],
    'cursor-001': ['ide-integration', 'code-editing', 'refactoring'],
    'perplexity-001': ['research', 'web-search', 'fact-checking'],
    'codewhisperer-001': ['aws-code', 'security-scanning', 'code-generation']
  };

  constructor(agentRegistry: AgentRegistry) {
    super();
    this.agentRegistry = agentRegistry;
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({ format: winston.format.simple() }),
        new winston.transports.File({ filename: 'logs/natural-language.log' })
      ]
    });
  }

  /**
   * Parse natural language input into structured task
   */
  async parseNaturalLanguageInput(input: string, context?: any): Promise<NLParseResult> {
    const normalizedInput = input.toLowerCase().trim();
    
    // Extract intent
    const intent = this.extractIntent(normalizedInput);
    
    // Extract entities
    const entities = this.extractEntities(normalizedInput);
    
    // Determine task type
    const taskType = this.determineTaskType(normalizedInput, entities);
    
    // Determine priority
    const priority = this.determinePriority(normalizedInput);
    
    // Suggest best agent
    const suggestedAgent = this.suggestBestAgent(taskType, entities, normalizedInput);
    
    // Check if collaboration is needed
    const collaborationNeeded = this.shouldUseCollaboration(normalizedInput, taskType);
    
    // Build intent object
    intent.taskType = taskType;
    intent.priority = priority;
    intent.entities = entities;
    intent.suggestedAgent = suggestedAgent;
    intent.collaborationNeeded = collaborationNeeded;
    
    // Create task object
    const task = this.buildTaskFromIntent(intent, input, context);
    
    // Generate suggestions
    const suggestions = this.generateSuggestions(intent, task);
    
    // Check if clarification is needed
    const { clarificationNeeded, clarificationQuestions } = this.checkClarificationNeeded(intent, task);
    
    const result: NLParseResult = {
      intent,
      task,
      suggestions,
      clarificationNeeded,
      clarificationQuestions
    };
    
    this.logger.info('Parsed natural language input', {
      input: input.substring(0, 100),
      result: {
        taskType,
        priority,
        suggestedAgent,
        clarificationNeeded
      }
    });
    
    this.emit('nl:parsed', result);
    
    return result;
  }

  /**
   * Extract action intent from input
   */
  private extractIntent(input: string): NLIntent {
    let action: NLIntent['action'] = 'create';
    let confidence = 0.8;
    
    if (input.includes('update') || input.includes('modify') || input.includes('change')) {
      action = 'update';
    } else if (input.includes('analyze') || input.includes('examine') || input.includes('investigate')) {
      action = 'analyze';
    } else if (input.includes('run') || input.includes('execute') || input.includes('perform')) {
      action = 'execute';
    } else if (input.includes('what') || input.includes('how') || input.includes('why') || input.includes('?')) {
      action = 'query';
    }
    
    // Adjust confidence based on clarity
    if (input.split(' ').length < 5) {
      confidence -= 0.2;
    }
    
    return {
      action,
      taskType: 'general',
      priority: 'medium',
      entities: {},
      confidence
    };
  }

  /**
   * Extract entities from input
   */
  private extractEntities(input: string): NLIntent['entities'] {
    const entities: NLIntent['entities'] = {};
    
    // Extract technologies
    const technologies: string[] = [];
    const frameworks: string[] = [];
    const languages: string[] = [];
    
    // Check for programming languages
    for (const lang of this.technologyPatterns.languages) {
      if (input.includes(lang)) {
        languages.push(lang);
      }
    }
    
    // Check for frameworks
    for (const framework of this.technologyPatterns.frameworks) {
      if (input.includes(framework)) {
        frameworks.push(framework);
      }
    }
    
    // Extract file references
    const filePattern = /(?:file|in|to|from)\s+([^\s]+\.[a-z]+)/gi;
    const fileMatches = input.matchAll(filePattern);
    const files: string[] = [];
    for (const match of fileMatches) {
      files.push(match[1]);
    }
    
    // Extract time references
    const timePattern = /(?:by|within|in)\s+(\d+\s+(?:hours?|days?|weeks?|minutes?))|(?:today|tomorrow|this week|next week)/gi;
    const timeMatch = input.match(timePattern);
    if (timeMatch) {
      entities.timeframe = timeMatch[0];
    }
    
    // Extract quoted requirements
    const quotedPattern = /"([^"]+)"|'([^']+)'/g;
    const quotedMatches = input.matchAll(quotedPattern);
    const requirements: string[] = [];
    for (const match of quotedMatches) {
      requirements.push(match[1] || match[2]);
    }
    
    // Build entities object
    if (languages.length > 0) entities.language = languages;
    if (frameworks.length > 0) entities.framework = frameworks;
    if (technologies.length > 0) entities.technology = technologies;
    if (files.length > 0) entities.file = files;
    if (requirements.length > 0) entities.requirements = requirements;
    
    // Extract main description (remove detected entities)
    let description = input;
    [...languages, ...frameworks, ...files].forEach(entity => {
      description = description.replace(new RegExp(entity, 'gi'), '');
    });
    entities.description = description.trim();
    
    return entities;
  }

  /**
   * Determine task type from input and entities
   */
  private determineTaskType(input: string, entities: NLIntent['entities']): TaskType {
    let bestMatch: TaskType = 'general';
    let highestScore = 0;
    
    for (const [type, keywords] of Object.entries(this.taskTypeKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        if (input.includes(keyword)) {
          score += keyword.split(' ').length; // Multi-word keywords score higher
        }
      }
      
      // Boost score based on entities
      if (type === 'code-generation' && (entities.language || entities.framework)) {
        score += 3;
      }
      if (type === 'documentation' && input.includes('readme')) {
        score += 5;
      }
      if (type === 'testing' && (input.includes('test') || input.includes('spec'))) {
        score += 4;
      }
      
      if (score > highestScore) {
        highestScore = score;
        bestMatch = type as TaskType;
      }
    }
    
    return bestMatch;
  }

  /**
   * Determine priority from input
   */
  private determinePriority(input: string): TaskPriority {
    for (const [priority, keywords] of Object.entries(this.priorityKeywords)) {
      for (const keyword of keywords) {
        if (input.includes(keyword)) {
          return priority as TaskPriority;
        }
      }
    }
    
    // Default based on certain indicators
    if (input.includes('!') || input.length > 200) {
      return 'high';
    }
    
    return 'medium';
  }

  /**
   * Suggest best agent for the task
   */
  private suggestBestAgent(taskType: TaskType, entities: NLIntent['entities'], input: string): string | undefined {
    const agents = this.agentRegistry.getAllAgents();
    let bestAgent: string | undefined;
    let highestScore = 0;
    
    for (const agent of agents) {
      let score = 0;
      const capabilities = this.agentCapabilityMap[agent.config.id] || [];
      
      // Score based on task type match
      if (capabilities.includes(taskType)) {
        score += 5;
      }
      if (capabilities.includes('general')) {
        score += 2;
      }
      
      // Score based on specific requirements
      if (entities.technology?.includes('aws') && agent.config.id.includes('amazon')) {
        score += 3;
      }
      if (taskType === 'code-generation' && agent.config.id.includes('codex')) {
        score += 3;
      }
      if (input.includes('research') && agent.config.id === 'perplexity-001') {
        score += 4;
      }
      
      // Consider agent availability
      const status = agent.getStatus();
      if (status.state === 'idle') {
        score += 1;
      }
      
      if (score > highestScore) {
        highestScore = score;
        bestAgent = agent.config.id;
      }
    }
    
    return bestAgent;
  }

  /**
   * Determine if collaboration is needed
   */
  private shouldUseCollaboration(input: string, taskType: TaskType): boolean {
    const collaborationIndicators = [
      'complex',
      'multiple',
      'various',
      'different aspects',
      'comprehensive',
      'full stack',
      'end to end',
      'research and implement',
      'analyze and create'
    ];
    
    let score = 0;
    for (const indicator of collaborationIndicators) {
      if (input.includes(indicator)) {
        score++;
      }
    }
    
    // Complex task types benefit from collaboration
    if (['review', 'security', 'performance'].includes(taskType)) {
      score++;
    }
    
    // Long inputs suggest complexity
    if (input.length > 150) {
      score++;
    }
    
    return score >= 2;
  }

  /**
   * Build task object from intent
   */
  private buildTaskFromIntent(intent: NLIntent, originalInput: string, context?: any): Partial<Task> {
    const task: Partial<Task> = {
      id: uuidv4(),
      prompt: originalInput,
      type: intent.taskType,
      priority: intent.priority,
      status: 'pending',
      createdAt: new Date(),
      context: {
        ...context,
        nlParsed: true,
        entities: intent.entities,
        suggestedAgent: intent.suggestedAgent,
        confidence: intent.confidence
      }
    };
    
    // Add specific context based on entities
    if (intent.entities.language) {
      task.context.language = intent.entities.language;
    }
    if (intent.entities.framework) {
      task.context.framework = intent.entities.framework;
    }
    if (intent.entities.file) {
      task.context.files = intent.entities.file;
    }
    if (intent.entities.timeframe) {
      task.context.deadline = this.parseTimeframe(intent.entities.timeframe);
    }
    
    return task;
  }

  /**
   * Parse timeframe into date
   */
  private parseTimeframe(timeframe: string): Date {
    const now = new Date();
    
    if (timeframe.includes('today')) {
      return new Date(now.setHours(23, 59, 59));
    } else if (timeframe.includes('tomorrow')) {
      return new Date(now.setDate(now.getDate() + 1));
    } else if (timeframe.includes('week')) {
      return new Date(now.setDate(now.getDate() + 7));
    }
    
    // Parse "in X days/hours"
    const match = timeframe.match(/(\d+)\s+(hours?|days?|weeks?)/);
    if (match) {
      const amount = parseInt(match[1]);
      const unit = match[2];
      
      if (unit.startsWith('hour')) {
        return new Date(now.getTime() + amount * 60 * 60 * 1000);
      } else if (unit.startsWith('day')) {
        return new Date(now.setDate(now.getDate() + amount));
      } else if (unit.startsWith('week')) {
        return new Date(now.setDate(now.getDate() + amount * 7));
      }
    }
    
    // Default to 1 week
    return new Date(now.setDate(now.getDate() + 7));
  }

  /**
   * Generate suggestions for the user
   */
  private generateSuggestions(intent: NLIntent, task: Partial<Task>): string[] {
    const suggestions: string[] = [];
    
    // Suggest adding more detail
    if (intent.confidence < 0.7) {
      suggestions.push('Consider adding more specific requirements or constraints');
    }
    
    // Suggest language/framework if missing
    if (intent.taskType === 'code-generation' && !intent.entities.language) {
      suggestions.push('Specify the programming language (e.g., "in TypeScript", "using Python")');
    }
    
    // Suggest collaboration for complex tasks
    if (!intent.collaborationNeeded && task.prompt && task.prompt.length > 100) {
      suggestions.push('This seems like a complex task. Consider using multi-agent collaboration');
    }
    
    // Suggest priority adjustment
    if (intent.entities.timeframe && intent.entities.timeframe.includes('today') && intent.priority !== 'urgent') {
      suggestions.push('Consider setting priority to "urgent" for today\'s deadline');
    }
    
    // Suggest relevant templates
    if (intent.taskType === 'code-generation') {
      suggestions.push('You might want to use a code generation template for consistency');
    }
    
    return suggestions;
  }

  /**
   * Check if clarification is needed
   */
  private checkClarificationNeeded(intent: NLIntent, task: Partial<Task>): {
    clarificationNeeded: boolean;
    clarificationQuestions: string[];
  } {
    const questions: string[] = [];
    
    // Check for ambiguous task type
    if (intent.confidence < 0.6) {
      questions.push('What type of task would you like to create? (e.g., code generation, analysis, documentation)');
    }
    
    // Check for missing critical information
    if (intent.taskType === 'code-generation' && !intent.entities.language && !intent.entities.framework) {
      questions.push('Which programming language or framework should be used?');
    }
    
    if (intent.taskType === 'data-analysis' && !intent.entities.description?.includes('data')) {
      questions.push('What data source should be analyzed?');
    }
    
    if (intent.taskType === 'testing' && !intent.entities.file) {
      questions.push('Which files or components should be tested?');
    }
    
    // Check for vague descriptions
    if (task.prompt && task.prompt.split(' ').length < 5) {
      questions.push('Can you provide more details about what you need?');
    }
    
    return {
      clarificationNeeded: questions.length > 0,
      clarificationQuestions: questions
    };
  }

  /**
   * Get task examples for a given type
   */
  getTaskExamples(taskType?: TaskType): string[] {
    const examples: Record<TaskType, string[]> = {
      'code-generation': [
        'Create a React component for user authentication with TypeScript',
        'Generate a Python API endpoint for processing payments',
        'Build a REST API service using Express.js with MongoDB'
      ],
      'data-analysis': [
        'Analyze the sales data from last quarter and identify trends',
        'Examine user behavior patterns in the application logs',
        'Generate insights from customer feedback CSV file'
      ],
      'documentation': [
        'Document the API endpoints for the user service',
        'Create a README file for the new React component library',
        'Write comprehensive JSDoc comments for all utility functions'
      ],
      'testing': [
        'Create unit tests for the authentication service',
        'Write integration tests for the payment processing flow',
        'Generate E2E tests for the user registration process'
      ],
      'review': [
        'Review the pull request for security vulnerabilities',
        'Audit the codebase for performance improvements',
        'Examine the architecture for scalability issues'
      ],
      'general': [
        'Help me understand how the authentication system works',
        'What\'s the best way to implement caching in this application?',
        'Suggest improvements for the current database schema'
      ]
    };
    
    if (taskType) {
      return examples[taskType] || examples.general;
    }
    
    // Return all examples
    return Object.values(examples).flat();
  }

  /**
   * Enhance task with additional context
   */
  async enhanceTaskWithContext(task: Partial<Task>): Promise<Partial<Task>> {
    // Add agent capabilities context
    if (task.context?.suggestedAgent) {
      const agent = this.agentRegistry.getAgent(task.context.suggestedAgent);
      if (agent) {
        task.context.agentCapabilities = agent.config.capabilities;
        task.context.agentCost = agent.config.cost;
      }
    }
    
    // Add similar task examples
    if (task.type) {
      task.context.examples = this.getTaskExamples(task.type).slice(0, 3);
    }
    
    // Add workflow suggestions
    if (task.type === 'code-generation' && task.context?.framework) {
      task.context.suggestedWorkflow = 'code-review-deploy';
    }
    
    return task;
  }

  /**
   * Convert structured task back to natural language
   */
  taskToNaturalLanguage(task: Task): string {
    let description = '';
    
    // Add priority if not medium
    if (task.priority !== 'medium') {
      description += `[${task.priority.toUpperCase()} PRIORITY] `;
    }
    
    // Add task type action
    const typeActions: Record<TaskType, string> = {
      'code-generation': 'Create',
      'data-analysis': 'Analyze',
      'documentation': 'Document',
      'testing': 'Test',
      'review': 'Review',
      'general': 'Handle'
    };
    
    description += `${typeActions[task.type] || 'Process'} `;
    
    // Add main description
    description += task.prompt;
    
    // Add context details
    if (task.context) {
      if (task.context.language) {
        description += ` using ${task.context.language.join(' and ')}`;
      }
      if (task.context.framework) {
        description += ` with ${task.context.framework.join(' and ')}`;
      }
      if (task.context.deadline) {
        description += ` by ${new Date(task.context.deadline).toLocaleDateString()}`;
      }
    }
    
    // Add collaboration note
    if (task.metadata?.requiresCollaboration) {
      description += ' (requires multi-agent collaboration)';
    }
    
    return description;
  }
}

export default NaturalLanguageService;