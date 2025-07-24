import api from './api';

export interface DashboardStats {
  activeTasks: number;
  runningAgents: number;
  successRate: number;
  avgCompletionTime: number;
}

export interface TaskProgress {
  completed: number;
  total: number;
}

export interface ActiveAgent {
  id: string;
  name: string;
  status: string;
  currentTask?: string;
}

export interface PerformanceData {
  labels: string[];
  datasets: Array<{
    data: number[];
    color?: (opacity: number) => string;
    strokeWidth?: number;
  }>;
}

export interface DashboardData {
  stats: DashboardStats;
  taskProgress: TaskProgress;
  activeAgents: ActiveAgent[];
  performanceData: PerformanceData;
  agentUtilization: PerformanceData;
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
    status: string;
  }>;
}

class DashboardService {
  async getDashboardData(): Promise<DashboardData> {
    const response = await api.get('/dashboard');
    return response.data;
  }

  async getTaskStats(timeRange: 'day' | 'week' | 'month' = 'week'): Promise<any> {
    const response = await api.get('/dashboard/task-stats', {
      params: { timeRange },
    });
    return response.data;
  }

  async getAgentPerformance(agentId?: string): Promise<any> {
    const response = await api.get('/dashboard/agent-performance', {
      params: { agentId },
    });
    return response.data;
  }

  async getSystemHealth(): Promise<any> {
    const response = await api.get('/dashboard/system-health');
    return response.data;
  }

  async getRecentActivity(limit: number = 10): Promise<any> {
    const response = await api.get('/dashboard/recent-activity', {
      params: { limit },
    });
    return response.data;
  }

  async getOrganizationMetrics(): Promise<any> {
    const response = await api.get('/dashboard/organization-metrics');
    return response.data;
  }
}

export const dashboardService = new DashboardService();