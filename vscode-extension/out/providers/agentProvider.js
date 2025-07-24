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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentProvider = void 0;
const vscode = __importStar(require("vscode"));
class AgentProvider {
    constructor(client) {
        this.client = client;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.agents = [];
        this.refresh();
        // Auto-refresh agents every 30 seconds
        setInterval(() => {
            if (this.client.isConnected()) {
                this.refresh();
            }
        }, 30000);
    }
    refresh() {
        this.loadAgents();
        this._onDidChangeTreeData.fire();
    }
    async loadAgents() {
        try {
            if (this.client.isConnected()) {
                this.agents = await this.client.getAgents();
            }
        }
        catch (error) {
            console.error('Failed to load agents:', error);
            this.agents = [];
        }
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!this.client.isConnected()) {
            return Promise.resolve([]);
        }
        if (!element) {
            // Group agents by provider
            const agentsByProvider = this.groupAgentsByProvider();
            return Promise.resolve(Object.entries(agentsByProvider).map(([provider, agents]) => new ProviderGroupItem(provider, agents)));
        }
        else if (element instanceof ProviderGroupItem) {
            return Promise.resolve(element.agents.map(agent => new AgentItem(agent)));
        }
        else if (element instanceof AgentItem && element.agent.capabilities.length > 0) {
            return Promise.resolve(element.agent.capabilities.map(capability => new CapabilityItem(capability)));
        }
        return Promise.resolve([]);
    }
    groupAgentsByProvider() {
        const groups = {};
        this.agents.forEach(agent => {
            if (!groups[agent.provider]) {
                groups[agent.provider] = [];
            }
            groups[agent.provider].push(agent);
        });
        return groups;
    }
    getAgentById(id) {
        return this.agents.find(agent => agent.id === id);
    }
}
exports.AgentProvider = AgentProvider;
class ProviderGroupItem extends vscode.TreeItem {
    constructor(provider, agents) {
        super(`${provider} (${agents.length})`, vscode.TreeItemCollapsibleState.Expanded);
        this.provider = provider;
        this.agents = agents;
        this.contextValue = 'providerGroup';
        this.tooltip = `${agents.length} agent(s) from ${provider}`;
        this.iconPath = new vscode.ThemeIcon('organization');
    }
}
class AgentItem extends vscode.TreeItem {
    constructor(agent) {
        super(agent.name, agent.capabilities.length > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None);
        this.agent = agent;
        this.tooltip = this.getTooltip();
        this.description = this.getDescription();
        this.iconPath = new vscode.ThemeIcon(getAgentStatusIcon(agent.status.state));
        this.contextValue = 'agent';
    }
    getTooltip() {
        const lines = [
            `Name: ${this.agent.name}`,
            `Provider: ${this.agent.provider}`,
            `Version: ${this.agent.version}`,
            `Status: ${this.agent.status.state}`,
            `Tasks Completed: ${this.agent.status.totalTasksCompleted}`,
            `Success Rate: ${(this.agent.status.successRate * 100).toFixed(1)}%`,
            `Avg Response Time: ${this.agent.status.averageResponseTime.toFixed(0)}ms`,
            `Last Activity: ${this.agent.status.lastActivity.toLocaleString()}`
        ];
        if (this.agent.status.currentTask) {
            lines.splice(4, 0, `Current Task: ${this.agent.status.currentTask}`);
        }
        if (this.agent.capabilities.length > 0) {
            lines.push('', 'Capabilities:');
            this.agent.capabilities.forEach(cap => {
                lines.push(`• ${cap.name} (${cap.category})`);
            });
        }
        return lines.join('\n');
    }
    getDescription() {
        const parts = [
            this.agent.status.state,
            `${this.agent.status.totalTasksCompleted} tasks`,
            `${(this.agent.status.successRate * 100).toFixed(0)}% success`
        ];
        if (this.agent.status.currentTask) {
            parts.unshift('🔄');
        }
        return parts.join(' • ');
    }
}
class CapabilityItem extends vscode.TreeItem {
    constructor(capability) {
        super(capability.name, vscode.TreeItemCollapsibleState.None);
        this.capability = capability;
        this.tooltip = `${capability.description}\nCategory: ${capability.category}`;
        this.description = capability.category;
        this.iconPath = new vscode.ThemeIcon(getCategoryIcon(capability.category));
        this.contextValue = 'capability';
    }
}
function getAgentStatusIcon(status) {
    switch (status) {
        case 'idle': return 'circle-outline';
        case 'busy': return 'loading~spin';
        case 'error': return 'error';
        case 'offline': return 'circle-slash';
        default: return 'question';
    }
}
function getCategoryIcon(category) {
    switch (category) {
        case 'planning': return 'list-unordered';
        case 'design': return 'paintcan';
        case 'development': return 'code';
        case 'testing': return 'beaker';
        case 'deployment': return 'rocket';
        case 'security': return 'shield';
        case 'general': return 'tools';
        default: return 'circle-outline';
    }
}
//# sourceMappingURL=agentProvider.js.map