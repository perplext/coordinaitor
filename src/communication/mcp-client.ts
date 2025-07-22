import { io, Socket } from 'socket.io-client';
import axios, { AxiosInstance } from 'axios';
import { Message, MCPTool } from '../interfaces/communication.interface';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

export class MCPClient {
  private socket: Socket | null = null;
  private httpClient: AxiosInstance;
  private logger: winston.Logger;
  private serverUrl: string;
  private secretKey: string;
  private connected: boolean = false;
  private messageHandlers: Map<string, (message: Message) => void> = new Map();

  constructor(serverUrl: string, secretKey: string) {
    this.serverUrl = serverUrl;
    this.secretKey = secretKey;

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.httpClient = axios.create({
      baseURL: serverUrl,
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        auth: {
          token: this.secretKey
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      this.socket.on('connect', () => {
        this.connected = true;
        this.logger.info(`Connected to MCP server at ${this.serverUrl}`);
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        this.logger.error('Connection error:', error);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        this.connected = false;
        this.logger.warn(`Disconnected from MCP server: ${reason}`);
      });

      this.socket.on('message', (message: Message) => {
        const handler = this.messageHandlers.get(message.type);
        if (handler) {
          handler(message);
        }
      });

      this.socket.on('tool-registered', (data) => {
        this.logger.info(`New tool available: ${data.name}`);
      });

      this.socket.on('tool-unregistered', (data) => {
        this.logger.info(`Tool removed: ${data.name}`);
      });
    });
  }

  public async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  public async getAvailableTools(): Promise<MCPTool[]> {
    try {
      const response = await this.httpClient.get('/tools');
      return response.data.tools;
    } catch (error) {
      this.logger.error('Failed to fetch tools:', error);
      throw error;
    }
  }

  public async executeTool(toolName: string, input: any): Promise<any> {
    const requestId = uuidv4();
    try {
      const response = await this.httpClient.post(`/tools/${toolName}/execute`, {
        input,
        requestId
      });
      
      if (response.data.success) {
        return response.data.result;
      } else {
        throw new Error(response.data.error);
      }
    } catch (error) {
      this.logger.error(`Failed to execute tool ${toolName}:`, error);
      throw error;
    }
  }

  public subscribe(event: string, handler: (message: Message) => void): void {
    if (!this.socket || !this.connected) {
      throw new Error('Not connected to MCP server');
    }

    this.messageHandlers.set(event, handler);
    this.socket.emit('subscribe', event);
  }

  public unsubscribe(event: string): void {
    if (!this.socket || !this.connected) {
      throw new Error('Not connected to MCP server');
    }

    this.messageHandlers.delete(event);
    this.socket.emit('unsubscribe', event);
  }

  public broadcast(message: Message): void {
    if (!this.socket || !this.connected) {
      throw new Error('Not connected to MCP server');
    }

    this.socket.emit('broadcast', message);
  }

  public async checkHealth(): Promise<any> {
    try {
      const response = await this.httpClient.get('/health');
      return response.data;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      throw error;
    }
  }

  public isConnected(): boolean {
    return this.connected;
  }
}