import * as vscode from 'vscode';
import { OrchestratorClient, Agent } from '../client/orchestratorClient';

export class AgentProvider implements vscode.TreeDataProvider<AgentItem | ProviderGroupItem | CapabilityItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<AgentItem | ProviderGroupItem | CapabilityItem | undefined | null | void> = new vscode.EventEmitter<AgentItem | ProviderGroupItem | CapabilityItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<AgentItem | ProviderGroupItem | CapabilityItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private agents: Agent[] = [];

    constructor(private client: OrchestratorClient) {
        this.refresh();
        
        // Auto-refresh agents every 30 seconds
        setInterval(() => {
            if (this.client.isConnected()) {
                this.refresh();
            }
        }, 30000);
    }

    refresh(): void {
        this.loadAgents();
        this._onDidChangeTreeData.fire();
    }

    private async loadAgents(): Promise<void> {
        try {
            if (this.client.isConnected()) {
                this.agents = await this.client.getAgents();
            }
        } catch (error) {
            console.error('Failed to load agents:', error);
            this.agents = [];
        }
    }

    getTreeItem(element: AgentItem | ProviderGroupItem | CapabilityItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: AgentItem | ProviderGroupItem | CapabilityItem): Thenable<(AgentItem | ProviderGroupItem | CapabilityItem)[]> {
        if (!this.client.isConnected()) {
            return Promise.resolve([]);
        }

        if (!element) {
            // Group agents by provider
            const agentsByProvider = this.groupAgentsByProvider();
            return Promise.resolve(
                Object.entries(agentsByProvider).map(([provider, agents]) => 
                    new ProviderGroupItem(provider, agents)
                )
            );
        } else if (element instanceof ProviderGroupItem) {
            return Promise.resolve(
                element.agents.map(agent => new AgentItem(agent))
            );
        } else if (element instanceof AgentItem && element.agent.capabilities.length > 0) {
            return Promise.resolve(
                element.agent.capabilities.map(capability => 
                    new CapabilityItem(capability)
                )
            );
        }

        return Promise.resolve([]);
    }

    private groupAgentsByProvider(): Record<string, Agent[]> {
        const groups: Record<string, Agent[]> = {};

        this.agents.forEach(agent => {
            if (!groups[agent.provider]) {
                groups[agent.provider] = [];
            }
            groups[agent.provider].push(agent);
        });

        return groups;
    }

    getAgentById(id: string): Agent | undefined {
        return this.agents.find(agent => agent.id === id);
    }
}

class ProviderGroupItem extends vscode.TreeItem {
    constructor(
        public readonly provider: string,
        public readonly agents: Agent[]
    ) {
        super(
            `${provider} (${agents.length})`,
            vscode.TreeItemCollapsibleState.Expanded
        );

        this.tooltip = `${agents.length} agent(s) from ${provider}`;
        this.iconPath = new vscode.ThemeIcon('organization');
    }

    contextValue = 'providerGroup';
}

class AgentItem extends vscode.TreeItem {
    constructor(public readonly agent: Agent) {
        super(
            agent.name,
            agent.capabilities.length > 0 
                ? vscode.TreeItemCollapsibleState.Collapsed 
                : vscode.TreeItemCollapsibleState.None
        );

        this.tooltip = this.getTooltip();
        this.description = this.getDescription();
        this.iconPath = new vscode.ThemeIcon(getAgentStatusIcon(agent.status.state));
        this.contextValue = 'agent';
    }

    private getTooltip(): string {
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

    private getDescription(): string {
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
    constructor(
        public readonly capability: {
            name: string;
            description: string;
            category: string;
        }
    ) {
        super(capability.name, vscode.TreeItemCollapsibleState.None);
        
        this.tooltip = `${capability.description}\nCategory: ${capability.category}`;
        this.description = capability.category;
        this.iconPath = new vscode.ThemeIcon(getCategoryIcon(capability.category));
        this.contextValue = 'capability';
    }
}

function getAgentStatusIcon(status: string): string {
    switch (status) {
        case 'idle': return 'circle-outline';
        case 'busy': return 'loading~spin';
        case 'error': return 'error';
        case 'offline': return 'circle-slash';
        default: return 'question';
    }
}

function getCategoryIcon(category: string): string {
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