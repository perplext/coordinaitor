import { EventEmitter } from 'events';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean; // System roles cannot be deleted
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface UserCreateRequest {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  roles?: string[]; // Role IDs
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenPayload {
  userId: string;
  username: string;
  roles: string[];
  permissions: string[];
}

// System roles
export const SYSTEM_ROLES = {
  ADMIN: {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system access',
    permissions: ['*:*'] // All permissions
  },
  DEVELOPER: {
    id: 'developer',
    name: 'Developer',
    description: 'Can create and manage tasks and projects',
    permissions: [
      'tasks:create',
      'tasks:read',
      'tasks:update',
      'tasks:delete',
      'tasks:execute',
      'projects:create',
      'projects:read',
      'projects:update',
      'projects:delete',
      'agents:read',
      'analytics:read',
      'templates:*',
      'workflows:*',
      'knowledge:*'
    ]
  },
  OPERATOR: {
    id: 'operator',
    name: 'Operator',
    description: 'Can execute and monitor tasks',
    permissions: [
      'tasks:read',
      'tasks:execute',
      'projects:read',
      'agents:read',
      'analytics:read',
      'workflows:execute',
      'knowledge:read'
    ]
  },
  VIEWER: {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    permissions: [
      'tasks:read',
      'projects:read',
      'agents:read',
      'analytics:read',
      'knowledge:read'
    ]
  }
};

// System permissions
export const PERMISSIONS = {
  // Task permissions
  TASKS_CREATE: { id: 'tasks:create', resource: 'tasks', action: 'create', description: 'Create tasks' },
  TASKS_READ: { id: 'tasks:read', resource: 'tasks', action: 'read', description: 'View tasks' },
  TASKS_UPDATE: { id: 'tasks:update', resource: 'tasks', action: 'update', description: 'Update tasks' },
  TASKS_DELETE: { id: 'tasks:delete', resource: 'tasks', action: 'delete', description: 'Delete tasks' },
  TASKS_EXECUTE: { id: 'tasks:execute', resource: 'tasks', action: 'execute', description: 'Execute tasks' },
  
  // Project permissions
  PROJECTS_CREATE: { id: 'projects:create', resource: 'projects', action: 'create', description: 'Create projects' },
  PROJECTS_READ: { id: 'projects:read', resource: 'projects', action: 'read', description: 'View projects' },
  PROJECTS_UPDATE: { id: 'projects:update', resource: 'projects', action: 'update', description: 'Update projects' },
  PROJECTS_DELETE: { id: 'projects:delete', resource: 'projects', action: 'delete', description: 'Delete projects' },
  
  // Agent permissions
  AGENTS_READ: { id: 'agents:read', resource: 'agents', action: 'read', description: 'View agents' },
  AGENTS_MANAGE: { id: 'agents:manage', resource: 'agents', action: 'manage', description: 'Manage agents' },
  
  // Analytics permissions
  ANALYTICS_READ: { id: 'analytics:read', resource: 'analytics', action: 'read', description: 'View analytics' },
  
  // Security permissions
  SECURITY_SCAN: { id: 'security:scan', resource: 'security', action: 'scan', description: 'Run security scans' },
  SECURITY_READ: { id: 'security:read', resource: 'security', action: 'read', description: 'View security reports' },
  
  // User management permissions
  USERS_CREATE: { id: 'users:create', resource: 'users', action: 'create', description: 'Create users' },
  USERS_READ: { id: 'users:read', resource: 'users', action: 'read', description: 'View users' },
  USERS_UPDATE: { id: 'users:update', resource: 'users', action: 'update', description: 'Update users' },
  USERS_DELETE: { id: 'users:delete', resource: 'users', action: 'delete', description: 'Delete users' },
  
  // Role management permissions
  ROLES_CREATE: { id: 'roles:create', resource: 'roles', action: 'create', description: 'Create roles' },
  ROLES_READ: { id: 'roles:read', resource: 'roles', action: 'read', description: 'View roles' },
  ROLES_UPDATE: { id: 'roles:update', resource: 'roles', action: 'update', description: 'Update roles' },
  ROLES_DELETE: { id: 'roles:delete', resource: 'roles', action: 'delete', description: 'Delete roles' },
  
  // Knowledge permissions
  KNOWLEDGE_CREATE: { id: 'knowledge:create', resource: 'knowledge', action: 'create', description: 'Create knowledge entries' },
  KNOWLEDGE_READ: { id: 'knowledge:read', resource: 'knowledge', action: 'read', description: 'View knowledge entries' },
  KNOWLEDGE_UPDATE: { id: 'knowledge:update', resource: 'knowledge', action: 'update', description: 'Update knowledge entries' },
  KNOWLEDGE_DELETE: { id: 'knowledge:delete', resource: 'knowledge', action: 'delete', description: 'Delete knowledge entries' },
  KNOWLEDGE_EXPORT: { id: 'knowledge:export', resource: 'knowledge', action: 'export', description: 'Export knowledge base' },
};

export class AuthService extends EventEmitter {
  private users: Map<string, User> = new Map();
  private roles: Map<string, Role> = new Map();
  private sessions: Map<string, TokenPayload> = new Map();
  private logger: winston.Logger;
  private jwtSecret: string;
  private jwtExpiresIn: string = '24h';
  private refreshTokenExpiresIn: string = '7d';

  constructor(jwtSecret?: string) {
    super();
    
    this.jwtSecret = jwtSecret || process.env.JWT_SECRET || 'default-secret-change-me';
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.initializeSystemRoles();
    this.createDefaultAdmin();
  }

  private initializeSystemRoles(): void {
    // Create system roles
    for (const [key, roleData] of Object.entries(SYSTEM_ROLES)) {
      const permissions: Permission[] = [];
      
      for (const permId of roleData.permissions) {
        if (permId === '*:*') {
          // Add all permissions for admin
          permissions.push(...Object.values(PERMISSIONS));
        } else if (permId.endsWith(':*')) {
          // Add all permissions for a resource
          const resource = permId.split(':')[0];
          permissions.push(
            ...Object.values(PERMISSIONS).filter(p => p.resource === resource)
          );
        } else {
          // Add specific permission
          const perm = Object.values(PERMISSIONS).find(p => p.id === permId);
          if (perm) permissions.push(perm);
        }
      }

      const role: Role = {
        id: roleData.id,
        name: roleData.name,
        description: roleData.description,
        permissions,
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.roles.set(role.id, role);
    }

    this.logger.info('System roles initialized');
  }

  private async createDefaultAdmin(): Promise<void> {
    // Check if admin exists
    const adminExists = Array.from(this.users.values()).some(
      user => user.roles.some(role => role.id === 'admin')
    );

    if (!adminExists) {
      // Create default admin user
      await this.createUser({
        email: 'admin@orchestrator.local',
        username: 'admin',
        password: 'admin123', // Should be changed on first login
        firstName: 'System',
        lastName: 'Administrator',
        roles: ['admin']
      });

      this.logger.info('Default admin user created');
    }
  }

  public async createUser(request: UserCreateRequest): Promise<User> {
    // Validate unique email and username
    const existingEmail = Array.from(this.users.values()).find(u => u.email === request.email);
    if (existingEmail) {
      throw new Error('Email already exists');
    }

    const existingUsername = Array.from(this.users.values()).find(u => u.username === request.username);
    if (existingUsername) {
      throw new Error('Username already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(request.password, 10);

    // Get roles
    const userRoles: Role[] = [];
    if (request.roles) {
      for (const roleId of request.roles) {
        const role = this.roles.get(roleId);
        if (role) userRoles.push(role);
      }
    } else {
      // Default to viewer role
      const viewerRole = this.roles.get('viewer');
      if (viewerRole) userRoles.push(viewerRole);
    }

    // Collect all permissions from roles
    const permissions = new Map<string, Permission>();
    for (const role of userRoles) {
      for (const perm of role.permissions) {
        permissions.set(perm.id, perm);
      }
    }

    const user: User = {
      id: uuidv4(),
      email: request.email,
      username: request.username,
      passwordHash,
      firstName: request.firstName,
      lastName: request.lastName,
      roles: userRoles,
      permissions: Array.from(permissions.values()),
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };

    this.users.set(user.id, user);
    this.emit('user:created', user);
    
    this.logger.info(`User created: ${user.username}`);
    return this.sanitizeUser(user);
  }

  public async login(request: LoginRequest): Promise<{ user: User; token: AuthToken }> {
    // Find user by username or email
    const user = Array.from(this.users.values()).find(
      u => u.username === request.username || u.email === request.username
    );

    if (!user || !user.isActive) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValid = await bcrypt.compare(request.password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    user.lastLogin = new Date();
    user.updatedAt = new Date();

    // Generate tokens
    const token = this.generateAuthToken(user);
    
    this.logger.info(`User logged in: ${user.username}`);
    this.emit('user:login', user);

    return {
      user: this.sanitizeUser(user),
      token
    };
  }

  public async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as TokenPayload;
      return payload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  public async refreshToken(refreshToken: string): Promise<AuthToken> {
    try {
      const payload = jwt.verify(refreshToken, this.jwtSecret) as TokenPayload;
      const user = this.users.get(payload.userId);
      
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      return this.generateAuthToken(user);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  private generateAuthToken(user: User): AuthToken {
    const payload: TokenPayload = {
      userId: user.id,
      username: user.username,
      roles: user.roles.map(r => r.id),
      permissions: user.permissions.map(p => p.id)
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    });

    const refreshToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.refreshTokenExpiresIn
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 86400, // 24 hours in seconds
      tokenType: 'Bearer'
    };
  }

  public hasPermission(user: User, permission: string): boolean {
    // Admin has all permissions
    if (user.roles.some(r => r.id === 'admin')) {
      return true;
    }

    // Check wildcard permissions
    if (user.permissions.some(p => p.id === '*:*')) {
      return true;
    }

    // Check resource wildcard
    const [resource, action] = permission.split(':');
    if (user.permissions.some(p => p.id === `${resource}:*`)) {
      return true;
    }

    // Check exact permission
    return user.permissions.some(p => p.id === permission);
  }

  public async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Update allowed fields
    if (updates.firstName !== undefined) user.firstName = updates.firstName;
    if (updates.lastName !== undefined) user.lastName = updates.lastName;
    if (updates.email !== undefined) user.email = updates.email;
    if (updates.isActive !== undefined) user.isActive = updates.isActive;
    if (updates.metadata !== undefined) user.metadata = updates.metadata;

    user.updatedAt = new Date();
    
    this.emit('user:updated', user);
    return this.sanitizeUser(user);
  }

  public async updateUserRoles(userId: string, roleIds: string[]): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get roles
    const newRoles: Role[] = [];
    for (const roleId of roleIds) {
      const role = this.roles.get(roleId);
      if (role) newRoles.push(role);
    }

    user.roles = newRoles;

    // Update permissions
    const permissions = new Map<string, Permission>();
    for (const role of newRoles) {
      for (const perm of role.permissions) {
        permissions.set(perm.id, perm);
      }
    }
    user.permissions = Array.from(permissions.values());

    user.updatedAt = new Date();
    
    this.emit('user:rolesUpdated', user);
    return this.sanitizeUser(user);
  }

  public async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify old password
    const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid old password');
    }

    // Hash new password
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.updatedAt = new Date();

    this.emit('user:passwordChanged', user);
  }

  public async resetPassword(userId: string, newPassword: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Hash new password
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.updatedAt = new Date();

    this.emit('user:passwordReset', user);
  }

  public getUser(userId: string): User | undefined {
    const user = this.users.get(userId);
    return user ? this.sanitizeUser(user) : undefined;
  }

  public getAllUsers(): User[] {
    return Array.from(this.users.values()).map(u => this.sanitizeUser(u));
  }

  public createRole(name: string, description: string, permissionIds: string[]): Role {
    const id = name.toLowerCase().replace(/\s+/g, '-');
    
    // Check if role exists
    if (this.roles.has(id)) {
      throw new Error('Role already exists');
    }

    // Get permissions
    const permissions: Permission[] = [];
    for (const permId of permissionIds) {
      const perm = Object.values(PERMISSIONS).find(p => p.id === permId);
      if (perm) permissions.push(perm);
    }

    const role: Role = {
      id,
      name,
      description,
      permissions,
      isSystem: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.roles.set(role.id, role);
    this.emit('role:created', role);
    
    return role;
  }

  public updateRole(roleId: string, updates: Partial<Role>): Role {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    if (role.isSystem) {
      throw new Error('Cannot update system role');
    }

    // Update allowed fields
    if (updates.name !== undefined) role.name = updates.name;
    if (updates.description !== undefined) role.description = updates.description;
    if (updates.permissions !== undefined) role.permissions = updates.permissions;

    role.updatedAt = new Date();
    
    // Update permissions for all users with this role
    for (const user of this.users.values()) {
      if (user.roles.some(r => r.id === roleId)) {
        this.updateUserPermissions(user);
      }
    }

    this.emit('role:updated', role);
    return role;
  }

  public deleteRole(roleId: string): void {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    if (role.isSystem) {
      throw new Error('Cannot delete system role');
    }

    // Remove role from users
    for (const user of this.users.values()) {
      user.roles = user.roles.filter(r => r.id !== roleId);
      if (user.roles.length === 0) {
        // Assign default viewer role
        const viewerRole = this.roles.get('viewer');
        if (viewerRole) user.roles.push(viewerRole);
      }
      this.updateUserPermissions(user);
    }

    this.roles.delete(roleId);
    this.emit('role:deleted', role);
  }

  private updateUserPermissions(user: User): void {
    const permissions = new Map<string, Permission>();
    for (const role of user.roles) {
      for (const perm of role.permissions) {
        permissions.set(perm.id, perm);
      }
    }
    user.permissions = Array.from(permissions.values());
    user.updatedAt = new Date();
  }

  public getRole(roleId: string): Role | undefined {
    return this.roles.get(roleId);
  }

  public getAllRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  public getAllPermissions(): Permission[] {
    return Object.values(PERMISSIONS);
  }

  private sanitizeUser(user: User): User {
    // Return user without password hash
    const { passwordHash, ...sanitized } = user;
    return sanitized as User;
  }
}