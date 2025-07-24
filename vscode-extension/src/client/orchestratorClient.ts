import axios, { AxiosInstance } from 'axios';
import * as vscode from 'vscode';
import * as WebSocket from 'ws';
import { StatusBarManager } from '../ui/statusBarManager';
import { NotificationManager } from '../ui/notificationManager';

export interface Task {
    id: string;
    projectId: string;
    type: 'requirement' | 'design' | 'implementation' | 'test' | 'deployment' | 'review';
    title: string;
    description: string;
    status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'blocked';
    priority: 'low' | 'medium' | 'high' | 'critical';
    assignedAgent?: string;
    estimatedDuration?: number;
    actualDuration?: number;
    createdAt: Date;
    updatedAt: Date;
    output?: any;
    error?: string;
}

export interface Agent {
    id: string;
    name: string;
    type: string;
    provider: string;
    version: string;
    status: {
        state: 'idle' | 'busy' | 'error' | 'offline';
        currentTask?: string;
        lastActivity: Date;
        totalTasksCompleted: number;
        successRate: number;
        averageResponseTime: number;
    };
    capabilities: Array<{
        name: string;
        description: string;
        category: string;
    }>;
}

export interface KnowledgeEntry {
    id: string;
    title: string;
    content: string;
    type: 'solution' | 'pattern' | 'snippet' | 'documentation' | 'error' | 'best-practice';
    tags: string[];
    metadata: {
        language?: string;
        framework?: string;
        difficulty?: string;
        votes?: number;
        views?: number;
    };
    createdAt: Date;
    isPublic: boolean;
}

export interface Template {
    id: string;
    name: string;
    description: string;
    type: string;
    variables: Array<{
        name: string;
        type: string;
        description: string;
        required: boolean;
        defaultValue?: any;
    }>;
}

export class OrchestratorClient implements vscode.Disposable {
    private apiClient: AxiosInstance;
    private websocket?: WebSocket.WebSocket;
    private connected = false;
    private reconnectTimer?: NodeJS.Timeout;
    private config: vscode.WorkspaceConfiguration;

    constructor(
        private statusBar: StatusBarManager,
        private notifications: NotificationManager
    ) {
        this.config = vscode.workspace.getConfiguration('multiAgentOrchestrator');
        this.apiClient = this.createApiClient();
        this.setupWebSocket();
    }

    private createApiClient(): AxiosInstance {
        const serverUrl = this.config.get<string>('serverUrl', 'http://localhost:3000');
        const apiKey = this.config.get<string>('apiKey');

        const client = axios.create({
            baseURL: `${serverUrl}/api`,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
            }
        });

        client.interceptors.response.use(
            response => response,
            error => {
                console.error('API Error:', error);
                if (error.response?.status === 401) {
                    this.notifications.showError('Authentication failed. Please check your API key.');
                } else if (error.code === 'ECONNREFUSED') {
                    this.notifications.showError('Cannot connect to orchestrator server. Please check the server URL.');
                }
                return Promise.reject(error);
            }
        );

        return client;
    }

    private setupWebSocket(): void {
        const serverUrl = this.config.get<string>('serverUrl', 'http://localhost:3000');
        const wsUrl = serverUrl.replace(/^http/, 'ws');

        try {
            this.websocket = new WebSocket.WebSocket(wsUrl);

            this.websocket?.on('open', () => {
                console.log('WebSocket connected');
                this.connected = true;
                this.statusBar.setConnected(true);
                vscode.commands.executeCommand('setContext', 'multiAgentOrchestrator.connected', true);
                this.notifications.showInfo('Connected to Multi-Agent Orchestrator');
            });

            this.websocket?.on('close', () => {
                console.log('WebSocket disconnected');
                this.connected = false;
                this.statusBar.setConnected(false);
                vscode.commands.executeCommand('setContext', 'multiAgentOrchestrator.connected', false);
                this.scheduleReconnect();
            });

            this.websocket?.on('error', (error: any) => {
                console.error('WebSocket error:', error);
                this.notifications.showError(`Connection error: ${error.message}`);
            });

            this.websocket?.on('message', (data: any) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleWebSocketMessage(message);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            });

        } catch (error) {
            console.error('Failed to setup WebSocket:', error);
        }
    }

    private handleWebSocketMessage(message: any): void {
        switch (message.type) {
            case 'task:created':
                this.notifications.showInfo(`Task created: ${message.data.title}`);
                vscode.commands.executeCommand('multiAgentOrchestrator.refreshTasks');
                break;
            
            case 'task:updated':
                if (message.data.status === 'completed') {
                    this.notifications.showInfo(`Task completed: ${message.data.title}`);
                } else if (message.data.status === 'failed') {
                    this.notifications.showError(`Task failed: ${message.data.title}`);
                }
                vscode.commands.executeCommand('multiAgentOrchestrator.refreshTasks');
                break;
            
            case 'agent:status':
                // Update agent status in tree view
                break;
            
            default:
                console.log('Unknown WebSocket message type:', message.type);
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        this.reconnectTimer = setTimeout(() => {
            if (!this.connected) {
                console.log('Attempting to reconnect...');
                this.setupWebSocket();
            }
        }, 5000);
    }

    public async connect(): Promise<boolean> {
        try {
            // Test API connection
            await this.apiClient.get('/health');
            this.setupWebSocket();
            return true;
        } catch (error) {
            console.error('Failed to connect:', error);
            this.notifications.showError('Failed to connect to orchestrator server');
            return false;
        }
    }

    public disconnect(): void {
        if (this.websocket) {
            this.websocket.close();
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        this.connected = false;
        this.statusBar.setConnected(false);
        vscode.commands.executeCommand('setContext', 'multiAgentOrchestrator.connected', false);
    }

    public isConnected(): boolean {
        return this.connected;
    }

    public updateConfiguration(): void {
        this.config = vscode.workspace.getConfiguration('multiAgentOrchestrator');
        this.apiClient = this.createApiClient();
        
        if (this.connected) {
            this.disconnect();
            setTimeout(() => this.connect(), 1000);
        }
    }

    // API Methods
    public async getTasks(): Promise<Task[]> {
        const response = await this.apiClient.get('/tasks');
        return response.data.tasks.map((task: any) => ({
            ...task,
            createdAt: new Date(task.createdAt),
            updatedAt: new Date(task.updatedAt)
        }));
    }

    public async createTask(task: Partial<Task>): Promise<Task> {
        const response = await this.apiClient.post('/tasks', task);
        return {
            ...response.data.task,
            createdAt: new Date(response.data.task.createdAt),
            updatedAt: new Date(response.data.task.updatedAt)
        };
    }

    public async executeTask(taskId: string): Promise<any> {
        const response = await this.apiClient.post(`/tasks/${taskId}/execute`);
        return response.data;
    }

    public async getAgents(): Promise<Agent[]> {
        const response = await this.apiClient.get('/agents');
        return response.data.agents.map((agent: any) => ({
            ...agent,
            status: {
                ...agent.status,
                lastActivity: new Date(agent.status.lastActivity)
            }
        }));
    }

    public async searchKnowledge(query: string, filters?: any): Promise<KnowledgeEntry[]> {
        const params = new URLSearchParams({ q: query, ...filters });
        const response = await this.apiClient.get(`/knowledge/search?${params}`);
        return response.data.entries.map((entry: any) => ({
            ...entry,
            createdAt: new Date(entry.createdAt)
        }));
    }

    public async createKnowledgeEntry(entry: Partial<KnowledgeEntry>): Promise<KnowledgeEntry> {
        const response = await this.apiClient.post('/knowledge', entry);
        return {
            ...response.data.entry,
            createdAt: new Date(response.data.entry.createdAt)
        };
    }

    public async getTemplates(): Promise<Template[]> {
        const response = await this.apiClient.get('/templates');
        return response.data.templates;
    }

    public async applyTemplate(templateId: string, variables: Record<string, any>): Promise<Task> {
        const response = await this.apiClient.post(`/templates/${templateId}/apply`, { variables });
        return {
            ...response.data.task,
            createdAt: new Date(response.data.task.createdAt),
            updatedAt: new Date(response.data.task.updatedAt)
        };
    }

    public async runSecurityScan(taskId: string): Promise<any> {
        const response = await this.apiClient.post(`/tasks/${taskId}/security-scan`);
        return response.data;
    }

    public dispose(): void {
        this.disconnect();
    }
}