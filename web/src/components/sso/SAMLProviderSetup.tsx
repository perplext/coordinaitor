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
  IconButton,
  Tooltip
} from '@mui/material';
import { ContentCopy, Help, CheckCircle, Error } from '@mui/icons-material';
import { motion } from 'framer-motion';

interface SAMLProviderSetupProps {
  onComplete: () => void;
  onCancel: () => void;
  existingProvider?: any;
}

export const SAMLProviderSetup: React.FC<SAMLProviderSetupProps> = ({
  onComplete,
  onCancel,
  existingProvider
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: existingProvider?.name || '',
    entityId: existingProvider?.entityId || '',
    ssoUrl: existingProvider?.ssoUrl || '',
    sloUrl: existingProvider?.sloUrl || '',
    metadata: existingProvider?.metadata || '',
    publicCert: existingProvider?.publicCert || '',
    nameIdFormat: existingProvider?.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    attributeMapping: {
      email: existingProvider?.attributeMapping?.email || 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
      firstName: existingProvider?.attributeMapping?.firstName || 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
      lastName: existingProvider?.attributeMapping?.lastName || 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
      groups: existingProvider?.attributeMapping?.groups || 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'
    },
    autoProvisionUsers: existingProvider?.autoProvisionUsers ?? true,
    defaultRole: existingProvider?.defaultRole || 'org_member',
    allowedDomains: existingProvider?.allowedDomains?.join(', ') || '',
    enabled: existingProvider?.enabled ?? true
  });

  const steps = [
    'Provider Information',
    'Metadata & Certificates',
    'Attribute Mapping',
    'Configuration Review'
  ];

  const handleInputChange = (field: string) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev as any)[parent],
          [child]: event.target.value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: event.target.type === 'checkbox' ? (event.target as HTMLInputElement).checked : event.target.value
      }));
    }
    setError(null);
    setValidationResult(null);
  };

  const validateMetadata = async () => {
    if (!formData.metadata) {
      setError('Metadata is required for validation');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/auth/saml/validate-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ metadata: formData.metadata })
      });

      const result = await response.json();

      if (result.valid) {
        setValidationResult({
          valid: true,
          entityId: result.entityId,
          ssoUrl: result.ssoUrl,
          sloUrl: result.sloUrl,
          certificates: result.certificates
        });

        // Auto-fill fields from metadata
        setFormData(prev => ({
          ...prev,
          entityId: result.entityId || prev.entityId,
          ssoUrl: result.ssoUrl || prev.ssoUrl,
          sloUrl: result.sloUrl || prev.sloUrl,
          publicCert: result.certificates?.[0] || prev.publicCert
        }));
      } else {
        setValidationResult({ valid: false, error: result.error });
        setError(result.error || 'Invalid metadata');
      }
    } catch (error) {
      setError('Failed to validate metadata');
      console.error('Metadata validation failed:', error);
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
        allowedDomains: formData.allowedDomains 
          ? formData.allowedDomains.split(',').map(d => d.trim()).filter(Boolean)
          : []
      };

      const url = existingProvider 
        ? `/api/sso/saml/providers/${existingProvider.id}`
        : '/api/sso/saml/providers';
      
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
        setError(result.message || 'Failed to save SAML provider');
      }
    } catch (error) {
      setError('Failed to save SAML provider');
      console.error('Save failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderProviderInformationStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Provider Information
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Basic information about your SAML identity provider
      </Typography>

      <TextField
        fullWidth
        label="Provider Name"
        value={formData.name}
        onChange={handleInputChange('name')}
        sx={{ mb: 2 }}
        required
        helperText="A friendly name for this SAML provider"
      />

      <TextField
        fullWidth
        label="Entity ID"
        value={formData.entityId}
        onChange={handleInputChange('entityId')}
        sx={{ mb: 2 }}
        required
        helperText="The unique identifier for the identity provider"
      />

      <TextField
        fullWidth
        label="SSO URL"
        value={formData.ssoUrl}
        onChange={handleInputChange('ssoUrl')}
        sx={{ mb: 2 }}
        required
        helperText="The SAML single sign-on endpoint"
      />

      <TextField
        fullWidth
        label="SLO URL (Optional)"
        value={formData.sloUrl}
        onChange={handleInputChange('sloUrl')}
        sx={{ mb: 2 }}
        helperText="Single logout endpoint (optional)"
      />

      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel>Name ID Format</InputLabel>
        <Select
          value={formData.nameIdFormat}
          onChange={(e) => setFormData(prev => ({ ...prev, nameIdFormat: e.target.value }))}
        >
          <MenuItem value="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">Email Address</MenuItem>
          <MenuItem value="urn:oasis:names:tc:SAML:2.0:nameid-format:persistent">Persistent</MenuItem>
          <MenuItem value="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">Transient</MenuItem>
          <MenuItem value="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified">Unspecified</MenuItem>
        </Select>
      </FormControl>

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => setCurrentStep(1)}
          disabled={!formData.name || !formData.entityId || !formData.ssoUrl}
        >
          Next
        </Button>
      </Box>
    </Box>
  );

  const renderMetadataStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Metadata & Certificates
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure using metadata XML or manual certificate entry
      </Typography>

      <Card sx={{ mb: 3, bgcolor: 'info.50' }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Service Provider Metadata
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Provide this metadata to your identity provider:
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              value={`${window.location.origin}/api/auth/saml/default/metadata`}
              InputProps={{ readOnly: true }}
              sx={{ flexGrow: 1 }}
            />
            <Tooltip title="Copy to clipboard">
              <IconButton 
                size="small"
                onClick={() => copyToClipboard(`${window.location.origin}/api/auth/saml/default/metadata`)}
              >
                <ContentCopy />
              </IconButton>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      <TextField
        fullWidth
        label="Identity Provider Metadata XML"
        multiline
        rows={8}
        value={formData.metadata}
        onChange={handleInputChange('metadata')}
        sx={{ mb: 2 }}
        helperText="Paste the complete metadata XML from your identity provider"
      />

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="outlined"
          onClick={validateMetadata}
          disabled={!formData.metadata || loading}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          Validate Metadata
        </Button>
        {validationResult && (
          <Alert 
            severity={validationResult.valid ? 'success' : 'error'}
            icon={validationResult.valid ? <CheckCircle /> : <Error />}
          >
            {validationResult.valid ? 'Metadata is valid' : validationResult.error}
          </Alert>
        )}
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" gutterBottom>
        Manual Configuration (if not using metadata)
      </Typography>

      <TextField
        fullWidth
        label="Public Certificate"
        multiline
        rows={6}
        value={formData.publicCert}
        onChange={handleInputChange('publicCert')}
        sx={{ mb: 3 }}
        helperText="X.509 certificate for signature verification (PEM format)"
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={() => setCurrentStep(0)}>
          Back
        </Button>
        <Button
          variant="contained"
          onClick={() => setCurrentStep(2)}
          disabled={!formData.metadata && !formData.publicCert}
        >
          Next
        </Button>
      </Box>
    </Box>
  );

  const renderAttributeMappingStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Attribute Mapping
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Map SAML attributes to user properties
      </Typography>

      <TextField
        fullWidth
        label="Email Attribute"
        value={formData.attributeMapping.email}
        onChange={handleInputChange('attributeMapping.email')}
        sx={{ mb: 2 }}
        required
        helperText="SAML attribute containing user email"
      />

      <TextField
        fullWidth
        label="First Name Attribute"
        value={formData.attributeMapping.firstName}
        onChange={handleInputChange('attributeMapping.firstName')}
        sx={{ mb: 2 }}
        helperText="SAML attribute containing user first name"
      />

      <TextField
        fullWidth
        label="Last Name Attribute"
        value={formData.attributeMapping.lastName}
        onChange={handleInputChange('attributeMapping.lastName')}
        sx={{ mb: 2 }}
        helperText="SAML attribute containing user last name"
      />

      <TextField
        fullWidth
        label="Groups Attribute"
        value={formData.attributeMapping.groups}
        onChange={handleInputChange('attributeMapping.groups')}
        sx={{ mb: 3 }}
        helperText="SAML attribute containing user groups/roles"
      />

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" gutterBottom>
        User Provisioning
      </Typography>

      <FormControlLabel
        control={
          <Switch
            checked={formData.autoProvisionUsers}
            onChange={handleInputChange('autoProvisionUsers')}
          />
        }
        label="Automatically provision new users"
        sx={{ mb: 2 }}
      />

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Default Role</InputLabel>
        <Select
          value={formData.defaultRole}
          onChange={(e) => setFormData(prev => ({ ...prev, defaultRole: e.target.value }))}
        >
          <MenuItem value="viewer">Viewer</MenuItem>
          <MenuItem value="org_member">Organization Member</MenuItem>
          <MenuItem value="developer">Developer</MenuItem>
          <MenuItem value="org_admin">Organization Admin</MenuItem>
        </Select>
      </FormControl>

      <TextField
        fullWidth
        label="Allowed Email Domains (Optional)"
        value={formData.allowedDomains}
        onChange={handleInputChange('allowedDomains')}
        sx={{ mb: 3 }}
        helperText="Comma-separated list of allowed email domains (e.g., company.com, example.org)"
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={() => setCurrentStep(1)}>
          Back
        </Button>
        <Button
          variant="contained"
          onClick={() => setCurrentStep(3)}
        >
          Next
        </Button>
      </Box>
    </Box>
  );

  const renderReviewStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Configuration Review
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review your SAML provider configuration
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Provider Information
          </Typography>
          <Typography variant="body2">Name: {formData.name}</Typography>
          <Typography variant="body2">Entity ID: {formData.entityId}</Typography>
          <Typography variant="body2">SSO URL: {formData.ssoUrl}</Typography>
          {formData.sloUrl && (
            <Typography variant="body2">SLO URL: {formData.sloUrl}</Typography>
          )}
          <Typography variant="body2">Name ID Format: {formData.nameIdFormat}</Typography>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Attribute Mapping
          </Typography>
          <Typography variant="body2">Email: {formData.attributeMapping.email}</Typography>
          <Typography variant="body2">First Name: {formData.attributeMapping.firstName}</Typography>
          <Typography variant="body2">Last Name: {formData.attributeMapping.lastName}</Typography>
          <Typography variant="body2">Groups: {formData.attributeMapping.groups}</Typography>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            User Provisioning
          </Typography>
          <Typography variant="body2">
            Auto Provision: {formData.autoProvisionUsers ? 'Enabled' : 'Disabled'}
          </Typography>
          <Typography variant="body2">Default Role: {formData.defaultRole}</Typography>
          {formData.allowedDomains && (
            <Typography variant="body2">Allowed Domains: {formData.allowedDomains}</Typography>
          )}
        </CardContent>
      </Card>

      <FormControlLabel
        control={
          <Switch
            checked={formData.enabled}
            onChange={handleInputChange('enabled')}
          />
        }
        label="Enable this SAML provider"
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
    renderProviderInformationStep,
    renderMetadataStep,
    renderAttributeMappingStep,
    renderReviewStep
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