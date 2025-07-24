import { APIAgent } from '../api-agent';
import { AgentConfig, AgentRequest } from '../../interfaces/agent.interface';
import { AxiosRequestConfig } from 'axios';

export class CursorAgent extends APIAgent {
  private sessionId: string;
  private conversationHistory: any[] = [];
  private codebaseContext: any = null;

  constructor(config: AgentConfig) {
    super(config);
    this.sessionId = this.generateSessionId();
  }

  protected getDefaultHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': `MultiAgentOrchestrator-Cursor/${this.config.version}`,
      'X-Cursor-Session': this.sessionId,
    };
  }

  protected async validateCredentials(): Promise<void> {
    try {
      // Test with a simple request to validate API key
      const response = await this.httpClient.post('/chat/validate', {
        session_id: this.sessionId
      });

      this.logger.info('Cursor AI credentials validated successfully', {
        sessionId: this.sessionId,
        status: response.data.status
      });
    } catch (error) {
      this.logger.error('Failed to validate Cursor AI credentials:', error);
      throw new Error(`Cursor AI agent validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  protected buildAPIRequest(request: AgentRequest): AxiosRequestConfig {
    const messages = [...this.conversationHistory];
    
    // Add codebase context if available
    if (this.codebaseContext) {
      messages.push({
        role: 'system',
        content: `Codebase context: ${JSON.stringify(this.codebaseContext)}`
      });
    }

    // Add request context if provided
    if (request.context) {
      messages.push({
        role: 'system',
        content: `Request context: ${JSON.stringify(request.context)}`
      });
    }

    // Add the user message
    messages.push({
      role: 'user',
      content: request.prompt
    });

    const requestBody = {
      messages,
      model: request.metadata?.model || 'cursor-fast',
      max_tokens: request.metadata?.maxTokens || 4096,
      temperature: request.metadata?.temperature || 0.1,
      stream: request.metadata?.stream || false,
      session_id: this.sessionId,
      codebase_awareness: request.metadata?.codebaseAwareness || true,
      file_context: request.metadata?.fileContext || [],
      ...(request.metadata?.systemPrompt && {
        system: request.metadata.systemPrompt
      })
    };

    return {
      method: 'POST',
      url: '/chat/completions',
      data: requestBody,
      headers: this.getDefaultHeaders(),
    };
  }

  protected parseAPIResponse(response: any, request: AgentRequest): any {
    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error('No response choices available from Cursor AI');
    }

    const content = choice.message?.content || choice.text || '';
    const usage = response.usage || {};
    
    const totalTokens = (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
    const cost = this.calculateCost(totalTokens);

    // Extract code suggestions if present
    const codeSuggestions = this.extractCodeSuggestions(content);
    const fileChanges = this.extractFileChanges(content);

    // Update conversation history
    this.conversationHistory.push(
      { role: 'user', content: request.prompt },
      { role: 'assistant', content: content }
    );

    // Keep conversation history manageable
    if (this.conversationHistory.length > 30) {
      this.conversationHistory = this.conversationHistory.slice(-30);
    }

    this.logger.info('Cursor AI response parsed', {
      taskId: request.taskId,
      contentLength: content.length,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      codeSuggestions: codeSuggestions.length,
      fileChanges: fileChanges.length,
      cost
    });

    return {
      content,
      metadata: {
        model: response.model,
        tokens: {
          prompt: usage.prompt_tokens,
          completion: usage.completion_tokens,
          total: totalTokens
        },
        cost,
        finishReason: choice.finish_reason,
        sessionId: this.sessionId,
        codeSuggestions,
        fileChanges,
        codebaseAware: response.codebase_aware || false
      },
      raw: response
    };
  }

  public async setCodebaseContext(context: any): Promise<void> {
    this.codebaseContext = context;
    this.logger.info('Codebase context updated', {
      files: context.files?.length || 0,
      directories: context.directories?.length || 0
    });
  }

  public async analyzeCodebase(path: string): Promise<any> {
    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt: `Analyze the codebase at path: ${path}. Provide insights about the structure, patterns, and potential improvements.`,
      priority: 'medium',
      metadata: {
        codebaseAwareness: true,
        temperature: 0.2,
        maxTokens: 2048
      }
    };

    return await this.execute(request);
  }

  public async generateCode(prompt: string, fileContext?: string[], language?: string): Promise<any> {
    const codePrompt = `Generate ${language ? language + ' ' : ''}code for: ${prompt}`;
    
    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt: codePrompt,
      priority: 'medium',
      metadata: {
        temperature: 0.1,
        maxTokens: 3000,
        fileContext: fileContext || [],
        codebaseAwareness: true,
        model: 'cursor-fast'
      }
    };

    return await this.execute(request);
  }

  public async refactorCode(code: string, instructions: string, language?: string): Promise<any> {
    const refactorPrompt = `Refactor the following ${language ? language + ' ' : ''}code according to these instructions: ${instructions}\n\nCode:\n\`\`\`${language || ''}\n${code}\n\`\`\``;
    
    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt: refactorPrompt,
      priority: 'medium',
      metadata: {
        temperature: 0.1,
        maxTokens: 3000,
        codebaseAwareness: true
      }
    };

    return await this.execute(request);
  }

  public async findAndFix(errorMessage: string, stackTrace?: string, fileContext?: string[]): Promise<any> {
    let fixPrompt = `Help me find and fix this error: ${errorMessage}`;
    
    if (stackTrace) {
      fixPrompt += `\n\nStack trace:\n${stackTrace}`;
    }
    
    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt: fixPrompt,
      priority: 'high',
      metadata: {
        temperature: 0.1,
        maxTokens: 2048,
        fileContext: fileContext || [],
        codebaseAwareness: true
      }
    };

    return await this.execute(request);
  }

  public async chatWithCodebase(message: string, fileContext?: string[]): Promise<any> {
    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt: message,
      priority: 'medium',
      metadata: {
        temperature: 0.3,
        maxTokens: 1500,
        fileContext: fileContext || [],
        codebaseAwareness: true
      }
    };

    return await this.execute(request);
  }

  public async optimizePerformance(code: string, language?: string, target?: string): Promise<any> {
    let optimizePrompt = `Optimize the performance of this ${language ? language + ' ' : ''}code`;
    
    if (target) {
      optimizePrompt += ` for ${target}`;
    }
    
    optimizePrompt += `:\n\n\`\`\`${language || ''}\n${code}\n\`\`\`\n\nProvide the optimized code with explanations of the improvements.`;
    
    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt: optimizePrompt,
      priority: 'medium',
      metadata: {
        temperature: 0.1,
        maxTokens: 2048,
        codebaseAwareness: true
      }
    };

    return await this.execute(request);
  }

  private extractCodeSuggestions(content: string): any[] {
    const suggestions = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)\n```/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      suggestions.push({
        language: match[1] || 'unknown',
        code: match[2],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    return suggestions;
  }

  private extractFileChanges(content: string): any[] {
    const changes = [];
    const fileChangeRegex = /(?:create|modify|update|delete)\s+(?:file\s+)?[`"]?([^`"\s]+)[`"]?/gi;
    let match;

    while ((match = fileChangeRegex.exec(content)) !== null) {
      changes.push({
        action: match[0].split(/\s+/)[0].toLowerCase(),
        file: match[1],
        position: match.index
      });
    }

    return changes;
  }

  private generateSessionId(): string {
    return `cursor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public clearConversationHistory(): void {
    this.conversationHistory = [];
    this.sessionId = this.generateSessionId();
    this.logger.info('Conversation history cleared, new session started');
  }

  public getConversationHistory(): any[] {
    return [...this.conversationHistory];
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getCodebaseContext(): any {
    return this.codebaseContext;
  }

  public getAvailableModels(): string[] {
    return [
      'cursor-fast',
      'cursor-smart',
      'cursor-premium'
    ];
  }

  public async switchModel(model: string): Promise<void> {
    if (!this.getAvailableModels().includes(model)) {
      throw new Error(`Model ${model} is not available`);
    }
    
    this.config.metadata = {
      ...this.config.metadata,
      model
    };
    
    this.logger.info(`Switched to model: ${model}`);
  }
}