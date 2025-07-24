import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Divider,
  Link
} from '@mui/material';
import { GitHub, GitBranch, Check, Warning } from '@mui/icons-material';
import { motion } from 'framer-motion';

interface RepositorySetupProps {
  provider: 'github' | 'gitlab';
  onComplete: () => void;
  onCancel: () => void;
}

export const RepositorySetup: React.FC<RepositorySetupProps> = ({
  provider,
  onComplete,
  onCancel
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    apiUrl: provider === 'github' ? 'https://api.github.com' : 'https://gitlab.com/api/v4',
    token: '',
    webhookSecret: '',
    organization: '',
    defaultBranch: 'main',
    enableWebhooks: true
  });

  const steps = [
    'API Configuration',
    'Test Connection',
    'Configure Webhooks'
  ];

  const handleInputChange = (field: string) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value
    }));
    setError(null);
    setTestResult(null);
  };

  const testConnection = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/repositories/setup/${provider}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setTestResult({
          success: true,
          message: data.message,
          organization: data.organization
        });
        setCurrentStep(2);
      } else {
        setError(data.message || 'Connection test failed');
      }
    } catch (error) {
      setError('Failed to test connection');
      console.error('Connection test failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const completeSetup = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Setup is already complete from the test connection step
      onComplete();
    } catch (error) {
      setError('Setup completion failed');
      console.error('Setup completion failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderApiConfigurationStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        {provider === 'github' ? 'GitHub' : 'GitLab'} API Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure your {provider === 'github' ? 'GitHub' : 'GitLab'} API connection.
      </Typography>

      <TextField
        fullWidth
        label="API URL"
        value={formData.apiUrl}
        onChange={handleInputChange('apiUrl')}
        sx={{ mb: 2 }}
        helperText={
          provider === 'github' 
            ? "Use https://api.github.com for GitHub.com or your GitHub Enterprise URL"
            : "Use https://gitlab.com/api/v4 for GitLab.com or your self-hosted GitLab API URL"
        }
      />

      <TextField
        fullWidth
        label="Personal Access Token"
        type="password"
        value={formData.token}
        onChange={handleInputChange('token')}
        sx={{ mb: 2 }}
        required
        helperText={
          <span>
            {provider === 'github' ? (
              <>
                Create a token at{' '}
                <Link href="https://github.com/settings/tokens" target="_blank" rel="noopener">
                  GitHub Settings
                </Link>
                {' '}with repo, admin:repo_hook, and read:org scopes
              </>
            ) : (
              <>
                Create a token at{' '}
                <Link href="https://gitlab.com/-/profile/personal_access_tokens" target="_blank" rel="noopener">
                  GitLab Settings
                </Link>
                {' '}with api scope
              </>
            )}
          </span>
        }
      />

      <TextField
        fullWidth
        label="Webhook Secret"
        type="password"
        value={formData.webhookSecret}
        onChange={handleInputChange('webhookSecret')}
        sx={{ mb: 2 }}
        helperText="Optional but recommended for webhook security"
      />

      <TextField
        fullWidth
        label="Organization/Group"
        value={formData.organization}
        onChange={handleInputChange('organization')}
        sx={{ mb: 2 }}
        helperText={
          provider === 'github'
            ? "Optional: GitHub organization name"
            : "Optional: GitLab group name"
        }
      />

      <TextField
        fullWidth
        label="Default Branch"
        value={formData.defaultBranch}
        onChange={handleInputChange('defaultBranch')}
        sx={{ mb: 3 }}
        helperText="Default branch for new repositories"
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => setCurrentStep(1)}
          disabled={!formData.token}
        >
          Next
        </Button>
      </Box>
    </Box>
  );

  const renderTestConnectionStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Test Connection
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Test your API configuration to ensure it's working correctly.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            {provider === 'github' ? <GitHub sx={{ mr: 2 }} /> : <GitBranch sx={{ mr: 2 }} />}
            <Typography variant="subtitle1">
              {provider === 'github' ? 'GitHub' : 'GitLab'} Configuration
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            API URL: {formData.apiUrl}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Token: {'*'.repeat(formData.token.length)}
          </Typography>
          {formData.organization && (
            <Typography variant="body2" color="text.secondary">
              Organization: {formData.organization}
            </Typography>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Warning sx={{ mr: 1 }} />
            {error}
          </Box>
        </Alert>
      )}

      {testResult && testResult.success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Check sx={{ mr: 1 }} />
            {testResult.message}
          </Box>
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={() => setCurrentStep(0)}>
          Back
        </Button>
        <Box>
          <Button
            variant="outlined"
            onClick={testConnection}
            disabled={loading}
            sx={{ mr: 1 }}
          >
            {loading ? <CircularProgress size={20} /> : 'Test Connection'}
          </Button>
          {testResult?.success && (
            <Button
              variant="contained"
              onClick={() => setCurrentStep(2)}
            >
              Next
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );

  const renderWebhookConfigurationStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Configure Webhooks
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Webhooks enable real-time integration with your repositories.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Webhooks will be automatically configured for each repository you integrate. 
        The webhook URL will be: {window.location.origin}/api/webhooks/{provider}
      </Alert>

      <FormControlLabel
        control={
          <Switch
            checked={formData.enableWebhooks}
            onChange={handleInputChange('enableWebhooks')}
          />
        }
        label="Enable automatic webhook creation"
        sx={{ mb: 3 }}
      />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Webhook Events
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The following events will be monitored:
          </Typography>
          <ul>
            <li>Push events (code changes)</li>
            <li>Pull/Merge request events</li>
            <li>Issue events</li>
            <li>Release events</li>
          </ul>
        </CardContent>
      </Card>

      <Alert severity="success" sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Check sx={{ mr: 1 }} />
          {provider === 'github' ? 'GitHub' : 'GitLab'} integration is ready!
        </Box>
      </Alert>

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={() => setCurrentStep(1)}>
          Back
        </Button>
        <Button
          variant="contained"
          onClick={completeSetup}
          disabled={loading}
        >
          {loading ? <CircularProgress size={20} /> : 'Complete Setup'}
        </Button>
      </Box>
    </Box>
  );

  const stepComponents = [
    renderApiConfigurationStep,
    renderTestConnectionStep,
    renderWebhookConfigurationStep
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Stepper activeStep={currentStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Divider sx={{ mb: 3 }} />

      {stepComponents[currentStep]()}
    </motion.div>
  );
};