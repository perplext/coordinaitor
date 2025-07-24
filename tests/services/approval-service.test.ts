import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ApprovalService, ApprovalRequest } from '../../src/services/approval-service';
import { NotificationService } from '../../src/services/notification-service';

// Mock NotificationService
jest.mock('../../src/services/notification-service');

describe('ApprovalService', () => {
  let approvalService: ApprovalService;
  let mockNotificationService: jest.Mocked<NotificationService>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationService = new NotificationService({}) as jest.Mocked<NotificationService>;
    mockNotificationService.notifyApprovalRequired = jest.fn().mockResolvedValue(undefined);
    mockNotificationService.notifyApprovalResolved = jest.fn().mockResolvedValue(undefined);
    
    approvalService = new ApprovalService(mockNotificationService);
  });

  describe('createApprovalRequest', () => {
    it('should create an approval request with default policy', async () => {
      const params = {
        workflowExecutionId: 'wf-exec-1',
        workflowStepId: 'step-1',
        stepName: 'Deploy to Production',
        workflowName: 'Production Deployment',
        requestedBy: 'user-1',
        approvers: ['admin-1', 'admin-2'],
        description: 'Test approval'
      };

      const request = await approvalService.createApprovalRequest(params);

      expect(request).toMatchObject({
        workflowExecutionId: params.workflowExecutionId,
        workflowStepId: params.workflowStepId,
        stepName: params.stepName,
        approvers: params.approvers,
        status: 'pending',
        requiredApprovals: 1,
        approvals: []
      });
      expect(request.id).toBeDefined();
      expect(request.createdAt).toBeInstanceOf(Date);
    });

    it('should create an approval request requiring all approvers', async () => {
      const params = {
        workflowExecutionId: 'wf-exec-1',
        workflowStepId: 'step-1',
        stepName: 'Critical Update',
        workflowName: 'System Update',
        requestedBy: 'user-1',
        approvers: ['admin-1', 'admin-2', 'admin-3'],
        policy: {
          allApproversRequired: true
        }
      };

      const request = await approvalService.createApprovalRequest(params);

      expect(request.requiredApprovals).toBe(3);
    });

    it('should set expiration time when timeout is specified', async () => {
      const timeoutMs = 60000; // 1 minute
      const params = {
        workflowExecutionId: 'wf-exec-1',
        workflowStepId: 'step-1',
        stepName: 'Quick Decision',
        workflowName: 'Fast Workflow',
        requestedBy: 'user-1',
        approvers: ['admin-1'],
        policy: {
          timeout: timeoutMs
        }
      };

      const request = await approvalService.createApprovalRequest(params);

      expect(request.expiresAt).toBeInstanceOf(Date);
      const expectedExpiration = new Date(request.createdAt.getTime() + timeoutMs);
      expect(Math.abs(request.expiresAt!.getTime() - expectedExpiration.getTime())).toBeLessThan(1000);
    });

    it('should throw error if no approvers specified', async () => {
      const params = {
        workflowExecutionId: 'wf-exec-1',
        workflowStepId: 'step-1',
        stepName: 'Deploy',
        workflowName: 'Deployment',
        requestedBy: 'user-1',
        approvers: []
      };

      await expect(approvalService.createApprovalRequest(params)).rejects.toThrow(
        'At least one approver must be specified'
      );
    });

    it('should send notifications to approvers', async () => {
      const params = {
        workflowExecutionId: 'wf-exec-1',
        workflowStepId: 'step-1',
        stepName: 'Deploy',
        workflowName: 'Deployment',
        requestedBy: 'user-1',
        approvers: ['admin-1', 'admin-2']
      };

      await approvalService.createApprovalRequest(params);

      expect(mockNotificationService.notifyApprovalRequired).toHaveBeenCalledTimes(2);
    });
  });

  describe('submitApproval', () => {
    let testRequest: ApprovalRequest;

    beforeEach(async () => {
      const params = {
        workflowExecutionId: 'wf-exec-1',
        workflowStepId: 'step-1',
        stepName: 'Deploy',
        workflowName: 'Deployment',
        requestedBy: 'user-1',
        approvers: ['admin-1', 'admin-2', 'admin-3'],
        policy: {
          requiredApprovals: 2
        }
      };
      testRequest = await approvalService.createApprovalRequest(params);
    });

    it('should submit an approval decision', async () => {
      const updated = await approvalService.submitApproval(
        testRequest.id,
        'admin-1',
        'approved',
        'Looks good'
      );

      expect(updated.approvals).toHaveLength(1);
      expect(updated.approvals[0]).toMatchObject({
        approverId: 'admin-1',
        decision: 'approved',
        comment: 'Looks good'
      });
      expect(updated.status).toBe('pending'); // Still pending, needs 2 approvals
    });

    it('should resolve request when required approvals are met', async () => {
      await approvalService.submitApproval(testRequest.id, 'admin-1', 'approved');
      const updated = await approvalService.submitApproval(testRequest.id, 'admin-2', 'approved');

      expect(updated.status).toBe('approved');
      expect(mockNotificationService.notifyApprovalResolved).toHaveBeenCalledWith({
        approvalRequest: expect.objectContaining({ id: testRequest.id }),
        resolution: 'approved'
      });
    });

    it('should reject request immediately on any rejection', async () => {
      const updated = await approvalService.submitApproval(
        testRequest.id,
        'admin-1',
        'rejected',
        'Not ready'
      );

      expect(updated.status).toBe('rejected');
      expect(updated.approvals).toHaveLength(1);
    });

    it('should throw error if request not found', async () => {
      await expect(
        approvalService.submitApproval('non-existent', 'admin-1', 'approved')
      ).rejects.toThrow('Approval request not found');
    });

    it('should throw error if request already resolved', async () => {
      await approvalService.submitApproval(testRequest.id, 'admin-1', 'rejected');
      
      await expect(
        approvalService.submitApproval(testRequest.id, 'admin-2', 'approved')
      ).rejects.toThrow('Approval request is already rejected');
    });

    it('should throw error if user not authorized', async () => {
      await expect(
        approvalService.submitApproval(testRequest.id, 'unauthorized-user', 'approved')
      ).rejects.toThrow('User is not authorized to approve this request');
    });

    it('should throw error if user already submitted decision', async () => {
      await approvalService.submitApproval(testRequest.id, 'admin-1', 'approved');
      
      await expect(
        approvalService.submitApproval(testRequest.id, 'admin-1', 'approved')
      ).rejects.toThrow('User has already submitted a decision for this request');
    });
  });

  describe('waitForApproval', () => {
    it('should resolve when approval is granted', async () => {
      const params = {
        workflowExecutionId: 'wf-exec-1',
        workflowStepId: 'step-1',
        stepName: 'Deploy',
        workflowName: 'Deployment',
        requestedBy: 'user-1',
        approvers: ['admin-1']
      };
      const request = await approvalService.createApprovalRequest(params);

      // Start waiting
      const waitPromise = approvalService.waitForApproval(request.id);

      // Submit approval
      await approvalService.submitApproval(request.id, 'admin-1', 'approved');

      // Wait should resolve
      const result = await waitPromise;
      expect(result).toBe('approved');
    });

    it('should resolve when approval is rejected', async () => {
      const params = {
        workflowExecutionId: 'wf-exec-1',
        workflowStepId: 'step-1',
        stepName: 'Deploy',
        workflowName: 'Deployment',
        requestedBy: 'user-1',
        approvers: ['admin-1']
      };
      const request = await approvalService.createApprovalRequest(params);

      // Start waiting
      const waitPromise = approvalService.waitForApproval(request.id);

      // Submit rejection
      await approvalService.submitApproval(request.id, 'admin-1', 'rejected');

      // Wait should resolve
      const result = await waitPromise;
      expect(result).toBe('rejected');
    });
  });

  describe('getApprovalRequestsByApprover', () => {
    it('should return pending approvals for specific approver', async () => {
      // Create multiple requests
      await approvalService.createApprovalRequest({
        workflowExecutionId: 'wf-1',
        workflowStepId: 'step-1',
        stepName: 'Deploy 1',
        workflowName: 'Workflow 1',
        requestedBy: 'user-1',
        approvers: ['admin-1', 'admin-2']
      });

      await approvalService.createApprovalRequest({
        workflowExecutionId: 'wf-2',
        workflowStepId: 'step-2',
        stepName: 'Deploy 2',
        workflowName: 'Workflow 2',
        requestedBy: 'user-2',
        approvers: ['admin-2', 'admin-3']
      });

      await approvalService.createApprovalRequest({
        workflowExecutionId: 'wf-3',
        workflowStepId: 'step-3',
        stepName: 'Deploy 3',
        workflowName: 'Workflow 3',
        requestedBy: 'user-3',
        approvers: ['admin-3']
      });

      const admin2Approvals = approvalService.getApprovalRequestsByApprover('admin-2');
      expect(admin2Approvals).toHaveLength(2);
      expect(admin2Approvals.every(a => a.approvers.includes('admin-2'))).toBe(true);
    });

    it('should not return resolved approvals', async () => {
      const request = await approvalService.createApprovalRequest({
        workflowExecutionId: 'wf-1',
        workflowStepId: 'step-1',
        stepName: 'Deploy',
        workflowName: 'Workflow',
        requestedBy: 'user-1',
        approvers: ['admin-1']
      });

      // Approve the request
      await approvalService.submitApproval(request.id, 'admin-1', 'approved');

      const pendingApprovals = approvalService.getApprovalRequestsByApprover('admin-1');
      expect(pendingApprovals).toHaveLength(0);
    });
  });

  describe('cancelApprovalRequest', () => {
    it('should cancel a pending approval request', async () => {
      const request = await approvalService.createApprovalRequest({
        workflowExecutionId: 'wf-1',
        workflowStepId: 'step-1',
        stepName: 'Deploy',
        workflowName: 'Workflow',
        requestedBy: 'user-1',
        approvers: ['admin-1']
      });

      await approvalService.cancelApprovalRequest(request.id, 'Workflow cancelled');

      const updated = approvalService.getApprovalRequest(request.id);
      expect(updated?.status).toBe('rejected');
      expect(updated?.metadata?.cancellationReason).toBe('Workflow cancelled');
    });

    it('should throw error if request not found', async () => {
      await expect(
        approvalService.cancelApprovalRequest('non-existent')
      ).rejects.toThrow('Approval request not found');
    });

    it('should throw error if request already resolved', async () => {
      const request = await approvalService.createApprovalRequest({
        workflowExecutionId: 'wf-1',
        workflowStepId: 'step-1',
        stepName: 'Deploy',
        workflowName: 'Workflow',
        requestedBy: 'user-1',
        approvers: ['admin-1']
      });

      await approvalService.submitApproval(request.id, 'admin-1', 'approved');

      await expect(
        approvalService.cancelApprovalRequest(request.id)
      ).rejects.toThrow('Cannot cancel approval request with status: approved');
    });
  });
});