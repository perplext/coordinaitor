import { DataSource } from 'typeorm';
import winston from 'winston';
import { AppDataSource } from './data-source';
import { UserRepository } from './repositories/UserRepository';
import { TaskRepository } from './repositories/TaskRepository';
import { Organization } from './entities/Organization';
import { Role } from './entities/Role';
import { Agent } from './entities/Agent';
import { Project } from './entities/Project';
import { SYSTEM_ROLES } from '../services/auth-service';

export class DatabaseService {
  private static instance: DatabaseService;
  private dataSource: DataSource;
  private logger: winston.Logger;
  
  // Repositories
  public users: UserRepository;
  public tasks: TaskRepository;

  private constructor() {
    this.dataSource = AppDataSource;
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [new winston.transports.Console()]
    });

    // Initialize repositories
    this.users = new UserRepository();
    this.tasks = new TaskRepository();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
        this.logger.info('Database connection initialized');
        
        // Run migrations if in production
        if (process.env.NODE_ENV === 'production') {
          await this.runMigrations();
        }
        
        // Seed initial data
        await this.seedInitialData();
      }
    } catch (error) {
      this.logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  public async close(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      this.logger.info('Database connection closed');
    }
  }

  public async runMigrations(): Promise<void> {
    try {
      const migrations = await this.dataSource.runMigrations();
      this.logger.info(`Ran ${migrations.length} migrations`);
    } catch (error) {
      this.logger.error('Failed to run migrations:', error);
      throw error;
    }
  }

  private async seedInitialData(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if initial data exists
      const orgRepo = this.dataSource.getRepository(Organization);
      const orgCount = await orgRepo.count();
      
      if (orgCount === 0) {
        this.logger.info('Seeding initial data...');
        
        // Create default organization
        const defaultOrg = await orgRepo.save({
          name: 'Default Organization',
          slug: 'default',
          description: 'Default organization for single-tenant deployment',
          settings: {
            features: {
              multiAgent: true,
              collaboration: true,
              approvals: true,
              knowledge: true
            }
          }
        });

        // Create system roles
        const roleRepo = this.dataSource.getRepository(Role);
        
        for (const [key, roleData] of Object.entries(SYSTEM_ROLES)) {
          await roleRepo.save({
            organizationId: defaultOrg.id,
            name: roleData.name,
            description: roleData.description,
            isSystem: true,
            permissions: roleData.permissions
          });
        }

        // Load agents from config
        const agentRepo = this.dataSource.getRepository(Agent);
        const agentConfigs = await this.loadAgentConfigs();
        
        for (const config of agentConfigs) {
          await agentRepo.save({
            agentId: config.id,
            name: config.name,
            type: config.type,
            provider: config.provider,
            version: config.version,
            endpoint: config.endpoint,
            capabilities: config.capabilities,
            maxConcurrentTasks: config.maxConcurrentTasks,
            timeoutMs: config.timeout,
            costConfig: config.cost || {},
            metadata: config.metadata || {},
            isActive: true
          });
        }

        await queryRunner.commitTransaction();
        this.logger.info('Initial data seeded successfully');
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to seed initial data:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async loadAgentConfigs(): Promise<any[]> {
    // This would normally load from the agents.yaml file
    // For now, return a minimal set
    return [
      {
        id: 'claude-001',
        name: 'Claude Code Agent',
        type: 'cli',
        provider: 'anthropic',
        version: '3.0',
        endpoint: 'http://claude-agent:5001',
        maxConcurrentTasks: 5,
        timeout: 300000,
        capabilities: [
          {
            name: 'complex-reasoning',
            description: 'Advanced reasoning and problem-solving',
            category: 'planning',
            complexity: 'complex'
          },
          {
            name: 'code-generation',
            description: 'Generate high-quality code',
            category: 'development',
            complexity: 'complex'
          }
        ]
      },
      {
        id: 'gemini-001',
        name: 'Google Gemini Agent',
        type: 'cli',
        provider: 'google',
        version: '1.0',
        endpoint: 'http://gemini-agent:5002',
        maxConcurrentTasks: 10,
        timeout: 180000,
        capabilities: [
          {
            name: 'strategic-planning',
            description: 'Long-term strategic planning',
            category: 'planning',
            complexity: 'complex'
          }
        ]
      }
    ];
  }

  public getDataSource(): DataSource {
    return this.dataSource;
  }

  // Utility methods for direct entity access
  public getRepository<T>(entity: any) {
    return this.dataSource.getRepository<T>(entity);
  }

  public async transaction<T>(work: (queryRunner: any) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await work(queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}