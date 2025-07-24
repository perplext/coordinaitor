import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tab,
  Tabs,
  Button,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel
} from '@mui/material';
import { Security, VpnKey, Group, Settings, Add } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { SAMLProviderSetup } from './SAMLProviderSetup';
import { OAuth2ProviderSetup } from './OAuth2ProviderSetup';
import { SSOProviderList } from './SSOProviderList';
import { SSOTestConnection } from './SSOTestConnection';
import { SSOUserMapping } from './SSOUserMapping';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`sso-tabpanel-${index}`}
      aria-labelledby={`sso-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export const SSOConfiguration: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [selectedProviderType, setSelectedProviderType] = useState<'saml' | 'oauth2' | null>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ssoEnabled, setSsoEnabled] = useState(true);

  useEffect(() => {
    loadSSOProviders();
  }, []);

  const loadSSOProviders = async () => {
    try {
      setLoading(true);
      
      // Load SAML providers
      const samlResponse = await fetch('/api/sso/saml/providers');
      const samlData = await samlResponse.json();
      
      // Load OAuth2 providers  
      const oauth2Response = await fetch('/api/sso/oauth2/providers');
      const oauth2Data = await oauth2Response.json();
      
      const allProviders = [
        ...(samlData.providers || []).map((p: any) => ({ ...p, type: 'saml' })),
        ...(oauth2Data.providers || []).map((p: any) => ({ ...p, type: 'oauth2' }))
      ];
      
      setProviders(allProviders);
    } catch (error) {
      console.error('Failed to load SSO providers:', error);
      setError('Failed to load SSO providers');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleSetupProvider = (type: 'saml' | 'oauth2') => {
    setSelectedProviderType(type);
    setSetupDialogOpen(true);
  };

  const handleSetupComplete = () => {
    setSetupDialogOpen(false);
    setSelectedProviderType(null);
    loadSSOProviders();
  };

  const handleToggleSSO = async (enabled: boolean) => {
    try {
      const response = await fetch('/api/sso/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled })
      });

      if (response.ok) {
        setSsoEnabled(enabled);
      } else {
        throw new Error('Failed to update SSO settings');
      }
    } catch (error) {
      console.error('Failed to toggle SSO:', error);
      setError('Failed to update SSO settings');
    }
  };

  const renderOverviewCards = () => (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12} md={4}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Security sx={{ mr: 2, fontSize: 32, color: 'primary.main' }} />
                <Typography variant="h6">SAML 2.0</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Enterprise single sign-on with SAML 2.0 identity providers like 
                Okta, Azure AD, and Google Workspace.
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Chip 
                  label={`${providers.filter(p => p.type === 'saml').length} Configured`}
                  size="small"
                  color="primary"
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Add />}
                  onClick={() => handleSetupProvider('saml')}
                >
                  Add SAML
                </Button>
              </Box>
            </CardContent>
          </Card>
        </motion.div>
      </Grid>

      <Grid item xs={12} md={4}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <VpnKey sx={{ mr: 2, fontSize: 32, color: 'secondary.main' }} />
                <Typography variant="h6">OAuth2/OIDC</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Modern OAuth2 and OpenID Connect authentication with providers 
                like Google, Microsoft, GitHub, and custom services.
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Chip 
                  label={`${providers.filter(p => p.type === 'oauth2').length} Configured`}
                  size="small"
                  color="secondary"
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Add />}
                  onClick={() => handleSetupProvider('oauth2')}
                >
                  Add OAuth2
                </Button>
              </Box>
            </CardContent>
          </Card>
        </motion.div>
      </Grid>

      <Grid item xs={12} md={4}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Group sx={{ mr: 2, fontSize: 32, color: 'success.main' }} />
                <Typography variant="h6">User Management</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Automatic user provisioning, role mapping, and attribute 
                synchronization from identity providers.
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Chip 
                  label={`${providers.filter(p => p.enabled).length} Active`}
                  size="small"
                  color="success"
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Settings />}
                  onClick={() => setCurrentTab(3)}
                >
                  Configure
                </Button>
              </Box>
            </CardContent>
          </Card>
        </motion.div>
      </Grid>
    </Grid>
  );

  if (loading && providers.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              SSO Configuration
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Configure SAML and OAuth2 single sign-on for your organization
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={ssoEnabled}
                onChange={(e) => handleToggleSSO(e.target.checked)}
                color="primary"
              />
            }
            label="Enable SSO"
          />
        </Box>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {renderOverviewCards()}

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={handleTabChange} aria-label="sso configuration tabs">
            <Tab label="Providers" />
            <Tab label="Testing" />
            <Tab label="User Mapping" />
            <Tab label="Security Settings" />
          </Tabs>
        </Box>

        <TabPanel value={currentTab} index={0}>
          <SSOProviderList 
            providers={providers} 
            onRefresh={loadSSOProviders}
            onAddProvider={handleSetupProvider}
          />
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <SSOTestConnection providers={providers} />
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <SSOUserMapping providers={providers} onRefresh={loadSSOProviders} />
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          <Box>
            <Typography variant="h6" gutterBottom>
              Security Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure security settings for SSO authentication
            </Typography>
            
            {/* Security settings would go here */}
            <Alert severity="info">
              Security settings configuration coming soon
            </Alert>
          </Box>
        </TabPanel>
      </Card>

      {/* Setup Dialog */}
      <Dialog 
        open={setupDialogOpen} 
        onClose={() => setSetupDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Setup {selectedProviderType === 'saml' ? 'SAML' : 'OAuth2'} Provider
        </DialogTitle>
        <DialogContent>
          {selectedProviderType === 'saml' && (
            <SAMLProviderSetup 
              onComplete={handleSetupComplete}
              onCancel={() => setSetupDialogOpen(false)}
            />
          )}
          {selectedProviderType === 'oauth2' && (
            <OAuth2ProviderSetup 
              onComplete={handleSetupComplete}
              onCancel={() => setSetupDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};