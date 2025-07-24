import * as vscode from 'vscode';
import { OrchestratorClient } from './client/orchestratorClient';
import { TaskProvider } from './providers/taskProvider';
import { AgentProvider } from './providers/agentProvider';
import { KnowledgeProvider } from './providers/knowledgeProvider';
import { TemplateProvider } from './providers/templateProvider';
import { CommandHandler } from './commands/commandHandler';
import { StatusBarManager } from './ui/statusBarManager';
import { NotificationManager } from './ui/notificationManager';

let client: OrchestratorClient;
let taskProvider: TaskProvider;
let agentProvider: AgentProvider;
let knowledgeProvider: KnowledgeProvider;
let templateProvider: TemplateProvider;
let commandHandler: CommandHandler;
let statusBarManager: StatusBarManager;
let notificationManager: NotificationManager;

export function activate(context: vscode.ExtensionContext) {
    console.log('Multi-Agent Orchestrator extension is now active!');

    // Initialize managers
    statusBarManager = new StatusBarManager();
    notificationManager = new NotificationManager();
    
    // Initialize client
    client = new OrchestratorClient(statusBarManager, notificationManager);
    
    // Initialize providers
    taskProvider = new TaskProvider(client);
    agentProvider = new AgentProvider(client);
    knowledgeProvider = new KnowledgeProvider(client);
    templateProvider = new TemplateProvider(client);
    
    // Initialize command handler
    commandHandler = new CommandHandler(
        client,
        taskProvider,
        agentProvider,
        knowledgeProvider,
        templateProvider
    );

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
        vscode.commands.registerCommand('multiAgentOrchestrator.connect', () => 
            commandHandler.connect()
        ),
        vscode.commands.registerCommand('multiAgentOrchestrator.disconnect', () => 
            commandHandler.disconnect()
        ),
        vscode.commands.registerCommand('multiAgentOrchestrator.createTask', (uri?: vscode.Uri) => 
            commandHandler.createTask(uri)
        ),
        vscode.commands.registerCommand('multiAgentOrchestrator.executeTask', (task: any) => 
            commandHandler.executeTask(task)
        ),
        vscode.commands.registerCommand('multiAgentOrchestrator.refreshTasks', () => 
            commandHandler.refreshTasks()
        ),
        vscode.commands.registerCommand('multiAgentOrchestrator.openWebDashboard', () => 
            commandHandler.openWebDashboard()
        ),
        vscode.commands.registerCommand('multiAgentOrchestrator.searchKnowledge', () => 
            commandHandler.searchKnowledge()
        ),
        vscode.commands.registerCommand('multiAgentOrchestrator.createKnowledgeEntry', () => 
            commandHandler.createKnowledgeEntry()
        ),
        vscode.commands.registerCommand('multiAgentOrchestrator.generateFromTemplate', () => 
            commandHandler.generateFromTemplate()
        ),
        vscode.commands.registerCommand('multiAgentOrchestrator.runSecurityScan', () => 
            commandHandler.runSecurityScan()
        )
    ];

    // Register all disposables
    context.subscriptions.push(
        ...commands,
        statusBarManager,
        client
    );

    // Auto-connect if configured
    const config = vscode.workspace.getConfiguration('multiAgentOrchestrator');
    const serverUrl = config.get<string>('serverUrl');
    if (serverUrl) {
        commandHandler.connect();
    }

    // Setup configuration change listener
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('multiAgentOrchestrator')) {
                if (client.isConnected()) {
                    client.updateConfiguration();
                }
            }
        })
    );

    // Setup file system watchers for automatic task creation
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        for (const folder of workspaceFolders) {
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(folder, '**/*.{ts,js,py,java,go,rs}')
            );
            
            context.subscriptions.push(
                watcher,
                watcher.onDidCreate(uri => {
                    if (config.get<boolean>('autoCreateTasksOnFileCreate')) {
                        commandHandler.autoCreateTaskFromFile(uri);
                    }
                })
            );
        }
    }
}

export function deactivate() {
    if (client) {
        client.disconnect();
    }
}