import { EventEmitter } from 'events';
import winston from 'winston';
import { RepositoryService, Issue, PullRequest } from './repository-service';
import { TaskOrchestrator } from '../orchestration/task-orchestrator';
import { DatabaseService } from '../database/database-service';

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  repositoryPattern: string; // Regex pattern to match repositories
  enabled: boolean;
  triggers: {
    events: string[]; // push, pull_request, issues, etc.
    conditions: {
      branchPattern?: string;
      labelPattern?: string;
      authorPattern?: string;
      pathPattern?: string;
      messagePattern?: string;
    };
  };
  actions: {
    createTask?: {
      title: string;
      description: string;
      type: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      assignedAgents?: string[];
      metadata?: Record<string, any>;
    };
    createPR?: {
      title: string;
      description: string;
      sourceBranch: string;
      targetBranch: string;
      draft?: boolean;
    };
    createIssue?: {
      title: string;
      description: string;
      labels?: string[];
      assignees?: string[];
    };
    addComment?: {
      body: string;
    };
    assignReviewers?: {
      reviewers: string[];
    };
    runWorkflow?: {
      workflowId: string;
      inputs?: Record<string, any>;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationExecution {
  id: string;
  ruleId: string;
  repositoryName: string;
  eventType: string;
  eventData: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  results: {
    tasksCreated?: string[];
    prsCreated?: string[];
    issuesCreated?: string[];
    errors?: string[];
  };
  error?: string;
}

export class RepositoryAutomationService extends EventEmitter {
  private logger: winston.Logger;
  private repositoryService: RepositoryService;
  private taskOrchestrator: TaskOrchestrator;
  private db: DatabaseService;
  private rules: Map<string, AutomationRule> = new Map();
  private executions: Map<string, AutomationExecution> = new Map();

  constructor(
    repositoryService: RepositoryService,
    taskOrchestrator: TaskOrchestrator
  ) {
    super();
    this.repositoryService = repositoryService;
    this.taskOrchestrator = taskOrchestrator;
    this.db = DatabaseService.getInstance();

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
          filename: 'logs/repository-automation.log',
          maxsize: 10485760,
          maxFiles: 5
        })
      ]
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Listen to repository events
    this.repositoryService.on('repository:push', this.handlePushEvent.bind(this));
    this.repositoryService.on('repository:pull_request', this.handlePullRequestEvent.bind(this));
    this.repositoryService.on('repository:issue', this.handleIssueEvent.bind(this));
    this.repositoryService.on('repository:release', this.handleReleaseEvent.bind(this));
  }

  async initialize(): Promise<void> {
    try {
      await this.loadAutomationRules();
      this.logger.info('Repository automation service initialized', {
        rulesCount: this.rules.size
      });
    } catch (error) {
      this.logger.error('Failed to initialize repository automation service:', error);
      throw error;
    }
  }

  private async loadAutomationRules(): Promise<void> {
    // Load automation rules from database
    // For now, create some default rules
    const defaultRules: AutomationRule[] = [
      {
        id: 'auto-task-from-issue',
        name: 'Auto-create task from issue',
        description: 'Automatically create a development task when an issue is labeled with "task"',
        organizationId: 'default',
        repositoryPattern: '.*',
        enabled: true,
        triggers: {
          events: ['issues'],
          conditions: {
            labelPattern: 'task|enhancement|feature'
          }
        },
        actions: {
          createTask: {
            title: 'Resolve issue: {{issue.title}}',
            description: '{{issue.description}}\n\nIssue URL: {{issue.url}}',
            type: 'development',
            priority: 'medium',
            metadata: {
              sourceType: 'issue',
              sourceId: '{{issue.id}}',
              repository: '{{repository}}'
            }
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'auto-review-pr',
        name: 'Auto-review pull request',
        description: 'Automatically create code review task for new pull requests',
        organizationId: 'default',
        repositoryPattern: '.*',
        enabled: true,
        triggers: {
          events: ['pull_request'],
          conditions: {}
        },
        actions: {
          createTask: {
            title: 'Review PR: {{pullRequest.title}}',
            description: 'Review pull request #{{pullRequest.number}}\n\n{{pullRequest.description}}\n\nPR URL: {{pullRequest.url}}',
            type: 'review',
            priority: 'medium',
            assignedAgents: ['github-copilot-001', 'codewhisperer-001'],
            metadata: {
              sourceType: 'pull_request',
              sourceId: '{{pullRequest.id}}',
              repository: '{{repository}}'
            }
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'auto-security-scan',
        name: 'Auto security scan on push',
        description: 'Run security scan when code is pushed to main branch',
        organizationId: 'default',
        repositoryPattern: '.*',
        enabled: true,
        triggers: {
          events: ['push'],
          conditions: {
            branchPattern: 'main|master|develop'
          }
        },
        actions: {
          createTask: {
            title: 'Security scan for {{repository}}',
            description: 'Run security scan on recent commits to {{branch}}',
            type: 'security',
            priority: 'high',
            assignedAgents: ['codewhisperer-001'],
            metadata: {
              sourceType: 'push',
              repository: '{{repository}}',
              branch: '{{branch}}'
            }
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });
  }

  private async handlePushEvent(event: any): Promise<void> {
    try {
      const matchingRules = this.findMatchingRules('push', event.repository);
      
      for (const rule of matchingRules) {
        if (this.evaluateConditions(rule.triggers.conditions, event)) {
          await this.executeRule(rule, 'push', event);
        }
      }
    } catch (error) {
      this.logger.error('Failed to handle push event:', error);
    }
  }

  private async handlePullRequestEvent(event: any): Promise<void> {
    try {
      const matchingRules = this.findMatchingRules('pull_request', event.repository);
      
      for (const rule of matchingRules) {
        if (this.evaluateConditions(rule.triggers.conditions, event)) {
          await this.executeRule(rule, 'pull_request', event);
        }
      }
    } catch (error) {
      this.logger.error('Failed to handle pull request event:', error);
    }
  }

  private async handleIssueEvent(event: any): Promise<void> {
    try {
      const matchingRules = this.findMatchingRules('issues', event.repository);
      
      for (const rule of matchingRules) {
        if (this.evaluateConditions(rule.triggers.conditions, event)) {
          await this.executeRule(rule, 'issues', event);
        }
      }
    } catch (error) {
      this.logger.error('Failed to handle issue event:', error);
    }
  }

  private async handleReleaseEvent(event: any): Promise<void> {
    try {
      const matchingRules = this.findMatchingRules('release', event.repository);
      
      for (const rule of matchingRules) {
        if (this.evaluateConditions(rule.triggers.conditions, event)) {
          await this.executeRule(rule, 'release', event);
        }
      }
    } catch (error) {
      this.logger.error('Failed to handle release event:', error);
    }
  }

  private findMatchingRules(eventType: string, repository: string): AutomationRule[] {
    return Array.from(this.rules.values()).filter(rule => {
      if (!rule.enabled) return false;
      if (!rule.triggers.events.includes(eventType)) return false;
      
      const repoRegex = new RegExp(rule.repositoryPattern);
      return repoRegex.test(repository);
    });
  }

  private evaluateConditions(conditions: any, event: any): boolean {
    // Branch pattern check
    if (conditions.branchPattern && event.branch) {
      const branchRegex = new RegExp(conditions.branchPattern);
      if (!branchRegex.test(event.branch)) return false;
    }

    // Label pattern check (for issues and PRs)
    if (conditions.labelPattern && event.issue?.labels) {
      const labelRegex = new RegExp(conditions.labelPattern, 'i');
      const hasMatchingLabel = event.issue.labels.some((label: string) => 
        labelRegex.test(label)
      );
      if (!hasMatchingLabel) return false;
    }

    // Author pattern check
    if (conditions.authorPattern && event.author) {
      const authorRegex = new RegExp(conditions.authorPattern);
      if (!authorRegex.test(event.author)) return false;
    }

    // Message pattern check (for commits)
    if (conditions.messagePattern && event.commits) {
      const messageRegex = new RegExp(conditions.messagePattern, 'i');
      const hasMatchingMessage = event.commits.some((commit: any) => 
        messageRegex.test(commit.message)
      );
      if (!hasMatchingMessage) return false;
    }

    return true;
  }

  private async executeRule(rule: AutomationRule, eventType: string, eventData: any): Promise<void> {
    const execution: AutomationExecution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      repositoryName: eventData.repository,
      eventType,
      eventData,
      status: 'pending',
      startedAt: new Date(),
      results: {}
    };

    this.executions.set(execution.id, execution);

    try {
      execution.status = 'running';
      this.logger.info('Executing automation rule', {
        ruleId: rule.id,
        ruleName: rule.name,
        repository: eventData.repository,
        eventType,
        executionId: execution.id
      });

      // Execute actions
      if (rule.actions.createTask) {
        await this.executeCreateTaskAction(rule.actions.createTask, eventData, execution);
      }

      if (rule.actions.createPR) {
        await this.executeCreatePRAction(rule.actions.createPR, eventData, execution);
      }

      if (rule.actions.createIssue) {
        await this.executeCreateIssueAction(rule.actions.createIssue, eventData, execution);
      }

      if (rule.actions.runWorkflow) {
        await this.executeRunWorkflowAction(rule.actions.runWorkflow, eventData, execution);
      }

      execution.status = 'completed';
      execution.completedAt = new Date();

      this.logger.info('Automation rule executed successfully', {
        ruleId: rule.id,
        executionId: execution.id,
        results: execution.results
      });

      this.emit('automation:executed', execution);
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.completedAt = new Date();

      this.logger.error('Automation rule execution failed', {
        ruleId: rule.id,
        executionId: execution.id,
        error: execution.error
      });

      this.emit('automation:failed', execution);
    }
  }

  private async executeCreateTaskAction(
    action: any,
    eventData: any,
    execution: AutomationExecution
  ): Promise<void> {
    try {
      const title = this.interpolateTemplate(action.title, eventData);
      const description = this.interpolateTemplate(action.description, eventData);

      const task = await this.taskOrchestrator.createTask({
        prompt: description,
        type: action.type,
        priority: action.priority,
        context: {
          title,
          sourceType: action.metadata?.sourceType,
          sourceId: action.metadata?.sourceId,
          repository: eventData.repository,
          eventType: execution.eventType,
          ...action.metadata
        }
      });

      if (!execution.results.tasksCreated) {
        execution.results.tasksCreated = [];
      }
      execution.results.tasksCreated.push(task.id);

      this.logger.info('Task created from automation', {
        taskId: task.id,
        title,
        repository: eventData.repository
      });
    } catch (error) {
      if (!execution.results.errors) {
        execution.results.errors = [];
      }
      execution.results.errors.push(`Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeCreatePRAction(
    action: any,
    eventData: any,
    execution: AutomationExecution
  ): Promise<void> {
    try {
      const [owner, repo] = eventData.repository.split('/');
      const title = this.interpolateTemplate(action.title, eventData);
      const description = this.interpolateTemplate(action.description, eventData);

      const pr = await this.repositoryService.createPullRequest(owner, repo, {
        title,
        description,
        sourceBranch: action.sourceBranch,
        targetBranch: action.targetBranch,
        draft: action.draft
      });

      if (!execution.results.prsCreated) {
        execution.results.prsCreated = [];
      }
      execution.results.prsCreated.push(pr.id.toString());

      this.logger.info('Pull request created from automation', {
        prId: pr.id,
        title,
        repository: eventData.repository
      });
    } catch (error) {
      if (!execution.results.errors) {
        execution.results.errors = [];
      }
      execution.results.errors.push(`Failed to create PR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeCreateIssueAction(
    action: any,
    eventData: any,
    execution: AutomationExecution
  ): Promise<void> {
    try {
      const [owner, repo] = eventData.repository.split('/');
      const title = this.interpolateTemplate(action.title, eventData);
      const description = this.interpolateTemplate(action.description, eventData);

      const issue = await this.repositoryService.createIssue(owner, repo, {
        title,
        description,
        labels: action.labels,
        assignees: action.assignees
      });

      if (!execution.results.issuesCreated) {
        execution.results.issuesCreated = [];
      }
      execution.results.issuesCreated.push(issue.id.toString());

      this.logger.info('Issue created from automation', {
        issueId: issue.id,
        title,
        repository: eventData.repository
      });
    } catch (error) {
      if (!execution.results.errors) {
        execution.results.errors = [];
      }
      execution.results.errors.push(`Failed to create issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeRunWorkflowAction(
    action: any,
    eventData: any,
    execution: AutomationExecution
  ): Promise<void> {
    try {
      // Run workflow through task orchestrator
      // This would integrate with the workflow service
      this.logger.info('Workflow execution requested', {
        workflowId: action.workflowId,
        repository: eventData.repository
      });
    } catch (error) {
      if (!execution.results.errors) {
        execution.results.errors = [];
      }
      execution.results.errors.push(`Failed to run workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private interpolateTemplate(template: string, data: any): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(data, path);
      return value !== undefined ? String(value) : match;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  // Public API methods
  async createAutomationRule(rule: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AutomationRule> {
    const newRule: AutomationRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.rules.set(newRule.id, newRule);

    this.logger.info('Automation rule created', {
      ruleId: newRule.id,
      name: newRule.name
    });

    return newRule;
  }

  async updateAutomationRule(ruleId: string, updates: Partial<AutomationRule>): Promise<AutomationRule> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error('Automation rule not found');
    }

    const updatedRule = {
      ...rule,
      ...updates,
      updatedAt: new Date()
    };

    this.rules.set(ruleId, updatedRule);

    this.logger.info('Automation rule updated', {
      ruleId,
      name: updatedRule.name
    });

    return updatedRule;
  }

  async deleteAutomationRule(ruleId: string): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error('Automation rule not found');
    }

    this.rules.delete(ruleId);

    this.logger.info('Automation rule deleted', {
      ruleId,
      name: rule.name
    });
  }

  async listAutomationRules(organizationId: string): Promise<AutomationRule[]> {
    return Array.from(this.rules.values())
      .filter(rule => rule.organizationId === organizationId);
  }

  async getAutomationRule(ruleId: string): Promise<AutomationRule | undefined> {
    return this.rules.get(ruleId);
  }

  async listExecutions(organizationId: string, options?: {
    ruleId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<AutomationExecution[]> {
    let executions = Array.from(this.executions.values());

    if (options?.ruleId) {
      executions = executions.filter(exec => exec.ruleId === options.ruleId);
    }

    if (options?.status) {
      executions = executions.filter(exec => exec.status === options.status);
    }

    // Sort by start time (newest first)
    executions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    // Apply pagination
    if (options?.offset) {
      executions = executions.slice(options.offset);
    }
    if (options?.limit) {
      executions = executions.slice(0, options.limit);
    }

    return executions;
  }

  async getExecution(executionId: string): Promise<AutomationExecution | undefined> {
    return this.executions.get(executionId);
  }
}