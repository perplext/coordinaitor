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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const orchestratorClient_1 = require("./client/orchestratorClient");
const taskProvider_1 = require("./providers/taskProvider");
const agentProvider_1 = require("./providers/agentProvider");
const knowledgeProvider_1 = require("./providers/knowledgeProvider");
const templateProvider_1 = require("./providers/templateProvider");
const commandHandler_1 = require("./commands/commandHandler");
const statusBarManager_1 = require("./ui/statusBarManager");
const notificationManager_1 = require("./ui/notificationManager");
let client;
let taskProvider;
let agentProvider;
let knowledgeProvider;
let templateProvider;
let commandHandler;
let statusBarManager;
let notificationManager;
function activate(context) {
    console.log('Multi-Agent Orchestrator extension is now active!');
    // Initialize managers
    statusBarManager = new statusBarManager_1.StatusBarManager();
    notificationManager = new notificationManager_1.NotificationManager();
    // Initialize client
    client = new orchestratorClient_1.OrchestratorClient(statusBarManager, notificationManager);
    // Initialize providers
    taskProvider = new taskProvider_1.TaskProvider(client);
    agentProvider = new agentProvider_1.AgentProvider(client);
    knowledgeProvider = new knowledgeProvider_1.KnowledgeProvider(client);
    templateProvider = new templateProvider_1.TemplateProvider(client);
    // Initialize command handler
    commandHandler = new commandHandler_1.CommandHandler(client, taskProvider, agentProvider, knowledgeProvider, templateProvider);
    // Register tree data providers
    vscode.window.createTreeView('multiAgentOrchestrator.tasks', {
        treeDataProvider: taskProvider,
        showCollapseAll: true
    });
    vscode.window.createTreeView('multiAgentOrchestrator.agents', {
        treeDataProvider: agentProvider,
        showCollapseAll: true
    });
    vscode.window.createTreeView('multiAgentOrchestrator.knowledge', {
        treeDataProvider: knowledgeProvider,
        showCollapseAll: true
    });
    vscode.window.createTreeView('multiAgentOrchestrator.templates', {
        treeDataProvider: templateProvider,
        showCollapseAll: true
    });
    // Register commands
    const commands = [
        vscode.commands.registerCommand('multiAgentOrchestrator.connect', () => commandHandler.connect()),
        vscode.commands.registerCommand('multiAgentOrchestrator.disconnect', () => commandHandler.disconnect()),
        vscode.commands.registerCommand('multiAgentOrchestrator.createTask', (uri) => commandHandler.createTask(uri)),
        vscode.commands.registerCommand('multiAgentOrchestrator.executeTask', (task) => commandHandler.executeTask(task)),
        vscode.commands.registerCommand('multiAgentOrchestrator.refreshTasks', () => commandHandler.refreshTasks()),
        vscode.commands.registerCommand('multiAgentOrchestrator.openWebDashboard', () => commandHandler.openWebDashboard()),
        vscode.commands.registerCommand('multiAgentOrchestrator.searchKnowledge', () => commandHandler.searchKnowledge()),
        vscode.commands.registerCommand('multiAgentOrchestrator.createKnowledgeEntry', () => commandHandler.createKnowledgeEntry()),
        vscode.commands.registerCommand('multiAgentOrchestrator.generateFromTemplate', () => commandHandler.generateFromTemplate()),
        vscode.commands.registerCommand('multiAgentOrchestrator.runSecurityScan', () => commandHandler.runSecurityScan())
    ];
    // Register all disposables
    context.subscriptions.push(...commands, statusBarManager, client);
    // Auto-connect if configured
    const config = vscode.workspace.getConfiguration('multiAgentOrchestrator');
    const serverUrl = config.get('serverUrl');
    if (serverUrl) {
        commandHandler.connect();
    }
    // Setup configuration change listener
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('multiAgentOrchestrator')) {
            if (client.isConnected()) {
                client.updateConfiguration();
            }
        }
    }));
    // Setup file system watchers for automatic task creation
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        for (const folder of workspaceFolders) {
            const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, '**/*.{ts,js,py,java,go,rs}'));
            context.subscriptions.push(watcher, watcher.onDidCreate(uri => {
                if (config.get('autoCreateTasksOnFileCreate')) {
                    commandHandler.autoCreateTaskFromFile(uri);
                }
            }));
        }
    }
}
function deactivate() {
    if (client) {
        client.disconnect();
    }
}
//# sourceMappingURL=extension.js.map