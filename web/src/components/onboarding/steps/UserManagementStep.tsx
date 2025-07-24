import React from 'react';
import { Box, Typography, Button } from '@mui/material';

interface UserManagementStepProps {
  onComplete: (data?: any) => void;
  onSkip: () => void;
  metadata?: Record<string, any>;
}

export const UserManagementStep: React.FC<UserManagementStepProps> = ({ onComplete }) => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        User Management
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Manage users, roles, and permissions.
      </Typography>
      <Button variant="contained" onClick={() => onComplete()}>
        Continue
      </Button>
    </Box>
  );
};