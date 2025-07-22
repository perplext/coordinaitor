export interface Agent {
  id: string;
  name: string;
  type: 'cli' | 'api' | 'sdk' | 'custom';
  provider: string;
  version: string;
  status: AgentStatus;
  capabilities: AgentCapability[];
  endpoint?: string;
  maxConcurrentTasks: number;
  cost?: {
    perRequest?: number;
    perToken?: number;
    monthly?: number;
  };
}

export interface AgentStatus {
  id: string;
  state: 'idle' | 'busy' | 'error' | 'offline';
  currentTask?: string;
  lastActivity: Date;
  totalTasksCompleted: number;
  successRate: number;
  averageResponseTime: number;
}

export interface AgentCapability {
  name: string;
  description: string;
  category: 'planning' | 'design' | 'development' | 'testing' | 'deployment' | 'security' | 'general';
  complexity: 'simple' | 'moderate' | 'complex';
  languages?: string[];
  frameworks?: string[];
  specialties?: string[];
}

export interface Task {
  id: string;
  projectId: string;
  type: 'requirement' | 'design' | 'implementation' | 'test' | 'deployment' | 'review';
  title: string;
  description: string;
  requirements?: string[];
  dependencies?: string[];
  assignedAgent?: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedDuration?: number;
  actualDuration?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  output?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  prd?: string;
  requirements?: Requirement[];
  tasks: string[];
  milestones: Milestone[];
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface Requirement {
  id: string;
  type: 'functional' | 'non-functional' | 'constraint';
  category: string;
  description: string;
  acceptance_criteria?: string[];
  priority: 'must' | 'should' | 'could' | 'wont';
  status: 'draft' | 'approved' | 'implemented' | 'verified';
}

export interface Milestone {
  id: string;
  name: string;
  description: string;
  targetDate: Date;
  tasks: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'missed';
  completedDate?: Date;
}

export interface TaskRequest {
  prompt: string;
  type?: Task['type'];
  priority?: Task['priority'];
  context?: any;
  projectId?: string;
  dependencies?: string[];
}

export interface ProjectRequest {
  name: string;
  description: string;
  prd?: string;
}

// Analytics Types
export interface MetricSnapshot {
  timestamp: Date;
  agents: {
    total: number;
    active: number;
    idle: number;
    error: number;
    offline: number;
  };
  tasks: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    inProgress: number;
    successRate: number;
    averageDuration: number;
  };
  projects: {
    total: number;
    active: number;
    completed: number;
    averageTasksPerProject: number;
  };
  workflows: {
    total: number;
    executions: number;
    successRate: number;
  };
}

export interface AgentMetrics {
  agentId: string;
  name: string;
  provider: string;
  tasksCompleted: number;
  tasksFailed: number;
  successRate: number;
  averageResponseTime: number;
  totalUptime: number;
  totalCost: number;
  utilizationRate: number;
  performance: {
    lastHour: number;
    lastDay: number;
    lastWeek: number;
    lastMonth: number;
  };
}

export interface ProjectMetrics {
  projectId: string;
  name: string;
  status: string;
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  progressPercentage: number;
  estimatedCompletion: Date | null;
  totalDuration: number;
  totalCost: number;
  velocity: number;
}

export interface TaskMetrics {
  byType: Record<string, { count: number; avgDuration: number; successRate: number }>;
  byPriority: Record<string, { count: number; avgDuration: number; successRate: number }>;
  byAgent: Record<string, { count: number; avgDuration: number; successRate: number }>;
  timeline: Array<{ date: Date; completed: number; failed: number }>;
}

export interface CostMetrics {
  totalCost: number;
  costByAgent: Record<string, number>;
  costByProject: Record<string, number>;
  costByDay: Array<{ date: Date; cost: number }>;
  projectedMonthlyCost: number;
}

export interface PerformanceInsight {
  type: 'info' | 'warning' | 'success';
  title: string;
  message: string;
  metric?: number;
}