import { CLIAgent } from '../cli-agent';
import { AgentConfig, AgentRequest } from '../../interfaces/agent.interface';

export class ClaudeAgent extends CLIAgent {
  private sessionId: string | null = null;
  private conversationHistory: any[] = [];

  constructor(config: AgentConfig) {
    super(config);
  }

  protected getCommand(): string {
    return 'claude-code';
  }

  protected getArgs(): string[] {
    return [
      '--mode', 'non-interactive',
      '--format', 'json',
      '--no-emoji'
    ];
  }

  protected getEnv(): NodeJS.ProcessEnv {
    return {
      ANTHROPIC_API_KEY: this.apiKey || process.env.ANTHROPIC_API_KEY || '',
      CLAUDE_CODE_AGENT_ID: this.config.id,
      CLAUDE_CODE_LOG_LEVEL: 'error'
    };
  }

  protected formatInput(request: AgentRequest): string {
    const message = {
      type: 'message',
      role: 'user',
      content: request.prompt,
      metadata: {
        taskId: request.taskId,
        priority: request.priority,
        context: request.context
      }
    };

    return JSON.stringify(message);
  }

  protected parseOutput(output: string): any | null {
    const lines = output.split('\n').filter(line => line.trim());
    
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('{') && line.includes('"type":"message"')) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'message' && parsed.role === 'assistant') {
            return {
              content: parsed.content,
              metadata: parsed.metadata || {},
              toolCalls: parsed.tool_calls || []
            };
          }
        } catch (e) {
          continue;
        }
      }
    }

    return null;
  }

  protected async waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Claude Code agent failed to start'));
      }, 10000);

      const checkInterval = setInterval(() => {
        if (this.outputBuffer.includes('"type":"ready"') || 
            this.outputBuffer.includes('Ready to receive messages')) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          this.logger.info('Claude Code agent ready');
          resolve();
        }
      }, 100);
    });
  }

  protected async onExecute(request: AgentRequest): Promise<any> {
    this.conversationHistory.push({
      role: 'user',
      content: request.prompt,
      timestamp: new Date()
    });

    const result = await super.onExecute(request);

    this.conversationHistory.push({
      role: 'assistant',
      content: result.content,
      timestamp: new Date()
    });

    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-10);
    }

    return result;
  }

  public getConversationHistory(): any[] {
    return [...this.conversationHistory];
  }

  public clearConversationHistory(): void {
    this.conversationHistory = [];
  }
}