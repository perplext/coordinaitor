import axios, { AxiosInstance } from 'axios';
import { Agent, Task, Project, TaskRequest, ProjectRequest } from '@/types';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error);
        return Promise.reject(error);
      }
    );
  }

  // Health check
  async checkHealth() {
    const response = await this.client.get('/health');
    return response.data;
  }

  // Agents
  async getAgents(): Promise<{ agents: Agent[] }> {
    const response = await this.client.get('/agents');
    return response.data;
  }

  async getAgentMetrics(agentId: string) {
    const response = await this.client.get(`/agents/${agentId}/metrics`);
    return response.data;
  }

  // Tasks
  async getTasks(filters?: {
    status?: string;
    projectId?: string;
    agentId?: string;
  }): Promise<{ tasks: Task[] }> {
    const response = await this.client.get('/tasks', { params: filters });
    return response.data;
  }

  async createTask(task: TaskRequest): Promise<{ task: Task; result: any }> {
    const response = await this.client.post('/tasks', task);
    return response.data;
  }

  async updateTask(taskId: string, updates: Partial<Task>) {
    const response = await this.client.put(`/tasks/${taskId}`, updates);
    return response.data;
  }

  async getTask(taskId: string): Promise<Task> {
    const response = await this.client.get(`/tasks/${taskId}`);
    return response.data;
  }

  // Projects
  async getProjects(): Promise<{ projects: Project[] }> {
    const response = await this.client.get('/projects');
    return response.data;
  }

  async createProject(project: ProjectRequest): Promise<{ project: Project; tasks: Task[] }> {
    const response = await this.client.post('/projects', project);
    return response.data;
  }

  async getProject(projectId: string): Promise<Project> {
    const response = await this.client.get(`/projects/${projectId}`);
    return response.data;
  }

  async getProjectTasks(projectId: string): Promise<{ tasks: Task[] }> {
    const response = await this.client.get(`/projects/${projectId}/tasks`);
    return response.data;
  }

  async deleteProject(projectId: string) {
    const response = await this.client.delete(`/projects/${projectId}`);
    return response.data;
  }

  // Analytics
  async getAnalyticsSnapshot() {
    const response = await this.client.get('/analytics/snapshot');
    return response.data;
  }

  async getAgentAnalytics() {
    const response = await this.client.get('/analytics/agents');
    return response.data;
  }

  async getProjectAnalytics() {
    const response = await this.client.get('/analytics/projects');
    return response.data;
  }

  async getTaskAnalytics() {
    const response = await this.client.get('/analytics/tasks');
    return response.data;
  }

  async getCostAnalytics() {
    const response = await this.client.get('/analytics/costs');
    return response.data;
  }

  async getPerformanceInsights() {
    const response = await this.client.get('/analytics/insights');
    return response.data;
  }
}

export const api = new ApiService();