import { Router, Request, Response } from 'express';
import { ApprovalService } from '../../services/approval-service';
import { authenticate, authorize } from '../../middleware/auth';
import { AuthRequest } from '../../interfaces/auth.interface';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';

const submitApprovalSchema = z.object({
  body: z.object({
    decision: z.enum(['approved', 'rejected']),
    comment: z.string().optional()
  })
});

export function createApprovalRoutes(approvalService: ApprovalService): Router {
  const router = Router();

  // Get all pending approvals for current user
  router.get('/pending', authenticate, async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user.id;
      
      const approvals = approvalService.getApprovalRequestsByApprover(userId);
      
      res.json({
        approvals: approvals.map(approval => ({
          id: approval.id,
          workflowName: approval.workflowName,
          stepName: approval.stepName,
          requestedBy: approval.requestedBy,
          createdAt: approval.createdAt,
          expiresAt: approval.expiresAt,
          description: approval.description,
          requiredApprovals: approval.requiredApprovals,
          currentApprovals: approval.approvals.length,
          metadata: approval.metadata
        }))
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch pending approvals' });
    }
  });

  // Get specific approval request
  router.get('/:id', authenticate, async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      
      const approval = approvalService.getApprovalRequest(id);
      if (!approval) {
        return res.status(404).json({ error: 'Approval request not found' });
      }

      // Check if user is authorized to view this approval
      const userId = authReq.user.id;
      const isApprover = approval.approvers.includes(userId);
      const isRequester = approval.requestedBy === userId;
      const isAdmin = authReq.user.roles.some(role => role.id === 'admin');

      if (!isApprover && !isRequester && !isAdmin) {
        return res.status(403).json({ error: 'Not authorized to view this approval' });
      }

      res.json({ approval });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch approval request' });
    }
  });

  // Submit approval decision
  router.post('/:id/decision', authenticate, validateRequest(submitApprovalSchema), async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const { id } = req.params;
      const { decision, comment } = req.body;
      const userId = authReq.user.id;

      const approval = await approvalService.submitApproval(id, userId, decision, comment);
      
      res.json({ 
        approval,
        message: `Approval ${decision} successfully`
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('not authorized') || error.message.includes('already submitted')) {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to submit approval decision' });
    }
  });

  // Get approval history for a workflow execution
  router.get('/workflow/:workflowExecutionId', authenticate, async (req: Request, res: Response) => {
    try {
      const { workflowExecutionId } = req.params;
      
      const approvals = approvalService.getApprovalRequestsByWorkflow(workflowExecutionId);
      
      res.json({ approvals });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch workflow approvals' });
    }
  });

  // Cancel approval request (admin only)
  router.delete('/:id', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      await approvalService.cancelApprovalRequest(id, reason);
      
      res.json({ message: 'Approval request cancelled successfully' });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('Cannot cancel')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to cancel approval request' });
    }
  });

  // Get all pending approvals (admin only)
  router.get('/', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
    try {
      const approvals = approvalService.getAllPendingApprovals();
      
      res.json({ approvals });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch all approvals' });
    }
  });

  return router;
}