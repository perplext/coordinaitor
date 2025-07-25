import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';
import { createLogger } from '../utils/logger';
import { performanceMonitor } from '../monitoring/performance';

const logger = createLogger({ module: 'websocket-server' });

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  organizationId?: string;
  role?: string;
}

export class WebSocketServer {
  private io: SocketIOServer;
  private pubClient: Redis;
  private subClient: Redis;
  private rooms: Map<string, Set<string>> = new Map();
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Setup Redis adapter for scaling
    if (process.env.REDIS_HOST) {
      this.pubClient = new Redis({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      });

      this.subClient = this.pubClient.duplicate();
      
      this.io.adapter(createAdapter(this.pubClient, this.subClient));
      
      logger.info('WebSocket server using Redis adapter for scaling');
    }

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        socket.userId = decoded.id;
        socket.organizationId = decoded.organizationId;
        socket.role = decoded.role;

        // Track user connection
        this.trackUserConnection(socket.userId, socket.id);
        
        logger.info('WebSocket client authenticated', {
          userId: socket.userId,
          socketId: socket.id,
          organizationId: socket.organizationId,
        });

        next();
      } catch (error) {
        logger.error('WebSocket authentication failed', error);
        next(new Error('Invalid token'));
      }
    });

    // Rate limiting middleware
    const rateLimiter = new Map<string, { count: number; resetTime: number }>();
    
    this.io.use((socket: AuthenticatedSocket, next) => {
      const key = socket.userId || socket.handshake.address;
      const now = Date.now();
      const limit = 100; // 100 events per minute
      const window = 60000; // 1 minute

      const userLimit = rateLimiter.get(key) || { count: 0, resetTime: now + window };
      
      if (now > userLimit.resetTime) {
        userLimit.count = 0;
        userLimit.resetTime = now + window;
      }

      if (userLimit.count >= limit) {
        return next(new Error('Rate limit exceeded'));
      }

      userLimit.count++;
      rateLimiter.set(key, userLimit);
      next();
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info('Client connected', {
        socketId: socket.id,
        userId: socket.userId,
        organizationId: socket.organizationId,
      });

      // Join organization room
      if (socket.organizationId) {
        socket.join(`org:${socket.organizationId}`);
        this.joinRoom(`org:${socket.organizationId}`, socket.id);
      }

      // Join user-specific room
      if (socket.userId) {
        socket.join(`user:${socket.userId}`);
        this.joinRoom(`user:${socket.userId}`, socket.id);
      }

      // Handle task subscription
      socket.on('subscribe:task', (taskId: string) => {
        if (this.canAccessTask(socket, taskId)) {
          socket.join(`task:${taskId}`);
          this.joinRoom(`task:${taskId}`, socket.id);
          
          socket.emit('subscribed:task', { taskId });
          
          logger.debug('Client subscribed to task', {
            socketId: socket.id,
            taskId,
            userId: socket.userId,
          });
        }
      });

      // Handle agent subscription
      socket.on('subscribe:agent', (agentId: string) => {
        if (this.canAccessAgent(socket, agentId)) {
          socket.join(`agent:${agentId}`);
          this.joinRoom(`agent:${agentId}`, socket.id);
          
          socket.emit('subscribed:agent', { agentId });
        }
      });

      // Handle project subscription
      socket.on('subscribe:project', (projectId: string) => {
        if (this.canAccessProject(socket, projectId)) {
          socket.join(`project:${projectId}`);
          this.joinRoom(`project:${projectId}`, socket.id);
          
          socket.emit('subscribed:project', { projectId });
        }
      });

      // Handle real-time collaboration
      socket.on('collaboration:join', (sessionId: string) => {
        socket.join(`collab:${sessionId}`);
        this.joinRoom(`collab:${sessionId}`, socket.id);
        
        // Notify others in the session
        socket.to(`collab:${sessionId}`).emit('collaboration:user-joined', {
          userId: socket.userId,
          socketId: socket.id,
        });
      });

      socket.on('collaboration:cursor', (data: any) => {
        socket.to(`collab:${data.sessionId}`).emit('collaboration:cursor-update', {
          userId: socket.userId,
          ...data,
        });
      });

      socket.on('collaboration:selection', (data: any) => {
        socket.to(`collab:${data.sessionId}`).emit('collaboration:selection-update', {
          userId: socket.userId,
          ...data,
        });
      });

      // Handle typing indicators
      socket.on('typing:start', (data: { resource: string; resourceId: string }) => {
        socket.to(`${data.resource}:${data.resourceId}`).emit('typing:started', {
          userId: socket.userId,
          resource: data.resource,
          resourceId: data.resourceId,
        });
      });

      socket.on('typing:stop', (data: { resource: string; resourceId: string }) => {
        socket.to(`${data.resource}:${data.resourceId}`).emit('typing:stopped', {
          userId: socket.userId,
          resource: data.resource,
          resourceId: data.resourceId,
        });
      });

      // Handle presence
      socket.on('presence:update', (status: string) => {
        this.updateUserPresence(socket.userId!, status);
        
        // Notify organization members
        socket.to(`org:${socket.organizationId}`).emit('presence:updated', {
          userId: socket.userId,
          status,
        });
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        logger.info('Client disconnected', {
          socketId: socket.id,
          userId: socket.userId,
          reason,
        });

        // Clean up rooms
        this.rooms.forEach((sockets, room) => {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            this.rooms.delete(room);
          }
        });

        // Clean up user tracking
        if (socket.userId) {
          const userSockets = this.userSockets.get(socket.userId);
          if (userSockets) {
            userSockets.delete(socket.id);
            if (userSockets.size === 0) {
              this.userSockets.delete(socket.userId);
              
              // Notify offline status
              this.io.to(`org:${socket.organizationId}`).emit('presence:updated', {
                userId: socket.userId,
                status: 'offline',
              });
            }
          }
        }
      });

      // Error handling
      socket.on('error', (error) => {
        logger.error('Socket error', error, {
          socketId: socket.id,
          userId: socket.userId,
        });
      });
    });
  }

  // Public methods for emitting events

  public emitTaskUpdate(taskId: string, update: any) {
    this.io.to(`task:${taskId}`).emit('task:updated', update);
    performanceMonitor.recordUserActivity('system', 'task-update', `task:${taskId}`);
  }

  public emitTaskStatusChange(taskId: string, status: string, metadata: any) {
    this.io.to(`task:${taskId}`).emit('task:status-changed', {
      taskId,
      status,
      ...metadata,
    });
  }

  public emitAgentUpdate(agentId: string, update: any) {
    this.io.to(`agent:${agentId}`).emit('agent:updated', update);
  }

  public emitAgentStatusChange(agentId: string, status: string, metadata: any) {
    this.io.to(`agent:${agentId}`).emit('agent:status-changed', {
      agentId,
      status,
      ...metadata,
    });
  }

  public emitProjectUpdate(projectId: string, update: any) {
    this.io.to(`project:${projectId}`).emit('project:updated', update);
  }

  public emitOrganizationNotification(organizationId: string, notification: any) {
    this.io.to(`org:${organizationId}`).emit('notification', notification);
  }

  public emitUserNotification(userId: string, notification: any) {
    this.io.to(`user:${userId}`).emit('notification', notification);
  }

  public emitSystemBroadcast(message: any) {
    this.io.emit('system:broadcast', message);
  }

  // Helper methods

  private trackUserConnection(userId: string, socketId: string) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);
  }

  private joinRoom(room: string, socketId: string) {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room)!.add(socketId);
  }

  private canAccessTask(socket: AuthenticatedSocket, taskId: string): boolean {
    // TODO: Implement proper authorization check
    return true;
  }

  private canAccessAgent(socket: AuthenticatedSocket, agentId: string): boolean {
    // TODO: Implement proper authorization check
    return true;
  }

  private canAccessProject(socket: AuthenticatedSocket, projectId: string): boolean {
    // TODO: Implement proper authorization check
    return true;
  }

  private updateUserPresence(userId: string, status: string) {
    // TODO: Update user presence in Redis or database
  }

  public getActiveConnections(): number {
    return this.io.sockets.sockets.size;
  }

  public getRoomMembers(room: string): string[] {
    return Array.from(this.rooms.get(room) || []);
  }

  public getUserSockets(userId: string): string[] {
    return Array.from(this.userSockets.get(userId) || []);
  }

  public close() {
    this.io.close();
    if (this.pubClient) {
      this.pubClient.disconnect();
      this.subClient.disconnect();
    }
    logger.info('WebSocket server closed');
  }
}