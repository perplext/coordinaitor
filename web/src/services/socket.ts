import { io, Socket } from 'socket.io-client';
import { Task, Agent } from '@/types';
import { info as logInfo } from '@/utils/logger';

export type SocketEvent = 
  | 'agent:registered'
  | 'agent:unregistered'
  | 'task:created'
  | 'task:assigned'
  | 'task:started'
  | 'task:completed'
  | 'task:failed'
  | 'task:error'
  | 'project:created'
  | 'message:routed'
  | 'tool-registered'
  | 'tool-unregistered';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect(url: string = '/') {
    if (this.socket?.connected) return;

    this.socket = io(url, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      logInfo('Connected to WebSocket server', {
        socketId: this.socket?.id,
        operation: 'socketConnect'
      });
      this.emit('connected', true);
    });

    this.socket.on('disconnect', () => {
      logInfo('Disconnected from WebSocket server', {
        operation: 'socketDisconnect'
      });
      this.emit('connected', false);
    });

    // Forward all events to listeners
    const events: SocketEvent[] = [
      'agent:registered',
      'agent:unregistered',
      'task:created',
      'task:assigned',
      'task:started',
      'task:completed',
      'task:failed',
      'task:error',
      'project:created',
      'message:routed',
      'tool-registered',
      'tool-unregistered',
    ];

    events.forEach(event => {
      this.socket!.on(event, (data) => {
        this.emit(event, data);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  subscribe(channel: string) {
    if (this.socket?.connected) {
      this.socket.emit('subscribe', channel);
    }
  }

  unsubscribe(channel: string) {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe', channel);
    }
  }

  sendMessage(message: any) {
    if (this.socket?.connected) {
      this.socket.emit('message', message);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();