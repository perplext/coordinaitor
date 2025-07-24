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
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
  description?: string;
}

export interface ApprovalDecision {
  approverId: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  decidedAt: string;
}

export interface ApprovalSummary {
  id: string;
  workflowName: string;
  stepName: string;
  requestedBy: string;
  createdAt: string;
  expiresAt?: string;
  description?: string;
  requiredApprovals: number;
  currentApprovals: number;
  metadata?: Record<string, any>;
}