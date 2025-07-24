import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Button,
  TextField,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Timer,
  Person,
  Description,
  Info,
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import { ApprovalSummary } from '@/types/approval';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'react-hot-toast';

interface ApprovalCardProps {
  approval: ApprovalSummary;
  onDecision?: () => void;
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({ approval, onDecision }) => {
  const [showDecisionDialog, setShowDecisionDialog] = useState(false);
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuthStore();

  const isExpired = approval.expiresAt && new Date(approval.expiresAt) < new Date();
  const progressPercentage = (approval.currentApprovals / approval.requiredApprovals) * 100;

  const handleSubmitDecision = async () => {
    if (!decision) return;

    setSubmitting(true);
    try {
      await api.post(`/approvals/${approval.id}/decision`, {
        decision,
        comment: comment.trim() || undefined
      });

      toast.success(`Successfully ${decision} the approval request`);
      setShowDecisionDialog(false);
      onDecision?.();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit decision');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = () => {
    if (isExpired) return 'error';
    if (approval.expiresAt) {
      const hoursUntilExpiry = (new Date(approval.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilExpiry < 1) return 'warning';
    }
    return 'primary';
  };

  return (
    <>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1 }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box>
              <Typography variant="h6" component="h3" gutterBottom>
                {approval.stepName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {approval.workflowName}
              </Typography>
            </Box>
            {isExpired ? (
              <Chip
                icon={<Cancel />}
                label="Expired"
                color="error"
                size="small"
              />
            ) : approval.expiresAt ? (
              <Chip
                icon={<Timer />}
                label={`Expires ${formatDistanceToNow(new Date(approval.expiresAt), { addSuffix: true })}`}
                color={getStatusColor()}
                size="small"
              />
            ) : null}
          </Box>

          {approval.description && (
            <Alert severity="info" icon={<Description />} sx={{ mb: 2 }}>
              {approval.description}
            </Alert>
          )}

          <Box mb={2}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Person fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Requested by: {approval.requestedBy}
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <Info fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {format(new Date(approval.createdAt), 'MMM d, yyyy h:mm a')}
              </Typography>
            </Box>
          </Box>

          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2" color="text.secondary">
                Approval Progress
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {approval.currentApprovals} / {approval.requiredApprovals}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progressPercentage}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>

          {approval.metadata && Object.keys(approval.metadata).length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Box>
                <Typography variant="body2" fontWeight="bold" gutterBottom>
                  Additional Information
                </Typography>
                {Object.entries(approval.metadata).map(([key, value]) => (
                  <Box key={key} display="flex" gap={1} mb={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      {key}:
                    </Typography>
                    <Typography variant="body2">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </CardContent>

        {!isExpired && (
          <CardActions sx={{ justifyContent: 'center', p: 2 }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircle />}
              onClick={() => {
                setDecision('approved');
                setShowDecisionDialog(true);
              }}
              sx={{ minWidth: 120 }}
            >
              Approve
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Cancel />}
              onClick={() => {
                setDecision('rejected');
                setShowDecisionDialog(true);
              }}
              sx={{ minWidth: 120 }}
            >
              Reject
            </Button>
          </CardActions>
        )}
      </Card>

      <Dialog
        open={showDecisionDialog}
        onClose={() => !submitting && setShowDecisionDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {decision === 'approved' ? 'Approve Request' : 'Reject Request'}
        </DialogTitle>
        <DialogContent>
          <Box py={1}>
            <Typography variant="body2" gutterBottom>
              You are about to {decision} the approval for:
            </Typography>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              {approval.stepName}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              in {approval.workflowName}
            </Typography>
            
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Comment (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={`Add a comment about why you are ${decision === 'approved' ? 'approving' : 'rejecting'} this request...`}
              sx={{ mt: 3 }}
              disabled={submitting}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDecisionDialog(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={decision === 'approved' ? 'success' : 'error'}
            onClick={handleSubmitDecision}
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : `Confirm ${decision === 'approved' ? 'Approval' : 'Rejection'}`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};