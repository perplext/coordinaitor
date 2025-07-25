import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { toast } from 'react-hot-toast';

export interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  retryConfig?: {
    maxRetries?: number;
    retryDelay?: number;
    retryCondition?: (error: AxiosError) => boolean;
  };
  onError?: (error: any) => void;
  onUnauthorized?: () => void;
}

export interface RequestOptions extends AxiosRequestConfig {
  skipErrorHandling?: boolean;
  retry?: boolean;
  retryCount?: number;
}

class ApiClient {
  private client: AxiosInstance;
  private config: ApiClientConfig;
  private refreshTokenPromise: Promise<any> | null = null;

  constructor(config: ApiClientConfig = {}) {
    this.config = {
      baseURL: config.baseURL || process.env.REACT_APP_API_URL || '/api',
      timeout: config.timeout || 30000,
      retryConfig: {
        maxRetries: config.retryConfig?.maxRetries || 3,
        retryDelay: config.retryConfig?.retryDelay || 1000,
        retryCondition: config.retryConfig?.retryCondition || this.defaultRetryCondition,
      },
      onError: config.onError,
      onUnauthorized: config.onUnauthorized || (() => {
        window.location.href = '/login';
      }),
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request ID
        config.headers['X-Request-ID'] = this.generateRequestId();

        // Add timestamp
        config.metadata = { startTime: Date.now() };

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Log response time
        const duration = Date.now() - (response.config.metadata?.startTime || 0);
        console.debug(`API ${response.config.method?.toUpperCase()} ${response.config.url} completed in ${duration}ms`);

        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // Handle network errors
        if (!error.response) {
          return Promise.reject({
            ...error,
            message: 'Network error. Please check your connection.',
            code: 'NETWORK_ERROR',
          });
        }

        // Handle 401 Unauthorized
        if (error.response.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          // Try to refresh token
          if (this.refreshTokenPromise === null) {
            this.refreshTokenPromise = this.refreshToken();
          }

          try {
            await this.refreshTokenPromise;
            this.refreshTokenPromise = null;
            return this.client(originalRequest);
          } catch (refreshError) {
            this.refreshTokenPromise = null;
            if (!originalRequest.skipErrorHandling) {
              this.config.onUnauthorized?.();
            }
            return Promise.reject(error);
          }
        }

        // Handle retry logic
        if (this.shouldRetry(error, originalRequest)) {
          originalRequest.retryCount = (originalRequest.retryCount || 0) + 1;
          
          const delay = this.getRetryDelay(originalRequest.retryCount);
          await this.sleep(delay);
          
          return this.client(originalRequest);
        }

        // Handle other errors
        if (!originalRequest.skipErrorHandling) {
          this.handleError(error);
        }

        return Promise.reject(error);
      }
    );
  }

  private defaultRetryCondition(error: AxiosError): boolean {
    // Retry on network errors and 5xx errors
    if (!error.response) return true;
    if (error.response.status >= 500) return true;
    if (error.response.status === 429) return true; // Rate limit
    return false;
  }

  private shouldRetry(error: AxiosError, config: RequestOptions): boolean {
    if (config.retry === false) return false;
    if (!this.config.retryConfig?.retryCondition?.(error)) return false;
    
    const retryCount = config.retryCount || 0;
    return retryCount < (this.config.retryConfig?.maxRetries || 3);
  }

  private getRetryDelay(retryCount: number): number {
    const baseDelay = this.config.retryConfig?.retryDelay || 1000;
    // Exponential backoff with jitter
    const delay = baseDelay * Math.pow(2, retryCount - 1);
    const jitter = delay * 0.1 * Math.random();
    return delay + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async refreshToken(): Promise<void> {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await this.client.post('/auth/refresh', {
        refreshToken,
      }, { skipErrorHandling: true } as RequestOptions);

      const { accessToken, refreshToken: newRefreshToken } = response.data;
      
      localStorage.setItem('authToken', accessToken);
      if (newRefreshToken) {
        localStorage.setItem('refreshToken', newRefreshToken);
      }
    } catch (error) {
      // Clear tokens on refresh failure
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      throw error;
    }
  }

  private handleError(error: AxiosError) {
    if (this.config.onError) {
      this.config.onError(error);
      return;
    }

    // Default error handling
    const message = this.getErrorMessage(error);
    toast.error(message);

    // Log error details
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
    });
  }

  private getErrorMessage(error: AxiosError): string {
    if (!error.response) {
      return 'Network error. Please check your connection.';
    }

    const { status, data } = error.response;

    // Extract message from response
    if (data && typeof data === 'object') {
      if ('message' in data) return data.message as string;
      if ('error' in data) return data.error as string;
    }

    // Default messages by status code
    switch (status) {
      case 400:
        return 'Invalid request. Please check your input.';
      case 401:
        return 'Authentication required.';
      case 403:
        return 'You don\'t have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 429:
        return 'Too many requests. Please try again later.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return `Error: ${status}`;
    }
  }

  // HTTP methods
  async get<T = any>(url: string, options?: RequestOptions): Promise<T> {
    const response = await this.client.get<T>(url, options);
    return response.data;
  }

  async post<T = any>(url: string, data?: any, options?: RequestOptions): Promise<T> {
    const response = await this.client.post<T>(url, data, options);
    return response.data;
  }

  async put<T = any>(url: string, data?: any, options?: RequestOptions): Promise<T> {
    const response = await this.client.put<T>(url, data, options);
    return response.data;
  }

  async patch<T = any>(url: string, data?: any, options?: RequestOptions): Promise<T> {
    const response = await this.client.patch<T>(url, data, options);
    return response.data;
  }

  async delete<T = any>(url: string, options?: RequestOptions): Promise<T> {
    const response = await this.client.delete<T>(url, options);
    return response.data;
  }

  // Utility methods
  setAuthToken(token: string) {
    localStorage.setItem('authToken', token);
  }

  clearAuthToken() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
  }

  // Upload with progress
  async upload<T = any>(
    url: string,
    formData: FormData,
    onProgress?: (progress: number) => void,
    options?: RequestOptions
  ): Promise<T> {
    const response = await this.client.post<T>(url, formData, {
      ...options,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
    return response.data;
  }

  // Batch requests
  async batch<T = any>(requests: Array<() => Promise<any>>): Promise<T[]> {
    try {
      const results = await Promise.allSettled(requests);
      
      return results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          console.error(`Batch request ${index} failed:`, result.reason);
          throw result.reason;
        }
      });
    } catch (error) {
      this.handleError(error as AxiosError);
      throw error;
    }
  }
}

// Create default instance
export const apiClient = new ApiClient();

// Export for custom instances
export default ApiClient;