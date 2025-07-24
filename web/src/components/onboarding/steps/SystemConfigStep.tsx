import React from 'react';
import { Box, Typography, Button } from '@mui/material';

interface SystemConfigStepProps {
  onComplete: (data?: any) => void;
  onSkip: () => void;
  metadata?: Record<string, any>;
}

export const SystemConfigStep: React.FC<SystemConfigStepProps> = ({ onComplete }) => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        System Configuration
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Configure agents, integrations, and security settings.
      </Typography>
      <Button variant="contained" onClick={() => onComplete()}>
        Continue
      </Button>
    </Box>
  );
};