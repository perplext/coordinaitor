import * as vscode from 'vscode';
import { OrchestratorClient, Task } from '../client/orchestratorClient';

export class TaskProvider implements vscode.TreeDataProvider<TaskItem | StatusGroupItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TaskItem | StatusGroupItem | undefined | null | void> = new vscode.EventEmitter<TaskItem | StatusGroupItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TaskItem | StatusGroupItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private tasks: Task[] = [];

    constructor(private client: OrchestratorClient) {
        this.refresh();
    }

    refresh(): void {
        this.loadTasks();
        this._onDidChangeTreeData.fire();
    }

    private async loadTasks(): Promise<void> {
        try {
            if (this.client.isConnected()) {
                this.tasks = await this.client.getTasks();
            }
        } catch (error) {
            console.error('Failed to load tasks:', error);
            this.tasks = [];
        }
    }

    getTreeItem(element: TaskItem | StatusGroupItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TaskItem | StatusGroupItem): Thenable<(TaskItem | StatusGroupItem)[]> {
        if (!this.client.isConnected()) {
            return Promise.resolve([]);
        }

        if (!element) {
            // Group tasks by status
            const tasksByStatus = this.groupTasksByStatus();
            return Promise.resolve(
                Object.entries(tasksByStatus).map(([status, tasks]) => 
                    new StatusGroupItem(status, tasks)
                )
            );
        } else if (element instanceof StatusGroupItem) {
            return Promise.resolve(
                element.tasks.map(task => new TaskItem(task))
            );
        }

        return Promise.resolve([]);
    }

    private groupTasksByStatus(): Record<string, Task[]> {
        const groups: Record<string, Task[]> = {
            'pending': [],
            'in_progress': [],
            'completed': [],
            'failed': [],
            'blocked': []
        };

        this.tasks.forEach(task => {
            if (groups[task.status]) {
                groups[task.status].push(task);
            }
        });

        // Remove empty groups
        Object.keys(groups).forEach(key => {
            if (groups[key].length === 0) {
                delete groups[key];
            }
        });

        return groups;
    }

    getTaskById(id: string): Task | undefined {
        return this.tasks.find(task => task.id === id);
    }
}

class StatusGroupItem extends vscode.TreeItem {
    constructor(
        public readonly status: string,
        public readonly tasks: Task[]
    ) {
        super(
            `${status.toUpperCase()} (${tasks.length})`,
            vscode.TreeItemCollapsibleState.Expanded
        );

        this.tooltip = `${tasks.length} task(s) with status: ${status}`;
        this.iconPath = new vscode.ThemeIcon(getStatusIcon(status));
    }

    contextValue = 'statusGroup';
}

class TaskItem extends vscode.TreeItem {
    constructor(public readonly task: Task) {
        super(task.title, vscode.TreeItemCollapsibleState.None);

        this.tooltip = this.getTooltip();
        this.description = this.getDescription();
        this.iconPath = new vscode.ThemeIcon(getTaskTypeIcon(task.type));
        this.contextValue = 'task';

        // Add command to open task details
        this.command = {
            command: 'vscode.open',
            title: 'Open Task',
            arguments: [
                vscode.Uri.parse(`orchestrator-task:${task.id}`),
                { preview: false }
            ]
        };
    }

    private getTooltip(): string {
        const lines = [
            `Title: ${this.task.title}`,
            `Status: ${this.task.status}`,
            `Priority: ${this.task.priority}`,
            `Type: ${this.task.type}`,
            `Created: ${this.task.createdAt.toLocaleString()}`
        ];

        if (this.task.assignedAgent) {
            lines.push(`Agent: ${this.task.assignedAgent}`);
        }

        if (this.task.estimatedDuration) {
            lines.push(`Estimated: ${Math.round(this.task.estimatedDuration / 60000)}m`);
        }

        if (this.task.actualDuration) {
            lines.push(`Duration: ${Math.round(this.task.actualDuration / 60000)}m`);
        }

        lines.push('', this.task.description);

        return lines.join('\n');
    }

    private getDescription(): string {
        const parts = [this.task.priority as string];
        
        if (this.task.assignedAgent) {
            parts.push(`@${this.task.assignedAgent}`);
        }

        if (this.task.estimatedDuration && this.task.status !== 'completed') {
            parts.push(`~${Math.round(this.task.estimatedDuration / 60000)}m`);
        }

        if (this.task.actualDuration && this.task.status === 'completed') {
            parts.push(`${Math.round(this.task.actualDuration / 60000)}m`);
        }

        return parts.join(' • ');
    }
}

function getStatusIcon(status: string): string {
    switch (status) {
        case 'pending': return 'clock';
        case 'in_progress': return 'play';
        case 'completed': return 'check';
        case 'failed': return 'error';
        case 'blocked': return 'stop';
        default: return 'circle-outline';
    }
}

function getTaskTypeIcon(type: string): string {
    switch (type) {
        case 'requirement': return 'list-unordered';
        case 'design': return 'paintcan';
        case 'implementation': return 'code';
        case 'test': return 'beaker';
        case 'deployment': return 'rocket';
        case 'review': return 'eye';
        default: return 'circle-outline';
    }
}

function getPriorityColor(priority: string): vscode.ThemeColor {
    switch (priority) {
        case 'critical': return new vscode.ThemeColor('errorForeground');
        case 'high': return new vscode.ThemeColor('notificationsWarningIcon.foreground');
        case 'medium': return new vscode.ThemeColor('notificationsInfoIcon.foreground');
        case 'low': return new vscode.ThemeColor('descriptionForeground');
        default: return new vscode.ThemeColor('foreground');
    }
}