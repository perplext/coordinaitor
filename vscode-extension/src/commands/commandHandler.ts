import * as vscode from 'vscode';
import * as path from 'path';
import { OrchestratorClient, Task, Template } from '../client/orchestratorClient';
import { TaskProvider } from '../providers/taskProvider';
import { AgentProvider } from '../providers/agentProvider';
import { KnowledgeProvider } from '../providers/knowledgeProvider';
import { TemplateProvider } from '../providers/templateProvider';

export class CommandHandler {
    constructor(
        private client: OrchestratorClient,
        private taskProvider: TaskProvider,
        private agentProvider: AgentProvider,
        private knowledgeProvider: KnowledgeProvider,
        private templateProvider: TemplateProvider
    ) {}

    async connect(): Promise<void> {
        const config = vscode.workspace.getConfiguration('multiAgentOrchestrator');
        const serverUrl = config.get<string>('serverUrl');

        if (!serverUrl) {
            const url = await vscode.window.showInputBox({
                prompt: 'Enter the Multi-Agent Orchestrator server URL',
                value: 'http://localhost:3000',
                validateInput: (value) => {
                    try {
                        new URL(value);
                        return null;
                    } catch {
                        return 'Please enter a valid URL';
                    }
                }
            });

            if (!url) return;

            await config.update('serverUrl', url, vscode.ConfigurationTarget.Workspace);
        }

        const connected = await this.client.connect();
        if (connected) {
            this.refreshAllProviders();
        }
    }

    disconnect(): void {
        this.client.disconnect();
    }

    async createTask(uri?: vscode.Uri): Promise<void> {
        if (!this.client.isConnected()) {
            vscode.window.showErrorMessage('Not connected to orchestrator server');
            return;
        }

        const config = vscode.workspace.getConfiguration('multiAgentOrchestrator');
        
        // Get context from current editor or file
        let context = '';
        let title = '';
        
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.selection && !editor.selection.isEmpty) {
            context = editor.document.getText(editor.selection);
            title = `Task for ${path.basename(editor.document.fileName)}`;
        } else if (uri) {
            const document = await vscode.workspace.openTextDocument(uri);
            context = document.getText();
            title = `Task for ${path.basename(uri.fsPath)}`;
        } else if (editor) {
            title = `Task for ${path.basename(editor.document.fileName)}`;
        } else {
            title = 'New Task';
        }

        // Show task creation form
        const panel = vscode.window.createWebviewPanel(
            'createTask',
            'Create Task',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.getTaskCreationWebviewContent(title, context, config);

        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'createTask':
                    try {
                        const task = await this.client.createTask({
                            title: message.title,
                            description: message.description,
                            type: message.type,
                            priority: message.priority
                        });

                        vscode.window.showInformationMessage(`Task created: ${task.title}`);
                        this.taskProvider.refresh();
                        panel.dispose();
                    } catch (error: any) {
                        vscode.window.showErrorMessage(`Failed to create task: ${error.message}`);
                    }
                    break;
                
                case 'cancel':
                    panel.dispose();
                    break;
            }
        });
    }

    async executeTask(task: any): Promise<void> {
        if (!this.client.isConnected()) {
            vscode.window.showErrorMessage('Not connected to orchestrator server');
            return;
        }

        const taskObj = task instanceof Object ? task : this.taskProvider.getTaskById(task);
        if (!taskObj) {
            vscode.window.showErrorMessage('Task not found');
            return;
        }

        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Executing task: ${taskObj.title}`,
                cancellable: false
            },
            async (progress) => {
                try {
                    progress.report({ message: 'Starting execution...' });
                    const result = await this.client.executeTask(taskObj.id);
                    progress.report({ message: 'Task completed!' });
                    return result;
                } catch (error: any) {
                    throw new Error(`Task execution failed: ${error.message}`);
                }
            }
        );

        if (result) {
            vscode.window.showInformationMessage(`Task completed successfully: ${taskObj.title}`);
            this.taskProvider.refresh();
        }
    }

    refreshTasks(): void {
        this.taskProvider.refresh();
    }

    async openWebDashboard(): Promise<void> {
        const config = vscode.workspace.getConfiguration('multiAgentOrchestrator');
        const serverUrl = config.get<string>('serverUrl', 'http://localhost:3000');
        
        await vscode.env.openExternal(vscode.Uri.parse(serverUrl));
    }

    async searchKnowledge(): Promise<void> {
        if (!this.client.isConnected()) {
            vscode.window.showErrorMessage('Not connected to orchestrator server');
            return;
        }

        const query = await vscode.window.showInputBox({
            prompt: 'Search knowledge base',
            placeHolder: 'Enter search terms...'
        });

        if (query) {
            await this.knowledgeProvider.search(query);
        }
    }

    async createKnowledgeEntry(): Promise<void> {
        if (!this.client.isConnected()) {
            vscode.window.showErrorMessage('Not connected to orchestrator server');
            return;
        }

        // Get context from current editor
        let content = '';
        let title = '';
        let language = '';
        
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            if (editor.selection && !editor.selection.isEmpty) {
                content = editor.document.getText(editor.selection);
            } else {
                content = editor.document.getText();
            }
            
            title = `Knowledge from ${path.basename(editor.document.fileName)}`;
            language = editor.document.languageId;
        }

        // Show knowledge entry creation form
        const panel = vscode.window.createWebviewPanel(
            'createKnowledgeEntry',
            'Create Knowledge Entry',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.getKnowledgeCreationWebviewContent(title, content, language);

        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'createEntry':
                    try {
                        const entry = await this.client.createKnowledgeEntry({
                            title: message.title,
                            content: message.content,
                            type: message.type,
                            tags: message.tags ? message.tags.split(',').map((t: string) => t.trim()) : [],
                            metadata: {
                                language: message.language || undefined,
                                framework: message.framework || undefined,
                                difficulty: message.difficulty || undefined
                            },
                            isPublic: message.isPublic
                        });

                        vscode.window.showInformationMessage(`Knowledge entry created: ${entry.title}`);
                        this.knowledgeProvider.refresh();
                        panel.dispose();
                    } catch (error: any) {
                        vscode.window.showErrorMessage(`Failed to create knowledge entry: ${error.message}`);
                    }
                    break;
                
                case 'cancel':
                    panel.dispose();
                    break;
            }
        });
    }

    async generateFromTemplate(template?: Template): Promise<void> {
        if (!this.client.isConnected()) {
            vscode.window.showErrorMessage('Not connected to orchestrator server');
            return;
        }

        let selectedTemplate = template;
        
        if (!selectedTemplate) {
            // Show template selection
            const templates = await this.client.getTemplates();
            const items = templates.map(t => ({
                label: t.name,
                description: t.description,
                detail: `Type: ${t.type} • Variables: ${t.variables.length}`,
                template: t
            }));

            const selection = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a template'
            });

            if (!selection) return;
            selectedTemplate = selection.template;
        }

        // Collect variable values
        const variables: Record<string, any> = {};
        
        for (const variable of selectedTemplate.variables) {
            if (variable.defaultValue !== undefined && !variable.required) {
                variables[variable.name] = variable.defaultValue;
                continue;
            }

            const value = await vscode.window.showInputBox({
                prompt: `${variable.description} (${variable.type})`,
                placeHolder: variable.defaultValue?.toString() || `Enter ${variable.name}`,
                validateInput: variable.required ? (value) => {
                    return value.trim() ? null : 'This field is required';
                } : undefined
            });

            if (value === undefined) return; // User cancelled
            
            variables[variable.name] = value || variable.defaultValue;
        }

        try {
            const task = await this.client.applyTemplate(selectedTemplate.id, variables);
            vscode.window.showInformationMessage(`Task created from template: ${task.title}`);
            this.taskProvider.refresh();
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to apply template: ${error.message}`);
        }
    }

    async runSecurityScan(): Promise<void> {
        if (!this.client.isConnected()) {
            vscode.window.showErrorMessage('Not connected to orchestrator server');
            return;
        }

        // Show task selection for security scan
        const tasks = await this.client.getTasks();
        const completedTasks = tasks.filter(t => t.status === 'completed');
        
        if (completedTasks.length === 0) {
            vscode.window.showInformationMessage('No completed tasks found to scan');
            return;
        }

        const items = completedTasks.map(t => ({
            label: t.title,
            description: `${t.type} • ${t.priority}`,
            detail: t.description,
            task: t
        }));

        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a task to run security scan on'
        });

        if (!selection) return;

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Running security scan...',
                    cancellable: false
                },
                async () => {
                    await this.client.runSecurityScan(selection.task.id);
                }
            );

            vscode.window.showInformationMessage('Security scan completed');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Security scan failed: ${error.message}`);
        }
    }

    async autoCreateTaskFromFile(uri: vscode.Uri): Promise<void> {
        const fileName = path.basename(uri.fsPath);
        const title = `Review ${fileName}`;
        const description = `Automatically created task to review new file: ${fileName}`;

        try {
            await this.client.createTask({
                title,
                description,
                type: 'review',
                priority: 'low'
            });

            vscode.window.showInformationMessage(`Auto-created review task for ${fileName}`);
            this.taskProvider.refresh();
        } catch (error: any) {
            console.error('Failed to auto-create task:', error);
        }
    }

    private refreshAllProviders(): void {
        this.taskProvider.refresh();
        this.agentProvider.refresh();
        this.knowledgeProvider.refresh();
        this.templateProvider.refresh();
    }

    private getTaskCreationWebviewContent(title: string, context: string, config: any): string {
        const defaultType = config.get('defaultTaskType', 'implementation');
        const defaultPriority = config.get('defaultPriority', 'medium');

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Create Task</title>
    <style>
        body { font-family: var(--vscode-font-family); padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, select, textarea { 
            width: 100%; 
            padding: 8px; 
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
        }
        textarea { height: 100px; resize: vertical; }
        .context-area { height: 150px; }
        .buttons { margin-top: 20px; }
        button { 
            padding: 10px 20px; 
            margin-right: 10px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
        }
        button:hover { background: var(--vscode-button-hoverBackground); }
        .cancel { background: var(--vscode-button-secondaryBackground); }
    </style>
</head>
<body>
    <h2>Create New Task</h2>
    <form>
        <div class="form-group">
            <label for="title">Title *</label>
            <input type="text" id="title" value="${title}" required>
        </div>
        
        <div class="form-group">
            <label for="type">Type *</label>
            <select id="type">
                <option value="requirement" ${defaultType === 'requirement' ? 'selected' : ''}>Requirement</option>
                <option value="design" ${defaultType === 'design' ? 'selected' : ''}>Design</option>
                <option value="implementation" ${defaultType === 'implementation' ? 'selected' : ''}>Implementation</option>
                <option value="test" ${defaultType === 'test' ? 'selected' : ''}>Test</option>
                <option value="deployment" ${defaultType === 'deployment' ? 'selected' : ''}>Deployment</option>
                <option value="review" ${defaultType === 'review' ? 'selected' : ''}>Review</option>
            </select>
        </div>
        
        <div class="form-group">
            <label for="priority">Priority *</label>
            <select id="priority">
                <option value="low" ${defaultPriority === 'low' ? 'selected' : ''}>Low</option>
                <option value="medium" ${defaultPriority === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="high" ${defaultPriority === 'high' ? 'selected' : ''}>High</option>
                <option value="critical" ${defaultPriority === 'critical' ? 'selected' : ''}>Critical</option>
            </select>
        </div>
        
        <div class="form-group">
            <label for="description">Description *</label>
            <textarea id="description" required placeholder="Describe what needs to be done..."></textarea>
        </div>
        
        <div class="form-group">
            <label for="requirements">Additional Requirements</label>
            <textarea id="requirements" placeholder="Any specific requirements or constraints..."></textarea>
        </div>
        
        ${context ? `
        <div class="form-group">
            <label for="context">Context (from editor)</label>
            <textarea id="context" class="context-area" readonly>${context}</textarea>
        </div>
        ` : ''}
        
        <div class="buttons">
            <button type="button" onclick="createTask()">Create Task</button>
            <button type="button" class="cancel" onclick="cancel()">Cancel</button>
        </div>
    </form>

    <script>
        const vscode = acquireVsCodeApi();
        
        function createTask() {
            const title = document.getElementById('title').value;
            const type = document.getElementById('type').value;
            const priority = document.getElementById('priority').value;
            const description = document.getElementById('description').value;
            const requirements = document.getElementById('requirements').value;
            
            if (!title || !description) {
                alert('Please fill in all required fields');
                return;
            }
            
            vscode.postMessage({
                command: 'createTask',
                title,
                type,
                priority,
                description,
                requirements
            });
        }
        
        function cancel() {
            vscode.postMessage({ command: 'cancel' });
        }
    </script>
</body>
</html>`;
    }

    private getKnowledgeCreationWebviewContent(title: string, content: string, language: string): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Create Knowledge Entry</title>
    <style>
        body { font-family: var(--vscode-font-family); padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, select, textarea { 
            width: 100%; 
            padding: 8px; 
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
        }
        textarea { height: 100px; resize: vertical; }
        .content-area { height: 200px; }
        .buttons { margin-top: 20px; }
        button { 
            padding: 10px 20px; 
            margin-right: 10px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
        }
        button:hover { background: var(--vscode-button-hoverBackground); }
        .cancel { background: var(--vscode-button-secondaryBackground); }
        .checkbox-group { display: flex; align-items: center; }
        .checkbox-group input { width: auto; margin-right: 10px; }
    </style>
</head>
<body>
    <h2>Create Knowledge Entry</h2>
    <form>
        <div class="form-group">
            <label for="title">Title *</label>
            <input type="text" id="title" value="${title}" required>
        </div>
        
        <div class="form-group">
            <label for="type">Type *</label>
            <select id="type">
                <option value="solution">Solution</option>
                <option value="pattern">Pattern</option>
                <option value="snippet" ${content ? 'selected' : ''}>Code Snippet</option>
                <option value="documentation">Documentation</option>
                <option value="error">Error Solution</option>
                <option value="best-practice">Best Practice</option>
            </select>
        </div>
        
        <div class="form-group">
            <label for="content">Content *</label>
            <textarea id="content" class="content-area" required>${content}</textarea>
        </div>
        
        <div class="form-group">
            <label for="tags">Tags (comma-separated)</label>
            <input type="text" id="tags" placeholder="javascript, react, component, ...">
        </div>
        
        <div class="form-group">
            <label for="language">Language</label>
            <input type="text" id="language" value="${language}" placeholder="typescript, python, java, ...">
        </div>
        
        <div class="form-group">
            <label for="framework">Framework</label>
            <input type="text" id="framework" placeholder="react, express, django, ...">
        </div>
        
        <div class="form-group">
            <label for="difficulty">Difficulty</label>
            <select id="difficulty">
                <option value="">None</option>
                <option value="easy">Easy</option>
                <option value="medium" selected>Medium</option>
                <option value="hard">Hard</option>
                <option value="expert">Expert</option>
            </select>
        </div>
        
        <div class="form-group checkbox-group">
            <input type="checkbox" id="isPublic" checked>
            <label for="isPublic">Make this entry public</label>
        </div>
        
        <div class="buttons">
            <button type="button" onclick="createEntry()">Create Entry</button>
            <button type="button" class="cancel" onclick="cancel()">Cancel</button>
        </div>
    </form>

    <script>
        const vscode = acquireVsCodeApi();
        
        function createEntry() {
            const title = document.getElementById('title').value;
            const type = document.getElementById('type').value;
            const content = document.getElementById('content').value;
            const tags = document.getElementById('tags').value;
            const language = document.getElementById('language').value;
            const framework = document.getElementById('framework').value;
            const difficulty = document.getElementById('difficulty').value;
            const isPublic = document.getElementById('isPublic').checked;
            
            if (!title || !content) {
                alert('Please fill in all required fields');
                return;
            }
            
            vscode.postMessage({
                command: 'createEntry',
                title,
                type,
                content,
                tags,
                language,
                framework,
                difficulty,
                isPublic
            });
        }
        
        function cancel() {
            vscode.postMessage({ command: 'cancel' });
        }
    </script>
</body>
</html>`;
    }
}