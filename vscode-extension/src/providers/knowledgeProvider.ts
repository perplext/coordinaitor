import * as vscode from 'vscode';
import { OrchestratorClient, KnowledgeEntry } from '../client/orchestratorClient';

export class KnowledgeProvider implements vscode.TreeDataProvider<KnowledgeItem | TypeGroupItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<KnowledgeItem | undefined | null | void> = new vscode.EventEmitter<KnowledgeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<KnowledgeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private entries: KnowledgeEntry[] = [];
    private searchQuery = '';

    constructor(private client: OrchestratorClient) {
        this.refresh();
    }

    refresh(): void {
        this.loadEntries();
        this._onDidChangeTreeData.fire();
    }

    async search(query: string): Promise<void> {
        this.searchQuery = query;
        await this.loadEntries();
        this._onDidChangeTreeData.fire();
    }

    private async loadEntries(): Promise<void> {
        try {
            if (this.client.isConnected()) {
                this.entries = await this.client.searchKnowledge(this.searchQuery);
            }
        } catch (error) {
            console.error('Failed to load knowledge entries:', error);
            this.entries = [];
        }
    }

    getTreeItem(element: KnowledgeItem | TypeGroupItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: KnowledgeItem | TypeGroupItem): Thenable<(KnowledgeItem | TypeGroupItem)[]> {
        if (!this.client.isConnected()) {
            return Promise.resolve([]);
        }

        if (!element) {
            // Group entries by type
            const entriesByType = this.groupEntriesByType();
            return Promise.resolve(
                Object.entries(entriesByType).map(([type, entries]) => 
                    new TypeGroupItem(type, entries)
                )
            );
        } else if (element instanceof TypeGroupItem) {
            return Promise.resolve(
                element.entries.map(entry => new KnowledgeItem(entry))
            );
        }

        return Promise.resolve([]);
    }

    private groupEntriesByType(): Record<string, KnowledgeEntry[]> {
        const groups: Record<string, KnowledgeEntry[]> = {};

        this.entries.forEach(entry => {
            if (!groups[entry.type]) {
                groups[entry.type] = [];
            }
            groups[entry.type].push(entry);
        });

        return groups;
    }

    getEntryById(id: string): KnowledgeEntry | undefined {
        return this.entries.find(entry => entry.id === id);
    }
}

class TypeGroupItem extends vscode.TreeItem {
    constructor(
        public readonly type: string,
        public readonly entries: KnowledgeEntry[]
    ) {
        super(
            `${type.charAt(0).toUpperCase() + type.slice(1)}s (${entries.length})`,
            vscode.TreeItemCollapsibleState.Expanded
        );

        this.tooltip = `${entries.length} ${type} entr${entries.length === 1 ? 'y' : 'ies'}`;
        this.iconPath = new vscode.ThemeIcon(getTypeIcon(type));
    }

    contextValue = 'typeGroup';
}

class KnowledgeItem extends vscode.TreeItem {
    constructor(public readonly entry: KnowledgeEntry) {
        super(entry.title, vscode.TreeItemCollapsibleState.None);

        this.tooltip = this.getTooltip();
        this.description = this.getDescription();
        this.iconPath = new vscode.ThemeIcon(getTypeIcon(entry.type));
        this.contextValue = 'knowledgeEntry';

        // Add command to open entry details
        this.command = {
            command: 'vscode.open',
            title: 'Open Knowledge Entry',
            arguments: [
                vscode.Uri.parse(`orchestrator-knowledge:${entry.id}`),
                { preview: false }
            ]
        };
    }

    private getTooltip(): string {
        const lines = [
            `Title: ${this.entry.title}`,
            `Type: ${this.entry.type}`,
            `Created: ${this.entry.createdAt.toLocaleString()}`,
            `Public: ${this.entry.isPublic ? 'Yes' : 'No'}`
        ];

        if (this.entry.metadata.language) {
            lines.push(`Language: ${this.entry.metadata.language}`);
        }

        if (this.entry.metadata.framework) {
            lines.push(`Framework: ${this.entry.metadata.framework}`);
        }

        if (this.entry.metadata.difficulty) {
            lines.push(`Difficulty: ${this.entry.metadata.difficulty}`);
        }

        if (this.entry.metadata.votes !== undefined) {
            lines.push(`Votes: ${this.entry.metadata.votes}`);
        }

        if (this.entry.metadata.views !== undefined) {
            lines.push(`Views: ${this.entry.metadata.views}`);
        }

        if (this.entry.tags.length > 0) {
            lines.push(`Tags: ${this.entry.tags.join(', ')}`);
        }

        lines.push('', this.entry.content.substring(0, 200) + '...');

        return lines.join('\n');
    }

    private getDescription(): string {
        const parts = [];

        if (this.entry.metadata.language) {
            parts.push(this.entry.metadata.language);
        }

        if (this.entry.metadata.difficulty) {
            parts.push(this.entry.metadata.difficulty);
        }

        if (this.entry.metadata.votes !== undefined && this.entry.metadata.votes > 0) {
            parts.push(`👍 ${this.entry.metadata.votes}`);
        }

        if (this.entry.metadata.views !== undefined && this.entry.metadata.views > 0) {
            parts.push(`👁 ${this.entry.metadata.views}`);
        }

        if (!this.entry.isPublic) {
            parts.push('🔒');
        }

        return parts.join(' • ');
    }
}

function getTypeIcon(type: string): string {
    switch (type) {
        case 'solution': return 'lightbulb';
        case 'pattern': return 'symbol-class';
        case 'snippet': return 'code';
        case 'documentation': return 'book';
        case 'error': return 'bug';
        case 'best-practice': return 'star';
        default: return 'note';
    }
}