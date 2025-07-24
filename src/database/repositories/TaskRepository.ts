import { BaseRepository } from './BaseRepository';
import { Task } from '../entities/Task';
import { FindManyOptions, In } from 'typeorm';

export class TaskRepository extends BaseRepository<Task> {
  constructor() {
    super(Task);
  }

  async findByProject(projectId: string): Promise<Task[]> {
    return this.repository.find({
      where: { projectId },
      relations: ['assignedAgent', 'createdBy'],
      order: { createdAt: 'DESC' }
    });
  }

  async findByOrganization(organizationId: string, options?: {
    status?: string;
    type?: string;
    priority?: string;
    limit?: number;
  }): Promise<Task[]> {
    const queryOptions: FindManyOptions<Task> = {
      where: { organizationId },
      relations: ['project', 'assignedAgent', 'createdBy'],
      order: { createdAt: 'DESC' }
    };

    if (options?.status) {
      queryOptions.where = { ...queryOptions.where, status: options.status };
    }
    if (options?.type) {
      queryOptions.where = { ...queryOptions.where, type: options.type };
    }
    if (options?.priority) {
      queryOptions.where = { ...queryOptions.where, priority: options.priority };
    }
    if (options?.limit) {
      queryOptions.take = options.limit;
    }

    return this.repository.find(queryOptions);
  }

  async findPendingTasks(organizationId: string): Promise<Task[]> {
    return this.repository.find({
      where: {
        organizationId,
        status: 'pending'
      },
      relations: ['project', 'assignedAgent'],
      order: {
        priority: 'ASC',
        createdAt: 'ASC'
      }
    });
  }

  async findTasksWithDependencies(taskIds: string[]): Promise<Task[]> {
    if (taskIds.length === 0) return [];
    
    return this.repository.find({
      where: {
        id: In(taskIds)
      },
      relations: ['assignedAgent', 'project']
    });
  }

  async findByAgent(agentId: string, status?: string): Promise<Task[]> {
    const where: any = { assignedAgentId: agentId };
    if (status) {
      where.status = status;
    }

    return this.repository.find({
      where,
      relations: ['project', 'createdBy'],
      order: { createdAt: 'DESC' }
    });
  }

  async updateTaskStatus(taskId: string, status: string, updates?: {
    output?: any;
    error?: string;
    actualDuration?: number;
    startedAt?: Date;
    completedAt?: Date;
  }): Promise<Task | null> {
    const updateData: any = { status };
    
    if (updates?.output !== undefined) updateData.output = updates.output;
    if (updates?.error !== undefined) updateData.error = updates.error;
    if (updates?.actualDuration !== undefined) updateData.actualDuration = updates.actualDuration;
    if (updates?.startedAt !== undefined) updateData.startedAt = updates.startedAt;
    if (updates?.completedAt !== undefined) updateData.completedAt = updates.completedAt;

    await this.repository.update(taskId, updateData);
    return this.findById(taskId);
  }

  async getTaskStatistics(organizationId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
  }> {
    const tasks = await this.findByOrganization(organizationId);
    
    const stats = {
      total: tasks.length,
      byStatus: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      byPriority: {} as Record<string, number>
    };

    tasks.forEach(task => {
      stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;
      stats.byType[task.type] = (stats.byType[task.type] || 0) + 1;
      stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;
    });

    return stats;
  }

  async findSubtasks(parentTaskId: string): Promise<Task[]> {
    return this.repository.find({
      where: { parentTaskId },
      relations: ['assignedAgent'],
      order: { createdAt: 'ASC' }
    });
  }

  async searchTasks(query: string, organizationId: string): Promise<Task[]> {
    return this.repository
      .createQueryBuilder('task')
      .where('task.organizationId = :organizationId', { organizationId })
      .andWhere('(task.title ILIKE :query OR task.description ILIKE :query)', 
        { query: `%${query}%` })
      .leftJoinAndSelect('task.project', 'project')
      .leftJoinAndSelect('task.assignedAgent', 'agent')
      .orderBy('task.createdAt', 'DESC')
      .limit(50)
      .getMany();
  }
}