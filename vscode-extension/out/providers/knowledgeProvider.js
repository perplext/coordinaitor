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
exports.KnowledgeProvider = void 0;
const vscode = __importStar(require("vscode"));
class KnowledgeProvider {
    constructor(client) {
        this.client = client;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.entries = [];
        this.searchQuery = '';
        this.refresh();
    }
    refresh() {
        this.loadEntries();
        this._onDidChangeTreeData.fire();
    }
    async search(query) {
        this.searchQuery = query;
        await this.loadEntries();
        this._onDidChangeTreeData.fire();
    }
    async loadEntries() {
        try {
            if (this.client.isConnected()) {
                this.entries = await this.client.searchKnowledge(this.searchQuery);
            }
        }
        catch (error) {
            console.error('Failed to load knowledge entries:', error);
            this.entries = [];
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
            // Group entries by type
            const entriesByType = this.groupEntriesByType();
            return Promise.resolve(Object.entries(entriesByType).map(([type, entries]) => new TypeGroupItem(type, entries)));
        }
        else if (element instanceof TypeGroupItem) {
            return Promise.resolve(element.entries.map(entry => new KnowledgeItem(entry)));
        }
        return Promise.resolve([]);
    }
    groupEntriesByType() {
        const groups = {};
        this.entries.forEach(entry => {
            if (!groups[entry.type]) {
                groups[entry.type] = [];
            }
            groups[entry.type].push(entry);
        });
        return groups;
    }
    getEntryById(id) {
        return this.entries.find(entry => entry.id === id);
    }
}
exports.KnowledgeProvider = KnowledgeProvider;
class TypeGroupItem extends vscode.TreeItem {
    constructor(type, entries) {
        super(`${type.charAt(0).toUpperCase() + type.slice(1)}s (${entries.length})`, vscode.TreeItemCollapsibleState.Expanded);
        this.type = type;
        this.entries = entries;
        this.contextValue = 'typeGroup';
        this.tooltip = `${entries.length} ${type} entr${entries.length === 1 ? 'y' : 'ies'}`;
        this.iconPath = new vscode.ThemeIcon(getTypeIcon(type));
    }
}
class KnowledgeItem extends vscode.TreeItem {
    constructor(entry) {
        super(entry.title, vscode.TreeItemCollapsibleState.None);
        this.entry = entry;
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
    getTooltip() {
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
    getDescription() {
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
function getTypeIcon(type) {
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
//# sourceMappingURL=knowledgeProvider.js.map