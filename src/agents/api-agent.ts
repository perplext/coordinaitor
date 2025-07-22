import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { BaseAgentImplementation } from './base-agent';
import { AgentConfig, AgentRequest } from '../interfaces/agent.interface';

export abstract class APIAgent extends BaseAgentImplementation {
  protected httpClient: AxiosInstance;
  protected apiKey: string;
  protected endpoint: string;

  constructor(config: AgentConfig) {
    super(config);
    
    this.apiKey = config.apiKey || process.env[`${config.provider.toUpperCase()}_API_KEY`] || '';
    this.endpoint = config.endpoint || '';

    this.httpClient = axios.create({
      baseURL: this.endpoint,
      timeout: config.timeout || 60000,
      headers: this.getDefaultHeaders()
    });

    this.setupInterceptors();
  }

  protected getDefaultHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'User-Agent': `MultiAgentOrchestrator/${this.config.version}`
    };
  }

  protected setupInterceptors(): void {
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug('API Request:', {
          method: config.method,
          url: config.url,
          headers: config.headers
        });
        return config;
      },
      (error) => {
        this.logger.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug('API Response:', {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
        return response;
      },
      (error) => {
        this.logger.error('API Response Error:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        return Promise.reject(error);
      }
    );
  }

  protected async onInitialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error(`API key not provided for ${this.config.name}`);
    }

    if (!this.endpoint) {
      throw new Error(`API endpoint not provided for ${this.config.name}`);
    }

    await this.validateCredentials();
  }

  protected abstract validateCredentials(): Promise<void>;

  protected async onExecute(request: AgentRequest): Promise<any> {
    const apiRequest = this.buildAPIRequest(request);
    
    try {
      const response = await this.httpClient.request(apiRequest);
      return this.parseAPIResponse(response.data, request);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded');
        } else if (error.response?.status === 401) {
          throw new Error('Authentication failed');
        } else if (error.response?.status === 503) {
          throw new Error('Service temporarily unavailable');
        }
      }
      throw error;
    }
  }

  protected abstract buildAPIRequest(request: AgentRequest): AxiosRequestConfig;
  protected abstract parseAPIResponse(response: any, request: AgentRequest): any;

  protected async onShutdown(): Promise<void> {
    // Most API agents don't need cleanup
    this.logger.info('API agent shutdown complete');
  }

  protected calculateCost(tokensUsed: number): number {
    if (!this.config.cost) return 0;

    if (this.config.cost.perToken) {
      return tokensUsed * this.config.cost.perToken;
    } else if (this.config.cost.perRequest) {
      return this.config.cost.perRequest;
    }

    return 0;
  }
}