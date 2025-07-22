import { CLIAgent } from '../cli-agent';
import { AgentConfig, AgentRequest } from '../../interfaces/agent.interface';

export class GeminiAgent extends CLIAgent {
  private model: string = 'gemini-pro';
  private temperature: number = 0.7;

  constructor(config: AgentConfig) {
    super(config);
    if (config.metadata?.model) {
      this.model = config.metadata.model;
    }
    if (config.metadata?.temperature) {
      this.temperature = config.metadata.temperature;
    }
  }

  protected getCommand(): string {
    return 'gemini-cli';
  }

  protected getArgs(): string[] {
    return [
      'chat',
      '--model', this.model,
      '--temperature', this.temperature.toString(),
      '--format', 'json',
      '--stream', 'false'
    ];
  }

  protected getEnv(): NodeJS.ProcessEnv {
    return {
      GOOGLE_GEMINI_API_KEY: this.apiKey || process.env.GOOGLE_GEMINI_API_KEY || '',
      GEMINI_AGENT_ID: this.config.id
    };
  }

  protected formatInput(request: AgentRequest): string {
    const prompt = {
      messages: [{
        role: 'user',
        content: request.prompt
      }],
      systemInstruction: request.context?.systemPrompt || 
        'You are an AI coding assistant integrated into a multi-agent orchestration system.',
      generationConfig: {
        temperature: this.temperature,
        topK: 1,
        topP: 1,
        maxOutputTokens: 8192,
      },
      metadata: {
        taskId: request.taskId,
        priority: request.priority
      }
    };

    return JSON.stringify(prompt);
  }

  protected parseOutput(output: string): any | null {
    const lines = output.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      if (line.includes('"candidates"') && line.includes('"content"')) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.candidates && parsed.candidates[0]?.content) {
            const candidate = parsed.candidates[0];
            return {
              content: candidate.content.parts
                ?.map((part: any) => part.text)
                .join('') || '',
              finishReason: candidate.finishReason,
              safetyRatings: candidate.safetyRatings,
              metadata: {
                model: this.model,
                tokensUsed: parsed.usageMetadata?.totalTokenCount
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
        reject(new Error('Gemini CLI agent failed to start'));
      }, 10000);

      const checkInterval = setInterval(() => {
        if (this.outputBuffer.includes('Ready') || 
            this.outputBuffer.includes('Gemini CLI initialized')) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          this.logger.info('Gemini CLI agent ready');
          resolve();
        }
      }, 100);
    });
  }

  public setModel(model: string): void {
    this.model = model;
    this.logger.info(`Gemini model changed to: ${model}`);
  }

  public setTemperature(temperature: number): void {
    if (temperature < 0 || temperature > 2) {
      throw new Error('Temperature must be between 0 and 2');
    }
    this.temperature = temperature;
    this.logger.info(`Gemini temperature changed to: ${temperature}`);
  }
}