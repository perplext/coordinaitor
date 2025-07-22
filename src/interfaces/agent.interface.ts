export interface AgentCapability {
  name: string;
  description: string;
  category: 'planning' | 'design' | 'development' | 'testing' | 'deployment' | 'security' | 'general';
  complexity: 'simple' | 'moderate' | 'complex';
  languages?: string[];
  frameworks?: string[];
  specialties?: string[];
}

export interface AgentConfig {
  id: string;
  name: string;
  type: 'cli' | 'api' | 'sdk' | 'custom';
  provider: string;
  version: string;
  apiKey?: string;
  endpoint?: string;
  capabilities: AgentCapability[];
  maxConcurrentTasks: number;
  timeout: number;
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

export interface AgentRequest {
  taskId: string;
  prompt: string;
  context?: any;
  timeout?: number;
  priority?: 'low' | 'medium' | 'high';
}

export interface AgentResponse {
  taskId: string;
  agentId: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
  tokensUsed?: number;
  cost?: number;
}

export abstract class BaseAgent {
  constructor(public config: AgentConfig) {}
  
  abstract initialize(): Promise<void>;
  abstract execute(request: AgentRequest): Promise<AgentResponse>;
  abstract getStatus(): AgentStatus;
  abstract shutdown(): Promise<void>;
}