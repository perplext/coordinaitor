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
exports.TemplateProvider = void 0;
const vscode = __importStar(require("vscode"));
class TemplateProvider {
    constructor(client) {
        this.client = client;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.templates = [];
        this.refresh();
    }
    refresh() {
        this.loadTemplates();
        this._onDidChangeTreeData.fire();
    }
    async loadTemplates() {
        try {
            if (this.client.isConnected()) {
                this.templates = await this.client.getTemplates();
            }
        }
        catch (error) {
            console.error('Failed to load templates:', error);
            this.templates = [];
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
            // Group templates by type
            const templatesByType = this.groupTemplatesByType();
            return Promise.resolve(Object.entries(templatesByType).map(([type, templates]) => new TypeGroupItem(type, templates)));
        }
        else if (element instanceof TypeGroupItem) {
            return Promise.resolve(element.templates.map(template => new TemplateItem(template)));
        }
        else if (element instanceof TemplateItem && element.template.variables.length > 0) {
            return Promise.resolve(element.template.variables.map(variable => new VariableItem(variable)));
        }
        return Promise.resolve([]);
    }
    groupTemplatesByType() {
        const groups = {};
        this.templates.forEach(template => {
            if (!groups[template.type]) {
                groups[template.type] = [];
            }
            groups[template.type].push(template);
        });
        return groups;
    }
    getTemplateById(id) {
        return this.templates.find(template => template.id === id);
    }
}
exports.TemplateProvider = TemplateProvider;
class TypeGroupItem extends vscode.TreeItem {
    constructor(type, templates) {
        super(`${type.charAt(0).toUpperCase() + type.slice(1)} (${templates.length})`, vscode.TreeItemCollapsibleState.Expanded);
        this.type = type;
        this.templates = templates;
        this.contextValue = 'templateTypeGroup';
        this.tooltip = `${templates.length} ${type} template(s)`;
        this.iconPath = new vscode.ThemeIcon('folder');
    }
}
class TemplateItem extends vscode.TreeItem {
    constructor(template) {
        super(template.name, template.variables.length > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None);
        this.template = template;
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
    getTooltip() {
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
    getDescription() {
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
    constructor(variable) {
        super(variable.name, vscode.TreeItemCollapsibleState.None);
        this.variable = variable;
        this.tooltip = this.getTooltip();
        this.description = this.getDescription();
        this.iconPath = new vscode.ThemeIcon(variable.required ? 'symbol-variable' : 'symbol-parameter');
        this.contextValue = 'templateVariable';
    }
    getTooltip() {
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
    getDescription() {
        const parts = [this.variable.type];
        if (this.variable.required) {
            parts.push('required');
        }
        else if (this.variable.defaultValue !== undefined) {
            parts.push(`= ${this.variable.defaultValue}`);
        }
        else {
            parts.push('optional');
        }
        return parts.join(' • ');
    }
}
//# sourceMappingURL=templateProvider.js.map