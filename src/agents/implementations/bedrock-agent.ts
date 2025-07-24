import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { APIAgent } from '../api-agent';
import { AgentConfig, AgentRequest } from '../../interfaces/agent.interface';

export class BedrockAgent extends APIAgent {
  private bedrockClient: BedrockRuntimeClient;
  private modelId: string;
  private region: string;
  private streamEnabled: boolean;

  constructor(config: AgentConfig) {
    super(config);
    
    this.region = config.metadata?.region || process.env.AWS_REGION || 'us-east-1';
    this.modelId = config.metadata?.modelId || 'anthropic.claude-3-sonnet-20240229-v1:0';
    this.streamEnabled = config.metadata?.streamEnabled || false;

    this.bedrockClient = new BedrockRuntimeClient({
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
      'User-Agent': `MultiAgentOrchestrator-Bedrock/${this.config.version}`,
    };
  }

  protected async validateCredentials(): Promise<void> {
    try {
      // Test with a simple invoke to validate credentials and model access
      const testCommand = new InvokeModelCommand({
        modelId: this.modelId,
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 10,
          messages: [{
            role: 'user',
            content: 'Hello'
          }]
        }),
        contentType: 'application/json',
        accept: 'application/json',
      });

      await this.bedrockClient.send(testCommand);
      this.logger.info('Bedrock credentials validated successfully');
    } catch (error) {
      this.logger.error('Failed to validate Bedrock credentials:', error);
      throw new Error(`Bedrock agent validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  protected buildAPIRequest(request: AgentRequest): any {
    // For Bedrock, we'll use the AWS SDK directly instead of axios
    const maxTokens = request.metadata?.maxTokens || 4096;
    const temperature = request.metadata?.temperature || 0.7;
    const topP = request.metadata?.topP || 0.9;

    const messages = [];
    
    // Add context if provided
    if (request.context) {
      messages.push({
        role: 'user',
        content: `Context: ${JSON.stringify(request.context)}`
      });
    }

    // Add the main prompt
    messages.push({
      role: 'user',
      content: request.prompt
    });

    return {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      messages,
      ...(request.metadata?.systemPrompt && {
        system: request.metadata.systemPrompt
      })
    };
  }

  protected async onExecute(request: AgentRequest): Promise<any> {
    const body = this.buildAPIRequest(request);
    
    try {
      if (this.streamEnabled) {
        return await this.invokeWithStream(body, request);
      } else {
        return await this.invokeStandard(body, request);
      }
    } catch (error) {
      this.logger.error('Bedrock execution failed:', error);
      throw error;
    }
  }

  private async invokeStandard(body: any, request: AgentRequest): Promise<any> {
    const command = new InvokeModelCommand({
      modelId: this.modelId,
      body: JSON.stringify(body),
      contentType: 'application/json',
      accept: 'application/json',
    });

    const response = await this.bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    return this.parseAPIResponse(responseBody, request);
  }

  private async invokeWithStream(body: any, request: AgentRequest): Promise<any> {
    const command = new InvokeModelWithResponseStreamCommand({
      modelId: this.modelId,
      body: JSON.stringify(body),
      contentType: 'application/json',
      accept: 'application/json',
    });

    const response = await this.bedrockClient.send(command);
    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    if (response.body) {
      for await (const chunk of response.body) {
        if (chunk.chunk?.bytes) {
          const chunkData = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes));
          
          if (chunkData.type === 'content_block_delta' && chunkData.delta?.text) {
            fullContent += chunkData.delta.text;
            
            // Emit streaming event
            this.emit('stream', {
              agentId: this.config.id,
              taskId: request.taskId,
              content: chunkData.delta.text,
              partial: true
            });
          } else if (chunkData.type === 'message_start') {
            inputTokens = chunkData.message?.usage?.input_tokens || 0;
          } else if (chunkData.type === 'message_delta') {
            outputTokens = chunkData.delta?.usage?.output_tokens || 0;
          }
        }
      }
    }

    return this.parseAPIResponse({
      content: [{ text: fullContent }],
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens
      }
    }, request);
  }

  protected parseAPIResponse(response: any, request: AgentRequest): any {
    const content = response.content?.[0]?.text || response.completion || '';
    const usage = response.usage || {};
    
    const totalTokens = (usage.input_tokens || 0) + (usage.output_tokens || 0);
    const cost = this.calculateCost(totalTokens);

    this.logger.info('Bedrock response parsed', {
      taskId: request.taskId,
      contentLength: content.length,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cost
    });

    return {
      content,
      metadata: {
        model: this.modelId,
        tokens: {
          input: usage.input_tokens,
          output: usage.output_tokens,
          total: totalTokens
        },
        cost,
        finishReason: response.stop_reason || 'complete'
      },
      raw: response
    };
  }

  public async switchModel(modelId: string): Promise<void> {
    this.modelId = modelId;
    this.logger.info(`Switched to model: ${modelId}`);
    
    // Validate the new model
    await this.validateCredentials();
  }

  public getAvailableModels(): string[] {
    return [
      'anthropic.claude-3-opus-20240229-v1:0',
      'anthropic.claude-3-sonnet-20240229-v1:0',
      'anthropic.claude-3-haiku-20240307-v1:0',
      'anthropic.claude-v2:1',
      'anthropic.claude-v2',
      'amazon.titan-text-express-v1',
      'amazon.titan-text-lite-v1',
      'ai21.j2-ultra-v1',
      'ai21.j2-mid-v1',
      'cohere.command-text-v14',
      'cohere.command-light-text-v14',
      'meta.llama2-13b-chat-v1',
      'meta.llama2-70b-chat-v1'
    ];
  }

  public getCurrentModel(): string {
    return this.modelId;
  }

  public enableStreaming(enabled: boolean): void {
    this.streamEnabled = enabled;
    this.logger.info(`Streaming ${enabled ? 'enabled' : 'disabled'}`);
  }

  public isStreamingEnabled(): boolean {
    return this.streamEnabled;
  }
}