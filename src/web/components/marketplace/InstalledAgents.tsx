import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Menu,
  MenuList,
  ListItemIcon,
  ListItemText,
  Divider,
  LinearProgress,
  Tooltip
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Health as HealthIcon,
  Timeline as TimelineIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

interface AgentInstallation {
  id: string;
  agentId: string;
  marketplaceAgentId: string;
  version: string;
  status: 'installing' | 'installed' | 'failed' | 'updating' | 'uninstalling';
  configuration: any;
  health: {
    isHealthy: boolean;
    lastHealthCheck: Date;
    failureCount: number;
  };
  usage: {
    tasksExecuted: number;
    totalCost: number;
    averageResponseTime: number;
    errorRate: number;
  };
  installedAt?: Date;
  lastUsedAt?: Date;
}

interface MarketplaceAgent {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  tags: string[];
  author: {
    name: string;
    organization?: string;
  };
  pricing: {
    type: 'free' | 'freemium' | 'paid' | 'subscription';
    pricePerTask?: number;
    monthlyPrice?: number;
  };
  metrics: {
    averageRating: number;
    totalReviews: number;
  };
}

const InstalledAgents: React.FC = () => {
  const [installations, setInstallations] = useState<AgentInstallation[]>([]);
  const [agents, setAgents] = useState<MarketplaceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstallation, setSelectedInstallation] = useState<AgentInstallation | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [uninstallDialogOpen, setUninstallDialogOpen] = useState(false);
  const [uninstallReason, setUninstallReason] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchInstalledAgents();
  }, []);

  const fetchInstalledAgents = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/marketplace/installed');
      const data = await response.json();

      if (data.success) {
        setInstallations(data.installations);
        setAgents(data.agents);
      } else {
        setError(data.error || 'Failed to fetch installed agents');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleUninstall = async () => {
    if (!selectedInstallation) return;

    setActionLoading('uninstall');

    try {
      const response = await fetch(`/api/marketplace/installations/${selectedInstallation.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: uninstallReason
        })
      });

      const data = await response.json();

      if (data.success) {
        // Remove from list
        setInstallations(prev => prev.filter(i => i.id !== selectedInstallation.id));
        setAgents(prev => prev.filter(a => a.id !== selectedInstallation.marketplaceAgentId));
        setUninstallDialogOpen(false);
        setUninstallReason('');
      } else {
        setError(data.error || 'Failed to uninstall agent');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setActionLoading(null);
      setSelectedInstallation(null);
    }
  };

  const getStatusColor = (status: AgentInstallation['status']) => {
    switch (status) {
      case 'installed':
        return 'success';
      case 'installing':
      case 'updating':
        return 'info';
      case 'failed':
        return 'error';
      case 'uninstalling':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: AgentInstallation['status']) => {
    switch (status) {
      case 'installed':
        return <CheckCircleIcon />;
      case 'installing':
      case 'updating':
        return <CircularProgress size={20} />;
      case 'failed':
        return <ErrorIcon />;
      case 'uninstalling':
        return <WarningIcon />;
      default:
        return <InfoIcon />;
    }
  };

  const getHealthStatus = (installation: AgentInstallation) => {
    if (installation.status !== 'installed') {
      return { color: 'default', text: 'N/A' };
    }

    if (installation.health.isHealthy) {
      return { color: 'success', text: 'Healthy' };
    } else if (installation.health.failureCount > 5) {
      return { color: 'error', text: 'Critical' };
    } else {
      return { color: 'warning', text: 'Warning' };
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
          Installed Agents
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Manage and monitor your organization's installed agents
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {installations.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No agents installed
            </Typography>
            <Typography variant="body1" color="text.secondary" mb={3}>
              Browse the marketplace to find and install agents for your organization
            </Typography>
            <Button
              variant="contained"
              onClick={() => window.location.href = '/marketplace'}
            >
              Browse Marketplace
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {installations.map((installation, index) => {
            const agent = agents.find(a => a.id === installation.marketplaceAgentId);
            if (!agent) return null;

            const healthStatus = getHealthStatus(installation);

            return (
              <Grid item xs={12} md={6} lg={4} key={installation.id}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card 
                    sx={{ 
                      height: '100%', 
                      display: 'flex', 
                      flexDirection: 'column',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: 4
                      }
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box display="flex" alignItems="center" mb={2}>
                        <Avatar sx={{ width: 48, height: 48, mr: 2, bgcolor: 'primary.main' }}>
                          {agent.displayName.charAt(0)}
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="h6" component="h3" fontWeight="bold">
                            {agent.displayName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            v{installation.version} • {agent.author.name}
                          </Typography>
                        </Box>
                        <IconButton
                          onClick={(e) => {
                            setMenuAnchor(e.currentTarget);
                            setSelectedInstallation(installation);
                          }}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Box>

                      <Typography variant="body2" sx={{ mb: 2, minHeight: '40px' }}>
                        {agent.description}
                      </Typography>

                      {/* Status and Health */}
                      <Box display="flex" gap={1} mb={2}>
                        <Chip
                          label={installation.status}
                          color={getStatusColor(installation.status)}
                          size="small"
                          icon={getStatusIcon(installation.status)}
                        />
                        <Chip
                          label={healthStatus.text}
                          color={healthStatus.color}
                          size="small"
                          icon={<HealthIcon fontSize="small" />}
                        />
                      </Box>

                      {/* Usage Statistics */}
                      {installation.status === 'installed' && (
                        <Box>
                          <Grid container spacing={1} sx={{ mb: 1 }}>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">
                                Tasks Executed
                              </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {installation.usage.tasksExecuted.toLocaleString()}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">
                                Total Cost
                              </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {formatCurrency(installation.usage.totalCost)}
                              </Typography>
                            </Grid>
                          </Grid>

                          <Grid container spacing={1}>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">
                                Avg Response Time
                              </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {formatDuration(installation.usage.averageResponseTime)}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">
                                Error Rate
                              </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {(installation.usage.errorRate * 100).toFixed(1)}%
                              </Typography>
                            </Grid>
                          </Grid>

                          {installation.usage.errorRate > 0.1 && (
                            <LinearProgress
                              variant="determinate"
                              value={installation.usage.errorRate * 100}
                              color="error"
                              sx={{ mt: 1, height: 4, borderRadius: 2 }}
                            />
                          )}
                        </Box>
                      )}

                      {installation.lastUsedAt && (
                        <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                          Last used: {new Date(installation.lastUsedAt).toLocaleDateString()}
                        </Typography>
                      )}
                    </CardContent>

                    <CardActions>
                      <Button 
                        size="small" 
                        startIcon={<SettingsIcon />}
                        onClick={() => {
                          setSelectedInstallation(installation);
                          setConfigDialogOpen(true);
                        }}
                      >
                        Configure
                      </Button>
                      <Button 
                        size="small" 
                        startIcon={<TimelineIcon />}
                        onClick={() => {
                          // Navigate to agent analytics
                          window.location.href = `/agents/${installation.agentId}/analytics`;
                        }}
                      >
                        Analytics
                      </Button>
                    </CardActions>
                  </Card>
                </motion.div>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuList>
          <MenuItem
            onClick={() => {
              setConfigDialogOpen(true);
              setMenuAnchor(null);
            }}
          >
            <ListItemIcon>
              <SettingsIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Configure</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              // Implement health check
              setMenuAnchor(null);
            }}
          >
            <ListItemIcon>
              <RefreshIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Health Check</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              setUninstallDialogOpen(true);
              setMenuAnchor(null);
            }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Uninstall</ListItemText>
          </MenuItem>
        </MenuList>
      </Menu>

      {/* Configuration Dialog */}
      <Dialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Configure {selectedInstallation && agents.find(a => a.id === selectedInstallation.marketplaceAgentId)?.displayName}
        </DialogTitle>
        <DialogContent>
          {selectedInstallation && (
            <TextField
              fullWidth
              label="Configuration (JSON)"
              multiline
              rows={8}
              value={JSON.stringify(selectedInstallation.configuration, null, 2)}
              onChange={() => {
                // Handle configuration update
              }}
              sx={{ mt: 2 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialogOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Uninstall Dialog */}
      <Dialog
        open={uninstallDialogOpen}
        onClose={() => setUninstallDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Uninstall Agent
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" mb={2}>
            Are you sure you want to uninstall "{selectedInstallation && agents.find(a => a.id === selectedInstallation.marketplaceAgentId)?.displayName}"?
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            This action cannot be undone. All configuration and usage data will be lost.
          </Typography>
          <TextField
            fullWidth
            label="Reason for uninstalling (optional)"
            multiline
            rows={3}
            value={uninstallReason}
            onChange={(e) => setUninstallReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUninstallDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="error"
            onClick={handleUninstall}
            disabled={actionLoading === 'uninstall'}
          >
            {actionLoading === 'uninstall' ? <CircularProgress size={20} /> : 'Uninstall'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default InstalledAgents;