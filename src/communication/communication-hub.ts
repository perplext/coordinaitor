import { EventEmitter } from 'events';
import { 
  CommunicationHub, 
  CommunicationChannel, 
  EventSubscription, 
  Message 
} from '../interfaces/communication.interface';
import { MCPServerImplementation } from './mcp-server';
import { MCPClient } from './mcp-client';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

class DirectChannel implements CommunicationChannel {
  constructor(
    public id: string,
    public type: 'direct',
    public protocol: string,
    public participants: string[],
    private hub: CommunicationHubImplementation
  ) {}

  async send(message: Message): Promise<void> {
    if (!this.participants.includes(message.from) || !this.participants.includes(message.to)) {
      throw new Error('Message sender or recipient not in channel participants');
    }
    this.hub.routeMessage(message);
  }

  receive(handler: (message: Message) => void): void {
    this.hub.registerChannelHandler(this.id, handler);
  }

  async close(): Promise<void> {
    this.hub.closeChannel(this.id);
  }
}

class BroadcastChannel implements CommunicationChannel {
  constructor(
    public id: string,
    public type: 'broadcast',
    public protocol: string,
    public participants: string[],
    private hub: CommunicationHubImplementation
  ) {}

  async send(message: Message): Promise<void> {
    if (!this.participants.includes(message.from)) {
      throw new Error('Message sender not in channel participants');
    }
    
    for (const participant of this.participants) {
      if (participant !== message.from) {
        const broadcastMessage = { ...message, to: participant };
        this.hub.routeMessage(broadcastMessage);
      }
    }
  }

  receive(handler: (message: Message) => void): void {
    this.hub.registerChannelHandler(this.id, handler);
  }

  async close(): Promise<void> {
    this.hub.closeChannel(this.id);
  }
}

export class CommunicationHubImplementation implements CommunicationHub {
  private agents: Map<string, { channels: Set<string> }> = new Map();
  private channels: Map<string, CommunicationChannel> = new Map();
  private subscriptions: Map<string, EventSubscription> = new Map();
  private channelHandlers: Map<string, (message: Message) => void> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();
  private logger: winston.Logger;
  private mcpServer: MCPServerImplementation | null = null;
  private mcpClients: Map<string, MCPClient> = new Map();

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  public async initialize(mcpPort: number = 4000): Promise<void> {
    this.mcpServer = new MCPServerImplementation('orchestrator-mcp', mcpPort);
    await this.mcpServer.start();
    
    this.mcpServer.on('agent-message', (message: Message) => {
      this.routeMessage(message);
    });
  }

  public registerAgent(agentId: string): void {
    if (!this.agents.has(agentId)) {
      this.agents.set(agentId, { channels: new Set() });
      this.logger.info(`Agent registered: ${agentId}`);
      this.publish('agent:registered', { agentId });
    }
  }

  public unregisterAgent(agentId: string): void {
    const agentData = this.agents.get(agentId);
    if (agentData) {
      for (const channelId of agentData.channels) {
        const channel = this.channels.get(channelId);
        if (channel) {
          const index = channel.participants.indexOf(agentId);
          if (index > -1) {
            channel.participants.splice(index, 1);
          }
          if (channel.participants.length === 0) {
            this.channels.delete(channelId);
          }
        }
      }
      this.agents.delete(agentId);
      this.logger.info(`Agent unregistered: ${agentId}`);
      this.publish('agent:unregistered', { agentId });
    }
  }

  public createChannel(type: 'direct' | 'broadcast' | 'pubsub', participants: string[]): CommunicationChannel {
    const channelId = uuidv4();
    let channel: CommunicationChannel;

    switch (type) {
      case 'direct':
        if (participants.length !== 2) {
          throw new Error('Direct channel must have exactly 2 participants');
        }
        channel = new DirectChannel(channelId, 'direct', 'internal', participants, this);
        break;
      case 'broadcast':
        channel = new BroadcastChannel(channelId, 'broadcast', 'internal', participants, this);
        break;
      default:
        throw new Error(`Unsupported channel type: ${type}`);
    }

    this.channels.set(channelId, channel);
    
    for (const participant of participants) {
      const agentData = this.agents.get(participant);
      if (agentData) {
        agentData.channels.add(channelId);
      }
    }

    this.logger.info(`Channel created: ${channelId} (${type}) with participants: ${participants.join(', ')}`);
    return channel;
  }

  public publish(event: string, data: any): void {
    this.eventEmitter.emit(event, data);
    if (this.mcpServer) {
      this.mcpServer.emit(event, data);
    }
  }

  public subscribe(event: string, subscriber: string, handler: (event: any) => void): EventSubscription {
    const subscriptionId = uuidv4();
    const subscription: EventSubscription = {
      id: subscriptionId,
      event,
      subscriber,
      handler
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.eventEmitter.on(event, handler);
    
    this.logger.info(`Subscription created: ${subscriber} -> ${event}`);
    return subscription;
  }

  public unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      this.eventEmitter.removeListener(subscription.event, subscription.handler);
      this.subscriptions.delete(subscriptionId);
      this.logger.info(`Subscription removed: ${subscriptionId}`);
    }
  }

  public routeMessage(message: Message): void {
    const agentData = this.agents.get(message.to);
    if (!agentData) {
      this.logger.warn(`Cannot route message to unregistered agent: ${message.to}`);
      return;
    }

    for (const channelId of agentData.channels) {
      const handler = this.channelHandlers.get(channelId);
      if (handler) {
        handler(message);
      }
    }

    this.publish('message:routed', message);
  }

  public registerChannelHandler(channelId: string, handler: (message: Message) => void): void {
    this.channelHandlers.set(channelId, handler);
  }

  public closeChannel(channelId: string): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      for (const participant of channel.participants) {
        const agentData = this.agents.get(participant);
        if (agentData) {
          agentData.channels.delete(channelId);
        }
      }
      this.channels.delete(channelId);
      this.channelHandlers.delete(channelId);
      this.logger.info(`Channel closed: ${channelId}`);
    }
  }

  public async connectToMCPServer(agentId: string, serverUrl: string, secretKey: string): Promise<void> {
    const client = new MCPClient(serverUrl, secretKey);
    await client.connect();
    this.mcpClients.set(agentId, client);
    this.logger.info(`Agent ${agentId} connected to MCP server at ${serverUrl}`);
  }

  public on(event: string, handler: (data: any) => void): void {
    this.eventEmitter.on(event, handler);
  }

  public async shutdown(): Promise<void> {
    for (const [agentId, client] of this.mcpClients) {
      await client.disconnect();
    }
    
    if (this.mcpServer) {
      await this.mcpServer.stop();
    }
    
    this.agents.clear();
    this.channels.clear();
    this.subscriptions.clear();
    this.channelHandlers.clear();
    this.mcpClients.clear();
  }
}