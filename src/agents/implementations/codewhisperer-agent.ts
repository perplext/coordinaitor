import {
  CodeWhispererClient,
  GenerateCompletionsCommand,
  ListCodeAnalysisFindings,
  CreateCodeReviewCommand,
  GetCodeAnalysisCommand,
} from '@aws-sdk/client-codewhisperer';
import { APIAgent } from '../api-agent';
import { AgentConfig, AgentRequest } from '../../interfaces/agent.interface';

export class CodeWhispererAgent extends APIAgent {
  private codewhispererClient: CodeWhispererClient;
  private region: string;
  private sessionId: string;

  constructor(config: AgentConfig) {
    super(config);
    
    this.region = config.metadata?.region || process.env.AWS_REGION || 'us-east-1';
    this.sessionId = this.generateSessionId();

    this.codewhispererClient = new CodeWhispererClient({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        sessionToken: process.env.AWS_SESSION_TOKEN,
      },
    });
  }

  protected getDefaultHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'User-Agent': `MultiAgentOrchestrator-CodeWhisperer/${this.config.version}`,
      'X-Session-Id': this.sessionId,
    };
  }

  protected async validateCredentials(): Promise<void> {
    try {
      // Test with a simple completion request to validate credentials
      const command = new GenerateCompletionsCommand({
        fileContext: {
          filename: 'test.js',
          leftContext: 'function hello() {',
          rightContext: '}',
        },
        maxResults: 1,
        nextToken: undefined,
      });

      await this.codewhispererClient.send(command);
      this.logger.info('CodeWhisperer credentials validated successfully');
    } catch (error) {
      this.logger.error('Failed to validate CodeWhisperer credentials:', error);
      throw new Error(`CodeWhisperer agent validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  protected buildAPIRequest(request: AgentRequest): any {
    // CodeWhisperer uses specific request format
    const filename = request.metadata?.filename || 'code.js';
    const language = this.detectLanguage(filename);
    
    // Extract code context from prompt
    const { leftContext, rightContext, cursorPosition } = this.parseCodeContext(request.prompt);

    return {
      fileContext: {
        filename,
        leftContext,
        rightContext,
        language,
      },
      maxResults: request.metadata?.maxResults || 5,
      nextToken: request.metadata?.nextToken,
      supplementalContexts: request.metadata?.supplementalContexts || [],
    };
  }

  protected async onExecute(request: AgentRequest): Promise<any> {
    const requestData = this.buildAPIRequest(request);
    
    try {
      if (request.metadata?.requestType === 'code-review') {
        return await this.performCodeReview(request);
      } else if (request.metadata?.requestType === 'security-scan') {
        return await this.performSecurityScan(request);
      } else {
        return await this.generateCompletions(requestData, request);
      }
    } catch (error) {
      this.logger.error('CodeWhisperer execution failed:', error);
      throw error;
    }
  }

  private async generateCompletions(requestData: any, request: AgentRequest): Promise<any> {
    const command = new GenerateCompletionsCommand(requestData);
    const response = await this.codewhispererClient.send(command);
    
    return this.parseAPIResponse(response, request);
  }

  private async performCodeReview(request: AgentRequest): Promise<any> {
    const codeContent = request.metadata?.codeContent || request.prompt;
    const language = request.metadata?.language || 'javascript';
    
    try {
      const command = new CreateCodeReviewCommand({
        codeReviewTitleText: `Code review for ${request.taskId}`,
        sourceCodeType: language,
        codeContent: Buffer.from(codeContent),
      });

      const response = await this.codewhispererClient.send(command);
      
      return {
        content: 'Code review initiated',
        metadata: {
          reviewId: response.codeReviewArn,
          status: response.status,
          type: 'code-review'
        },
        raw: response
      };
    } catch (error) {
      this.logger.error('Code review failed:', error);
      throw error;
    }
  }

  private async performSecurityScan(request: AgentRequest): Promise<any> {
    const codeContent = request.metadata?.codeContent || request.prompt;
    
    try {
      // Note: This is a placeholder as the actual security scanning API may differ
      const analysisId = `analysis_${Date.now()}`;
      
      return {
        content: 'Security scan initiated',
        metadata: {
          analysisId,
          status: 'in_progress',
          type: 'security-scan'
        }
      };
    } catch (error) {
      this.logger.error('Security scan failed:', error);
      throw error;
    }
  }

  protected parseAPIResponse(response: any, request: AgentRequest): any {
    const completions = response.completions || [];
    const cost = this.calculateCost(completions.length); // Rough estimate

    this.logger.info('CodeWhisperer response parsed', {
      taskId: request.taskId,
      completions: completions.length,
      cost
    });

    // Format completions for better usability
    const suggestions = completions.map((completion: any, index: number) => ({
      index: index + 1,
      content: completion.content,
      references: completion.references || [],
      mostRelevantMissingImports: completion.mostRelevantMissingImports || [],
      isTruncated: completion.isTruncated || false,
    }));

    return {
      content: this.formatCompletionsAsText(suggestions),
      metadata: {
        suggestions,
        totalSuggestions: completions.length,
        nextToken: response.nextToken,
        cost,
        sessionId: this.sessionId,
        type: 'code-completion'
      },
      raw: response
    };
  }

  public async generateCode(prompt: string, filename: string, leftContext?: string, rightContext?: string): Promise<any> {
    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt,
      priority: 'medium',
      metadata: {
        filename,
        leftContext: leftContext || '',
        rightContext: rightContext || '',
        maxResults: 5
      }
    };

    return await this.execute(request);
  }

  public async getCodeSuggestions(
    code: string, 
    cursorPosition: number, 
    filename: string, 
    maxResults: number = 3
  ): Promise<any> {
    const leftContext = code.substring(0, cursorPosition);
    const rightContext = code.substring(cursorPosition);

    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt: `${leftContext}|CURSOR|${rightContext}`,
      priority: 'medium',
      metadata: {
        filename,
        leftContext,
        rightContext,
        maxResults,
        cursorPosition
      }
    };

    return await this.execute(request);
  }

  public async reviewCode(code: string, language: string): Promise<any> {
    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt: code,
      priority: 'medium',
      metadata: {
        requestType: 'code-review',
        codeContent: code,
        language
      }
    };

    return await this.execute(request);
  }

  public async scanForSecurity(code: string, language: string): Promise<any> {
    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt: code,
      priority: 'high',
      metadata: {
        requestType: 'security-scan',
        codeContent: code,
        language
      }
    };

    return await this.execute(request);
  }

  public async addSupplementalContext(contexts: any[]): Promise<void> {
    this.config.metadata = {
      ...this.config.metadata,
      supplementalContexts: contexts
    };

    this.logger.info('Added supplemental contexts', { count: contexts.length });
  }

  private parseCodeContext(prompt: string): { leftContext: string; rightContext: string; cursorPosition: number } {
    const cursorMarker = '|CURSOR|';
    const cursorIndex = prompt.indexOf(cursorMarker);
    
    if (cursorIndex !== -1) {
      return {
        leftContext: prompt.substring(0, cursorIndex),
        rightContext: prompt.substring(cursorIndex + cursorMarker.length),
        cursorPosition: cursorIndex
      };
    }

    // If no cursor marker, assume cursor is at the end
    return {
      leftContext: prompt,
      rightContext: '',
      cursorPosition: prompt.length
    };
  }

  private detectLanguage(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'kt': 'kotlin',
      'scala': 'scala',
      'swift': 'swift',
      'sh': 'shell',
      'sql': 'sql',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'xml': 'xml'
    };

    return languageMap[extension || ''] || 'text';
  }

  private formatCompletionsAsText(suggestions: any[]): string {
    if (suggestions.length === 0) {
      return 'No code suggestions available.';
    }

    let result = `Generated ${suggestions.length} code suggestion${suggestions.length > 1 ? 's' : ''}:\n\n`;
    
    suggestions.forEach((suggestion, index) => {
      result += `## Suggestion ${index + 1}\n`;
      result += '```\n';
      result += suggestion.content;
      result += '\n```\n';
      
      if (suggestion.references.length > 0) {
        result += `*References: ${suggestion.references.map((r: any) => r.licenseName || 'Unknown').join(', ')}*\n`;
      }
      
      if (suggestion.mostRelevantMissingImports.length > 0) {
        result += `*Missing imports: ${suggestion.mostRelevantMissingImports.join(', ')}*\n`;
      }
      
      result += '\n';
    });

    return result;
  }

  private generateSessionId(): string {
    return `cw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getSupportedLanguages(): string[] {
    return [
      'javascript',
      'typescript',
      'python',
      'java',
      'cpp',
      'c',
      'csharp',
      'php',
      'ruby',
      'go',
      'rust',
      'kotlin',
      'scala',
      'swift',
      'shell',
      'sql',
      'html',
      'css',
      'json',
      'yaml',
      'xml'
    ];
  }
}