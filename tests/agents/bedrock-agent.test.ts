import { BedrockAgent } from '../../src/agents/implementations/bedrock-agent';
import { AgentConfig, AgentRequest } from '../../src/interfaces/agent.interface';

// Mock AWS SDK
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  InvokeModelCommand: jest.fn(),
  InvokeModelWithResponseStreamCommand: jest.fn(),
}));

describe('BedrockAgent', () => {
  let agent: BedrockAgent;
  let mockConfig: AgentConfig;

  beforeEach(() => {
    mockConfig = {
      id: 'bedrock-test',
      name: 'Test Bedrock Agent',
      type: 'api',
      provider: 'aws',
      version: '1.0',
      endpoint: 'https://bedrock.us-east-1.amazonaws.com',
      maxConcurrentTasks: 5,
      timeout: 300000,
      capabilities: [],
      cost: {
        perToken: 0.00001,
      },
      metadata: {
        region: 'us-east-1',
        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      },
    };

    // Set up environment variables
    process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
    process.env.AWS_REGION = 'us-east-1';

    agent = new BedrockAgent(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_REGION;
  });

  describe('initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(agent.config.id).toBe('bedrock-test');
      expect(agent.config.provider).toBe('aws');
    });

    it('should use default model if not specified', () => {
      const configWithoutModel = { ...mockConfig };
      delete configWithoutModel.metadata?.modelId;
      const agentWithDefault = new BedrockAgent(configWithoutModel);
      expect(agentWithDefault.getCurrentModel()).toBe('anthropic.claude-3-sonnet-20240229-v1:0');
    });

    it('should use custom model if specified', () => {
      expect(agent.getCurrentModel()).toBe('anthropic.claude-3-sonnet-20240229-v1:0');
    });
  });

  describe('validateCredentials', () => {
    it('should validate credentials successfully', async () => {
      const mockSend = jest.fn().mockResolvedValue({
        body: new TextEncoder().encode('{"content":[{"text":"Hello"}]}'),
      });
      
      (agent as any).bedrockClient.send = mockSend;

      await expect(agent['validateCredentials']()).resolves.not.toThrow();
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should throw error on credential validation failure', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('Invalid credentials'));
      (agent as any).bedrockClient.send = mockSend;

      await expect(agent['validateCredentials']()).rejects.toThrow('Bedrock agent validation failed');
    });
  });

  describe('buildAPIRequest', () => {
    it('should build correct API request', () => {
      const request: AgentRequest = {
        taskId: 'test-task',
        prompt: 'Hello, world!',
        priority: 'medium',
      };

      const apiRequest = agent['buildAPIRequest'](request);

      expect(apiRequest).toMatchObject({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        temperature: 0.7,
        top_p: 0.9,
        messages: [
          {
            role: 'user',
            content: 'Hello, world!',
          },
        ],
      });
    });

    it('should include context in request if provided', () => {
      const request: AgentRequest = {
        taskId: 'test-task',
        prompt: 'Hello, world!',
        priority: 'medium',
        context: { previousResult: 'Some context' },
      };

      const apiRequest = agent['buildAPIRequest'](request);

      expect(apiRequest.messages).toHaveLength(2);
      expect(apiRequest.messages[0].content).toContain('Context:');
      expect(apiRequest.messages[1].content).toBe('Hello, world!');
    });

    it('should include system prompt if provided', () => {
      const request: AgentRequest = {
        taskId: 'test-task',
        prompt: 'Hello, world!',
        priority: 'medium',
        metadata: {
          systemPrompt: 'You are a helpful assistant',
        },
      };

      const apiRequest = agent['buildAPIRequest'](request);

      expect(apiRequest.system).toBe('You are a helpful assistant');
    });

    it('should use custom parameters if provided', () => {
      const request: AgentRequest = {
        taskId: 'test-task',
        prompt: 'Hello, world!',
        priority: 'medium',
        metadata: {
          maxTokens: 1000,
          temperature: 0.5,
          topP: 0.8,
        },
      };

      const apiRequest = agent['buildAPIRequest'](request);

      expect(apiRequest.max_tokens).toBe(1000);
      expect(apiRequest.temperature).toBe(0.5);
      expect(apiRequest.top_p).toBe(0.8);
    });
  });

  describe('parseAPIResponse', () => {
    it('should parse successful response correctly', () => {
      const mockResponse = {
        content: [{ text: 'Hello! How can I help you?' }],
        usage: {
          input_tokens: 10,
          output_tokens: 15,
        },
        stop_reason: 'end_turn',
      };

      const request: AgentRequest = {
        taskId: 'test-task',
        prompt: 'Hello',
        priority: 'medium',
      };

      const result = agent['parseAPIResponse'](mockResponse, request);

      expect(result).toMatchObject({
        content: 'Hello! How can I help you?',
        metadata: {
          model: 'anthropic.claude-3-sonnet-20240229-v1:0',
          tokens: {
            input: 10,
            output: 15,
            total: 25,
          },
          finishReason: 'end_turn',
        },
        raw: mockResponse,
      });
    });

    it('should handle response without usage information', () => {
      const mockResponse = {
        content: [{ text: 'Response without usage' }],
      };

      const request: AgentRequest = {
        taskId: 'test-task',
        prompt: 'Hello',
        priority: 'medium',
      };

      const result = agent['parseAPIResponse'](mockResponse, request);

      expect(result.metadata.tokens).toMatchObject({
        input: 0,
        output: 0,
        total: 0,
      });
    });
  });

  describe('model management', () => {
    it('should switch models successfully', async () => {
      const mockSend = jest.fn().mockResolvedValue({
        body: new TextEncoder().encode('{"content":[{"text":"Test"}]}'),
      });
      (agent as any).bedrockClient.send = mockSend;

      const newModel = 'anthropic.claude-3-opus-20240229-v1:0';
      await agent.switchModel(newModel);

      expect(agent.getCurrentModel()).toBe(newModel);
    });

    it('should return available models', () => {
      const models = agent.getAvailableModels();
      
      expect(models).toContain('anthropic.claude-3-opus-20240229-v1:0');
      expect(models).toContain('anthropic.claude-3-sonnet-20240229-v1:0');
      expect(models).toContain('anthropic.claude-3-haiku-20240307-v1:0');
      expect(models).toContain('amazon.titan-text-express-v1');
    });
  });

  describe('streaming', () => {
    it('should enable/disable streaming', () => {
      expect(agent.isStreamingEnabled()).toBe(false);
      
      agent.enableStreaming(true);
      expect(agent.isStreamingEnabled()).toBe(true);
      
      agent.enableStreaming(false);
      expect(agent.isStreamingEnabled()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('API Error'));
      (agent as any).bedrockClient.send = mockSend;

      const request: AgentRequest = {
        taskId: 'test-task',
        prompt: 'Hello',
        priority: 'medium',
      };

      await expect(agent['onExecute'](request)).rejects.toThrow('API Error');
    });
  });

  describe('cost calculation', () => {
    it('should calculate cost correctly', () => {
      const tokensUsed = 1000;
      const cost = agent['calculateCost'](tokensUsed);
      
      expect(cost).toBe(0.01); // 1000 * 0.00001
    });

    it('should return 0 cost if no cost config provided', () => {
      const configWithoutCost = { ...mockConfig };
      delete configWithoutCost.cost;
      const agentWithoutCost = new BedrockAgent(configWithoutCost);
      
      const cost = agentWithoutCost['calculateCost'](1000);
      expect(cost).toBe(0);
    });
  });
});