import React from 'react';
import { Box, Typography, Button } from '@mui/material';

interface ApprovalWorkflowStepProps {
  onComplete: (data?: any) => void;
  onSkip: () => void;
  metadata?: Record<string, any>;
}

export const ApprovalWorkflowStep: React.FC<ApprovalWorkflowStepProps> = ({ onComplete }) => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Approval Workflows
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Set up approval processes for critical tasks.
      </Typography>
      <Button variant="contained" onClick={() => onComplete()}>
        Continue
      </Button>
    </Box>
  );
};