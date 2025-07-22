import { EventEmitter } from 'events';
import express, { Express, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createServer, Server as HTTPServer } from 'http';
import { MCPServer, MCPTool, Message } from '../interfaces/communication.interface';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

export class MCPServerImplementation implements MCPServer {
  public id: string;
  public name: string;
  public tools: Map<string, MCPTool>;
  
  private app: Express;
  private httpServer: HTTPServer;
  private io: SocketIOServer;
  private eventEmitter: EventEmitter;
  private logger: winston.Logger;
  private port: number;
  private secretKey: string;

  constructor(
    name: string,
    port: number = 4000,
    secretKey: string = process.env.MCP_SECRET_KEY || 'default-secret'
  ) {
    this.id = uuidv4();
    this.name = name;
    this.tools = new Map();
    this.port = port;
    this.secretKey = secretKey;
    this.eventEmitter = new EventEmitter();
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${this.secretKey}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      next();
    });
  }

  private setupRoutes(): void {
    this.app.get('/tools', (req: Request, res: Response) => {
      const toolList = Array.from(this.tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema
      }));
      res.json({ tools: toolList });
    });

    this.app.post('/tools/:toolName/execute', async (req: Request, res: Response) => {
      const { toolName } = req.params;
      const { input, requestId } = req.body;

      const tool = this.tools.get(toolName);
      if (!tool) {
        return res.status(404).json({ error: 'Tool not found' });
      }

      try {
        const result = await tool.handler(input);
        res.json({
          requestId,
          toolName,
          result,
          success: true
        });
      } catch (error) {
        this.logger.error(`Tool execution failed: ${toolName}`, error);
        res.status(500).json({
          requestId,
          toolName,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
      }
    });

    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        serverId: this.id,
        serverName: this.name,
        toolsCount: this.tools.size,
        uptime: process.uptime()
      });
    });
  }

  private setupSocketHandlers(): void {
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (token !== this.secretKey) {
        return next(new Error('Authentication failed'));
      }
      next();
    });

    this.io.on('connection', (socket) => {
      this.logger.info(`Client connected: ${socket.id}`);

      socket.on('subscribe', (event: string) => {
        socket.join(event);
        this.logger.info(`Client ${socket.id} subscribed to ${event}`);
      });

      socket.on('unsubscribe', (event: string) => {
        socket.leave(event);
        this.logger.info(`Client ${socket.id} unsubscribed from ${event}`);
      });

      socket.on('broadcast', (message: Message) => {
        this.io.to(message.type).emit('message', message);
        this.eventEmitter.emit('message', message);
      });

      socket.on('disconnect', () => {
        this.logger.info(`Client disconnected: ${socket.id}`);
      });
    });
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.port, () => {
        this.logger.info(`MCP Server '${this.name}' started on port ${this.port}`);
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => {
        this.httpServer.close(() => {
          this.logger.info(`MCP Server '${this.name}' stopped`);
          resolve();
        });
      });
    });
  }

  public registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
    this.logger.info(`Tool registered: ${tool.name}`);
    this.io.emit('tool-registered', {
      name: tool.name,
      description: tool.description
    });
  }

  public unregisterTool(name: string): void {
    if (this.tools.delete(name)) {
      this.logger.info(`Tool unregistered: ${name}`);
      this.io.emit('tool-unregistered', { name });
    }
  }

  public emit(event: string, data: any): void {
    this.io.emit(event, data);
    this.eventEmitter.emit(event, data);
  }

  public on(event: string, handler: (data: any) => void): void {
    this.eventEmitter.on(event, handler);
  }
}