import { APIAgent } from '../api-agent';
import { AgentConfig, AgentRequest } from '../../interfaces/agent.interface';
import { AxiosRequestConfig } from 'axios';

export class PerplexityAgent extends APIAgent {
  private conversationHistory: any[] = [];

  constructor(config: AgentConfig) {
    super(config);
  }

  protected getDefaultHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': `MultiAgentOrchestrator-Perplexity/${this.config.version}`,
    };
  }

  protected async validateCredentials(): Promise<void> {
    try {
      // Test with a simple request to validate API key
      const response = await this.httpClient.post('/chat/completions', {
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      });

      this.logger.info('Perplexity AI credentials validated successfully');
    } catch (error) {
      this.logger.error('Failed to validate Perplexity AI credentials:', error);
      throw new Error(`Perplexity AI agent validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

    const model = request.metadata?.model || this.getDefaultModel(request.metadata?.searchEnabled);
    
    const requestBody = {
      model,
      messages,
      max_tokens: request.metadata?.maxTokens || 4096,
      temperature: request.metadata?.temperature || 0.2,
      top_p: request.metadata?.topP || 0.9,
      return_citations: request.metadata?.returnCitations !== false,
      return_images: request.metadata?.returnImages || false,
      return_related_questions: request.metadata?.returnRelatedQuestions || false,
      search_domain_filter: request.metadata?.searchDomainFilter || [],
      search_recency_filter: request.metadata?.searchRecencyFilter || 'auto',
      top_k: request.metadata?.topK || 0,
      stream: request.metadata?.stream || false,
      presence_penalty: request.metadata?.presencePenalty || 0,
      frequency_penalty: request.metadata?.frequencyPenalty || 1
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
      throw new Error('No response choices available from Perplexity AI');
    }

    const content = choice.message?.content || '';
    const usage = response.usage || {};
    
    const totalTokens = (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
    const cost = this.calculateCost(totalTokens);

    // Extract citations if available
    const citations = this.extractCitations(choice.message);
    const relatedQuestions = response.related_questions || [];
    const images = response.images || [];

    // Update conversation history
    this.conversationHistory.push(
      { role: 'user', content: request.prompt },
      { role: 'assistant', content: content }
    );

    // Keep conversation history manageable
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }

    this.logger.info('Perplexity AI response parsed', {
      taskId: request.taskId,
      contentLength: content.length,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      citations: citations.length,
      relatedQuestions: relatedQuestions.length,
      images: images.length,
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
        citations,
        relatedQuestions,
        images,
        searchEnabled: this.isSearchModel(response.model)
      },
      raw: response
    };
  }

  public async search(query: string, options?: {
    domainFilter?: string[];
    recencyFilter?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'auto';
    returnImages?: boolean;
    returnRelatedQuestions?: boolean;
  }): Promise<any> {
    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt: query,
      priority: 'medium',
      metadata: {
        model: 'llama-3.1-sonar-large-128k-online',
        searchEnabled: true,
        returnCitations: true,
        returnImages: options?.returnImages || false,
        returnRelatedQuestions: options?.returnRelatedQuestions || true,
        searchDomainFilter: options?.domainFilter || [],
        searchRecencyFilter: options?.recencyFilter || 'auto',
        temperature: 0.2,
        maxTokens: 2048
      }
    };

    return await this.execute(request);
  }

  public async research(topic: string, depth: 'shallow' | 'medium' | 'deep' = 'medium'): Promise<any> {
    const researchPrompt = this.buildResearchPrompt(topic, depth);
    
    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt: researchPrompt,
      priority: 'medium',
      metadata: {
        model: 'llama-3.1-sonar-large-128k-online',
        searchEnabled: true,
        returnCitations: true,
        returnRelatedQuestions: true,
        temperature: 0.3,
        maxTokens: depth === 'deep' ? 4096 : depth === 'medium' ? 2048 : 1024
      }
    };

    return await this.execute(request);
  }

  public async factCheck(statement: string): Promise<any> {
    const factCheckPrompt = `Please fact-check the following statement and provide sources to verify or refute it:\n\n"${statement}"\n\nProvide detailed analysis with citations.`;
    
    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt: factCheckPrompt,
      priority: 'high',
      metadata: {
        model: 'llama-3.1-sonar-large-128k-online',
        searchEnabled: true,
        returnCitations: true,
        temperature: 0.1,
        maxTokens: 2048
      }
    };

    return await this.execute(request);
  }

  public async findLatestInfo(topic: string, timeframe?: 'hour' | 'day' | 'week' | 'month'): Promise<any> {
    const latestInfoPrompt = `Find the latest information and recent developments about: ${topic}`;
    
    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt: latestInfoPrompt,
      priority: 'medium',
      metadata: {
        model: 'llama-3.1-sonar-large-128k-online',
        searchEnabled: true,
        returnCitations: true,
        returnRelatedQuestions: true,
        searchRecencyFilter: timeframe || 'week',
        temperature: 0.2,
        maxTokens: 2048
      }
    };

    return await this.execute(request);
  }

  public async compareOptions(options: string[], criteria?: string[]): Promise<any> {
    let comparePrompt = `Compare the following options: ${options.join(', ')}`;
    
    if (criteria && criteria.length > 0) {
      comparePrompt += `\n\nUse these criteria for comparison: ${criteria.join(', ')}`;
    }
    
    comparePrompt += '\n\nProvide a detailed comparison with pros and cons for each option, backed by current information and sources.';
    
    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt: comparePrompt,
      priority: 'medium',
      metadata: {
        model: 'llama-3.1-sonar-large-128k-online',
        searchEnabled: true,
        returnCitations: true,
        temperature: 0.3,
        maxTokens: 3000
      }
    };

    return await this.execute(request);
  }

  public async generateSummary(url: string): Promise<any> {
    const summaryPrompt = `Please provide a comprehensive summary of the content at this URL: ${url}`;
    
    const request: AgentRequest = {
      taskId: this.generateTaskId(),
      prompt: summaryPrompt,
      priority: 'medium',
      metadata: {
        model: 'llama-3.1-sonar-large-128k-online',
        searchEnabled: true,
        returnCitations: true,
        temperature: 0.2,
        maxTokens: 1500
      }
    };

    return await this.execute(request);
  }

  private buildResearchPrompt(topic: string, depth: 'shallow' | 'medium' | 'deep'): string {
    const basePrompt = `Research the topic: ${topic}`;
    
    switch (depth) {
      case 'shallow':
        return `${basePrompt}\n\nProvide a brief overview with key points and basic information.`;
      case 'medium':
        return `${basePrompt}\n\nProvide a comprehensive analysis including background, current state, key players, and recent developments.`;
      case 'deep':
        return `${basePrompt}\n\nProvide an in-depth analysis including historical context, detailed examination of all aspects, expert opinions, controversies, future implications, and extensive source material.`;
      default:
        return basePrompt;
    }
  }

  private extractCitations(message: any): any[] {
    const citations = [];
    
    if (message.citations) {
      return message.citations.map((citation: any, index: number) => ({
        index: index + 1,
        url: citation.url,
        title: citation.title,
        snippet: citation.snippet
      }));
    }

    // Fallback: extract from content if citations are inline
    const citationRegex = /\[(\d+)\]/g;
    const content = message.content || '';
    let match;

    while ((match = citationRegex.exec(content)) !== null) {
      citations.push({
        index: parseInt(match[1]),
        position: match.index
      });
    }

    return citations;
  }

  private getDefaultModel(searchEnabled?: boolean): string {
    return searchEnabled !== false 
      ? 'llama-3.1-sonar-large-128k-online'
      : 'llama-3.1-sonar-large-128k-chat';
  }

  private isSearchModel(model: string): boolean {
    return model.includes('online');
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public clearConversationHistory(): void {
    this.conversationHistory = [];
    this.logger.info('Conversation history cleared');
  }

  public getConversationHistory(): any[] {
    return [...this.conversationHistory];
  }

  public getAvailableModels(): string[] {
    return [
      'llama-3.1-sonar-small-128k-online',
      'llama-3.1-sonar-large-128k-online',
      'llama-3.1-sonar-huge-128k-online',
      'llama-3.1-sonar-small-128k-chat',
      'llama-3.1-sonar-large-128k-chat',
      'llama-3.1-8b-instruct',
      'llama-3.1-70b-instruct',
      'mixtral-8x7b-instruct'
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