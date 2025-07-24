import React from 'react';
import { Box, Typography, Button } from '@mui/material';

interface MonitoringStepProps {
  onComplete: (data?: any) => void;
  onSkip: () => void;
  metadata?: Record<string, any>;
}

export const MonitoringStep: React.FC<MonitoringStepProps> = ({ onComplete }) => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        System Monitoring
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Monitor system health and performance.
      </Typography>
      <Button variant="contained" onClick={() => onComplete()}>
        Continue
      </Button>
    </Box>
  );
};