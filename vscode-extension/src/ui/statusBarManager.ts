import * as vscode from 'vscode';

export class StatusBarManager implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        
        this.statusBarItem.command = 'multiAgentOrchestrator.openWebDashboard';
        this.setDisconnected();
        this.statusBarItem.show();
    }

    setConnected(connected: boolean): void {
        if (connected) {
            this.statusBarItem.text = "$(radio-tower) MAO Connected";
            this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.foreground');
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.tooltip = "Connected to Multi-Agent Orchestrator\nClick to open web dashboard";
        } else {
            this.setDisconnected();
        }
    }

    private setDisconnected(): void {
        this.statusBarItem.text = "$(radio-tower) MAO Disconnected";
        this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        this.statusBarItem.tooltip = "Not connected to Multi-Agent Orchestrator\nClick to connect";
        this.statusBarItem.command = 'multiAgentOrchestrator.connect';
    }

    updateTaskCount(count: number): void {
        if (count > 0) {
            this.statusBarItem.text = `$(radio-tower) MAO (${count} tasks)`;
        } else {
            this.statusBarItem.text = "$(radio-tower) MAO Connected";
        }
    }

    showProgress(message: string): void {
        this.statusBarItem.text = `$(loading~spin) ${message}`;
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}