import * as vscode from 'vscode';

export class NotificationManager {
    private config: vscode.WorkspaceConfiguration;

    constructor() {
        this.config = vscode.workspace.getConfiguration('multiAgentOrchestrator');
    }

    showInfo(message: string, ...actions: string[]): Thenable<string | undefined> {
        if (!this.isNotificationsEnabled()) {
            return Promise.resolve(undefined);
        }
        
        if (actions.length > 0) {
            return vscode.window.showInformationMessage(message, ...actions);
        }
        
        return vscode.window.showInformationMessage(message);
    }

    showWarning(message: string, ...actions: string[]): Thenable<string | undefined> {
        if (!this.isNotificationsEnabled()) {
            return Promise.resolve(undefined);
        }
        
        if (actions.length > 0) {
            return vscode.window.showWarningMessage(message, ...actions);
        }
        
        return vscode.window.showWarningMessage(message);
    }

    showError(message: string, ...actions: string[]): Thenable<string | undefined> {
        // Always show error messages regardless of notification settings
        if (actions.length > 0) {
            return vscode.window.showErrorMessage(message, ...actions);
        }
        
        return vscode.window.showErrorMessage(message);
    }

    showProgress<T>(
        title: string,
        task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Thenable<T>
    ): Thenable<T> {
        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title,
                cancellable: false
            },
            task
        );
    }

    showTaskCreated(taskTitle: string): void {
        this.showInfo(
            `Task created: ${taskTitle}`,
            'View Tasks',
            'Open Dashboard'
        ).then(action => {
            switch (action) {
                case 'View Tasks':
                    vscode.commands.executeCommand('multiAgentOrchestrator.refreshTasks');
                    break;
                case 'Open Dashboard':
                    vscode.commands.executeCommand('multiAgentOrchestrator.openWebDashboard');
                    break;
            }
        });
    }

    showTaskCompleted(taskTitle: string): void {
        this.showInfo(
            `✅ Task completed: ${taskTitle}`,
            'View Result',
            'Create New Task'
        ).then(action => {
            switch (action) {
                case 'View Result':
                    vscode.commands.executeCommand('multiAgentOrchestrator.refreshTasks');
                    break;
                case 'Create New Task':
                    vscode.commands.executeCommand('multiAgentOrchestrator.createTask');
                    break;
            }
        });
    }

    showTaskFailed(taskTitle: string, error?: string): void {
        const message = error 
            ? `❌ Task failed: ${taskTitle}\nError: ${error}`
            : `❌ Task failed: ${taskTitle}`;
            
        this.showError(
            message,
            'View Tasks',
            'Retry Task'
        ).then(action => {
            switch (action) {
                case 'View Tasks':
                    vscode.commands.executeCommand('multiAgentOrchestrator.refreshTasks');
                    break;
                case 'Retry Task':
                    // TODO: Implement retry functionality
                    break;
            }
        });
    }

    showConnectionStatus(connected: boolean): void {
        if (connected) {
            this.showInfo(
                '🟢 Connected to Multi-Agent Orchestrator',
                'View Dashboard'
            ).then(action => {
                if (action === 'View Dashboard') {
                    vscode.commands.executeCommand('multiAgentOrchestrator.openWebDashboard');
                }
            });
        } else {
            this.showWarning(
                '🔴 Disconnected from Multi-Agent Orchestrator',
                'Reconnect',
                'Check Settings'
            ).then(action => {
                switch (action) {
                    case 'Reconnect':
                        vscode.commands.executeCommand('multiAgentOrchestrator.connect');
                        break;
                    case 'Check Settings':
                        vscode.commands.executeCommand('workbench.action.openSettings', 'multiAgentOrchestrator');
                        break;
                }
            });
        }
    }

    showSecurityScanResult(taskTitle: string, issuesFound: number): void {
        if (issuesFound === 0) {
            this.showInfo(`🛡️ Security scan completed for "${taskTitle}" - No issues found`);
        } else {
            this.showWarning(
                `🛡️ Security scan completed for "${taskTitle}" - ${issuesFound} issue(s) found`,
                'View Report',
                'Open Dashboard'
            ).then(action => {
                switch (action) {
                    case 'View Report':
                        // TODO: Open security report
                        break;
                    case 'Open Dashboard':
                        vscode.commands.executeCommand('multiAgentOrchestrator.openWebDashboard');
                        break;
                }
            });
        }
    }

    showKnowledgeEntryCreated(title: string): void {
        this.showInfo(
            `📚 Knowledge entry created: ${title}`,
            'View Knowledge',
            'Create Another'
        ).then(action => {
            switch (action) {
                case 'View Knowledge':
                    vscode.commands.executeCommand('multiAgentOrchestrator.searchKnowledge');
                    break;
                case 'Create Another':
                    vscode.commands.executeCommand('multiAgentOrchestrator.createKnowledgeEntry');
                    break;
            }
        });
    }

    private isNotificationsEnabled(): boolean {
        return this.config.get<boolean>('enableNotifications', true);
    }
}