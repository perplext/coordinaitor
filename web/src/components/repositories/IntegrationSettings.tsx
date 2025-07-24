import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  FormGroup,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Menu,
  MenuItem,
  Grid,
  Divider
} from '@mui/material';
import {
  Edit,
  Delete,
  MoreVert,
  GitHub,
  GitBranch,
  Settings,
  Check,
  Close,
  Warning
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface Integration {
  id: string;
  repositoryId: string;
  repositoryName: string;
  provider: 'github' | 'gitlab';
  webhookUrl?: string;
  autoCreateTasks: boolean;
  autoCreatePR: boolean;
  branchPrefix?: string;
  settings: {
    enabledEvents: string[];
    taskCreationRules: {
      issueLabels?: string[];
      prLabels?: string[];
      autoAssign?: boolean;
    };
  };
  createdAt: string;
  updatedAt: string;
}

interface IntegrationSettingsProps {
  integrations: Integration[];
  onRefresh: () => void;
  services: {
    github: boolean;
    gitlab: boolean;
  };
}

export const IntegrationSettings: React.FC<IntegrationSettingsProps> = ({
  integrations,
  onRefresh,
  services
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [formData, setFormData] = useState<Partial<Integration>>({});

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, integration: Integration) => {
    setAnchorEl(event.currentTarget);
    setSelectedIntegration(integration);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedIntegration(null);
  };

  const handleEditIntegration = () => {
    if (selectedIntegration) {
      setFormData(selectedIntegration);
      setEditDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleDeleteIntegration = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSettingsChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [field]: value
      }
    }));
  };

  const handleTaskCreationRulesChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        taskCreationRules: {
          ...prev.settings?.taskCreationRules,
          [field]: value
        }
      }
    }));
  };

  const saveIntegration = async () => {
    if (!selectedIntegration) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/repositories/integrations/${selectedIntegration.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Integration updated successfully');
        setEditDialogOpen(false);
        setSelectedIntegration(null);
        onRefresh();
      } else {
        setError(data.message || 'Failed to update integration');
      }
    } catch (error) {
      setError('Failed to update integration');
      console.error('Update failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteIntegration = async () => {
    if (!selectedIntegration) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/repositories/integrations/${selectedIntegration.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setSuccess('Integration deleted successfully');
        setDeleteDialogOpen(false);
        setSelectedIntegration(null);
        onRefresh();
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to delete integration');
      }
    } catch (error) {
      setError('Failed to delete integration');
      console.error('Delete failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleIntegrationSetting = async (integration: Integration, field: string, value: boolean) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/repositories/integrations/${integration.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          [field]: value
        })
      });

      if (response.ok) {
        setSuccess(`${field} ${value ? 'enabled' : 'disabled'} successfully`);
        onRefresh();
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to update setting');
      }
    } catch (error) {
      setError('Failed to update setting');
      console.error('Toggle failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderIntegrationCard = (integration: Integration) => (
    <Grid item xs={12} lg={6} key={integration.id}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        layout
      >
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {integration.provider === 'github' ? (
                  <GitHub sx={{ mr: 2, color: 'primary.main' }} />
                ) : (
                  <GitBranch sx={{ mr: 2, color: 'primary.main' }} />
                )}
                <Box>
                  <Typography variant="h6" component="div" noWrap>
                    {integration.repositoryName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {integration.provider.charAt(0).toUpperCase() + integration.provider.slice(1)}
                  </Typography>
                </Box>
              </Box>
              <IconButton 
                size="small"
                onClick={(e) => handleMenuOpen(e, integration)}
              >
                <MoreVert />
              </IconButton>
            </Box>

            <Box sx={{ mb: 3 }}>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={integration.autoCreateTasks}
                      onChange={(e) => toggleIntegrationSetting(
                        integration, 
                        'autoCreateTasks', 
                        e.target.checked
                      )}
                      disabled={loading}
                    />
                  }
                  label="Auto-create tasks from issues"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={integration.autoCreatePR}
                      onChange={(e) => toggleIntegrationSetting(
                        integration, 
                        'autoCreatePR', 
                        e.target.checked
                      )}
                      disabled={loading}
                    />
                  }
                  label="Auto-create pull requests"
                />
              </FormGroup>
            </Box>

            <Divider sx={{ mb: 2 }} />

            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Enabled Events
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {integration.settings.enabledEvents.map(event => (
                  <Chip
                    key={event}
                    size="small"
                    label={event}
                    variant="outlined"
                    color="primary"
                  />
                ))}
              </Box>
            </Box>

            {integration.settings.taskCreationRules.issueLabels && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Issue Labels
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {integration.settings.taskCreationRules.issueLabels.map(label => (
                    <Chip
                      key={label}
                      size="small"
                      label={label}
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            )}

            {integration.branchPrefix && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Branch Prefix
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {integration.branchPrefix}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Updated: {new Date(integration.updatedAt).toLocaleDateString()}
              </Typography>
              {integration.webhookUrl ? (
                <Chip
                  size="small"
                  label="Webhook Active"
                  color="success"
                  icon={<Check />}
                />
              ) : (
                <Chip
                  size="small"
                  label="No Webhook"
                  color="warning"
                  icon={<Warning />}
                />
              )}
            </Box>
          </CardContent>
        </Card>
      </motion.div>
    </Grid>
  );

  return (
    <Box>
      {/* Status Messages */}
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
        {success && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert severity="success" sx={{ mb: 3 }}>
              {success}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <CircularProgress size={20} />
        </Box>
      )}

      {/* Integrations Grid */}
      {integrations.length > 0 ? (
        <Grid container spacing={3}>
          {integrations.map(renderIntegrationCard)}
        </Grid>
      ) : (
        <Box sx={{ textAlign: 'center', p: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No repository integrations found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Integrate repositories from the Repositories tab to manage settings here
          </Typography>
        </Box>
      )}

      {/* Integration Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEditIntegration}>
          <Edit sx={{ mr: 1 }} />
          Edit Settings
        </MenuItem>
        <MenuItem onClick={handleDeleteIntegration} sx={{ color: 'error.main' }}>
          <Delete sx={{ mr: 1 }} />
          Delete Integration
        </MenuItem>
      </Menu>

      {/* Edit Integration Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Edit Integration: {selectedIntegration?.repositoryName}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Automation Settings
            </Typography>
            
            <FormGroup sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.autoCreateTasks || false}
                    onChange={(e) => handleFormChange('autoCreateTasks', e.target.checked)}
                  />
                }
                label="Automatically create tasks from issues"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.autoCreatePR || false}
                    onChange={(e) => handleFormChange('autoCreatePR', e.target.checked)}
                  />
                }
                label="Automatically create pull requests for completed tasks"
              />
            </FormGroup>

            <TextField
              fullWidth
              label="Branch Prefix"
              value={formData.branchPrefix || ''}
              onChange={(e) => handleFormChange('branchPrefix', e.target.value)}
              sx={{ mb: 3 }}
              helperText="Prefix for branches created by AI agents"
            />

            <Typography variant="h6" gutterBottom>
              Task Creation Rules
            </Typography>
            
            <TextField
              fullWidth
              label="Issue Labels (comma-separated)"
              value={formData.settings?.taskCreationRules?.issueLabels?.join(', ') || ''}
              onChange={(e) => handleTaskCreationRulesChange(
                'issueLabels', 
                e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              )}
              sx={{ mb: 2 }}
              helperText="Issues with these labels will automatically create tasks"
            />

            <TextField
              fullWidth
              label="PR Labels (comma-separated)"
              value={formData.settings?.taskCreationRules?.prLabels?.join(', ') || ''}
              onChange={(e) => handleTaskCreationRulesChange(
                'prLabels', 
                e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              )}
              sx={{ mb: 2 }}
              helperText="Pull requests with these labels will create review tasks"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.settings?.taskCreationRules?.autoAssign || false}
                  onChange={(e) => handleTaskCreationRulesChange('autoAssign', e.target.checked)}
                />
              }
              label="Auto-assign tasks to best available agents"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={saveIntegration}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Integration</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the integration for{' '}
            <strong>{selectedIntegration?.repositoryName}</strong>?
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            This will also remove any associated webhooks and automation rules.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={deleteIntegration}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};