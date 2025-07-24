import * as vscode from 'vscode';
import { OrchestratorClient, Template } from '../client/orchestratorClient';

export class TemplateProvider implements vscode.TreeDataProvider<TemplateItem | TypeGroupItem | VariableItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TemplateItem | undefined | null | void> = new vscode.EventEmitter<TemplateItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TemplateItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private templates: Template[] = [];

    constructor(private client: OrchestratorClient) {
        this.refresh();
    }

    refresh(): void {
        this.loadTemplates();
        this._onDidChangeTreeData.fire();
    }

    private async loadTemplates(): Promise<void> {
        try {
            if (this.client.isConnected()) {
                this.templates = await this.client.getTemplates();
            }
        } catch (error) {
            console.error('Failed to load templates:', error);
            this.templates = [];
        }
    }

    getTreeItem(element: TemplateItem | TypeGroupItem | VariableItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TemplateItem | TypeGroupItem | VariableItem): Thenable<(TemplateItem | TypeGroupItem | VariableItem)[]> {
        if (!this.client.isConnected()) {
            return Promise.resolve([]);
        }

        if (!element) {
            // Group templates by type
            const templatesByType = this.groupTemplatesByType();
            return Promise.resolve(
                Object.entries(templatesByType).map(([type, templates]) => 
                    new TypeGroupItem(type, templates)
                )
            );
        } else if (element instanceof TypeGroupItem) {
            return Promise.resolve(
                element.templates.map(template => new TemplateItem(template))
            );
        } else if (element instanceof TemplateItem && element.template.variables.length > 0) {
            return Promise.resolve(
                element.template.variables.map(variable => 
                    new VariableItem(variable)
                )
            );
        }

        return Promise.resolve([]);
    }

    private groupTemplatesByType(): Record<string, Template[]> {
        const groups: Record<string, Template[]> = {};

        this.templates.forEach(template => {
            if (!groups[template.type]) {
                groups[template.type] = [];
            }
            groups[template.type].push(template);
        });

        return groups;
    }

    getTemplateById(id: string): Template | undefined {
        return this.templates.find(template => template.id === id);
    }
}

class TypeGroupItem extends vscode.TreeItem {
    constructor(
        public readonly type: string,
        public readonly templates: Template[]
    ) {
        super(
            `${type.charAt(0).toUpperCase() + type.slice(1)} (${templates.length})`,
            vscode.TreeItemCollapsibleState.Expanded
        );

        this.tooltip = `${templates.length} ${type} template(s)`;
        this.iconPath = new vscode.ThemeIcon('folder');
    }

    contextValue = 'templateTypeGroup';
}

class TemplateItem extends vscode.TreeItem {
    constructor(public readonly template: Template) {
        super(
            template.name,
            template.variables.length > 0 
                ? vscode.TreeItemCollapsibleState.Collapsed 
                : vscode.TreeItemCollapsibleState.None
        );

        this.tooltip = this.getTooltip();
        this.description = this.getDescription();
        this.iconPath = new vscode.ThemeIcon('file-code');
        this.contextValue = 'template';

        // Add command to apply template
        this.command = {
            command: 'multiAgentOrchestrator.generateFromTemplate',
            title: 'Apply Template',
            arguments: [template]
        };
    }

    private getTooltip(): string {
        const lines = [
            `Name: ${this.template.name}`,
            `Type: ${this.template.type}`,
            `Description: ${this.template.description}`,
            `Variables: ${this.template.variables.length}`
        ];

        if (this.template.variables.length > 0) {
            lines.push('', 'Variables:');
            this.template.variables.forEach(variable => {
                const required = variable.required ? ' (required)' : ' (optional)';
                const defaultVal = variable.defaultValue ? ` = ${variable.defaultValue}` : '';
                lines.push(`• ${variable.name}: ${variable.type}${defaultVal}${required}`);
            });
        }

        return lines.join('\n');
    }

    private getDescription(): string {
        const parts = [this.template.type];
        
        if (this.template.variables.length > 0) {
            const requiredVars = this.template.variables.filter(v => v.required).length;
            parts.push(`${this.template.variables.length} vars`);
            if (requiredVars > 0) {
                parts.push(`${requiredVars} required`);
            }
        }

        return parts.join(' • ');
    }
}

class VariableItem extends vscode.TreeItem {
    constructor(
        public readonly variable: {
            name: string;
            type: string;
            description: string;
            required: boolean;
            defaultValue?: any;
        }
    ) {
        super(variable.name, vscode.TreeItemCollapsibleState.None);
        
        this.tooltip = this.getTooltip();
        this.description = this.getDescription();
        this.iconPath = new vscode.ThemeIcon(variable.required ? 'symbol-variable' : 'symbol-parameter');
        this.contextValue = 'templateVariable';
    }

    private getTooltip(): string {
        const lines = [
            `Name: ${this.variable.name}`,
            `Type: ${this.variable.type}`,
            `Required: ${this.variable.required ? 'Yes' : 'No'}`,
            `Description: ${this.variable.description}`
        ];

        if (this.variable.defaultValue !== undefined) {
            lines.splice(3, 0, `Default: ${this.variable.defaultValue}`);
        }

        return lines.join('\n');
    }

    private getDescription(): string {
        const parts = [this.variable.type];
        
        if (this.variable.required) {
            parts.push('required');
        } else if (this.variable.defaultValue !== undefined) {
            parts.push(`= ${this.variable.defaultValue}`);
        } else {
            parts.push('optional');
        }

        return parts.join(' • ');
    }
}