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
  metadata?: Record<string, any>;
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
  priority?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
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
  public id: string;
  public name: string;
  public provider: string;
  public capabilities: AgentCapability[];
  public status: AgentStatus;
  protected apiKey?: string;

  constructor(public config: AgentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.provider = config.provider;
    this.capabilities = config.capabilities;
    this.apiKey = config.apiKey;
    this.status = {
      id: config.id,
      state: 'offline',
      lastActivity: new Date(),
      totalTasksCompleted: 0,
      successRate: 1.0,
      averageResponseTime: 0
    };
  }
  
  abstract initialize(): Promise<void>;
  abstract execute(request: AgentRequest): Promise<AgentResponse>;
  abstract getStatus(): AgentStatus;
  abstract shutdown(): Promise<void>;
  
  getCapabilities(): AgentCapability[] {
    return this.config.capabilities;
  }
  
  getCost(): AgentConfig['cost'] {
    return this.config.cost;
  }
  
  isHealthy(): boolean {
    const status = this.getStatus();
    return status.state !== 'error' && status.state !== 'offline';
  }
}

export interface Agent extends BaseAgent {
  id: string;
  name: string;
  provider: string;
  capabilities: AgentCapability[];
  status: AgentStatus;
  cost?: AgentConfig['cost'];
}