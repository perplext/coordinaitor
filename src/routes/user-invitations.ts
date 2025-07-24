import express from 'express';
import { UserInvitationService } from '../services/user-invitation-service';
import { authenticateToken } from '../middleware/auth-middleware';
import { TenantIsolationMiddleware } from '../middleware/tenant-isolation-middleware';
import winston from 'winston';

const router = express.Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Apply authentication and tenant isolation to all routes
router.use(authenticateToken);

const tenantMiddleware = new TenantIsolationMiddleware({
  strategy: 'header', // Default strategy, can be overridden by environment
  fallbackStrategy: 'path'
});
router.use(tenantMiddleware.isolate());

const invitationService = new UserInvitationService();

/**
 * @swagger
 * /api/invitations:
 *   post:
 *     summary: Send invitation to join organization
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address of the user to invite
 *               role:
 *                 type: string
 *                 enum: [owner, admin, member, viewer, billing]
 *                 description: Role to assign to the invited user
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Custom permissions (optional)
 *               personalMessage:
 *                 type: string
 *                 description: Personal message to include in invitation
 *               expiresInHours:
 *                 type: number
 *                 default: 168
 *                 description: Hours until invitation expires (default 7 days)
 *     responses:
 *       201:
 *         description: Invitation sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 invitation:
 *                   $ref: '#/components/schemas/UserInvitation'
 */
router.post('/', async (req, res) => {
  try {
    const { email, role, permissions, personalMessage, expiresInHours } = req.body;
    const organizationId = req.tenant?.organization?.id;
    const invitedBy = req.user?.id;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization context required'
      });
    }

    if (!invitedBy) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    if (!email || !role) {
      return res.status(400).json({
        success: false,
        error: 'Email and role are required'
      });
    }

    const invitation = await invitationService.sendInvitation({
      organizationId,
      email,
      role,
      permissions,
      invitedBy,
      personalMessage,
      expiresInHours
    });

    logger.info('Invitation sent', {
      invitationId: invitation.id,
      organizationId,
      email,
      invitedBy
    });

    res.status(201).json({
      success: true,
      invitation
    });
  } catch (error) {
    logger.error('Failed to send invitation:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send invitation'
    });
  }
});

/**
 * @swagger
 * /api/invitations/bulk:
 *   post:
 *     summary: Send bulk invitations
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invitations
 *             properties:
 *               invitations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - email
 *                     - role
 *                   properties:
 *                     email:
 *                       type: string
 *                       format: email
 *                     role:
 *                       type: string
 *                       enum: [owner, admin, member, viewer, billing]
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                     personalMessage:
 *                       type: string
 *               expiresInHours:
 *                 type: number
 *                 default: 168
 *     responses:
 *       202:
 *         description: Bulk invitation process started
 */
router.post('/bulk', async (req, res) => {
  try {
    const { invitations, expiresInHours } = req.body;
    const organizationId = req.tenant?.organization?.id;
    const invitedBy = req.user?.id;

    if (!organizationId || !invitedBy) {
      return res.status(400).json({
        success: false,
        error: 'Organization context and authentication required'
      });
    }

    if (!Array.isArray(invitations) || invitations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invitations array is required and must not be empty'
      });
    }

    const bulkInvitation = await invitationService.sendBulkInvitations({
      organizationId,
      invitations,
      invitedBy,
      expiresInHours
    });

    res.status(202).json({
      success: true,
      bulkInvitation
    });
  } catch (error) {
    logger.error('Failed to send bulk invitations:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send bulk invitations'
    });
  }
});

/**
 * @swagger
 * /api/invitations:
 *   get:
 *     summary: Get organization invitations
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, declined, expired, revoked]
 *         description: Filter by invitation status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of invitations to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: List of invitations
 */
router.get('/', async (req, res) => {
  try {
    const organizationId = req.tenant?.organization?.id;
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization context required'
      });
    }

    const { status, limit, offset } = req.query;
    const result = await invitationService.getOrganizationInvitations(organizationId, {
      status: status as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Failed to get invitations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get invitations'
    });
  }
});

/**
 * @swagger
 * /api/invitations/{invitationId}:
 *   delete:
 *     summary: Revoke invitation
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invitationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Invitation ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for revoking invitation
 *     responses:
 *       200:
 *         description: Invitation revoked successfully
 */
router.delete('/:invitationId', async (req, res) => {
  try {
    const { invitationId } = req.params;
    const { reason } = req.body;
    const revokedBy = req.user?.id;

    if (!revokedBy) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const invitation = await invitationService.revokeInvitation(invitationId, revokedBy, reason);

    res.json({
      success: true,
      invitation
    });
  } catch (error) {
    logger.error('Failed to revoke invitation:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revoke invitation'
    });
  }
});

/**
 * @swagger
 * /api/invitations/{invitationId}/resend:
 *   post:
 *     summary: Resend invitation
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invitationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Invitation ID
 *     responses:
 *       200:
 *         description: Invitation resent successfully
 */
router.post('/:invitationId/resend', async (req, res) => {
  try {
    const { invitationId } = req.params;
    const invitation = await invitationService.resendInvitation(invitationId);

    res.json({
      success: true,
      invitation
    });
  } catch (error) {
    logger.error('Failed to resend invitation:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resend invitation'
    });
  }
});

/**
 * @swagger
 * /api/invitations/accept/{token}:
 *   post:
 *     summary: Accept invitation by token
 *     tags: [Invitations]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Invitation token
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               preferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: Invitation accepted successfully
 */
router.post('/accept/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { firstName, lastName, preferences } = req.body;

    const result = await invitationService.acceptInvitation(token, {
      firstName,
      lastName,
      preferences
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Failed to accept invitation:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to accept invitation'
    });
  }
});

/**
 * @swagger
 * /api/invitations/decline/{token}:
 *   post:
 *     summary: Decline invitation by token
 *     tags: [Invitations]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Invitation token
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for declining
 *     responses:
 *       200:
 *         description: Invitation declined successfully
 */
router.post('/decline/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { reason } = req.body;

    const invitation = await invitationService.declineInvitation(token, reason);

    res.json({
      success: true,
      invitation
    });
  } catch (error) {
    logger.error('Failed to decline invitation:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to decline invitation'
    });
  }
});

/**
 * @swagger
 * /api/invitations/stats:
 *   get:
 *     summary: Get invitation statistics
 *     tags: [Invitations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Invitation statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const organizationId = req.tenant?.organization?.id;
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization context required'
      });
    }

    const stats = await invitationService.getInvitationStats(organizationId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Failed to get invitation stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get invitation stats'
    });
  }
});

/**
 * Organization Users Routes
 */

/**
 * @swagger
 * /api/invitations/users:
 *   get:
 *     summary: Get organization users
 *     tags: [Organization Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended, pending_activation]
 *         description: Filter by user status
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [owner, admin, member, viewer, billing]
 *         description: Filter by user role
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of organization users
 */
router.get('/users', async (req, res) => {
  try {
    const organizationId = req.tenant?.organization?.id;
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization context required'
      });
    }

    const { status, role, limit, offset } = req.query;
    const result = await invitationService.getOrganizationUsers(organizationId, {
      status: status as string,
      role: role as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Failed to get organization users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get organization users'
    });
  }
});

/**
 * @swagger
 * /api/invitations/users/{userId}/role:
 *   put:
 *     summary: Update user role and permissions
 *     tags: [Organization Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [owner, admin, member, viewer, billing]
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: User role updated successfully
 */
router.put('/users/:userId/role', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, permissions } = req.body;
    const organizationId = req.tenant?.organization?.id;
    const updatedBy = req.user?.id;

    if (!organizationId || !updatedBy) {
      return res.status(400).json({
        success: false,
        error: 'Organization context and authentication required'
      });
    }

    const user = await invitationService.updateUserRole(organizationId, userId, {
      role,
      permissions,
      updatedBy
    });

    res.json({
      success: true,
      user
    });
  } catch (error) {
    logger.error('Failed to update user role:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update user role'
    });
  }
});

/**
 * @swagger
 * /api/invitations/users/{userId}:
 *   delete:
 *     summary: Remove user from organization
 *     tags: [Organization Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for removing user
 *     responses:
 *       200:
 *         description: User removed successfully
 */
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const organizationId = req.tenant?.organization?.id;
    const removedBy = req.user?.id;

    if (!organizationId || !removedBy) {
      return res.status(400).json({
        success: false,
        error: 'Organization context and authentication required'
      });
    }

    await invitationService.removeUser(organizationId, userId, removedBy, reason);

    res.json({
      success: true,
      message: 'User removed successfully'
    });
  } catch (error) {
    logger.error('Failed to remove user:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove user'
    });
  }
});

export default router;