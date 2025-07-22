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