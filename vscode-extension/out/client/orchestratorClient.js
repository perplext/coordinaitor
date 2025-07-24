"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestratorClient = void 0;
const axios_1 = __importDefault(require("axios"));
const vscode = __importStar(require("vscode"));
const WebSocket = __importStar(require("ws"));
class OrchestratorClient {
    constructor(statusBar, notifications) {
        this.statusBar = statusBar;
        this.notifications = notifications;
        this.connected = false;
        this.config = vscode.workspace.getConfiguration('multiAgentOrchestrator');
        this.apiClient = this.createApiClient();
        this.setupWebSocket();
    }
    createApiClient() {
        const serverUrl = this.config.get('serverUrl', 'http://localhost:3000');
        const apiKey = this.config.get('apiKey');
        const client = axios_1.default.create({
            baseURL: `${serverUrl}/api`,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
            }
        });
        client.interceptors.response.use(response => response, error => {
            console.error('API Error:', error);
            if (error.response?.status === 401) {
                this.notifications.showError('Authentication failed. Please check your API key.');
            }
            else if (error.code === 'ECONNREFUSED') {
                this.notifications.showError('Cannot connect to orchestrator server. Please check the server URL.');
            }
            return Promise.reject(error);
        });
        return client;
    }
    setupWebSocket() {
        const serverUrl = this.config.get('serverUrl', 'http://localhost:3000');
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
            this.websocket?.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.notifications.showError(`Connection error: ${error.message}`);
            });
            this.websocket?.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleWebSocketMessage(message);
                }
                catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            });
        }
        catch (error) {
            console.error('Failed to setup WebSocket:', error);
        }
    }
    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'task:created':
                this.notifications.showInfo(`Task created: ${message.data.title}`);
                vscode.commands.executeCommand('multiAgentOrchestrator.refreshTasks');
                break;
            case 'task:updated':
                if (message.data.status === 'completed') {
                    this.notifications.showInfo(`Task completed: ${message.data.title}`);
                }
                else if (message.data.status === 'failed') {
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
    scheduleReconnect() {
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
    async connect() {
        try {
            // Test API connection
            await this.apiClient.get('/health');
            this.setupWebSocket();
            return true;
        }
        catch (error) {
            console.error('Failed to connect:', error);
            this.notifications.showError('Failed to connect to orchestrator server');
            return false;
        }
    }
    disconnect() {
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
    isConnected() {
        return this.connected;
    }
    updateConfiguration() {
        this.config = vscode.workspace.getConfiguration('multiAgentOrchestrator');
        this.apiClient = this.createApiClient();
        if (this.connected) {
            this.disconnect();
            setTimeout(() => this.connect(), 1000);
        }
    }
    // API Methods
    async getTasks() {
        const response = await this.apiClient.get('/tasks');
        return response.data.tasks.map((task) => ({
            ...task,
            createdAt: new Date(task.createdAt),
            updatedAt: new Date(task.updatedAt)
        }));
    }
    async createTask(task) {
        const response = await this.apiClient.post('/tasks', task);
        return {
            ...response.data.task,
            createdAt: new Date(response.data.task.createdAt),
            updatedAt: new Date(response.data.task.updatedAt)
        };
    }
    async executeTask(taskId) {
        const response = await this.apiClient.post(`/tasks/${taskId}/execute`);
        return response.data;
    }
    async getAgents() {
        const response = await this.apiClient.get('/agents');
        return response.data.agents.map((agent) => ({
            ...agent,
            status: {
                ...agent.status,
                lastActivity: new Date(agent.status.lastActivity)
            }
        }));
    }
    async searchKnowledge(query, filters) {
        const params = new URLSearchParams({ q: query, ...filters });
        const response = await this.apiClient.get(`/knowledge/search?${params}`);
        return response.data.entries.map((entry) => ({
            ...entry,
            createdAt: new Date(entry.createdAt)
        }));
    }
    async createKnowledgeEntry(entry) {
        const response = await this.apiClient.post('/knowledge', entry);
        return {
            ...response.data.entry,
            createdAt: new Date(response.data.entry.createdAt)
        };
    }
    async getTemplates() {
        const response = await this.apiClient.get('/templates');
        return response.data.templates;
    }
    async applyTemplate(templateId, variables) {
        const response = await this.apiClient.post(`/templates/${templateId}/apply`, { variables });
        return {
            ...response.data.task,
            createdAt: new Date(response.data.task.createdAt),
            updatedAt: new Date(response.data.task.updatedAt)
        };
    }
    async runSecurityScan(taskId) {
        const response = await this.apiClient.post(`/tasks/${taskId}/security-scan`);
        return response.data;
    }
    dispose() {
        this.disconnect();
    }
}
exports.OrchestratorClient = OrchestratorClient;
//# sourceMappingURL=orchestratorClient.js.map