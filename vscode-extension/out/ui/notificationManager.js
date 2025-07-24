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
exports.NotificationManager = void 0;
const vscode = __importStar(require("vscode"));
class NotificationManager {
    constructor() {
        this.config = vscode.workspace.getConfiguration('multiAgentOrchestrator');
    }
    showInfo(message, ...actions) {
        if (!this.isNotificationsEnabled()) {
            return Promise.resolve(undefined);
        }
        if (actions.length > 0) {
            return vscode.window.showInformationMessage(message, ...actions);
        }
        return vscode.window.showInformationMessage(message);
    }
    showWarning(message, ...actions) {
        if (!this.isNotificationsEnabled()) {
            return Promise.resolve(undefined);
        }
        if (actions.length > 0) {
            return vscode.window.showWarningMessage(message, ...actions);
        }
        return vscode.window.showWarningMessage(message);
    }
    showError(message, ...actions) {
        // Always show error messages regardless of notification settings
        if (actions.length > 0) {
            return vscode.window.showErrorMessage(message, ...actions);
        }
        return vscode.window.showErrorMessage(message);
    }
    showProgress(title, task) {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title,
            cancellable: false
        }, task);
    }
    showTaskCreated(taskTitle) {
        this.showInfo(`Task created: ${taskTitle}`, 'View Tasks', 'Open Dashboard').then(action => {
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
    showTaskCompleted(taskTitle) {
        this.showInfo(`✅ Task completed: ${taskTitle}`, 'View Result', 'Create New Task').then(action => {
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
    showTaskFailed(taskTitle, error) {
        const message = error
            ? `❌ Task failed: ${taskTitle}\nError: ${error}`
            : `❌ Task failed: ${taskTitle}`;
        this.showError(message, 'View Tasks', 'Retry Task').then(action => {
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
    showConnectionStatus(connected) {
        if (connected) {
            this.showInfo('🟢 Connected to Multi-Agent Orchestrator', 'View Dashboard').then(action => {
                if (action === 'View Dashboard') {
                    vscode.commands.executeCommand('multiAgentOrchestrator.openWebDashboard');
                }
            });
        }
        else {
            this.showWarning('🔴 Disconnected from Multi-Agent Orchestrator', 'Reconnect', 'Check Settings').then(action => {
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
    showSecurityScanResult(taskTitle, issuesFound) {
        if (issuesFound === 0) {
            this.showInfo(`🛡️ Security scan completed for "${taskTitle}" - No issues found`);
        }
        else {
            this.showWarning(`🛡️ Security scan completed for "${taskTitle}" - ${issuesFound} issue(s) found`, 'View Report', 'Open Dashboard').then(action => {
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
    showKnowledgeEntryCreated(title) {
        this.showInfo(`📚 Knowledge entry created: ${title}`, 'View Knowledge', 'Create Another').then(action => {
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
    isNotificationsEnabled() {
        return this.config.get('enableNotifications', true);
    }
}
exports.NotificationManager = NotificationManager;
//# sourceMappingURL=notificationManager.js.map