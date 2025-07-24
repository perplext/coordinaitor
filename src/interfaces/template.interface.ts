import { Task } from './task.interface';

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  taskDefinition: Partial<Task>;
  variables?: TemplateVariable[];
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  label: string;
  description?: string;
  required: boolean;
  defaultValue?: any;
  options?: { value: string; label: string }[];
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  steps: WorkflowStep[];
  variables?: TemplateVariable[];
  triggers?: WorkflowTrigger[];
  createdAt: Date;
  updatedAt: Date;
  executionCount: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'task' | 'condition' | 'parallel' | 'loop' | 'wait';
  taskTemplate?: string;
  taskDefinition?: Partial<Task>;
  condition?: WorkflowCondition;
  parallel?: WorkflowStep[];
  loop?: WorkflowLoop;
  wait?: WorkflowWait;
  dependencies?: string[];
  onSuccess?: string[];
  onFailure?: string[];
  retryPolicy?: {
    maxAttempts: number;
    delayMs: number;
    backoffMultiplier?: number;
  };
}

export interface WorkflowCondition {
  expression: string;
  trueStep?: string;
  falseStep?: string;
}

export interface WorkflowLoop {
  items: string;
  variable: string;
  steps: WorkflowStep[];
  maxIterations?: number;
}

export interface WorkflowWait {
  type: 'duration' | 'condition' | 'approval';
  duration?: number;
  condition?: string;
  approvers?: string[];
  approvalPolicy?: {
    requiredApprovals?: number;
    allApproversRequired?: boolean;
    timeoutMs?: number;
    autoApproveAfterTimeout?: boolean;
    autoRejectAfterTimeout?: boolean;
  };
}

export interface WorkflowTrigger {
  type: 'manual' | 'schedule' | 'webhook' | 'event';
  schedule?: string;
  webhook?: {
    url: string;
    secret?: string;
  };
  event?: {
    source: string;
    type: string;
    filter?: string;
  };
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  variables: Record<string, any>;
  steps: WorkflowStepExecution[];
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface WorkflowStepExecution {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  taskId?: string;
  startedAt?: Date;
  completedAt?: Date;
  output?: any;
  error?: string;
  retryCount?: number;
}