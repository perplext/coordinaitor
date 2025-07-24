import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  PlayArrow,
  CheckCircle,
  Error,
  Warning,
  Info,
  ExpandMore,
  ContentCopy,
  OpenInNew,
  Security,
  VpnKey,
  AccountCircle,
  Group,
  Email,
  Badge
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface SSOProvider {
  id: string;
  name: string;
  type: 'saml' | 'oauth2';
  provider?: string;
  enabled: boolean;
}

interface TestResult {
  success: boolean;
  provider: SSOProvider;
  steps: TestStep[];
  userInfo?: {
    id: string;
    email: string;
    name?: string;
    attributes: Record<string, any>;
  };
  error?: string;
  warnings?: string[];
  metadata?: Record<string, any>;
  timestamp: Date;
  duration: number;
}

interface TestStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'warning';
  message?: string;
  details?: Record<string, any>;
  timestamp?: Date;
  duration?: number;
}

interface SSOTestConnectionProps {
  providers: SSOProvider[];
}

export const SSOTestConnection: React.FC<SSOTestConnectionProps> = ({ providers }) => {
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [testMode, setTestMode] = useState<'metadata' | 'auth' | 'userinfo'>('metadata');
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [activeStep, setActiveStep] = useState(-1);

  const enabledProviders = providers.filter(p => p.enabled);

  const testSteps = {
    metadata: [
      'Validate Provider Configuration',
      'Test Discovery Endpoints',
      'Verify Certificates',
      'Check Metadata Consistency'
    ],
    auth: [
      'Validate Provider Configuration',
      'Generate Authentication Request',
      'Simulate Authentication Flow',
      'Validate Response Format',
      'Extract User Information'
    ],
    userinfo: [
      'Validate Provider Configuration', 
      'Authenticate Test User',
      'Fetch User Profile',
      'Map User Attributes',
      'Validate Role Mapping'
    ]
  };

  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    setTestResult(null);
    setActiveStep(-1);
  };

  const handleTestModeChange = (mode: 'metadata' | 'auth' | 'userinfo') => {
    setTestMode(mode);
    setTestResult(null);
    setActiveStep(-1);
  };

  const runTest = async () => {
    if (!selectedProvider) return;

    const provider = providers.find(p => p.id === selectedProvider);
    if (!provider) return;

    setTesting(true);
    setTestResult(null);
    setActiveStep(0);

    const startTime = Date.now();
    const steps = testSteps[testMode].map((name, index) => ({
      name,
      status: index === 0 ? 'running' : 'pending'
    })) as TestStep[];

    try {
      const endpoint = getTestEndpoint(provider, testMode);
      const payload = getTestPayload(provider, testMode);

      // Simulate step progression
      for (let i = 0; i < steps.length; i++) {
        setActiveStep(i);
        steps[i].status = 'running';
        steps[i].timestamp = new Date();

        // Simulate step execution time
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

        try {
          // Make actual API call for the step
          const stepResponse = await fetch(`${endpoint}?step=${i}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          const stepResult = await stepResponse.json();
          steps[i].duration = Date.now() - (steps[i].timestamp?.getTime() || Date.now());

          if (stepResult.success) {
            steps[i].status = 'success';
            steps[i].message = stepResult.message || 'Step completed successfully';
            steps[i].details = stepResult.details;
          } else {
            steps[i].status = stepResult.severity === 'warning' ? 'warning' : 'error';
            steps[i].message = stepResult.message || 'Step failed';
            steps[i].details = stepResult.details;

            if (steps[i].status === 'error') {
              // Mark remaining steps as pending
              for (let j = i + 1; j < steps.length; j++) {
                steps[j].status = 'pending';
              }
              break;
            }
          }
        } catch (error) {
          steps[i].status = 'error';
          steps[i].message = 'Network error or service unavailable';
          steps[i].duration = Date.now() - (steps[i].timestamp?.getTime() || Date.now());
          break;
        }

        // Set next step to running if not the last step and current step succeeded
        if (i < steps.length - 1 && steps[i].status === 'success') {
          steps[i + 1].status = 'running';
        }
      }

      // Final API call to get complete test result
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      const duration = Date.now() - startTime;

      setTestResult({
        success: result.success,
        provider,
        steps,
        userInfo: result.userInfo,
        error: result.error,
        warnings: result.warnings,
        metadata: result.metadata,
        timestamp: new Date(),
        duration
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      setTestResult({
        success: false,
        provider,
        steps,
        error: error instanceof Error ? error.message : 'Test failed',
        timestamp: new Date(),
        duration
      });
    } finally {
      setTesting(false);
      setActiveStep(-1);
    }
  };

  const getTestEndpoint = (provider: SSOProvider, mode: string): string => {
    const baseUrl = provider.type === 'saml' ? '/api/sso/saml' : '/api/sso/oauth2';
    return `${baseUrl}/providers/${provider.id}/test/${mode}`;
  };

  const getTestPayload = (provider: SSOProvider, mode: string): any => {
    const base = { mode, timestamp: new Date().toISOString() };
    
    if (mode === 'userinfo' && testEmail) {
      return { ...base, testEmail };
    }
    
    return base;
  };

  const getStepIcon = (step: TestStep) => {
    switch (step.status) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'running':
        return <CircularProgress size={20} />;
      default:
        return <Info color="disabled" />;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDuration = (ms: number): string => {
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const selectedProviderObj = providers.find(p => p.id === selectedProvider);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Typography variant="h6" gutterBottom>
        Test SSO Connections
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Validate your SSO provider configurations and test authentication flows
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2, mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel>SSO Provider</InputLabel>
              <Select
                value={selectedProvider}
                onChange={(e) => handleProviderChange(e.target.value)}
                label="SSO Provider"
              >
                {enabledProviders.map((provider) => (
                  <MenuItem key={provider.id} value={provider.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {provider.type === 'saml' ? <Security fontSize="small" /> : <VpnKey fontSize="small" />}
                      {provider.name}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Test Type</InputLabel>
              <Select
                value={testMode}
                onChange={(e) => handleTestModeChange(e.target.value as 'metadata' | 'auth' | 'userinfo')}
                label="Test Type"
              >
                <MenuItem value="metadata">Configuration & Metadata</MenuItem>
                <MenuItem value="auth">Authentication Flow</MenuItem>
                <MenuItem value="userinfo">User Information</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {testMode === 'userinfo' && (
            <TextField
              fullWidth
              label="Test User Email (Optional)"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              helperText="Leave empty to test with a mock user"
              sx={{ mb: 2 }}
            />
          )}

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Button
              variant="contained"
              startIcon={testing ? <CircularProgress size={16} /> : <PlayArrow />}
              onClick={runTest}
              disabled={!selectedProvider || testing}
            >
              {testing ? 'Running Test...' : 'Run Test'}
            </Button>

            {selectedProviderObj && (
              <Chip
                icon={selectedProviderObj.type === 'saml' ? <Security /> : <VpnKey />}
                label={`${selectedProviderObj.type.toUpperCase()} Provider`}
                variant="outlined"
              />
            )}
          </Box>
        </CardContent>
      </Card>

      <AnimatePresence>
        {(testing || testResult) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6">
                    Test Results
                  </Typography>
                  {testResult && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip
                        icon={testResult.success ? <CheckCircle /> : <Error />}
                        label={testResult.success ? 'Success' : 'Failed'}
                        color={testResult.success ? 'success' : 'error'}
                      />
                      <Typography variant="caption" color="text.secondary">
                        Duration: {formatDuration(testResult.duration)}
                      </Typography>
                    </Box>
                  )}
                </Box>

                <Stepper orientation="vertical" activeStep={activeStep}>
                  {testSteps[testMode].map((stepName, index) => {
                    const step = testResult?.steps[index] || { name: stepName, status: 'pending' };
                    
                    return (
                      <Step key={stepName} active={activeStep === index} completed={step.status === 'success'}>
                        <StepLabel
                          icon={getStepIcon(step)}
                          error={step.status === 'error'}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography>{stepName}</Typography>
                            {step.duration && (
                              <Typography variant="caption" color="text.secondary">
                                {formatDuration(step.duration)}
                              </Typography>
                            )}
                          </Box>
                        </StepLabel>
                        <StepContent>
                          {step.message && (
                            <Alert 
                              severity={step.status === 'error' ? 'error' : step.status === 'warning' ? 'warning' : 'info'}
                              sx={{ mb: 2 }}
                            >
                              {step.message}
                            </Alert>
                          )}
                          {step.details && (
                            <Accordion>
                              <AccordionSummary expandIcon={<ExpandMore />}>
                                <Typography variant="body2">View Details</Typography>
                              </AccordionSummary>
                              <AccordionDetails>
                                <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                                  {JSON.stringify(step.details, null, 2)}
                                </pre>
                              </AccordionDetails>
                            </Accordion>
                          )}
                        </StepContent>
                      </Step>
                    );
                  })}
                </Stepper>

                {testResult && testResult.success && testResult.userInfo && (
                  <Box sx={{ mt: 3 }}>
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="subtitle1" gutterBottom>
                      User Information Retrieved
                    </Typography>
                    <Paper sx={{ p: 2 }}>
                      <List dense>
                        <ListItem>
                          <ListItemIcon>
                            <AccountCircle />
                          </ListItemIcon>
                          <ListItemText
                            primary="User ID"
                            secondary={testResult.userInfo.id}
                          />
                          <Tooltip title="Copy to clipboard">
                            <IconButton 
                              size="small"
                              onClick={() => copyToClipboard(testResult.userInfo!.id)}
                            >
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </ListItem>
                        
                        <ListItem>
                          <ListItemIcon>
                            <Email />
                          </ListItemIcon>
                          <ListItemText
                            primary="Email"
                            secondary={testResult.userInfo.email}
                          />
                          <Tooltip title="Copy to clipboard">
                            <IconButton 
                              size="small"
                              onClick={() => copyToClipboard(testResult.userInfo!.email)}
                            >
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </ListItem>

                        {testResult.userInfo.name && (
                          <ListItem>
                            <ListItemIcon>
                              <Badge />
                            </ListItemIcon>
                            <ListItemText
                              primary="Display Name"
                              secondary={testResult.userInfo.name}
                            />
                          </ListItem>
                        )}
                      </List>

                      {Object.keys(testResult.userInfo.attributes).length > 0 && (
                        <Accordion sx={{ mt: 2 }}>
                          <AccordionSummary expandIcon={<ExpandMore />}>
                            <Typography variant="body2">
                              All Attributes ({Object.keys(testResult.userInfo.attributes).length})
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                              {JSON.stringify(testResult.userInfo.attributes, null, 2)}
                            </pre>
                          </AccordionDetails>
                        </Accordion>
                      )}
                    </Paper>
                  </Box>
                )}

                {testResult && testResult.warnings && testResult.warnings.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <Alert severity="warning">
                      <Typography variant="subtitle2" gutterBottom>
                        Warnings Detected
                      </Typography>
                      <List dense>
                        {testResult.warnings.map((warning, index) => (
                          <ListItem key={index} sx={{ py: 0 }}>
                            <ListItemText primary={warning} />
                          </ListItem>
                        ))}
                      </List>
                    </Alert>
                  </Box>
                )}

                {testResult && testResult.error && (
                  <Box sx={{ mt: 3 }}>
                    <Alert severity="error">
                      <Typography variant="subtitle2" gutterBottom>
                        Test Failed
                      </Typography>
                      <Typography variant="body2">{testResult.error}</Typography>
                    </Alert>
                  </Box>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {enabledProviders.length === 0 && (
        <Alert severity="info">
          No enabled SSO providers found. Enable at least one provider to run connection tests.
        </Alert>
      )}
    </motion.div>
  );
};