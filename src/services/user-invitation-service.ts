import { EventEmitter } from 'events';
import { DatabaseService } from '../database/database-service';
import { OrganizationService } from './organization-service';
import { NotificationService } from './notification-service';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export interface UserInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer' | 'billing';
  permissions: string[];
  invitedBy: string;
  invitedByEmail: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
  token: string;
  expiresAt: Date;
  acceptedAt?: Date;
  declinedAt?: Date;
  revokedAt?: Date;
  revokedBy?: string;
  personalMessage?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationUser {
  id: string;
  organizationId: string;
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer' | 'billing';
  permissions: string[];
  status: 'active' | 'inactive' | 'suspended' | 'pending_activation';
  invitationId?: string;
  joinedAt: Date;
  lastLoginAt?: Date;
  lastActiveAt?: Date;
  preferences?: {
    notifications: {
      email: boolean;
      slack: boolean;
      inApp: boolean;
    };
    timezone: string;
    language: string;
    theme: 'light' | 'dark' | 'auto';
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BulkInvitation {
  id: string;
  organizationId: string;
  createdBy: string;
  totalInvites: number;
  successfulInvites: number;
  failedInvites: number;
  status: 'processing' | 'completed' | 'failed';
  invitations: string[]; // Array of invitation IDs
  errors?: string[];
  createdAt: Date;
  completedAt?: Date;
}

export interface InvitationStats {
  organizationId: string;
  totalInvitations: number;
  pendingInvitations: number;
  acceptedInvitations: number;
  declinedInvitations: number;
  expiredInvitations: number;
  revokedInvitations: number;
  recentInvitations: UserInvitation[];
}

export class UserInvitationService extends EventEmitter {
  private db: DatabaseService;
  private organizationService: OrganizationService;
  private notificationService: NotificationService | null;
  private logger: winston.Logger;
  private defaultExpiryHours: number = 168; // 7 days

  constructor(notificationService: NotificationService | null = null) {
    super();
    this.db = DatabaseService.getInstance();
    this.organizationService = new OrganizationService();
    this.notificationService = notificationService;

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        }),
        new winston.transports.File({ 
          filename: 'logs/user-invitation-service.log',
          maxsize: 10485760,
          maxFiles: 5
        })
      ]
    });
  }

  /**
   * Send invitation to join organization
   */
  async sendInvitation(data: {
    organizationId: string;
    email: string;
    role: string;
    permissions?: string[];
    invitedBy: string;
    personalMessage?: string;
    expiresInHours?: number;
  }): Promise<UserInvitation> {
    try {
      // Validate organization exists
      const organization = await this.organizationService.getOrganization(data.organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      // Check if user is already invited or is a member
      const existingInvitation = await this.getActiveInvitationByEmail(data.organizationId, data.email);
      if (existingInvitation) {
        throw new Error('User already has a pending invitation');
      }

      const existingUser = await this.getOrganizationUserByEmail(data.organizationId, data.email);
      if (existingUser) {
        throw new Error('User is already a member of this organization');
      }

      // Validate role and permissions
      const validatedRole = this.validateRole(data.role);
      const validatedPermissions = this.getDefaultPermissionsForRole(validatedRole, data.permissions);

      // Generate secure token
      const token = this.generateInvitationToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + (data.expiresInHours || this.defaultExpiryHours));

      // Get inviter information
      const inviterUser = await this.getUserById(data.invitedBy);
      const inviterEmail = inviterUser?.email || 'unknown@example.com';

      const invitation: UserInvitation = {
        id: uuidv4(),
        organizationId: data.organizationId,
        email: data.email.toLowerCase(),
        role: validatedRole,
        permissions: validatedPermissions,
        invitedBy: data.invitedBy,
        invitedByEmail: inviterEmail,
        status: 'pending',
        token,
        expiresAt,
        personalMessage: data.personalMessage,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save invitation to database
      await this.db.executeQuery(
        `INSERT INTO user_invitations (
          id, organization_id, email, role, permissions, invited_by, 
          invited_by_email, status, token, expires_at, personal_message, 
          metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          invitation.id, invitation.organizationId, invitation.email,
          invitation.role, JSON.stringify(invitation.permissions),
          invitation.invitedBy, invitation.invitedByEmail, invitation.status,
          invitation.token, invitation.expiresAt, invitation.personalMessage,
          JSON.stringify(invitation.metadata), invitation.createdAt, invitation.updatedAt
        ]
      );

      // Send invitation email
      await this.sendInvitationEmail(invitation, organization);

      this.logger.info('User invitation sent', {
        invitationId: invitation.id,
        organizationId: data.organizationId,
        email: data.email,
        role: data.role,
        invitedBy: data.invitedBy
      });

      this.emit('invitation:sent', { invitation, organization });

      return invitation;
    } catch (error) {
      this.logger.error('Failed to send invitation:', error);
      throw error;
    }
  }

  /**
   * Send bulk invitations
   */
  async sendBulkInvitations(data: {
    organizationId: string;
    invitations: Array<{
      email: string;
      role: string;
      permissions?: string[];
      personalMessage?: string;
    }>;
    invitedBy: string;
    expiresInHours?: number;
  }): Promise<BulkInvitation> {
    try {
      const bulkInvitation: BulkInvitation = {
        id: uuidv4(),
        organizationId: data.organizationId,
        createdBy: data.invitedBy,
        totalInvites: data.invitations.length,
        successfulInvites: 0,
        failedInvites: 0,
        status: 'processing',
        invitations: [],
        errors: [],
        createdAt: new Date()
      };

      // Save bulk invitation record
      await this.db.executeQuery(
        `INSERT INTO bulk_invitations (
          id, organization_id, created_by, total_invites, successful_invites,
          failed_invites, status, invitations, errors, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          bulkInvitation.id, bulkInvitation.organizationId, bulkInvitation.createdBy,
          bulkInvitation.totalInvites, bulkInvitation.successfulInvites,
          bulkInvitation.failedInvites, bulkInvitation.status,
          JSON.stringify(bulkInvitation.invitations), JSON.stringify(bulkInvitation.errors),
          bulkInvitation.createdAt
        ]
      );

      // Process invitations asynchronously
      this.processBulkInvitations(bulkInvitation, data);

      return bulkInvitation;
    } catch (error) {
      this.logger.error('Failed to initiate bulk invitations:', error);
      throw error;
    }
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(token: string, userData?: {
    firstName?: string;
    lastName?: string;
    preferences?: any;
  }): Promise<{ invitation: UserInvitation; user: OrganizationUser }> {
    try {
      // Get invitation by token
      const invitation = await this.getInvitationByToken(token);
      if (!invitation) {
        throw new Error('Invalid invitation token');
      }

      // Check if invitation is still valid
      if (invitation.status !== 'pending') {
        throw new Error(`Invitation is ${invitation.status}`);
      }

      if (new Date() > invitation.expiresAt) {
        // Mark as expired
        await this.updateInvitationStatus(invitation.id, 'expired');
        throw new Error('Invitation has expired');
      }

      // Create or update user in organization
      const user = await this.createOrganizationUser({
        organizationId: invitation.organizationId,
        email: invitation.email,
        firstName: userData?.firstName,
        lastName: userData?.lastName,
        role: invitation.role,
        permissions: invitation.permissions,
        invitationId: invitation.id,
        preferences: userData?.preferences
      });

      // Mark invitation as accepted
      const updatedInvitation = await this.updateInvitationStatus(invitation.id, 'accepted', {
        acceptedAt: new Date()
      });

      this.logger.info('Invitation accepted', {
        invitationId: invitation.id,
        organizationId: invitation.organizationId,
        email: invitation.email,
        userId: user.id
      });

      this.emit('invitation:accepted', { invitation: updatedInvitation, user });

      return { invitation: updatedInvitation, user };
    } catch (error) {
      this.logger.error('Failed to accept invitation:', error);
      throw error;
    }
  }

  /**
   * Decline invitation
   */
  async declineInvitation(token: string, reason?: string): Promise<UserInvitation> {
    try {
      const invitation = await this.getInvitationByToken(token);
      if (!invitation) {
        throw new Error('Invalid invitation token');
      }

      if (invitation.status !== 'pending') {
        throw new Error(`Invitation is ${invitation.status}`);
      }

      const updatedInvitation = await this.updateInvitationStatus(invitation.id, 'declined', {
        declinedAt: new Date(),
        metadata: { ...invitation.metadata, declineReason: reason }
      });

      this.logger.info('Invitation declined', {
        invitationId: invitation.id,
        organizationId: invitation.organizationId,
        email: invitation.email,
        reason
      });

      this.emit('invitation:declined', { invitation: updatedInvitation, reason });

      return updatedInvitation;
    } catch (error) {
      this.logger.error('Failed to decline invitation:', error);
      throw error;
    }
  }

  /**
   * Revoke invitation
   */
  async revokeInvitation(invitationId: string, revokedBy: string, reason?: string): Promise<UserInvitation> {
    try {
      const invitation = await this.getInvitationById(invitationId);
      if (!invitation) {
        throw new Error('Invitation not found');
      }

      if (invitation.status !== 'pending') {
        throw new Error(`Cannot revoke ${invitation.status} invitation`);
      }

      const updatedInvitation = await this.updateInvitationStatus(invitationId, 'revoked', {
        revokedAt: new Date(),
        revokedBy,
        metadata: { ...invitation.metadata, revokeReason: reason }
      });

      this.logger.info('Invitation revoked', {
        invitationId,
        organizationId: invitation.organizationId,
        email: invitation.email,
        revokedBy,
        reason
      });

      this.emit('invitation:revoked', { invitation: updatedInvitation, revokedBy, reason });

      return updatedInvitation;
    } catch (error) {
      this.logger.error('Failed to revoke invitation:', error);
      throw error;
    }
  }

  /**
   * Resend invitation
   */
  async resendInvitation(invitationId: string): Promise<UserInvitation> {
    try {
      const invitation = await this.getInvitationById(invitationId);
      if (!invitation) {
        throw new Error('Invitation not found');
      }

      if (invitation.status !== 'pending') {
        throw new Error(`Cannot resend ${invitation.status} invitation`);
      }

      // Extend expiry
      const newExpiresAt = new Date();
      newExpiresAt.setHours(newExpiresAt.getHours() + this.defaultExpiryHours);

      await this.db.executeQuery(
        'UPDATE user_invitations SET expires_at = $1, updated_at = $2 WHERE id = $3',
        [newExpiresAt, new Date(), invitationId]
      );

      const updatedInvitation = { ...invitation, expiresAt: newExpiresAt };

      // Resend email
      const organization = await this.organizationService.getOrganization(invitation.organizationId);
      if (organization) {
        await this.sendInvitationEmail(updatedInvitation, organization);
      }

      this.logger.info('Invitation resent', {
        invitationId,
        organizationId: invitation.organizationId,
        email: invitation.email
      });

      this.emit('invitation:resent', { invitation: updatedInvitation });

      return updatedInvitation;
    } catch (error) {
      this.logger.error('Failed to resend invitation:', error);
      throw error;
    }
  }

  /**
   * Get organization invitations
   */
  async getOrganizationInvitations(organizationId: string, options: {
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ invitations: UserInvitation[]; total: number }> {
    try {
      const { status, limit = 20, offset = 0 } = options;

      let whereClause = 'WHERE organization_id = $1';
      const params: any[] = [organizationId];
      let paramIndex = 2;

      if (status) {
        whereClause += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      // Get total count
      const countResult = await this.db.executeQuery(
        `SELECT COUNT(*) FROM user_invitations ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // Get invitations
      const result = await this.db.executeQuery(
        `SELECT * FROM user_invitations ${whereClause} 
         ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      const invitations = result.rows.map(row => this.mapRowToInvitation(row));

      return { invitations, total };
    } catch (error) {
      this.logger.error('Failed to get organization invitations:', error);
      throw error;
    }
  }

  /**
   * Get organization users
   */
  async getOrganizationUsers(organizationId: string, options: {
    status?: string;
    role?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ users: OrganizationUser[]; total: number }> {
    try {
      const { status, role, limit = 20, offset = 0 } = options;

      let whereClause = 'WHERE organization_id = $1';
      const params: any[] = [organizationId];
      let paramIndex = 2;

      if (status) {
        whereClause += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (role) {
        whereClause += ` AND role = $${paramIndex}`;
        params.push(role);
        paramIndex++;
      }

      // Get total count
      const countResult = await this.db.executeQuery(
        `SELECT COUNT(*) FROM organization_users ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      // Get users
      const result = await this.db.executeQuery(
        `SELECT * FROM organization_users ${whereClause} 
         ORDER BY joined_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      const users = result.rows.map(row => this.mapRowToOrganizationUser(row));

      return { users, total };
    } catch (error) {
      this.logger.error('Failed to get organization users:', error);
      throw error;
    }
  }

  /**
   * Update user role and permissions
   */
  async updateUserRole(organizationId: string, userId: string, data: {
    role?: string;
    permissions?: string[];
    updatedBy: string;
  }): Promise<OrganizationUser> {
    try {
      const user = await this.getOrganizationUser(organizationId, userId);
      if (!user) {
        throw new Error('User not found in organization');
      }

      const updates: any = { updatedAt: new Date() };

      if (data.role) {
        updates.role = this.validateRole(data.role);
      }

      if (data.permissions) {
        updates.permissions = data.permissions;
      }

      await this.db.executeQuery(
        `UPDATE organization_users SET 
          role = COALESCE($1, role),
          permissions = COALESCE($2, permissions),
          updated_at = $3
         WHERE organization_id = $4 AND user_id = $5`,
        [
          updates.role, JSON.stringify(updates.permissions),
          updates.updatedAt, organizationId, userId
        ]
      );

      const updatedUser = { ...user, ...updates };

      this.logger.info('User role updated', {
        organizationId,
        userId,
        oldRole: user.role,
        newRole: updates.role,
        updatedBy: data.updatedBy
      });

      this.emit('user:role_updated', { user: updatedUser, updatedBy: data.updatedBy });

      return updatedUser;
    } catch (error) {
      this.logger.error('Failed to update user role:', error);
      throw error;
    }
  }

  /**
   * Remove user from organization
   */
  async removeUser(organizationId: string, userId: string, removedBy: string, reason?: string): Promise<void> {
    try {
      const user = await this.getOrganizationUser(organizationId, userId);
      if (!user) {
        throw new Error('User not found in organization');
      }

      // Don't allow removing the last owner
      if (user.role === 'owner') {
        const ownerCount = await this.getOwnerCount(organizationId);
        if (ownerCount <= 1) {
          throw new Error('Cannot remove the last owner from organization');
        }
      }

      await this.db.executeQuery(
        'DELETE FROM organization_users WHERE organization_id = $1 AND user_id = $2',
        [organizationId, userId]
      );

      this.logger.info('User removed from organization', {
        organizationId,
        userId,
        userEmail: user.email,
        removedBy,
        reason
      });

      this.emit('user:removed', { user, removedBy, reason });
    } catch (error) {
      this.logger.error('Failed to remove user from organization:', error);
      throw error;
    }
  }

  /**
   * Get invitation statistics
   */
  async getInvitationStats(organizationId: string): Promise<InvitationStats> {
    try {
      const result = await this.db.executeQuery(
        `SELECT 
          COUNT(*) as total_invitations,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_invitations,
          COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_invitations,
          COUNT(CASE WHEN status = 'declined' THEN 1 END) as declined_invitations,
          COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_invitations,
          COUNT(CASE WHEN status = 'revoked' THEN 1 END) as revoked_invitations
         FROM user_invitations WHERE organization_id = $1`,
        [organizationId]
      );

      const stats = result.rows[0];

      // Get recent invitations
      const recentResult = await this.db.executeQuery(
        `SELECT * FROM user_invitations 
         WHERE organization_id = $1 
         ORDER BY created_at DESC LIMIT 10`,
        [organizationId]
      );

      const recentInvitations = recentResult.rows.map(row => this.mapRowToInvitation(row));

      return {
        organizationId,
        totalInvitations: parseInt(stats.total_invitations),
        pendingInvitations: parseInt(stats.pending_invitations),
        acceptedInvitations: parseInt(stats.accepted_invitations),
        declinedInvitations: parseInt(stats.declined_invitations),
        expiredInvitations: parseInt(stats.expired_invitations),
        revokedInvitations: parseInt(stats.revoked_invitations),
        recentInvitations
      };
    } catch (error) {
      this.logger.error('Failed to get invitation stats:', error);
      throw error;
    }
  }

  /**
   * Process bulk invitations
   */
  private async processBulkInvitations(bulkInvitation: BulkInvitation, data: any): Promise<void> {
    const results = {
      successful: 0,
      failed: 0,
      invitations: [] as string[],
      errors: [] as string[]
    };

    for (const invitationData of data.invitations) {
      try {
        const invitation = await this.sendInvitation({
          organizationId: data.organizationId,
          email: invitationData.email,
          role: invitationData.role,
          permissions: invitationData.permissions,
          invitedBy: data.invitedBy,
          personalMessage: invitationData.personalMessage,
          expiresInHours: data.expiresInHours
        });

        results.successful++;
        results.invitations.push(invitation.id);
      } catch (error) {
        results.failed++;
        results.errors.push(`${invitationData.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Update bulk invitation record
    await this.db.executeQuery(
      `UPDATE bulk_invitations SET 
        successful_invites = $1, failed_invites = $2, status = $3,
        invitations = $4, errors = $5, completed_at = $6
       WHERE id = $7`,
      [
        results.successful, results.failed, 'completed',
        JSON.stringify(results.invitations), JSON.stringify(results.errors),
        new Date(), bulkInvitation.id
      ]
    );

    this.emit('bulk_invitation:completed', {
      bulkInvitationId: bulkInvitation.id,
      successful: results.successful,
      failed: results.failed,
      errors: results.errors
    });
  }

  /**
   * Send invitation email
   */
  private async sendInvitationEmail(invitation: UserInvitation, organization: any): Promise<void> {
    if (!this.notificationService) {
      this.logger.warn('No notification service configured, skipping invitation email');
      return;
    }

    const inviteUrl = `${process.env.APP_URL || 'http://localhost:3000'}/invite/${invitation.token}`;

    const emailContent = {
      to: invitation.email,
      subject: `You're invited to join ${organization.displayName}`,
      template: 'user-invitation',
      data: {
        organizationName: organization.displayName,
        inviterName: invitation.invitedByEmail,
        inviteUrl,
        role: invitation.role,
        personalMessage: invitation.personalMessage,
        expiresAt: invitation.expiresAt.toLocaleDateString()
      }
    };

    try {
      await this.notificationService.sendEmail(emailContent);
    } catch (error) {
      this.logger.error('Failed to send invitation email:', error);
      // Don't throw error as invitation was created successfully
    }
  }

  /**
   * Generate secure invitation token
   */
  private generateInvitationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate role
   */
  private validateRole(role: string): 'owner' | 'admin' | 'member' | 'viewer' | 'billing' {
    const validRoles = ['owner', 'admin', 'member', 'viewer', 'billing'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }
    return role as any;
  }

  /**
   * Get default permissions for role
   */
  private getDefaultPermissionsForRole(role: string, customPermissions?: string[]): string[] {
    if (customPermissions) {
      return customPermissions;
    }

    const defaultPermissions: Record<string, string[]> = {
      owner: ['*'],
      admin: ['users:read', 'users:write', 'projects:read', 'projects:write', 'tasks:read', 'tasks:write', 'settings:read', 'settings:write'],
      member: ['projects:read', 'projects:write', 'tasks:read', 'tasks:write'],
      viewer: ['projects:read', 'tasks:read'],
      billing: ['billing:read', 'billing:write', 'users:read']
    };

    return defaultPermissions[role] || defaultPermissions.member;
  }

  /**
   * Helper methods for database operations
   */
  private async getInvitationByToken(token: string): Promise<UserInvitation | null> {
    const result = await this.db.executeQuery(
      'SELECT * FROM user_invitations WHERE token = $1',
      [token]
    );

    return result.rows.length > 0 ? this.mapRowToInvitation(result.rows[0]) : null;
  }

  private async getInvitationById(id: string): Promise<UserInvitation | null> {
    const result = await this.db.executeQuery(
      'SELECT * FROM user_invitations WHERE id = $1',
      [id]
    );

    return result.rows.length > 0 ? this.mapRowToInvitation(result.rows[0]) : null;
  }

  private async getActiveInvitationByEmail(organizationId: string, email: string): Promise<UserInvitation | null> {
    const result = await this.db.executeQuery(
      'SELECT * FROM user_invitations WHERE organization_id = $1 AND email = $2 AND status = $3',
      [organizationId, email.toLowerCase(), 'pending']
    );

    return result.rows.length > 0 ? this.mapRowToInvitation(result.rows[0]) : null;
  }

  private async getOrganizationUserByEmail(organizationId: string, email: string): Promise<OrganizationUser | null> {
    const result = await this.db.executeQuery(
      'SELECT * FROM organization_users WHERE organization_id = $1 AND email = $2',
      [organizationId, email.toLowerCase()]
    );

    return result.rows.length > 0 ? this.mapRowToOrganizationUser(result.rows[0]) : null;
  }

  private async getOrganizationUser(organizationId: string, userId: string): Promise<OrganizationUser | null> {
    const result = await this.db.executeQuery(
      'SELECT * FROM organization_users WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId]
    );

    return result.rows.length > 0 ? this.mapRowToOrganizationUser(result.rows[0]) : null;
  }

  private async getUserById(userId: string): Promise<any> {
    // This would typically query a users table
    // For now, return a mock user
    return { id: userId, email: 'user@example.com' };
  }

  private async getOwnerCount(organizationId: string): Promise<number> {
    const result = await this.db.executeQuery(
      'SELECT COUNT(*) FROM organization_users WHERE organization_id = $1 AND role = $2',
      [organizationId, 'owner']
    );

    return parseInt(result.rows[0].count);
  }

  private async updateInvitationStatus(id: string, status: string, updates: any = {}): Promise<UserInvitation> {
    const setClause = ['status = $2', 'updated_at = $3'];
    const params = [id, status, new Date()];
    let paramIndex = 4;

    if (updates.acceptedAt) {
      setClause.push(`accepted_at = $${paramIndex}`);
      params.push(updates.acceptedAt);
      paramIndex++;
    }

    if (updates.declinedAt) {
      setClause.push(`declined_at = $${paramIndex}`);
      params.push(updates.declinedAt);
      paramIndex++;
    }

    if (updates.revokedAt) {
      setClause.push(`revoked_at = $${paramIndex}`);
      params.push(updates.revokedAt);
      paramIndex++;
    }

    if (updates.revokedBy) {
      setClause.push(`revoked_by = $${paramIndex}`);
      params.push(updates.revokedBy);
      paramIndex++;
    }

    if (updates.metadata) {
      setClause.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(updates.metadata));
      paramIndex++;
    }

    await this.db.executeQuery(
      `UPDATE user_invitations SET ${setClause.join(', ')} WHERE id = $1`,
      params
    );

    const result = await this.db.executeQuery(
      'SELECT * FROM user_invitations WHERE id = $1',
      [id]
    );

    return this.mapRowToInvitation(result.rows[0]);
  }

  private async createOrganizationUser(data: {
    organizationId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
    permissions: string[];
    invitationId?: string;
    preferences?: any;
  }): Promise<OrganizationUser> {
    const user: OrganizationUser = {
      id: uuidv4(),
      organizationId: data.organizationId,
      userId: uuidv4(), // This would typically be the user's global ID
      email: data.email.toLowerCase(),
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role as any,
      permissions: data.permissions,
      status: 'active',
      invitationId: data.invitationId,
      joinedAt: new Date(),
      preferences: data.preferences || {
        notifications: { email: true, slack: false, inApp: true },
        timezone: 'UTC',
        language: 'en',
        theme: 'auto'
      },
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.executeQuery(
      `INSERT INTO organization_users (
        id, organization_id, user_id, email, first_name, last_name,
        role, permissions, status, invitation_id, joined_at,
        preferences, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        user.id, user.organizationId, user.userId, user.email,
        user.firstName, user.lastName, user.role,
        JSON.stringify(user.permissions), user.status, user.invitationId,
        user.joinedAt, JSON.stringify(user.preferences),
        JSON.stringify(user.metadata), user.createdAt, user.updatedAt
      ]
    );

    return user;
  }

  /**
   * Map database rows to objects
   */
  private mapRowToInvitation(row: any): UserInvitation {
    return {
      id: row.id,
      organizationId: row.organization_id,
      email: row.email,
      role: row.role,
      permissions: JSON.parse(row.permissions || '[]'),
      invitedBy: row.invited_by,
      invitedByEmail: row.invited_by_email,
      status: row.status,
      token: row.token,
      expiresAt: new Date(row.expires_at),
      acceptedAt: row.accepted_at ? new Date(row.accepted_at) : undefined,
      declinedAt: row.declined_at ? new Date(row.declined_at) : undefined,
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : undefined,
      revokedBy: row.revoked_by,
      personalMessage: row.personal_message,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapRowToOrganizationUser(row: any): OrganizationUser {
    return {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      permissions: JSON.parse(row.permissions || '[]'),
      status: row.status,
      invitationId: row.invitation_id,
      joinedAt: new Date(row.joined_at),
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
      lastActiveAt: row.last_active_at ? new Date(row.last_active_at) : undefined,
      preferences: JSON.parse(row.preferences || '{}'),
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

export default UserInvitationService;