import {
  QBusinessClient,
  ChatSyncCommand,
  GetApplicationCommand,
  GetIndexCommand,
  ListConversationsCommand,
  ListMessagesCommand,
} from '@aws-sdk/client-qbusiness';
import { APIAgent } from '../api-agent';
import { AgentConfig, AgentRequest } from '../../interfaces/agent.interface';

export class AmazonQAgent extends APIAgent {
  private qBusinessClient: QBusinessClient;
  private applicationId: string;
  private indexId?: string;
  private region: string;
  private conversationId?: string;
  private parentMessageId?: string;

  constructor(config: AgentConfig) {
    super(config);
    
    this.region = config.metadata?.region || process.env.AWS_REGION || 'us-east-1';
    this.applicationId = config.metadata?.applicationId || process.env.AMAZON_Q_APPLICATION_ID || '';
    this.indexId = config.metadata?.indexId || process.env.AMAZON_Q_INDEX_ID;

    if (!this.applicationId) {
      throw new Error('Amazon Q Application ID is required');
    }

    this.qBusinessClient = new QBusinessClient({
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
      'User-Agent': `MultiAgentOrchestrator-AmazonQ/${this.config.version}`,
    };
  }

  protected async validateCredentials(): Promise<void> {
    try {
      // Test by getting application details
      const command = new GetApplicationCommand({
        applicationId: this.applicationId,
      });

      const response = await this.qBusinessClient.send(command);
      this.logger.info('Amazon Q credentials validated successfully', {
        applicationId: this.applicationId,
        applicationName: response.displayName,
        status: response.status
      });

      if (response.status !== 'ACTIVE') {
        throw new Error(`Amazon Q application is not active. Status: ${response.status}`);
      }

      // Validate index if specified
      if (this.indexId) {
        await this.validateIndex();
      }
    } catch (error) {
      this.logger.error('Failed to validate Amazon Q credentials:', error);
      throw new Error(`Amazon Q agent validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async validateIndex(): Promise<void> {
    if (!this.indexId) return;

    try {
      const command = new GetIndexCommand({
        applicationId: this.applicationId,
        indexId: this.indexId,
      });

      const response = await this.qBusinessClient.send(command);
      this.logger.info('Amazon Q index validated', {
        indexId: this.indexId,
        indexName: response.displayName,
        status: response.status
      });

      if (response.status !== 'ACTIVE') {
        this.logger.warn(`Amazon Q index is not active. Status: ${response.status}`);
      }
    } catch (error) {
      this.logger.error('Failed to validate Amazon Q index:', error);
      throw new Error(`Amazon Q index validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  protected buildAPIRequest(request: AgentRequest): any {
    const attachments = [];

    // Add any file attachments if provided
    if (request.metadata?.attachments) {
      for (const attachment of request.metadata.attachments) {
        attachments.push({
          name: attachment.name,
          data: attachment.data,
        });
      }
    }

    return {
      applicationId: this.applicationId,
      userMessage: request.prompt,
      ...(this.conversationId && { conversationId: this.conversationId }),
      ...(this.parentMessageId && { parentMessageId: this.parentMessageId }),
      ...(attachments.length > 0 && { attachments }),
      ...(request.metadata?.attributeFilter && { 
        attributeFilter: request.metadata.attributeFilter 
      }),
      ...(request.metadata?.chatMode && { 
        chatMode: request.metadata.chatMode 
      }),
      ...(request.metadata?.userId && { 
        userId: request.metadata.userId 
      }),
    };
  }

  protected async onExecute(request: AgentRequest): Promise<any> {
    const commandInput = this.buildAPIRequest(request);
    
    try {
      const command = new ChatSyncCommand(commandInput);
      const response = await this.qBusinessClient.send(command);
      
      // Store conversation context for follow-up messages
      this.conversationId = response.conversationId;
      this.parentMessageId = response.systemMessage;

      return this.parseAPIResponse(response, request);
    } catch (error) {
      this.logger.error('Amazon Q execution failed:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('AccessDenied')) {
          throw new Error('Access denied to Amazon Q application');
        } else if (error.message.includes('ThrottlingException')) {
          throw new Error('Amazon Q rate limit exceeded');
        } else if (error.message.includes('ValidationException')) {
          throw new Error('Invalid request parameters for Amazon Q');
        }
      }
      
      throw error;
    }
  }

  protected parseAPIResponse(response: any, request: AgentRequest): any {
    const systemMessage = response.systemMessage || '';
    const userMessageId = response.userMessageId;
    const conversationId = response.conversationId;
    const sourceAttributions = response.sourceAttributions || [];
    const failedAttachments = response.failedAttachments || [];

    // Calculate approximate cost (Amazon Q pricing varies)
    const messageLength = systemMessage.length;
    const cost = this.calculateCost(Math.ceil(messageLength / 4)); // Rough token estimate

    this.logger.info('Amazon Q response parsed', {
      taskId: request.taskId,
      conversationId,
      messageLength,
      sourceAttributions: sourceAttributions.length,
      failedAttachments: failedAttachments.length,
      cost
    });

    // Extract citations from source attributions
    const citations = sourceAttributions.map((attr: any, index: number) => ({
      index: index + 1,
      title: attr.title,
      url: attr.url,
      snippet: attr.snippet,
      citationNumber: attr.citationNumber
    }));

    return {
      content: systemMessage,
      metadata: {
        conversationId,
        userMessageId,
        sourceAttributions: citations,
        failedAttachments,
        cost,
        hasKnowledgeBase: sourceAttributions.length > 0
      },
      raw: response
    };
  }

  public async getConversationHistory(conversationId?: string): Promise<any[]> {
    const targetConversationId = conversationId || this.conversationId;
    
    if (!targetConversationId) {
      throw new Error('No conversation ID available');
    }

    try {
      const command = new ListMessagesCommand({
        applicationId: this.applicationId,
        conversationId: targetConversationId,
      });

      const response = await this.qBusinessClient.send(command);
      return response.messages || [];
    } catch (error) {
      this.logger.error('Failed to get conversation history:', error);
      throw error;
    }
  }

  public async listConversations(): Promise<any[]> {
    try {
      const command = new ListConversationsCommand({
        applicationId: this.applicationId,
      });

      const response = await this.qBusinessClient.send(command);
      return response.conversations || [];
    } catch (error) {
      this.logger.error('Failed to list conversations:', error);
      throw error;
    }
  }

  public startNewConversation(): void {
    this.conversationId = undefined;
    this.parentMessageId = undefined;
    this.logger.info('Started new conversation');
  }

  public setConversationContext(conversationId: string, parentMessageId?: string): void {
    this.conversationId = conversationId;
    this.parentMessageId = parentMessageId;
    this.logger.info('Set conversation context', { conversationId, parentMessageId });
  }

  public getConversationContext(): { conversationId?: string; parentMessageId?: string } {
    return {
      conversationId: this.conversationId,
      parentMessageId: this.parentMessageId
    };
  }

  public getApplicationId(): string {
    return this.applicationId;
  }

  public getIndexId(): string | undefined {
    return this.indexId;
  }

  public async setAttributeFilter(filter: any): Promise<void> {
    // This would be used in subsequent requests
    this.config.metadata = {
      ...this.config.metadata,
      attributeFilter: filter
    };
    
    this.logger.info('Set attribute filter', { filter });
  }

  public async setChatMode(mode: 'RETRIEVAL_MODE' | 'CREATOR_MODE' | 'PLUGIN_MODE'): Promise<void> {
    this.config.metadata = {
      ...this.config.metadata,
      chatMode: mode
    };
    
    this.logger.info(`Set chat mode to: ${mode}`);
  }
}