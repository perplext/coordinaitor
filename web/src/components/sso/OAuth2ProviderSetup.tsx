import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import { ContentCopy, Help, CheckCircle, Error, Visibility, VisibilityOff } from '@mui/icons-material';
import { motion } from 'framer-motion';

interface OAuth2ProviderSetupProps {
  onComplete: () => void;
  onCancel: () => void;
  existingProvider?: any;
}

export const OAuth2ProviderSetup: React.FC<OAuth2ProviderSetupProps> = ({
  onComplete,
  onCancel,
  existingProvider
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [showClientSecret, setShowClientSecret] = useState(false);
  
  const [formData, setFormData] = useState({
    name: existingProvider?.name || '',
    provider: existingProvider?.provider || 'google',
    clientId: existingProvider?.clientId || '',
    clientSecret: existingProvider?.clientSecret || '',
    authorizationUrl: existingProvider?.authorizationUrl || '',
    tokenUrl: existingProvider?.tokenUrl || '',
    userInfoUrl: existingProvider?.userInfoUrl || '',
    jwksUrl: existingProvider?.jwksUrl || '',
    scopes: existingProvider?.scopes?.join(' ') || '',
    redirectUri: existingProvider?.redirectUri || `${window.location.origin}/auth/oauth2/callback`,
    discoveryUrl: existingProvider?.discoveryUrl || '',
    useDiscovery: existingProvider?.useDiscovery ?? true,
    issuer: existingProvider?.issuer || '',
    enabled: existingProvider?.enabled ?? true
  });

  const steps = [
    'Provider Selection',
    'OAuth2 Configuration', 
    'Endpoint Configuration',
    'Test & Review'
  ];

  const providerTemplates = {
    google: {
      name: 'Google',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
      scopes: 'openid email profile',
      discoveryUrl: 'https://accounts.google.com/.well-known/openid_configuration',
      issuer: 'https://accounts.google.com',
      useDiscovery: true
    },
    microsoft: {
      name: 'Microsoft Azure AD',
      authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
      jwksUrl: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
      scopes: 'openid email profile User.Read',
      discoveryUrl: 'https://login.microsoftonline.com/common/v2.0/.well-known/openid_configuration',
      issuer: 'https://login.microsoftonline.com/common/v2.0',
      useDiscovery: true
    },
    okta: {
      name: 'Okta',
      authorizationUrl: 'https://your-domain.okta.com/oauth2/default/v1/authorize',
      tokenUrl: 'https://your-domain.okta.com/oauth2/default/v1/token',
      userInfoUrl: 'https://your-domain.okta.com/oauth2/default/v1/userinfo',
      jwksUrl: 'https://your-domain.okta.com/oauth2/default/v1/keys',
      scopes: 'openid email profile',
      discoveryUrl: 'https://your-domain.okta.com/.well-known/openid_configuration',
      issuer: 'https://your-domain.okta.com',
      useDiscovery: true
    },
    auth0: {
      name: 'Auth0',
      authorizationUrl: 'https://your-domain.auth0.com/authorize',
      tokenUrl: 'https://your-domain.auth0.com/oauth/token',
      userInfoUrl: 'https://your-domain.auth0.com/userinfo',
      jwksUrl: 'https://your-domain.auth0.com/.well-known/jwks.json',
      scopes: 'openid email profile',
      discoveryUrl: 'https://your-domain.auth0.com/.well-known/openid_configuration',
      issuer: 'https://your-domain.auth0.com/',
      useDiscovery: true
    },
    custom: {
      name: 'Custom OAuth2',
      authorizationUrl: '',
      tokenUrl: '',
      userInfoUrl: '',
      jwksUrl: '',
      scopes: 'openid email profile',
      discoveryUrl: '',
      issuer: '',
      useDiscovery: false
    }
  };

  const handleInputChange = (field: string) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.type === 'checkbox' ? (event.target as HTMLInputElement).checked : event.target.value
    }));
    setError(null);
    setTestResult(null);
  };

  const handleProviderChange = (provider: string) => {
    const template = providerTemplates[provider as keyof typeof providerTemplates];
    setFormData(prev => ({
      ...prev,
      provider,
      name: template.name,
      authorizationUrl: template.authorizationUrl,
      tokenUrl: template.tokenUrl,
      userInfoUrl: template.userInfoUrl,
      jwksUrl: template.jwksUrl,
      scopes: template.scopes,
      discoveryUrl: template.discoveryUrl,
      issuer: template.issuer,
      useDiscovery: template.useDiscovery
    }));
  };

  const testConnection = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/auth/oauth2/${formData.provider}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        setTestResult({
          success: true,
          message: 'Connection test successful',
          endpoints: result.endpoints
        });
      } else {
        setTestResult({
          success: false,
          error: result.error
        });
        setError(result.error || 'Connection test failed');
      }
    } catch (error) {
      const errorMsg = 'Failed to test connection';
      setError(errorMsg);
      setTestResult({
        success: false,
        error: errorMsg
      });
      console.error('Connection test failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProvider = async () => {
    try {
      setLoading(true);
      setError(null);

      const payload = {
        ...formData,
        scopes: formData.scopes.split(' ').filter(Boolean),
        redirectUri: formData.redirectUri || `${window.location.origin}/auth/oauth2/${formData.provider}/callback`
      };

      const url = existingProvider 
        ? `/api/sso/oauth2/providers/${existingProvider.id}`
        : '/api/sso/oauth2/providers';
      
      const method = existingProvider ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        onComplete();
      } else {
        setError(result.message || 'Failed to save OAuth2 provider');
      }
    } catch (error) {
      setError('Failed to save OAuth2 provider');
      console.error('Save failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderProviderSelectionStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Provider Selection
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose your OAuth2/OIDC identity provider
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2, mb: 3 }}>
        {Object.entries(providerTemplates).map(([key, template]) => (
          <Card 
            key={key}
            sx={{ 
              cursor: 'pointer',
              border: formData.provider === key ? 2 : 1,
              borderColor: formData.provider === key ? 'primary.main' : 'divider'
            }}
            onClick={() => handleProviderChange(key)}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {template.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {key === 'google' && 'Google Workspace and Gmail accounts'}
                {key === 'microsoft' && 'Azure Active Directory and Office 365'}
                {key === 'okta' && 'Okta identity platform'}
                {key === 'auth0' && 'Auth0 universal identity platform'}
                {key === 'custom' && 'Custom OAuth2 provider'}
              </Typography>
              {formData.provider === key && (
                <Chip label="Selected" color="primary" size="small" sx={{ mt: 1 }} />
              )}
            </CardContent>
          </Card>
        ))}
      </Box>

      <TextField
        fullWidth
        label="Provider Name"
        value={formData.name}
        onChange={handleInputChange('name')}
        sx={{ mb: 3 }}
        required
        helperText="A friendly name for this OAuth2 provider"
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => setCurrentStep(1)}
          disabled={!formData.name || !formData.provider}
        >
          Next
        </Button>
      </Box>
    </Box>
  );

  const renderOAuth2ConfigurationStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        OAuth2 Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure your OAuth2 application credentials
      </Typography>

      <Card sx={{ mb: 3, bgcolor: 'info.50' }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Callback URL
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure this URL in your OAuth2 provider:
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              value={formData.redirectUri}
              InputProps={{ readOnly: true }}
              sx={{ flexGrow: 1 }}
            />
            <Tooltip title="Copy to clipboard">
              <IconButton 
                size="small"
                onClick={() => copyToClipboard(formData.redirectUri)}
              >
                <ContentCopy />
              </IconButton>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      <TextField
        fullWidth
        label="Client ID"
        value={formData.clientId}
        onChange={handleInputChange('clientId')}
        sx={{ mb: 2 }}
        required
        helperText="OAuth2 application client ID"
      />

      <TextField
        fullWidth
        label="Client Secret"
        type={showClientSecret ? 'text' : 'password'}
        value={formData.clientSecret}
        onChange={handleInputChange('clientSecret')}
        sx={{ mb: 2 }}
        required
        helperText="OAuth2 application client secret"
        InputProps={{
          endAdornment: (
            <IconButton
              onClick={() => setShowClientSecret(!showClientSecret)}
              edge="end"
            >
              {showClientSecret ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          )
        }}
      />

      <TextField
        fullWidth
        label="Scopes"
        value={formData.scopes}
        onChange={handleInputChange('scopes')}
        sx={{ mb: 2 }}
        required
        helperText="Space-separated list of OAuth2 scopes"
      />

      {formData.provider !== 'custom' && (
        <FormControlLabel
          control={
            <Switch
              checked={formData.useDiscovery}
              onChange={handleInputChange('useDiscovery')}
            />
          }
          label="Use OpenID Connect Discovery"
          sx={{ mb: 2 }}
        />
      )}

      {formData.useDiscovery && formData.provider !== 'custom' && (
        <TextField
          fullWidth
          label="Discovery URL"
          value={formData.discoveryUrl}
          onChange={handleInputChange('discoveryUrl')}
          sx={{ mb: 2 }}
          helperText="OpenID Connect discovery endpoint"
        />
      )}

      <TextField
        fullWidth
        label="Issuer"
        value={formData.issuer}
        onChange={handleInputChange('issuer')}
        sx={{ mb: 3 }}
        helperText="Token issuer identifier"
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={() => setCurrentStep(0)}>
          Back
        </Button>
        <Button
          variant="contained"
          onClick={() => setCurrentStep(2)}
          disabled={!formData.clientId || !formData.clientSecret}
        >
          Next
        </Button>
      </Box>
    </Box>
  );

  const renderEndpointConfigurationStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Endpoint Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure OAuth2 endpoints (auto-filled from discovery if enabled)
      </Typography>

      {formData.useDiscovery && (
        <Alert severity="info" sx={{ mb: 3 }}>
          These endpoints will be automatically discovered. Manual configuration is only needed for custom providers.
        </Alert>
      )}

      <TextField
        fullWidth
        label="Authorization URL"
        value={formData.authorizationUrl}
        onChange={handleInputChange('authorizationUrl')}
        sx={{ mb: 2 }}
        required={!formData.useDiscovery}
        disabled={formData.useDiscovery && formData.provider !== 'custom'}
        helperText="OAuth2 authorization endpoint"
      />

      <TextField
        fullWidth
        label="Token URL"
        value={formData.tokenUrl}
        onChange={handleInputChange('tokenUrl')}
        sx={{ mb: 2 }}
        required={!formData.useDiscovery}
        disabled={formData.useDiscovery && formData.provider !== 'custom'}
        helperText="OAuth2 token endpoint"
      />

      <TextField
        fullWidth
        label="User Info URL"
        value={formData.userInfoUrl}
        onChange={handleInputChange('userInfoUrl')}
        sx={{ mb: 2 }}
        disabled={formData.useDiscovery && formData.provider !== 'custom'}
        helperText="OAuth2 user information endpoint"
      />

      <TextField
        fullWidth
        label="JWKS URL"
        value={formData.jwksUrl}
        onChange={handleInputChange('jwksUrl')}
        sx={{ mb: 3 }}
        disabled={formData.useDiscovery && formData.provider !== 'custom'}
        helperText="JSON Web Key Set endpoint for token verification"
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={() => setCurrentStep(1)}>
          Back
        </Button>
        <Button
          variant="contained"
          onClick={() => setCurrentStep(3)}
          disabled={!formData.useDiscovery && (!formData.authorizationUrl || !formData.tokenUrl)}
        >
          Next
        </Button>
      </Box>
    </Box>
  );

  const renderTestReviewStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Test & Review
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Test the connection and review your configuration
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Provider Configuration
          </Typography>
          <Typography variant="body2">Name: {formData.name}</Typography>
          <Typography variant="body2">Provider: {formData.provider}</Typography>
          <Typography variant="body2">Client ID: {formData.clientId}</Typography>
          <Typography variant="body2">Scopes: {formData.scopes}</Typography>
          <Typography variant="body2">Use Discovery: {formData.useDiscovery ? 'Yes' : 'No'}</Typography>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Endpoints
          </Typography>
          <Typography variant="body2">Authorization: {formData.authorizationUrl}</Typography>
          <Typography variant="body2">Token: {formData.tokenUrl}</Typography>
          <Typography variant="body2">User Info: {formData.userInfoUrl}</Typography>
          <Typography variant="body2">JWKS: {formData.jwksUrl}</Typography>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="outlined"
          onClick={testConnection}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          Test Connection
        </Button>
        {testResult && (
          <Alert 
            severity={testResult.success ? 'success' : 'error'}
            icon={testResult.success ? <CheckCircle /> : <Error />}
          >
            {testResult.success ? testResult.message : testResult.error}
          </Alert>
        )}
      </Box>

      <FormControlLabel
        control={
          <Switch
            checked={formData.enabled}
            onChange={handleInputChange('enabled')}
          />
        }
        label="Enable this OAuth2 provider"
        sx={{ mb: 3 }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={() => setCurrentStep(2)}>
          Back
        </Button>
        <Button
          variant="contained"
          onClick={saveProvider}
          disabled={loading}
        >
          {loading ? <CircularProgress size={20} /> : (existingProvider ? 'Update Provider' : 'Create Provider')}
        </Button>
      </Box>
    </Box>
  );

  const stepComponents = [
    renderProviderSelectionStep,
    renderOAuth2ConfigurationStep,
    renderEndpointConfigurationStep,
    renderTestReviewStep
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