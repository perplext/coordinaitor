import { BaseRepository } from './BaseRepository';
import { User } from '../entities/User';
import { Role } from '../entities/Role';
import { UserRole } from '../entities/UserRole';

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(User);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({
      where: { email },
      relations: ['organization', 'userRoles', 'userRoles.role']
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.repository.findOne({
      where: { username },
      relations: ['organization', 'userRoles', 'userRoles.role']
    });
  }

  async findByOrganization(organizationId: string): Promise<User[]> {
    return this.repository.find({
      where: { organizationId },
      relations: ['userRoles', 'userRoles.role']
    });
  }

  async getUserWithRoles(userId: string): Promise<User | null> {
    return this.repository.findOne({
      where: { id: userId },
      relations: ['organization', 'userRoles', 'userRoles.role']
    });
  }

  async assignRole(userId: string, roleId: string, grantedBy?: string): Promise<void> {
    const userRoleRepo = this.repository.manager.getRepository(UserRole);
    
    const existing = await userRoleRepo.findOne({
      where: { userId, roleId }
    });

    if (!existing) {
      await userRoleRepo.save({
        userId,
        roleId,
        grantedBy
      });
    }
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    const userRoleRepo = this.repository.manager.getRepository(UserRole);
    await userRoleRepo.delete({ userId, roleId });
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.getUserWithRoles(userId);
    if (!user) return [];

    const permissions = new Set<string>();
    
    for (const userRole of user.userRoles) {
      if (userRole.role && userRole.role.permissions) {
        userRole.role.permissions.forEach(p => permissions.add(p));
      }
    }

    return Array.from(permissions);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.repository.update(userId, {
      lastLogin: new Date()
    });
  }

  async searchUsers(query: string, organizationId?: string): Promise<User[]> {
    const qb = this.repository.createQueryBuilder('user');
    
    qb.where('(user.email ILIKE :query OR user.username ILIKE :query OR user.firstName ILIKE :query OR user.lastName ILIKE :query)', 
      { query: `%${query}%` });
    
    if (organizationId) {
      qb.andWhere('user.organizationId = :organizationId', { organizationId });
    }

    return qb.getMany();
  }
}