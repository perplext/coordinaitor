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
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Tab,
  Tabs,
  Divider
} from '@mui/material';
import {
  Business,
  People,
  Assessment,
  Settings,
  Warning,
  TrendingUp,
  Storage,
  Api,
  SmartToy,
  Edit,
  Visibility,
  Delete,
  Add,
  FileDownload,
  Refresh
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface Organization {
  id: string;
  name: string;
  displayName: string;
  domain?: string;
  subdomain?: string;
  status: 'active' | 'suspended' | 'pending' | 'cancelled';
  tier: 'free' | 'starter' | 'professional' | 'enterprise';
  contactEmail: string;
  industry?: string;
  size?: string;
  createdAt: string;
  userCount: number;
  projectCount: number;
}

interface OrganizationUsage {
  organizationId: string;
  period: string;
  users: number;
  projects: number;
  tasks: number;
  storageGB: number;
  apiCalls: number;
  agentExecutions: number;
  costs: {
    total: number;
    breakdown: {
      agents: number;
      storage: number;
      apiCalls: number;
      features: number;
    };
  };
  limits: {
    maxUsers: number;
    maxProjects: number;
    maxTasksPerMonth: number;
    maxStorageGB: number;
    maxAPICallsPerMonth: number;
    maxAgents: number;
  };
  warnings: string[];
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
      id={`org-tabpanel-${index}`}
      aria-labelledby={`org-tab-${index}`}
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

export const OrganizationDashboard: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [usage, setUsage] = useState<OrganizationUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');

  useEffect(() => {
    loadOrganizations();
  }, [page, searchTerm, statusFilter, tierFilter]);

  useEffect(() => {
    if (selectedOrg) {
      loadOrganizationUsage(selectedOrg.id);
    }
  }, [selectedOrg]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });

      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (tierFilter) params.append('tier', tierFilter);

      const response = await fetch(`/api/organizations?${params}`);
      const data = await response.json();

      if (response.ok) {
        setOrganizations(data.organizations);
        if (data.organizations.length > 0 && !selectedOrg) {
          setSelectedOrg(data.organizations[0]);
        }
      } else {
        setError(data.message || 'Failed to load organizations');
      }
    } catch (error) {
      setError('Failed to load organizations');
      console.error('Failed to load organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizationUsage = async (organizationId: string) => {
    try {
      const response = await fetch(`/api/organizations/${organizationId}/usage`);
      const data = await response.json();

      if (response.ok) {
        setUsage(data);
      } else {
        console.error('Failed to load usage:', data.message);
      }
    } catch (error) {
      console.error('Failed to load usage:', error);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleCreateOrganization = () => {
    setCreateDialogOpen(true);
  };

  const handleEditOrganization = (org: Organization) => {
    setSelectedOrg(org);
    setEditDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'suspended':
        return 'error';
      case 'pending':
        return 'warning';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'free':
        return 'default';
      case 'starter':
        return 'primary';
      case 'professional':
        return 'secondary';
      case 'enterprise':
        return 'success';
      default:
        return 'default';
    }
  };

  const formatUsagePercentage = (used: number, limit: number): number => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number): 'success' | 'warning' | 'error' => {
    if (percentage < 70) return 'success';
    if (percentage < 90) return 'warning';
    return 'error';
  };

  const renderOrganizationOverview = () => (
    <Grid container spacing={3}>
      {/* Overview Cards */}
      <Grid item xs={12} md={3}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Business sx={{ mr: 2, fontSize: 32, color: 'primary.main' }} />
                <Typography variant="h6">Organizations</Typography>
              </Box>
              <Typography variant="h4" color="primary">
                {organizations.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total organizations
              </Typography>
            </CardContent>
          </Card>
        </motion.div>
      </Grid>

      <Grid item xs={12} md={3}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <People sx={{ mr: 2, fontSize: 32, color: 'secondary.main' }} />
                <Typography variant="h6">Total Users</Typography>
              </Box>
              <Typography variant="h4" color="secondary">
                {organizations.reduce((sum, org) => sum + org.userCount, 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Across all organizations
              </Typography>
            </CardContent>
          </Card>
        </motion.div>
      </Grid>

      <Grid item xs={12} md={3}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Assessment sx={{ mr: 2, fontSize: 32, color: 'success.main' }} />
                <Typography variant="h6">Projects</Typography>
              </Box>
              <Typography variant="h4" color="success">
                {organizations.reduce((sum, org) => sum + org.projectCount, 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active projects
              </Typography>
            </CardContent>
          </Card>
        </motion.div>
      </Grid>

      <Grid item xs={12} md={3}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUp sx={{ mr: 2, fontSize: 32, color: 'warning.main' }} />
                <Typography variant="h6">Revenue</Typography>
              </Box>
              <Typography variant="h4" color="warning">
                ${usage?.costs.total.toFixed(2) || '0.00'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This month
              </Typography>
            </CardContent>
          </Card>
        </motion.div>
      </Grid>

      {/* Organizations Table */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">Organizations</Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                  size="small"
                  placeholder="Search organizations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={statusFilter}
                    label="Status"
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="suspended">Suspended</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Tier</InputLabel>
                  <Select
                    value={tierFilter}
                    label="Tier"
                    onChange={(e) => setTierFilter(e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="free">Free</MenuItem>
                    <MenuItem value="starter">Starter</MenuItem>
                    <MenuItem value="professional">Professional</MenuItem>
                    <MenuItem value="enterprise">Enterprise</MenuItem>
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleCreateOrganization}
                >
                  Add Organization
                </Button>
                <IconButton onClick={loadOrganizations}>
                  <Refresh />
                </IconButton>
              </Box>
            </Box>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Organization</TableCell>
                    <TableCell>Domain</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Tier</TableCell>
                    <TableCell>Users</TableCell>
                    <TableCell>Projects</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {organizations.map((org) => (
                    <TableRow 
                      key={org.id}
                      hover
                      selected={selectedOrg?.id === org.id}
                      onClick={() => setSelectedOrg(org)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Box>
                          <Typography variant="subtitle2">
                            {org.displayName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {org.contactEmail}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {org.subdomain && (
                          <Typography variant="body2">
                            {org.subdomain}.platform.com
                          </Typography>
                        )}
                        {org.domain && (
                          <Typography variant="body2">
                            {org.domain}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={org.status}
                          color={getStatusColor(org.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={org.tier}
                          color={getTierColor(org.tier) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{org.userCount}</TableCell>
                      <TableCell>{org.projectCount}</TableCell>
                      <TableCell>
                        {new Date(org.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrg(org);
                              setCurrentTab(1);
                            }}
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditOrganization(org);
                            }}
                          >
                            <Edit />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderOrganizationDetails = () => {
    if (!selectedOrg || !usage) {
      return (
        <Alert severity="info">
          Select an organization to view details
        </Alert>
      );
    }

    return (
      <Grid container spacing={3}>
        {/* Organization Info */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Organization Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Name
                  </Typography>
                  <Typography variant="body1">{selectedOrg.displayName}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Contact Email
                  </Typography>
                  <Typography variant="body1">{selectedOrg.contactEmail}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Industry
                  </Typography>
                  <Typography variant="body1">{selectedOrg.industry || 'Not specified'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Size
                  </Typography>
                  <Typography variant="body1">{selectedOrg.size || 'Not specified'}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<Edit />}
                  onClick={() => handleEditOrganization(selectedOrg)}
                  fullWidth
                >
                  Edit Organization
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Settings />}
                  fullWidth
                >
                  Configure Settings
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<FileDownload />}
                  fullWidth
                >
                  Export Data
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Usage Statistics */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Usage & Limits
              </Typography>
              
              {usage.warnings.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">Warnings:</Typography>
                  <ul>
                    {usage.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </Alert>
              )}

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Users ({usage.users}/{usage.limits.maxUsers === -1 ? '∞' : usage.limits.maxUsers})
                    </Typography>
                    {usage.limits.maxUsers !== -1 && (
                      <LinearProgress
                        variant="determinate"
                        value={formatUsagePercentage(usage.users, usage.limits.maxUsers)}
                        color={getUsageColor(formatUsagePercentage(usage.users, usage.limits.maxUsers))}
                      />
                    )}
                  </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Projects ({usage.projects}/{usage.limits.maxProjects === -1 ? '∞' : usage.limits.maxProjects})
                    </Typography>
                    {usage.limits.maxProjects !== -1 && (
                      <LinearProgress
                        variant="determinate"
                        value={formatUsagePercentage(usage.projects, usage.limits.maxProjects)}
                        color={getUsageColor(formatUsagePercentage(usage.projects, usage.limits.maxProjects))}
                      />
                    )}
                  </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Tasks This Month ({usage.tasks}/{usage.limits.maxTasksPerMonth === -1 ? '∞' : usage.limits.maxTasksPerMonth})
                    </Typography>
                    {usage.limits.maxTasksPerMonth !== -1 && (
                      <LinearProgress
                        variant="determinate"
                        value={formatUsagePercentage(usage.tasks, usage.limits.maxTasksPerMonth)}
                        color={getUsageColor(formatUsagePercentage(usage.tasks, usage.limits.maxTasksPerMonth))}
                      />
                    )}
                  </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Storage ({usage.storageGB.toFixed(2)}GB/{usage.limits.maxStorageGB === -1 ? '∞' : usage.limits.maxStorageGB}GB)
                    </Typography>
                    {usage.limits.maxStorageGB !== -1 && (
                      <LinearProgress
                        variant="determinate"
                        value={formatUsagePercentage(usage.storageGB, usage.limits.maxStorageGB)}
                        color={getUsageColor(formatUsagePercentage(usage.storageGB, usage.limits.maxStorageGB))}
                      />
                    )}
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Cost Breakdown */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Cost Breakdown - {usage.period}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <SmartToy sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="subtitle2">Agents</Typography>
                      </Box>
                      <Typography variant="h6">${usage.costs.breakdown.agents.toFixed(2)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Storage sx={{ mr: 1, color: 'secondary.main' }} />
                        <Typography variant="subtitle2">Storage</Typography>
                      </Box>
                      <Typography variant="h6">${usage.costs.breakdown.storage.toFixed(2)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Api sx={{ mr: 1, color: 'success.main' }} />
                        <Typography variant="subtitle2">API Calls</Typography>
                      </Box>
                      <Typography variant="h6">${usage.costs.breakdown.apiCalls.toFixed(2)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Settings sx={{ mr: 1, color: 'warning.main' }} />
                        <Typography variant="subtitle2">Features</Typography>
                      </Box>
                      <Typography variant="h6">${usage.costs.breakdown.features.toFixed(2)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="h5" color="primary">
                  Total: ${usage.costs.total.toFixed(2)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  if (loading && organizations.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <Typography>Loading organizations...</Typography>
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
          Organization Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Manage organizations, monitor usage, and track performance
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
          <Tabs value={currentTab} onChange={handleTabChange} aria-label="organization dashboard tabs">
            <Tab label="Overview" />
            <Tab label="Organization Details" />
            <Tab label="Analytics" />
            <Tab label="Settings" />
          </Tabs>
        </Box>

        <TabPanel value={currentTab} index={0}>
          {renderOrganizationOverview()}
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          {renderOrganizationDetails()}
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <Alert severity="info">
            Advanced analytics coming soon
          </Alert>
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          <Alert severity="info">
            Platform settings configuration coming soon
          </Alert>
        </TabPanel>
      </Card>

      {/* Create Organization Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create New Organization</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Organization creation form would be implemented here
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Organization Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Organization</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Organization editing form would be implemented here
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained">Save Changes</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};