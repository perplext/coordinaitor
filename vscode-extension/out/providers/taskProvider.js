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
exports.TaskProvider = void 0;
const vscode = __importStar(require("vscode"));
class TaskProvider {
    constructor(client) {
        this.client = client;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.tasks = [];
        this.refresh();
    }
    refresh() {
        this.loadTasks();
        this._onDidChangeTreeData.fire();
    }
    async loadTasks() {
        try {
            if (this.client.isConnected()) {
                this.tasks = await this.client.getTasks();
            }
        }
        catch (error) {
            console.error('Failed to load tasks:', error);
            this.tasks = [];
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
            // Group tasks by status
            const tasksByStatus = this.groupTasksByStatus();
            return Promise.resolve(Object.entries(tasksByStatus).map(([status, tasks]) => new StatusGroupItem(status, tasks)));
        }
        else if (element instanceof StatusGroupItem) {
            return Promise.resolve(element.tasks.map(task => new TaskItem(task)));
        }
        return Promise.resolve([]);
    }
    groupTasksByStatus() {
        const groups = {
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
    getTaskById(id) {
        return this.tasks.find(task => task.id === id);
    }
}
exports.TaskProvider = TaskProvider;
class StatusGroupItem extends vscode.TreeItem {
    constructor(status, tasks) {
        super(`${status.toUpperCase()} (${tasks.length})`, vscode.TreeItemCollapsibleState.Expanded);
        this.status = status;
        this.tasks = tasks;
        this.contextValue = 'statusGroup';
        this.tooltip = `${tasks.length} task(s) with status: ${status}`;
        this.iconPath = new vscode.ThemeIcon(getStatusIcon(status));
    }
}
class TaskItem extends vscode.TreeItem {
    constructor(task) {
        super(task.title, vscode.TreeItemCollapsibleState.None);
        this.task = task;
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
    getTooltip() {
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
    getDescription() {
        const parts = [this.task.priority];
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
function getStatusIcon(status) {
    switch (status) {
        case 'pending': return 'clock';
        case 'in_progress': return 'play';
        case 'completed': return 'check';
        case 'failed': return 'error';
        case 'blocked': return 'stop';
        default: return 'circle-outline';
    }
}
function getTaskTypeIcon(type) {
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
function getPriorityColor(priority) {
    switch (priority) {
        case 'critical': return new vscode.ThemeColor('errorForeground');
        case 'high': return new vscode.ThemeColor('notificationsWarningIcon.foreground');
        case 'medium': return new vscode.ThemeColor('notificationsInfoIcon.foreground');
        case 'low': return new vscode.ThemeColor('descriptionForeground');
        default: return new vscode.ThemeColor('foreground');
    }
}
//# sourceMappingURL=taskProvider.js.map