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
  DialogActions
} from '@mui/material';
import { GitHub, GitBranch, Settings, Add } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { RepositorySetup } from './RepositorySetup';
import { RepositoryList } from './RepositoryList';
import { IntegrationSettings } from './IntegrationSettings';
import { WebhookStatus } from './WebhookStatus';
import { AutomationRules } from './AutomationRules';

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
      id={`repository-tabpanel-${index}`}
      aria-labelledby={`repository-tab-${index}`}
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

export const RepositoryIntegration: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'github' | 'gitlab' | null>(null);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState({
    github: false,
    gitlab: false
  });

  useEffect(() => {
    loadRepositoryServices();
    loadIntegrations();
  }, []);

  const loadRepositoryServices = async () => {
    try {
      const response = await fetch('/api/repositories/health');
      const data = await response.json();
      
      if (response.ok) {
        setServices({
          github: data.services.github || false,
          gitlab: data.services.gitlab || false
        });
      }
    } catch (error) {
      console.error('Failed to load repository services:', error);
    }
  };

  const loadIntegrations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/repositories/integrations');
      const data = await response.json();
      
      if (response.ok) {
        setIntegrations(data.integrations || []);
      } else {
        setError(data.message || 'Failed to load integrations');
      }
    } catch (error) {
      setError('Failed to load integrations');
      console.error('Failed to load integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleSetupProvider = (provider: 'github' | 'gitlab') => {
    setSelectedProvider(provider);
    setSetupDialogOpen(true);
  };

  const handleSetupComplete = () => {
    setSetupDialogOpen(false);
    setSelectedProvider(null);
    loadRepositoryServices();
    loadIntegrations();
  };

  const renderSetupCards = () => (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12} md={6}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <GitHub sx={{ mr: 2, fontSize: 32 }} />
                <Typography variant="h6">GitHub Integration</Typography>
                {services.github && (
                  <Chip 
                    label="Configured" 
                    color="success" 
                    size="small" 
                    sx={{ ml: 'auto' }} 
                  />
                )}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Connect your GitHub repositories to automatically create tasks from issues, 
                review pull requests, and sync code changes.
              </Typography>
              <Button
                variant={services.github ? "outlined" : "contained"}
                startIcon={services.github ? <Settings /> : <Add />}
                onClick={() => handleSetupProvider('github')}
                fullWidth
              >
                {services.github ? 'Reconfigure' : 'Setup GitHub'}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </Grid>

      <Grid item xs={12} md={6}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <GitBranch sx={{ mr: 2, fontSize: 32 }} />
                <Typography variant="h6">GitLab Integration</Typography>
                {services.gitlab && (
                  <Chip 
                    label="Configured" 
                    color="success" 
                    size="small" 
                    sx={{ ml: 'auto' }} 
                  />
                )}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Connect your GitLab projects to enable automatic task creation, 
                merge request reviews, and pipeline integration.
              </Typography>
              <Button
                variant={services.gitlab ? "outlined" : "contained"}
                startIcon={services.gitlab ? <Settings /> : <Add />}
                onClick={() => handleSetupProvider('gitlab')}
                fullWidth
              >
                {services.gitlab ? 'Reconfigure' : 'Setup GitLab'}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </Grid>
    </Grid>
  );

  if (loading && integrations.length === 0) {
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
        <Typography variant="h4" gutterBottom>
          Repository Integration
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Connect your Git repositories to enable automatic task creation, code review, 
          and workflow automation.
        </Typography>
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

      {renderSetupCards()}

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={handleTabChange} aria-label="repository tabs">
            <Tab label="Repositories" />
            <Tab label="Integrations" />
            <Tab label="Webhooks" />
            <Tab label="Automation Rules" />
          </Tabs>
        </Box>

        <TabPanel value={currentTab} index={0}>
          <RepositoryList services={services} onRefresh={loadIntegrations} />
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <IntegrationSettings 
            integrations={integrations} 
            onRefresh={loadIntegrations}
            services={services}
          />
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <WebhookStatus integrations={integrations} />
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          <AutomationRules onRefresh={loadIntegrations} />
        </TabPanel>
      </Card>

      <Dialog 
        open={setupDialogOpen} 
        onClose={() => setSetupDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Setup {selectedProvider?.charAt(0).toUpperCase()}{selectedProvider?.slice(1)} Integration
        </DialogTitle>
        <DialogContent>
          {selectedProvider && (
            <RepositorySetup 
              provider={selectedProvider}
              onComplete={handleSetupComplete}
              onCancel={() => setSetupDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};