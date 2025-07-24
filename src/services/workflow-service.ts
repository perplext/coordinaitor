import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { 
  Workflow, 
  WorkflowStep, 
  WorkflowExecution, 
  WorkflowStepExecution,
  WorkflowCondition,
  WorkflowLoop
} from '../interfaces/template.interface';
import { Task } from '../interfaces/task.interface';
import { TaskOrchestrator } from '../orchestration/task-orchestrator';
import { TemplateService } from './template-service';
import { NotificationService } from './notification-service';
import { ApprovalService, ApprovalPolicy } from './approval-service';
import winston from 'winston';
import * as fs from 'fs/promises';
import * as path from 'path';

export class WorkflowService extends EventEmitter {
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private logger: winston.Logger;
  private workflowDir: string;

  constructor(
    private taskOrchestrator: TaskOrchestrator,
    private templateService: TemplateService,
    private notificationService: NotificationService | null = null,
    private approvalService: ApprovalService | null = null,
    workflowDir: string = './workflows'
  ) {
    super();
    
    this.workflowDir = workflowDir;
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.loadWorkflows();
    this.loadBuiltInWorkflows();
  }

  private async loadWorkflows(): Promise<void> {
    try {
      await fs.mkdir(this.workflowDir, { recursive: true });
      
      const files = await fs.readdir(this.workflowDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = await fs.readFile(path.join(this.workflowDir, file), 'utf-8');
            const workflow = JSON.parse(content) as Workflow;
            this.workflows.set(workflow.id, workflow);
            this.logger.info(`Loaded workflow: ${workflow.name}`);
          } catch (error) {
            this.logger.error(`Failed to load workflow ${file}:`, error);
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to load workflows:', error);
    }
  }

  private loadBuiltInWorkflows(): void {
    // Full Stack Feature Workflow
    this.createWorkflow({
      name: 'Full Stack Feature',
      description: 'Complete workflow for implementing a full stack feature',
      category: 'development',
      tags: ['fullstack', 'feature', 'complete'],
      steps: [
        {
          id: 'design',
          name: 'Design API',
          type: 'task',
          taskDefinition: {
            type: 'design',
            title: 'Design API endpoints and data models',
            priority: 'high'
          }
        },
        {
          id: 'backend',
          name: 'Implement Backend',
          type: 'task',
          taskDefinition: {
            type: 'implementation',
            title: 'Implement backend API and database',
            priority: 'high'
          },
          dependencies: ['design']
        },
        {
          id: 'frontend',
          name: 'Implement Frontend',
          type: 'task',
          taskDefinition: {
            type: 'implementation',
            title: 'Implement frontend UI and integration',
            priority: 'high'
          },
          dependencies: ['design']
        },
        {
          id: 'tests',
          name: 'Write Tests',
          type: 'parallel',
          parallel: [
            {
              id: 'backend-tests',
              name: 'Backend Tests',
              type: 'task',
              taskDefinition: {
                type: 'test',
                title: 'Write backend unit and integration tests',
                priority: 'medium'
              }
            },
            {
              id: 'frontend-tests',
              name: 'Frontend Tests',
              type: 'task',
              taskDefinition: {
                type: 'test',
                title: 'Write frontend component and integration tests',
                priority: 'medium'
              }
            }
          ],
          dependencies: ['backend', 'frontend']
        },
        {
          id: 'review',
          name: 'Code Review',
          type: 'task',
          taskDefinition: {
            type: 'review',
            title: 'Perform code review and address feedback',
            priority: 'medium'
          },
          dependencies: ['tests']
        },
        {
          id: 'deploy',
          name: 'Deploy',
          type: 'task',
          taskDefinition: {
            type: 'deployment',
            title: 'Deploy to staging environment',
            priority: 'medium'
          },
          dependencies: ['review']
        }
      ],
      variables: [
        {
          name: 'featureName',
          type: 'string',
          label: 'Feature Name',
          required: true
        },
        {
          name: 'includeAuth',
          type: 'boolean',
          label: 'Include Authentication',
          defaultValue: true,
          required: true
        }
      ]
    });

    // Bug Fix Workflow
    this.createWorkflow({
      name: 'Bug Fix Process',
      description: 'Standard workflow for fixing bugs',
      category: 'maintenance',
      tags: ['bug', 'fix', 'maintenance'],
      steps: [
        {
          id: 'reproduce',
          name: 'Reproduce Bug',
          type: 'task',
          taskDefinition: {
            type: 'test',
            title: 'Reproduce and document the bug',
            priority: 'high'
          }
        },
        {
          id: 'analyze',
          name: 'Analyze Root Cause',
          type: 'task',
          taskDefinition: {
            type: 'review',
            title: 'Analyze and identify root cause',
            priority: 'high'
          },
          dependencies: ['reproduce']
        },
        {
          id: 'fix',
          name: 'Implement Fix',
          type: 'task',
          taskDefinition: {
            type: 'implementation',
            title: 'Implement the bug fix',
            priority: 'high'
          },
          dependencies: ['analyze'],
          retryPolicy: {
            maxAttempts: 2,
            delayMs: 5000
          }
        },
        {
          id: 'test',
          name: 'Test Fix',
          type: 'task',
          taskDefinition: {
            type: 'test',
            title: 'Test the fix and verify resolution',
            priority: 'high'
          },
          dependencies: ['fix']
        },
        {
          id: 'regression',
          name: 'Regression Test',
          type: 'task',
          taskDefinition: {
            type: 'test',
            title: 'Run regression tests',
            priority: 'medium'
          },
          dependencies: ['test']
        }
      ]
    });

    // Security Scan Workflow
    this.createWorkflow({
      name: 'Security Scan',
      description: 'Comprehensive security scanning workflow',
      category: 'security',
      tags: ['security', 'scan', 'audit'],
      steps: [
        {
          id: 'dependency-scan',
          name: 'Dependency Scan',
          type: 'task',
          taskDefinition: {
            type: 'test',
            title: 'Scan dependencies for vulnerabilities',
            priority: 'high'
          }
        },
        {
          id: 'code-scan',
          name: 'Static Code Analysis',
          type: 'task',
          taskDefinition: {
            type: 'test',
            title: 'Run static security analysis on code',
            priority: 'high'
          }
        },
        {
          id: 'check-critical',
          name: 'Check for Critical Issues',
          type: 'condition',
          condition: {
            expression: 'hasCriticalIssues',
            trueStep: 'immediate-fix',
            falseStep: 'report'
          },
          dependencies: ['dependency-scan', 'code-scan']
        },
        {
          id: 'immediate-fix',
          name: 'Fix Critical Issues',
          type: 'task',
          taskDefinition: {
            type: 'implementation',
            title: 'Fix critical security issues immediately',
            priority: 'critical'
          }
        },
        {
          id: 'report',
          name: 'Generate Report',
          type: 'task',
          taskDefinition: {
            type: 'implementation',
            title: 'Generate security report',
            priority: 'medium'
          },
          dependencies: ['immediate-fix']
        }
      ]
    });

    // Deployment Workflow with Approval
    this.createWorkflow({
      name: 'Production Deployment',
      description: 'Deploy to production with approval gates',
      category: 'deployment',
      tags: ['deployment', 'production', 'approval'],
      steps: [
        {
          id: 'build',
          name: 'Build Application',
          type: 'task',
          taskDefinition: {
            type: 'implementation',
            title: 'Build and package application',
            priority: 'high'
          }
        },
        {
          id: 'test',
          name: 'Run Tests',
          type: 'task',
          taskDefinition: {
            type: 'test',
            title: 'Run all test suites',
            priority: 'high'
          },
          dependencies: ['build']
        },
        {
          id: 'deploy-staging',
          name: 'Deploy to Staging',
          type: 'task',
          taskDefinition: {
            type: 'deployment',
            title: 'Deploy to staging environment',
            priority: 'high'
          },
          dependencies: ['test']
        },
        {
          id: 'staging-tests',
          name: 'Staging Tests',
          type: 'task',
          taskDefinition: {
            type: 'test',
            title: 'Run smoke tests on staging',
            priority: 'high'
          },
          dependencies: ['deploy-staging']
        },
        {
          id: 'approval-gate',
          name: 'Production Deployment Approval',
          type: 'wait',
          wait: {
            type: 'approval',
            approvers: ['admin', 'lead-developer', 'devops-lead'],
            approvalPolicy: {
              requiredApprovals: 2,
              timeoutMs: 3600000, // 1 hour
              autoRejectAfterTimeout: true
            }
          },
          dependencies: ['staging-tests']
        },
        {
          id: 'deploy-production',
          name: 'Deploy to Production',
          type: 'task',
          taskDefinition: {
            type: 'deployment',
            title: 'Deploy to production environment',
            priority: 'critical'
          },
          dependencies: ['approval-gate']
        },
        {
          id: 'production-verify',
          name: 'Verify Production',
          type: 'task',
          taskDefinition: {
            type: 'test',
            title: 'Verify production deployment',
            priority: 'critical'
          },
          dependencies: ['deploy-production']
        }
      ],
      variables: [
        {
          name: 'version',
          type: 'string',
          label: 'Version to Deploy',
          required: true
        },
        {
          name: 'environment',
          type: 'string',
          label: 'Target Environment',
          required: true,
          defaultValue: 'production'
        }
      ]
    });
  }

  public createWorkflow(params: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>): Workflow {
    const workflow: Workflow = {
      id: uuidv4(),
      ...params,
      createdAt: new Date(),
      updatedAt: new Date(),
      executionCount: 0
    };

    this.workflows.set(workflow.id, workflow);
    this.saveWorkflow(workflow);
    
    return workflow;
  }

  private async saveWorkflow(workflow: Workflow): Promise<void> {
    try {
      const filePath = path.join(this.workflowDir, `${workflow.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(workflow, null, 2));
    } catch (error) {
      this.logger.error('Failed to save workflow:', error);
    }
  }

  public async executeWorkflow(workflowId: string, variables: Record<string, any>): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const execution: WorkflowExecution = {
      id: uuidv4(),
      workflowId,
      status: 'running',
      variables,
      steps: workflow.steps.map(step => ({
        stepId: step.id,
        status: 'pending'
      })),
      startedAt: new Date()
    };

    this.executions.set(execution.id, execution);
    this.emit('workflow:started', { execution, workflow });

    // Update workflow usage
    workflow.executionCount++;
    workflow.updatedAt = new Date();
    this.saveWorkflow(workflow);

    // Execute workflow asynchronously
    this.executeWorkflowSteps(workflow, execution).catch(error => {
      this.logger.error('Workflow execution failed:', error);
      execution.status = 'failed';
      execution.error = error.message;
      execution.completedAt = new Date();
      this.emit('workflow:failed', { execution, workflow, error });
    });

    return execution;
  }

  private async executeWorkflowSteps(workflow: Workflow, execution: WorkflowExecution): Promise<void> {
    const completedSteps = new Set<string>();

    while (execution.status === 'running') {
      let hasExecutableStep = false;

      for (const step of workflow.steps) {
        if (completedSteps.has(step.id)) continue;

        const stepExecution = execution.steps.find(s => s.stepId === step.id)!;
        if (stepExecution.status !== 'pending') continue;

        // Check dependencies
        const dependenciesMet = !step.dependencies || 
          step.dependencies.every(dep => {
            const depExecution = execution.steps.find(s => s.stepId === dep);
            return depExecution && depExecution.status === 'completed';
          });

        if (dependenciesMet) {
          hasExecutableStep = true;
          await this.executeStep(step, execution, workflow);
          
          // Refetch stepExecution after async execution
          const updatedStepExecution = execution.steps.find(s => s.stepId === step.id)!;
          if (updatedStepExecution.status === 'completed') {
            completedSteps.add(step.id);
          } else if (updatedStepExecution.status === 'failed' && !step.retryPolicy) {
            execution.status = 'failed';
            execution.error = `Step ${step.name} failed`;
            break;
          }
        }
      }

      if (!hasExecutableStep) {
        // Check if all steps are completed
        const allCompleted = execution.steps.every(s => 
          s.status === 'completed' || s.status === 'skipped'
        );

        if (allCompleted) {
          execution.status = 'completed';
        } else {
          // No progress can be made
          execution.status = 'failed';
          execution.error = 'Workflow stuck - dependencies cannot be resolved';
        }
      }

      // Small delay to prevent busy loop
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    execution.completedAt = new Date();
    this.emit('workflow:completed', { execution, workflow });

    // Send notification
    if (this.notificationService && execution.status === 'completed') {
      this.notificationService.notifyWorkflowCompleted(workflow, execution).catch(err => {
        this.logger.error('Failed to send workflow completion notification:', err);
      });
    } else if (this.notificationService && execution.status === 'failed') {
      this.notificationService.notifyWorkflowFailed(workflow, execution, execution.error || 'Unknown error').catch(err => {
        this.logger.error('Failed to send workflow failure notification:', err);
      });
    }
  }

  private async executeStep(
    step: WorkflowStep, 
    execution: WorkflowExecution, 
    workflow: Workflow
  ): Promise<void> {
    const stepExecution = execution.steps.find(s => s.stepId === step.id)!;
    stepExecution.status = 'running';
    stepExecution.startedAt = new Date();

    this.emit('step:started', { step, execution, workflow });

    try {
      switch (step.type) {
        case 'task':
          await this.executeTaskStep(step, stepExecution, execution);
          break;

        case 'condition':
          await this.executeConditionStep(step, stepExecution, execution);
          break;

        case 'parallel':
          await this.executeParallelStep(step, stepExecution, execution, workflow);
          break;

        case 'loop':
          await this.executeLoopStep(step, stepExecution, execution, workflow);
          break;

        case 'wait':
          await this.executeWaitStep(step, stepExecution, execution);
          break;
      }

      stepExecution.status = 'completed';
      stepExecution.completedAt = new Date();
      this.emit('step:completed', { step, execution, workflow });

    } catch (error: any) {
      stepExecution.status = 'failed';
      stepExecution.error = error.message;
      stepExecution.completedAt = new Date();

      // Handle retry
      if (step.retryPolicy && (stepExecution.retryCount || 0) < step.retryPolicy.maxAttempts) {
        stepExecution.retryCount = (stepExecution.retryCount || 0) + 1;
        stepExecution.status = 'pending';
        
        const delay = step.retryPolicy.delayMs * 
          Math.pow(step.retryPolicy.backoffMultiplier || 1, stepExecution.retryCount - 1);
        
        setTimeout(() => {
          this.executeStep(step, execution, workflow);
        }, delay);
        
        this.logger.info(`Retrying step ${step.name} (attempt ${stepExecution.retryCount})`);
      } else {
        this.emit('step:failed', { step, execution, workflow, error });
      }
    }
  }

  private async executeTaskStep(
    step: WorkflowStep, 
    stepExecution: WorkflowStepExecution,
    execution: WorkflowExecution
  ): Promise<void> {
    let taskDefinition = step.taskDefinition;

    // Apply template if specified
    if (step.taskTemplate) {
      taskDefinition = this.templateService.applyTemplate(step.taskTemplate, execution.variables);
    }

    if (!taskDefinition) {
      throw new Error('No task definition or template specified');
    }

    // Replace variables in task definition
    const processedTask = this.replaceVariables(taskDefinition, execution.variables);

    // Create and execute task
    const task = await this.taskOrchestrator.createTask({
      ...processedTask,
      prompt: processedTask.description || processedTask.title || step.name,
      metadata: {
        ...processedTask.metadata,
        workflowExecutionId: execution.id,
        workflowStepId: step.id
      }
    });

    stepExecution.taskId = task.id;

    // Wait for task completion
    await new Promise<void>((resolve, reject) => {
      const checkTask = setInterval(() => {
        const currentTask = this.taskOrchestrator.getTask(task.id);
        if (currentTask) {
          if (currentTask.status === 'completed') {
            clearInterval(checkTask);
            stepExecution.output = currentTask.output;
            resolve();
          } else if (currentTask.status === 'failed') {
            clearInterval(checkTask);
            reject(new Error(currentTask.error || 'Task failed'));
          }
        }
      }, 2000);
    });
  }

  private async executeConditionStep(
    step: WorkflowStep,
    stepExecution: WorkflowStepExecution,
    execution: WorkflowExecution
  ): Promise<void> {
    if (!step.condition) {
      throw new Error('Condition not specified');
    }

    // Evaluate condition
    const result = this.evaluateCondition(step.condition.expression, execution);
    stepExecution.output = { conditionResult: result };

    // Update next step based on condition
    const nextStepId = result ? step.condition.trueStep : step.condition.falseStep;
    if (nextStepId) {
      // Mark other branch as skipped
      const skipStepId = result ? step.condition.falseStep : step.condition.trueStep;
      if (skipStepId) {
        const skipStep = execution.steps.find(s => s.stepId === skipStepId);
        if (skipStep) {
          skipStep.status = 'skipped';
        }
      }
    }
  }

  private async executeParallelStep(
    step: WorkflowStep,
    stepExecution: WorkflowStepExecution,
    execution: WorkflowExecution,
    workflow: Workflow
  ): Promise<void> {
    if (!step.parallel || step.parallel.length === 0) {
      throw new Error('No parallel steps specified');
    }

    // Execute all parallel steps concurrently
    const promises = step.parallel.map(parallelStep => 
      this.executeStep(parallelStep, execution, workflow)
    );

    await Promise.all(promises);
  }

  private async executeLoopStep(
    step: WorkflowStep,
    stepExecution: WorkflowStepExecution,
    execution: WorkflowExecution,
    workflow: Workflow
  ): Promise<void> {
    if (!step.loop) {
      throw new Error('Loop configuration not specified');
    }

    const items = this.getLoopItems(step.loop.items, execution);
    const maxIterations = step.loop.maxIterations || items.length;

    for (let i = 0; i < Math.min(items.length, maxIterations); i++) {
      // Set loop variable
      execution.variables[step.loop.variable] = items[i];
      execution.variables[`${step.loop.variable}_index`] = i;

      // Execute loop steps
      for (const loopStep of step.loop.steps) {
        await this.executeStep(loopStep, execution, workflow);
      }
    }
  }

  private async executeWaitStep(
    step: WorkflowStep,
    stepExecution: WorkflowStepExecution,
    execution: WorkflowExecution
  ): Promise<void> {
    if (!step.wait) {
      throw new Error('Wait configuration not specified');
    }

    switch (step.wait?.type) {
      case 'duration':
        if (step.wait?.duration) {
          await new Promise(resolve => setTimeout(resolve, step.wait!.duration!));
        }
        break;

      case 'condition':
        // Poll condition until true
        while (!this.evaluateCondition(step.wait.condition || 'false', execution)) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        break;

      case 'approval':
        await this.executeApprovalWait(step, stepExecution, execution);
        break;
    }
  }

  private async executeApprovalWait(
    step: WorkflowStep,
    stepExecution: WorkflowStepExecution,
    execution: WorkflowExecution
  ): Promise<void> {
    if (!this.approvalService) {
      throw new Error('Approval service not configured');
    }

    if (!step.wait?.approvers || step.wait.approvers.length === 0) {
      throw new Error('No approvers specified for approval wait');
    }

    // Create approval policy from step configuration
    const policy: ApprovalPolicy = {
      requiredApprovals: step.wait.approvalPolicy?.requiredApprovals || 1,
      allApproversRequired: step.wait.approvalPolicy?.allApproversRequired || false,
      timeout: step.wait.approvalPolicy?.timeoutMs || step.wait.duration,
      autoApproveAfterTimeout: step.wait.approvalPolicy?.autoApproveAfterTimeout || false,
      autoRejectAfterTimeout: step.wait.approvalPolicy?.autoRejectAfterTimeout ?? true
    };

    // Create approval request
    const approvalRequest = await this.approvalService.createApprovalRequest({
      workflowExecutionId: execution.id,
      workflowStepId: step.id,
      stepName: step.name,
      workflowName: this.workflows.get(execution.workflowId)?.name || 'Unknown Workflow',
      requestedBy: execution.variables.requestedBy || 'system',
      approvers: step.wait.approvers,
      policy,
      metadata: {
        workflowVariables: execution.variables,
        stepDependencies: step.dependencies
      },
      description: `Approval required for step "${step.name}" in workflow execution ${execution.id}`
    });

    stepExecution.output = {
      approvalRequestId: approvalRequest.id,
      approvers: approvalRequest.approvers,
      status: 'waiting_for_approval'
    };

    // Wait for approval
    const result = await this.approvalService.waitForApproval(approvalRequest.id);

    if (result === 'approved') {
      stepExecution.output = {
        ...stepExecution.output,
        status: 'approved',
        approvalDetails: await this.approvalService.getApprovalRequest(approvalRequest.id)
      };
    } else {
      throw new Error(`Approval ${result} for step "${step.name}"`);
    }
  }

  private replaceVariables(obj: any, variables: Record<string, any>): any {
    if (typeof obj === 'string') {
      return obj.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return variables[varName] || match;
      });
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.replaceVariables(item, variables));
    } else if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replaceVariables(value, variables);
      }
      return result;
    }
    return obj;
  }

  private evaluateCondition(expression: string, execution: WorkflowExecution): boolean {
    // Simple expression evaluation
    // In production, use a proper expression evaluator
    try {
      const context = {
        ...execution.variables,
        steps: execution.steps
      };

      // Very basic evaluation - replace with proper expression engine
      if (expression === 'true') return true;
      if (expression === 'false') return false;
      
      // Check if variable exists and is truthy
      if (expression in context) {
        return !!(context as any)[expression];
      }

      // Default to false for safety
      return false;
    } catch (error) {
      this.logger.error('Failed to evaluate condition:', error);
      return false;
    }
  }

  private getLoopItems(itemsExpression: string, execution: WorkflowExecution): any[] {
    const items = execution.variables[itemsExpression];
    if (Array.isArray(items)) {
      return items;
    }
    
    // Try to parse as JSON array
    try {
      const parsed = JSON.parse(itemsExpression);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}

    return [];
  }

  public getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  public getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  public getExecution(id: string): WorkflowExecution | undefined {
    return this.executions.get(id);
  }

  public getWorkflowExecutions(workflowId: string): WorkflowExecution[] {
    return Array.from(this.executions.values()).filter(e => e.workflowId === workflowId);
  }
}