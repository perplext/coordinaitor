import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import winston from 'winston';
import { NotificationService } from './notification-service';

export interface ApprovalRequest {
  id: string;
  workflowExecutionId: string;
  workflowStepId: string;
  stepName: string;
  workflowName: string;
  requestedBy: string;
  approvers: string[];
  approvals: ApprovalDecision[];
  requiredApprovals: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  description?: string;
}

export interface ApprovalDecision {
  approverId: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  decidedAt: Date;
}

export interface ApprovalPolicy {
  requiredApprovals?: number; // Default: 1
  allApproversRequired?: boolean; // If true, all approvers must approve
  timeout?: number; // Timeout in milliseconds
  autoApproveAfterTimeout?: boolean;
  autoRejectAfterTimeout?: boolean;
}

export class ApprovalService extends EventEmitter {
  private approvalRequests: Map<string, ApprovalRequest> = new Map();
  private logger: winston.Logger;
  private timeoutHandlers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private notificationService: NotificationService | null = null
  ) {
    super();
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    // Cleanup expired approvals periodically
    setInterval(() => this.cleanupExpiredApprovals(), 60000); // Every minute
  }

  public async createApprovalRequest(params: {
    workflowExecutionId: string;
    workflowStepId: string;
    stepName: string;
    workflowName: string;
    requestedBy: string;
    approvers: string[];
    policy?: ApprovalPolicy;
    metadata?: Record<string, any>;
    description?: string;
  }): Promise<ApprovalRequest> {
    const {
      workflowExecutionId,
      workflowStepId,
      stepName,
      workflowName,
      requestedBy,
      approvers,
      policy = {},
      metadata,
      description
    } = params;

    if (!approvers || approvers.length === 0) {
      throw new Error('At least one approver must be specified');
    }

    const requiredApprovals = policy.allApproversRequired 
      ? approvers.length 
      : (policy.requiredApprovals || 1);

    const request: ApprovalRequest = {
      id: uuidv4(),
      workflowExecutionId,
      workflowStepId,
      stepName,
      workflowName,
      requestedBy,
      approvers,
      approvals: [],
      requiredApprovals: Math.min(requiredApprovals, approvers.length),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
      description
    };

    // Set expiration if timeout is specified
    if (policy.timeout) {
      request.expiresAt = new Date(Date.now() + policy.timeout);
      
      // Set up timeout handler
      const timeoutHandler = setTimeout(() => {
        this.handleApprovalTimeout(request.id, policy);
      }, policy.timeout);
      
      this.timeoutHandlers.set(request.id, timeoutHandler);
    }

    this.approvalRequests.set(request.id, request);
    this.emit('approval:requested', request);

    // Send notifications to approvers
    if (this.notificationService) {
      for (const approver of approvers) {
        this.notificationService.notifyApprovalRequired({
          approvalRequest: request,
          approverId: approver
        }).catch(err => {
          this.logger.error('Failed to send approval notification:', err);
        });
      }
    }

    this.logger.info(`Approval request created: ${request.id} for workflow step ${stepName}`);
    return request;
  }

  public async submitApproval(
    requestId: string,
    approverId: string,
    decision: 'approved' | 'rejected',
    comment?: string
  ): Promise<ApprovalRequest> {
    const request = this.approvalRequests.get(requestId);
    if (!request) {
      throw new Error('Approval request not found');
    }

    if (request.status !== 'pending') {
      throw new Error(`Approval request is already ${request.status}`);
    }

    if (!request.approvers.includes(approverId)) {
      throw new Error('User is not authorized to approve this request');
    }

    // Check if user has already made a decision
    const existingDecision = request.approvals.find(a => a.approverId === approverId);
    if (existingDecision) {
      throw new Error('User has already submitted a decision for this request');
    }

    // Add the decision
    const approvalDecision: ApprovalDecision = {
      approverId,
      decision,
      comment,
      decidedAt: new Date()
    };

    request.approvals.push(approvalDecision);
    request.updatedAt = new Date();

    // Check if request should be resolved
    const approvedCount = request.approvals.filter(a => a.decision === 'approved').length;
    const rejectedCount = request.approvals.filter(a => a.decision === 'rejected').length;

    if (decision === 'rejected') {
      // Any rejection results in overall rejection
      request.status = 'rejected';
      this.resolveApprovalRequest(request);
    } else if (approvedCount >= request.requiredApprovals) {
      // Required approvals met
      request.status = 'approved';
      this.resolveApprovalRequest(request);
    }

    this.approvalRequests.set(request.id, request);
    this.emit('approval:submitted', { request, decision: approvalDecision });

    return request;
  }

  private resolveApprovalRequest(request: ApprovalRequest): void {
    // Clear timeout if exists
    const timeoutHandler = this.timeoutHandlers.get(request.id);
    if (timeoutHandler) {
      clearTimeout(timeoutHandler);
      this.timeoutHandlers.delete(request.id);
    }

    this.emit('approval:resolved', request);

    // Send notification about resolution
    if (this.notificationService) {
      this.notificationService.notifyApprovalResolved({
        approvalRequest: request,
        resolution: request.status
      }).catch(err => {
        this.logger.error('Failed to send approval resolution notification:', err);
      });
    }

    this.logger.info(`Approval request ${request.id} resolved with status: ${request.status}`);
  }

  private handleApprovalTimeout(requestId: string, policy: ApprovalPolicy): void {
    const request = this.approvalRequests.get(requestId);
    if (!request || request.status !== 'pending') {
      return;
    }

    if (policy.autoApproveAfterTimeout) {
      request.status = 'approved';
      this.logger.info(`Approval request ${requestId} auto-approved after timeout`);
    } else if (policy.autoRejectAfterTimeout) {
      request.status = 'rejected';
      this.logger.info(`Approval request ${requestId} auto-rejected after timeout`);
    } else {
      request.status = 'expired';
      this.logger.info(`Approval request ${requestId} expired after timeout`);
    }

    request.updatedAt = new Date();
    this.approvalRequests.set(request.id, request);
    this.resolveApprovalRequest(request);
  }

  private cleanupExpiredApprovals(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [id, request] of this.approvalRequests) {
      if (request.status === 'expired' || request.status === 'approved' || request.status === 'rejected') {
        const ageMs = now.getTime() - request.updatedAt.getTime();
        const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days

        if (ageMs > maxAgeMs) {
          this.approvalRequests.delete(id);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      this.logger.info(`Cleaned up ${cleanedCount} old approval requests`);
    }
  }

  public getApprovalRequest(id: string): ApprovalRequest | undefined {
    return this.approvalRequests.get(id);
  }

  public getApprovalRequestsByApprover(approverId: string): ApprovalRequest[] {
    return Array.from(this.approvalRequests.values()).filter(
      request => request.approvers.includes(approverId) && request.status === 'pending'
    );
  }

  public getApprovalRequestsByWorkflow(workflowExecutionId: string): ApprovalRequest[] {
    return Array.from(this.approvalRequests.values()).filter(
      request => request.workflowExecutionId === workflowExecutionId
    );
  }

  public getAllPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.approvalRequests.values()).filter(
      request => request.status === 'pending'
    );
  }

  public async cancelApprovalRequest(requestId: string, reason?: string): Promise<void> {
    const request = this.approvalRequests.get(requestId);
    if (!request) {
      throw new Error('Approval request not found');
    }

    if (request.status !== 'pending') {
      throw new Error(`Cannot cancel approval request with status: ${request.status}`);
    }

    request.status = 'rejected';
    request.updatedAt = new Date();
    
    if (reason) {
      request.metadata = {
        ...request.metadata,
        cancellationReason: reason
      };
    }

    this.approvalRequests.set(request.id, request);
    this.resolveApprovalRequest(request);
  }

  public async waitForApproval(requestId: string): Promise<'approved' | 'rejected' | 'expired'> {
    return new Promise((resolve) => {
      const checkStatus = () => {
        const request = this.approvalRequests.get(requestId);
        if (!request) {
          resolve('rejected');
          return;
        }

        if (request.status !== 'pending') {
          resolve(request.status as 'approved' | 'rejected' | 'expired');
          return;
        }
      };

      // Check immediately
      checkStatus();

      // Listen for resolution
      const resolveHandler = (resolvedRequest: ApprovalRequest) => {
        if (resolvedRequest.id === requestId) {
          this.removeListener('approval:resolved', resolveHandler);
          resolve(resolvedRequest.status as 'approved' | 'rejected' | 'expired');
        }
      };

      this.on('approval:resolved', resolveHandler);
    });
  }
}