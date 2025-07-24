import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Switch,
  FormControlLabel,
  Slider,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  ExpandMore,
  SmartToy,
  Settings,
  Integration,
  Workflow,
  Edit,
  Add,
  Save,
  Cancel,
  Warning,
  CheckCircle,
  Error,
  Refresh
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface OrganizationAgentConfig {
  id: string;
  organizationId: string;
  agentId: string;
  enabled: boolean;
  priority: number;
  maxConcurrentTasks: number;
  config: {
    apiKey?: string;
    endpoint?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    rateLimits?: {
      requestsPerMinute: number;
      requestsPerHour: number;
      requestsPerDay: number;
    };
    costLimits?: {
      maxCostPerTask: number;
      maxCostPerDay: number;
      maxCostPerMonth: number;
    };
    features?: {
      codeGeneration: boolean;
      dataAnalysis: boolean;
      imageGeneration: boolean;
      fileProcessing: boolean;
      webSearch: boolean;
      collaboration: boolean;
    };
  };
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface OrganizationFeatureConfig {
  id: string;
  organizationId: string;
  featureName: string;
  enabled: boolean;
  config: Record<string, any>;
  limits?: {
    maxUsage?: number;
    maxUsers?: number;
    rateLimits?: Record<string, number>;
  };
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface OrganizationWorkflowConfig {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  enabled: boolean;
  triggerEvents: string[];
  actions: WorkflowAction[];
  conditions?: WorkflowCondition[];
  schedule?: {
    type: 'cron' | 'interval' | 'event';
    value: string;
    timezone?: string;
  };
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowAction {
  id: string;
  type: 'agent_task' | 'notification' | 'webhook' | 'approval' | 'integration';
  config: Record<string, any>;
  order: number;
  enabled: boolean;
}

interface WorkflowCondition {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

interface OrganizationIntegrationConfig {
  id: string;
  organizationId: string;
  integrationType: string;
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  webhookUrl?: string;
  lastSyncAt?: string;
  syncStatus?: 'success' | 'error' | 'pending';
  syncError?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

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
      id={`config-tabpanel-${index}`}
      aria-labelledby={`config-tab-${index}`}
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

export const OrganizationConfigDashboard: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [agentConfigs, setAgentConfigs] = useState<OrganizationAgentConfig[]>([]);
  const [availableAgents, setAvailableAgents] = useState<string[]>([]);
  const [featureConfigs, setFeatureConfigs] = useState<OrganizationFeatureConfig[]>([]);
  const [workflows, setWorkflows] = useState<OrganizationWorkflowConfig[]>([]);
  const [integrations, setIntegrations] = useState<OrganizationIntegrationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);

  useEffect(() => {
    loadConfigData();
  }, []);

  const loadConfigData = async () => {
    try {
      setLoading(true);
      setError(null);

      await Promise.all([
        loadAgentConfigs(),
        loadAvailableAgents(),
        loadFeatureConfigs(),
        loadWorkflows(),
        loadIntegrations()
      ]);
    } catch (error) {
      setError('Failed to load configuration data');
      console.error('Failed to load config data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAgentConfigs = async () => {
    const response = await fetch('/api/organization-config/agents');
    const data = await response.json();
    if (response.ok) {
      setAgentConfigs(data.agents);
    }
  };

  const loadAvailableAgents = async () => {
    const response = await fetch('/api/organization-config/agents/available');
    const data = await response.json();
    if (response.ok) {
      setAvailableAgents(data.agents);
    }
  };

  const loadFeatureConfigs = async () => {
    const response = await fetch('/api/organization-config/features');
    const data = await response.json();
    if (response.ok) {
      setFeatureConfigs(data.features);
    }
  };

  const loadWorkflows = async () => {
    const response = await fetch('/api/organization-config/workflows');
    const data = await response.json();
    if (response.ok) {
      setWorkflows(data.workflows);
    }
  };

  const loadIntegrations = async () => {
    const response = await fetch('/api/organization-config/integrations');
    const data = await response.json();
    if (response.ok) {
      setIntegrations(data.integrations);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const updateAgentConfig = async (agentId: string, config: Partial<OrganizationAgentConfig>) => {
    try {
      const response = await fetch(`/api/organization-config/agents/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        await loadAgentConfigs();
        setEditingAgent(null);
        setAgentDialogOpen(false);
      } else {
        const error = await response.json();
        setError(error.message || 'Failed to update agent configuration');
      }
    } catch (error) {
      setError('Failed to update agent configuration');
      console.error('Failed to update agent config:', error);
    }
  };

  const updateFeatureConfig = async (featureName: string, config: Partial<OrganizationFeatureConfig>) => {
    try {
      const response = await fetch(`/api/organization-config/features/${featureName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        await loadFeatureConfigs();
      } else {
        const error = await response.json();
        setError(error.message || 'Failed to update feature configuration');
      }
    } catch (error) {
      setError('Failed to update feature configuration');
      console.error('Failed to update feature config:', error);
    }
  };

  const getAgentStatusColor = (agentId: string): 'success' | 'warning' | 'error' => {
    const config = agentConfigs.find(c => c.agentId === agentId);
    if (!config) return 'warning';
    return config.enabled ? 'success' : 'error';
  };

  const getSyncStatusIcon = (status?: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      case 'pending':
        return <Warning color="warning" />;
      default:
        return <Warning color="disabled" />;
    }
  };

  const renderAgentsTab = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">Agent Configurations</Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setAgentDialogOpen(true)}
          >
            Configure Agent
          </Button>
        </Box>
      </Grid>

      {availableAgents.map(agentId => {
        const config = agentConfigs.find(c => c.agentId === agentId);
        const isConfigured = !!config;
        
        return (
          <Grid item xs={12} md={6} key={agentId}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SmartToy sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                      {agentId}
                    </Typography>
                    <Chip
                      label={isConfigured && config.enabled ? 'Active' : 'Inactive'}
                      color={getAgentStatusColor(agentId)}
                      size="small"
                    />
                  </Box>

                  {isConfigured && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Priority: {config.priority} | Max Tasks: {config.maxConcurrentTasks}
                      </Typography>
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={config.enabled}
                            onChange={(e) => updateAgentConfig(agentId, { enabled: e.target.checked })}
                          />
                        }
                        label="Enabled"
                        sx={{ mt: 1 }}
                      />
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      startIcon={<Edit />}
                      onClick={() => {
                        setEditingAgent(agentId);
                        setAgentDialogOpen(true);
                      }}
                    >
                      {isConfigured ? 'Edit' : 'Configure'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        );
      })}
    </Grid>
  );

  const renderFeaturesTab = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom>Feature Configurations</Typography>
      </Grid>

      {featureConfigs.map(feature => (
        <Grid item xs={12} md={6} key={feature.featureName}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Settings sx={{ mr: 2, color: 'secondary.main' }} />
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  {feature.featureName}
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={feature.enabled}
                      onChange={(e) => updateFeatureConfig(feature.featureName, { enabled: e.target.checked })}
                    />
                  }
                  label="Enabled"
                />
              </Box>

              {feature.limits && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Limits</Typography>
                  {Object.entries(feature.limits).map(([key, value]) => (
                    <Typography key={key} variant="body2" color="text.secondary">
                      {key}: {value}
                    </Typography>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  const renderWorkflowsTab = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">Workflows</Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setWorkflowDialogOpen(true)}
          >
            Create Workflow
          </Button>
        </Box>
      </Grid>

      {workflows.map(workflow => (
        <Grid item xs={12} key={workflow.id}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Workflow sx={{ mr: 2, color: 'primary.main' }} />
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h6">{workflow.name}</Typography>
                  {workflow.description && (
                    <Typography variant="body2" color="text.secondary">
                      {workflow.description}
                    </Typography>
                  )}
                </Box>
                <FormControlLabel
                  control={<Switch checked={workflow.enabled} />}
                  label="Enabled"
                />
              </Box>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle2">Workflow Details</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Typography variant="subtitle2" gutterBottom>Trigger Events</Typography>
                      <List dense>
                        {workflow.triggerEvents.map((event, index) => (
                          <ListItem key={index}>
                            <ListItemText primary={event} />
                          </ListItem>
                        ))}
                      </List>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="subtitle2" gutterBottom>Actions ({workflow.actions.length})</Typography>
                      <List dense>
                        {workflow.actions.slice(0, 3).map((action, index) => (
                          <ListItem key={index}>
                            <ListItemText primary={action.type} secondary={`Order: ${action.order}`} />
                          </ListItem>
                        ))}
                        {workflow.actions.length > 3 && (
                          <ListItem>
                            <ListItemText primary={`+${workflow.actions.length - 3} more actions`} />
                          </ListItem>
                        )}
                      </List>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="subtitle2" gutterBottom>Schedule</Typography>
                      {workflow.schedule ? (
                        <Typography variant="body2">
                          {workflow.schedule.type}: {workflow.schedule.value}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">Event-driven</Typography>
                      )}
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  const renderIntegrationsTab = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">Integrations</Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {/* Handle create integration */}}
          >
            Add Integration
          </Button>
        </Box>
      </Grid>

      {integrations.map(integration => (
        <Grid item xs={12} md={6} key={integration.id}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Integration sx={{ mr: 2, color: 'success.main' }} />
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h6">{integration.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {integration.integrationType}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Tooltip title={`Sync status: ${integration.syncStatus || 'unknown'}`}>
                    {getSyncStatusIcon(integration.syncStatus)}
                  </Tooltip>
                  <FormControlLabel
                    control={<Switch checked={integration.enabled} />}
                    label="Enabled"
                    sx={{ ml: 1 }}
                  />
                </Box>
              </Box>

              {integration.lastSyncAt && (
                <Typography variant="body2" color="text.secondary">
                  Last sync: {new Date(integration.lastSyncAt).toLocaleString()}
                </Typography>
              )}

              {integration.syncError && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {integration.syncError}
                </Alert>
              )}

              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button size="small" startIcon={<Edit />}>
                  Configure
                </Button>
                <Button size="small" startIcon={<Refresh />}>
                  Sync Now
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <Typography>Loading configuration...</Typography>
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
          Organization Configuration
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Configure agents, features, workflows, and integrations for your organization
        </Typography>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={currentTab} onChange={handleTabChange} aria-label="configuration tabs">
            <Tab label="Agents" />
            <Tab label="Features" />
            <Tab label="Workflows" />
            <Tab label="Integrations" />
          </Tabs>
        </Box>

        <TabPanel value={currentTab} index={0}>
          {renderAgentsTab()}
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          {renderFeaturesTab()}
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          {renderWorkflowsTab()}
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          {renderIntegrationsTab()}
        </TabPanel>
      </Card>

      {/* Agent Configuration Dialog */}
      <Dialog
        open={agentDialogOpen}
        onClose={() => setAgentDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingAgent ? `Configure ${editingAgent}` : 'Configure Agent'}
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Agent configuration form would be implemented here
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAgentDialogOpen(false)}>Cancel</Button>
          <Button variant="contained">Save Configuration</Button>
        </DialogActions>
      </Dialog>

      {/* Workflow Creation Dialog */}
      <Dialog
        open={workflowDialogOpen}
        onClose={() => setWorkflowDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Create Workflow</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Workflow creation form would be implemented here
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWorkflowDialogOpen(false)}>Cancel</Button>
          <Button variant="contained">Create Workflow</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};