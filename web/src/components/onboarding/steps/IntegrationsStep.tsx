import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  IconButton,
  Tooltip,
  Badge,
  Paper,
} from '@mui/material';
import {
  GitHub,
  Code,
  CloudQueue,
  Security,
  Webhook,
  Api,
  Storage,
  Email,
  Chat,
  CheckCircle,
  Settings,
  Link,
  ContentCopy,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { api } from '@/services/api';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

interface IntegrationsStepProps {
  onComplete: (data?: any) => void;
  onSkip: () => void;
  metadata?: Record<string, any>;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  status: 'connected' | 'disconnected' | 'error';
  features: string[];
  requiredFields: {
    name: string;
    label: string;
    type: string;
    required: boolean;
  }[];
}

const integrations: Integration[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Connect your GitHub repositories for seamless code management',
    icon: <GitHub />,
    category: 'Version Control',
    status: 'disconnected',
    features: [
      'Automatic PR creation',
      'Issue tracking integration',
      'Webhook notifications',
      'Code review workflows',
    ],
    requiredFields: [
      { name: 'token', label: 'Personal Access Token', type: 'password', required: true },
      { name: 'organization', label: 'Organization', type: 'text', required: false },
    ],
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    description: 'Integrate with GitLab for complete DevOps workflows',
    icon: <Code />,
    category: 'Version Control',
    status: 'disconnected',
    features: [
      'Merge request automation',
      'CI/CD pipeline triggers',
      'Issue synchronization',
    ],
    requiredFields: [
      { name: 'token', label: 'Access Token', type: 'password', required: true },
      { name: 'url', label: 'GitLab URL', type: 'text', required: true },
    ],
  },
  {
    id: 'aws',
    name: 'AWS',
    description: 'Deploy and manage cloud resources on AWS',
    icon: <CloudQueue />,
    category: 'Cloud Services',
    status: 'disconnected',
    features: [
      'EC2 instance management',
      'S3 bucket operations',
      'Lambda function deployment',
      'CloudFormation templates',
    ],
    requiredFields: [
      { name: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
      { name: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
      { name: 'region', label: 'Default Region', type: 'text', required: true },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get real-time notifications and collaborate with your team',
    icon: <Chat />,
    category: 'Communication',
    status: 'disconnected',
    features: [
      'Task notifications',
      'Agent status updates',
      'Interactive commands',
      'Thread discussions',
    ],
    requiredFields: [
      { name: 'webhookUrl', label: 'Webhook URL', type: 'text', required: true },
      { name: 'channel', label: 'Default Channel', type: 'text', required: false },
    ],
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Sync tasks and track progress with Jira',
    icon: <Api />,
    category: 'Project Management',
    status: 'disconnected',
    features: [
      'Two-way issue sync',
      'Sprint planning',
      'Time tracking',
      'Custom field mapping',
    ],
    requiredFields: [
      { name: 'url', label: 'Jira URL', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'apiToken', label: 'API Token', type: 'password', required: true },
    ],
  },
];

export const IntegrationsStep: React.FC<IntegrationsStepProps> = ({ onComplete, onSkip }) => {
  const [connectedIntegrations, setConnectedIntegrations] = useState<Set<string>>(new Set());
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [setupStep, setSetupStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const handleSetupIntegration = (integration: Integration) => {
    setSelectedIntegration(integration);
    setSetupDialogOpen(true);
    setSetupStep(0);
    setFormData({});
  };

  const handleConnect = async () => {
    if (!selectedIntegration) return;

    setLoading(true);
    try {
      await api.post(`/integrations/${selectedIntegration.id}/connect`, formData);
      
      setConnectedIntegrations(new Set([...connectedIntegrations, selectedIntegration.id]));
      toast.success(`${selectedIntegration.name} connected successfully!`);
      setSetupDialogOpen(false);
    } catch (error) {
      console.error('Failed to connect integration:', error);
      toast.error('Failed to connect integration');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    try {
      await api.post(`/integrations/${integrationId}/disconnect`);
      
      const newConnected = new Set(connectedIntegrations);
      newConnected.delete(integrationId);
      setConnectedIntegrations(newConnected);
      
      toast.success('Integration disconnected');
    } catch (error) {
      console.error('Failed to disconnect integration:', error);
      toast.error('Failed to disconnect integration');
    }
  };

  const getIntegrationsByCategory = () => {
    const categories: Record<string, Integration[]> = {};
    integrations.forEach((integration) => {
      if (!categories[integration.category]) {
        categories[integration.category] = [];
      }
      categories[integration.category].push(integration);
    });
    return categories;
  };

  const categories = getIntegrationsByCategory();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Set Up Integrations
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Connect your favorite tools and services to enhance your development workflow.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        You can skip this step and set up integrations later from the settings page.
      </Alert>

      {Object.entries(categories).map(([category, categoryIntegrations]) => (
        <Box key={category} mb={4}>
          <Typography variant="h6" gutterBottom>
            {category}
          </Typography>
          <Grid container spacing={3}>
            {categoryIntegrations.map((integration) => (
              <Grid item xs={12} md={6} key={integration.id}>
                <Card
                  variant="outlined"
                  sx={{
                    borderColor: connectedIntegrations.has(integration.id)
                      ? 'success.main'
                      : 'divider',
                    borderWidth: connectedIntegrations.has(integration.id) ? 2 : 1,
                  }}
                >
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          badgeContent={
                            connectedIntegrations.has(integration.id) ? (
                              <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                            ) : null
                          }
                        >
                          {integration.icon}
                        </Badge>
                        <Box>
                          <Typography variant="h6">{integration.name}</Typography>
                          <Chip
                            label={connectedIntegrations.has(integration.id) ? 'Connected' : 'Not Connected'}
                            size="small"
                            color={connectedIntegrations.has(integration.id) ? 'success' : 'default'}
                          />
                        </Box>
                      </Box>
                    </Box>

                    <Typography variant="body2" color="text.secondary" paragraph>
                      {integration.description}
                    </Typography>

                    <Typography variant="subtitle2" gutterBottom>
                      Features:
                    </Typography>
                    <List dense>
                      {integration.features.slice(0, 2).map((feature, index) => (
                        <ListItem key={index} disableGutters>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            <CheckCircle fontSize="small" color="primary" />
                          </ListItemIcon>
                          <ListItemText
                            primary={feature}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      ))}
                      {integration.features.length > 2 && (
                        <ListItem disableGutters>
                          <ListItemText
                            primary={`+${integration.features.length - 2} more features`}
                            primaryTypographyProps={{
                              variant: 'body2',
                              color: 'text.secondary',
                            }}
                          />
                        </ListItem>
                      )}
                    </List>

                    <Box display="flex" justifyContent="flex-end" mt={2}>
                      {connectedIntegrations.has(integration.id) ? (
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={() => handleDisconnect(integration.id)}
                        >
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleSetupIntegration(integration)}
                        >
                          Connect
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}

      <Box display="flex" justifyContent="center" mt={4}>
        <Button
          variant={connectedIntegrations.size > 0 ? 'contained' : 'outlined'}
          color="primary"
          size="large"
          onClick={() => onComplete({ connectedIntegrations: Array.from(connectedIntegrations) })}
        >
          {connectedIntegrations.size > 0 ? 'Continue' : 'Continue Without Integrations'}
        </Button>
      </Box>

      {/* Setup Dialog */}
      <Dialog
        open={setupDialogOpen}
        onClose={() => setSetupDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={2}>
            {selectedIntegration?.icon}
            <Typography variant="h6">Connect {selectedIntegration?.name}</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={setupStep} orientation="vertical">
            <Step>
              <StepLabel>Enter Credentials</StepLabel>
              <StepContent>
                <Box mt={2}>
                  {selectedIntegration?.requiredFields.map((field) => (
                    <Box key={field.name} mb={2}>
                      <TextField
                        fullWidth
                        label={field.label}
                        type={
                          field.type === 'password' && !showSecrets[field.name]
                            ? 'password'
                            : 'text'
                        }
                        value={formData[field.name] || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, [field.name]: e.target.value })
                        }
                        required={field.required}
                        InputProps={{
                          endAdornment: field.type === 'password' && (
                            <IconButton
                              edge="end"
                              onClick={() =>
                                setShowSecrets({
                                  ...showSecrets,
                                  [field.name]: !showSecrets[field.name],
                                })
                              }
                            >
                              {showSecrets[field.name] ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          ),
                        }}
                      />
                    </Box>
                  ))}
                  <Button
                    variant="contained"
                    onClick={() => setSetupStep(1)}
                    disabled={
                      !selectedIntegration?.requiredFields
                        .filter((f) => f.required)
                        .every((f) => formData[f.name])
                    }
                  >
                    Next
                  </Button>
                </Box>
              </StepContent>
            </Step>
            <Step>
              <StepLabel>Test Connection</StepLabel>
              <StepContent>
                <Alert severity="info" sx={{ mt: 2 }}>
                  We'll test the connection to ensure everything is configured correctly.
                </Alert>
                <Box mt={2}>
                  <Button variant="contained" onClick={handleConnect} disabled={loading}>
                    {loading ? 'Connecting...' : 'Connect'}
                  </Button>
                </Box>
              </StepContent>
            </Step>
          </Stepper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSetupDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};