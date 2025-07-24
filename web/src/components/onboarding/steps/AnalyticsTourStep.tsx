import React from 'react';
import { Box, Typography, Button } from '@mui/material';

interface AnalyticsTourStepProps {
  onComplete: (data?: any) => void;
  onSkip: () => void;
  metadata?: Record<string, any>;
}

export const AnalyticsTourStep: React.FC<AnalyticsTourStepProps> = ({ onComplete }) => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Analytics Dashboard Tour
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Learn how to track team performance and AI agent usage.
      </Typography>
      <Button variant="contained" onClick={() => onComplete()}>
        Continue
      </Button>
    </Box>
  );
};