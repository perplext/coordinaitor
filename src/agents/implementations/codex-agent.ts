import { CLIAgent } from '../cli-agent';
import { AgentConfig, AgentRequest } from '../../interfaces/agent.interface';

export class CodexAgent extends CLIAgent {
  private model: string = 'code-davinci-002';
  private maxTokens: number = 4096;
  private stopSequences: string[] = [];

  constructor(config: AgentConfig) {
    super(config);
    if (config.metadata?.model) {
      this.model = config.metadata.model;
    }
    if (config.metadata?.maxTokens) {
      this.maxTokens = config.metadata.maxTokens;
    }
  }

  protected getCommand(): string {
    return 'codex';
  }

  protected getArgs(): string[] {
    return [
      'complete',
      '--model', this.model,
      '--format', 'json',
      '--no-stream'
    ];
  }

  protected getEnv(): NodeJS.ProcessEnv {
    return {
      OPENAI_API_KEY: this.apiKey || process.env.OPENAI_API_KEY || '',
      CODEX_AGENT_ID: this.config.id,
      OPENAI_API_BASE: process.env.OPENAI_API_BASE || 'https://api.openai.com/v1'
    };
  }

  protected formatInput(request: AgentRequest): string {
    const isCodeGeneration = request.context?.type === 'code' || 
                           request.prompt.toLowerCase().includes('code') ||
                           request.prompt.toLowerCase().includes('function') ||
                           request.prompt.toLowerCase().includes('implement');

    const completion = {
      prompt: this.formatPromptForCodex(request.prompt, request.context),
      max_tokens: this.maxTokens,
      temperature: isCodeGeneration ? 0.2 : 0.7,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      stop: this.stopSequences.length > 0 ? this.stopSequences : undefined,
      metadata: {
        taskId: request.taskId,
        priority: request.priority,
        isCodeGeneration
      }
    };

    return JSON.stringify(completion);
  }

  private formatPromptForCodex(prompt: string, context?: any): string {
    let formattedPrompt = '';

    if (context?.language) {
      formattedPrompt += `# Language: ${context.language}\n`;
    }

    if (context?.existingCode) {
      formattedPrompt += `# Existing code:\n${context.existingCode}\n\n`;
    }

    if (context?.requirements) {
      formattedPrompt += `# Requirements:\n${context.requirements}\n\n`;
    }

    formattedPrompt += prompt;

    if (context?.expectedFormat) {
      formattedPrompt += `\n\n# Expected format:\n${context.expectedFormat}`;
    }

    return formattedPrompt;
  }

  protected parseOutput(output: string): any | null {
    const lines = output.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      if (line.includes('"choices"') && line.includes('"text"')) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.choices && parsed.choices[0]) {
            const choice = parsed.choices[0];
            return {
              content: choice.text || choice.message?.content || '',
              finishReason: choice.finish_reason,
              metadata: {
                model: parsed.model,
                tokensUsed: parsed.usage?.total_tokens,
                promptTokens: parsed.usage?.prompt_tokens,
                completionTokens: parsed.usage?.completion_tokens
              }
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
        reject(new Error('Codex CLI agent failed to start'));
      }, 10000);

      const checkInterval = setInterval(() => {
        if (this.outputBuffer.includes('Ready') || 
            this.outputBuffer.includes('Codex CLI initialized') ||
            this.outputBuffer.includes('OpenAI connection established')) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          this.logger.info('Codex CLI agent ready');
          resolve();
        }
      }, 100);
    });
  }

  public setModel(model: string): void {
    const validModels = ['code-davinci-002', 'code-cushman-001', 'gpt-4', 'gpt-3.5-turbo'];
    if (!validModels.includes(model)) {
      throw new Error(`Invalid model. Must be one of: ${validModels.join(', ')}`);
    }
    this.model = model;
    this.logger.info(`Codex model changed to: ${model}`);
  }

  public setMaxTokens(maxTokens: number): void {
    if (maxTokens < 1 || maxTokens > 8192) {
      throw new Error('Max tokens must be between 1 and 8192');
    }
    this.maxTokens = maxTokens;
  }

  public setStopSequences(sequences: string[]): void {
    this.stopSequences = sequences;
  }
}