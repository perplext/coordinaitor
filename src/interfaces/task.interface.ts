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
  tasks: Task[];
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

export interface TaskDecomposition {
  originalTask: Task;
  subtasks: Task[];
  dependencies: TaskDependency[];
  estimatedTotalDuration: number;
  suggestedAgents: Map<string, string>;
}

export interface TaskDependency {
  from: string;
  to: string;
  type: 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish';
  lag?: number;
}