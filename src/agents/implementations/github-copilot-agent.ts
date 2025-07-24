import { APIAgent } from '../api-agent';
import { AgentConfig, AgentRequest } from '../../interfaces/agent.interface';
import { AxiosRequestConfig } from 'axios';

export class GitHubCopilotAgent extends APIAgent {
  private sessionId: string;
  private conversationHistory: any[] = [];

  constructor(config: AgentConfig) {
    super(config);
    this.sessionId = this.generateSessionId();
  }

  protected getDefaultHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': `MultiAgentOrchestrator-Copilot/${this.config.version}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Accept': 'application/vnd.github+json',
    };
  }

  protected async validateCredentials(): Promise<void> {
    try {
      // Test with a simple request to GitHub API
      const response = await this.httpClient.get('/user', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        baseURL: 'https://api.github.com'
      });

      this.logger.info('GitHub Copilot credentials validated successfully', {
        user: response.data.login
      });
    } catch (error) {
      this.logger.error('Failed to validate GitHub Copilot credentials:', error);
      throw new Error(`GitHub Copilot agent validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  protected buildAPIRequest(request: AgentRequest): AxiosRequestConfig {
    const messages = [...this.conversationHistory];
    
    // Add context if provided
    if (request.context) {
      messages.push({
        role: 'system',
        content: `Context: ${JSON.stringify(request.context)}`
      });
    }

    // Add the user message
    messages.push({
      role: 'user',
      content: request.prompt
    });

    const requestBody = {
      messages,
      model: request.metadata?.model || 'gpt-4',
      max_tokens: request.metadata?.maxTokens || 4096,
      temperature: request.metadata?.temperature || 0.1, // Lower temperature for code generation
      top_p: request.metadata?.topP || 0.95,
      stream: request.metadata?.stream || false,
      ...(request.metadata?.systemPrompt && {
        system: request.metadata.systemPrompt
      })
    };

    return {
      method: 'POST',
      url: '/chat/completions',
      baseURL: 'https://api.github.com/copilot',
      data: requestBody,
      headers: this.getDefaultHeaders(),
    };
  }

  protected parseAPIResponse(response: any, request: AgentRequest): any {
    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error('No response choices available from GitHub Copilot');
    }

    const content = choice.message?.content || choice.text || '';
    const usage = response.usage || {};
    
    const totalTokens = (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
    const cost = this.calculateCost(totalTokens);

    // Update conversation history
    this.conversationHistory.push(
      { role: 'user', content: request.prompt },
      { role: 'assistant', content: content }
    );

    // Keep conversation history manageable
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }

    this.logger.info('GitHub Copilot response parsed', {
      taskId: request.taskId,
      contentLength: content.length,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      cost,
      finishReason: choice.finish_reason
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
        sessionId: this.sessionId
      },
      raw: response
    };
  }

  public async generateCode(prompt: string, language?: string, context?: any): Promise<any> {
    const codePrompt = this.buildCodePrompt(prompt, language, context);
    
    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt: codePrompt,
      priority: 'medium',
      metadata: {
        temperature: 0.1, // Very low for code generation
        maxTokens: 2048,
        model: 'gpt-4'
      }
    };

    return await this.execute(request);
  }

  public async explainCode(code: string, language?: string): Promise<any> {
    const explainPrompt = this.buildExplainPrompt(code, language);
    
    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt: explainPrompt,
      priority: 'medium',
      metadata: {
        temperature: 0.3,
        maxTokens: 1024,
        model: 'gpt-4'
      }
    };

    return await this.execute(request);
  }

  public async reviewCode(code: string, language?: string): Promise<any> {
    const reviewPrompt = this.buildReviewPrompt(code, language);
    
    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt: reviewPrompt,
      priority: 'medium',
      metadata: {
        temperature: 0.2,
        maxTokens: 1024,
        model: 'gpt-4'
      }
    };

    return await this.execute(request);
  }

  public async generateTests(code: string, language?: string, framework?: string): Promise<any> {
    const testPrompt = this.buildTestPrompt(code, language, framework);
    
    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt: testPrompt,
      priority: 'medium',
      metadata: {
        temperature: 0.1,
        maxTokens: 2048,
        model: 'gpt-4'
      }
    };

    return await this.execute(request);
  }

  public async fixCode(code: string, error: string, language?: string): Promise<any> {
    const fixPrompt = this.buildFixPrompt(code, error, language);
    
    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt: fixPrompt,
      priority: 'high',
      metadata: {
        temperature: 0.1,
        maxTokens: 2048,
        model: 'gpt-4'
      }
    };

    return await this.execute(request);
  }

  private buildCodePrompt(prompt: string, language?: string, context?: any): string {
    let codePrompt = `Generate ${language ? language + ' ' : ''}code for the following request:\n\n${prompt}`;
    
    if (context) {
      codePrompt += `\n\nContext:\n${JSON.stringify(context, null, 2)}`;
    }
    
    codePrompt += '\n\nPlease provide clean, well-commented, production-ready code.';
    
    return codePrompt;
  }

  private buildExplainPrompt(code: string, language?: string): string {
    return `Explain the following ${language ? language + ' ' : ''}code in detail:\n\n\`\`\`${language || ''}\n${code}\n\`\`\`\n\nProvide a clear explanation of what this code does, how it works, and any important details.`;
  }

  private buildReviewPrompt(code: string, language?: string): string {
    return `Review the following ${language ? language + ' ' : ''}code and provide feedback:\n\n\`\`\`${language || ''}\n${code}\n\`\`\`\n\nPlease identify:\n1. Potential bugs or issues\n2. Performance improvements\n3. Best practices violations\n4. Security concerns\n5. Code quality suggestions`;
  }

  private buildTestPrompt(code: string, language?: string, framework?: string): string {
    let testPrompt = `Generate comprehensive unit tests for the following ${language ? language + ' ' : ''}code:\n\n\`\`\`${language || ''}\n${code}\n\`\`\``;
    
    if (framework) {
      testPrompt += `\n\nUse the ${framework} testing framework.`;
    }
    
    testPrompt += '\n\nInclude tests for:\n1. Normal operation\n2. Edge cases\n3. Error conditions\n4. Boundary values';
    
    return testPrompt;
  }

  private buildFixPrompt(code: string, error: string, language?: string): string {
    return `Fix the following ${language ? language + ' ' : ''}code that is producing this error:\n\nError: ${error}\n\nCode:\n\`\`\`${language || ''}\n${code}\n\`\`\`\n\nPlease provide the corrected code with an explanation of what was wrong and how you fixed it.`;
  }

  private generateSessionId(): string {
    return `copilot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

  public getAvailableModels(): string[] {
    return [
      'gpt-4',
      'gpt-3.5-turbo',
      'gpt-4-turbo-preview'
    ];
  }
}