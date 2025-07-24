import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Switch,
  FormControlLabel,
  Tooltip
} from '@mui/material';
import {
  MoreVert,
  Edit,
  Delete,
  Visibility,
  VisibilityOff,
  Security,
  VpnKey,
  Add,
  Settings,
  CheckCircle,
  Error,
  Warning
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { SAMLProviderSetup } from './SAMLProviderSetup';
import { OAuth2ProviderSetup } from './OAuth2ProviderSetup';

interface SSOProvider {
  id: string;
  name: string;
  type: 'saml' | 'oauth2';
  provider?: string;
  enabled: boolean;
  entityId?: string;
  clientId?: string;
  lastUsed?: Date;
  userCount?: number;
  status: 'active' | 'inactive' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

interface SSOProviderListProps {
  providers: SSOProvider[];
  onRefresh: () => void;
  onAddProvider: (type: 'saml' | 'oauth2') => void;
}

export const SSOProviderList: React.FC<SSOProviderListProps> = ({
  providers,
  onRefresh,
  onAddProvider
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedProvider, setSelectedProvider] = useState<SSOProvider | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, provider: SSOProvider) => {
    setAnchorEl(event.currentTarget);
    setSelectedProvider(provider);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedProvider(null);
  };

  const handleEdit = () => {
    setEditDialogOpen(true);
    handleMenuClose();
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleToggleProvider = async (provider: SSOProvider) => {
    try {
      setLoading(true);
      setError(null);

      const endpoint = provider.type === 'saml' 
        ? `/api/sso/saml/providers/${provider.id}`
        : `/api/sso/oauth2/providers/${provider.id}`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enabled: !provider.enabled
        })
      });

      if (response.ok) {
        onRefresh();
      } else {
        const result = await response.json();
        setError(result.message || 'Failed to update provider');
      }
    } catch (error) {
      setError('Failed to update provider');
      console.error('Provider toggle failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!selectedProvider) return;

    try {
      setLoading(true);
      setError(null);

      const endpoint = selectedProvider.type === 'saml' 
        ? `/api/sso/saml/providers/${selectedProvider.id}`
        : `/api/sso/oauth2/providers/${selectedProvider.id}`;

      const response = await fetch(endpoint, {
        method: 'DELETE'
      });

      if (response.ok) {
        onRefresh();
        setDeleteDialogOpen(false);
        setSelectedProvider(null);
      } else {
        const result = await response.json();
        setError(result.message || 'Failed to delete provider');
      }
    } catch (error) {
      setError('Failed to delete provider');
      console.error('Provider deletion failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProviderIcon = (provider: SSOProvider) => {
    if (provider.type === 'saml') {
      return <Security color="primary" />;
    }
    return <VpnKey color="secondary" />;
  };

  const getStatusChip = (provider: SSOProvider) => {
    const statusConfig = {
      active: { color: 'success' as const, icon: <CheckCircle fontSize="small" />, label: 'Active' },
      inactive: { color: 'default' as const, icon: <VisibilityOff fontSize="small" />, label: 'Inactive' },
      error: { color: 'error' as const, icon: <Error fontSize="small" />, label: 'Error' }
    };

    const config = statusConfig[provider.status];
    return (
      <Chip
        size="small"
        color={config.color}
        icon={config.icon}
        label={config.label}
      />
    );
  };

  const getProviderTypeLabel = (provider: SSOProvider) => {
    if (provider.type === 'saml') return 'SAML 2.0';
    if (provider.provider) {
      return `OAuth2 (${provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1)})`;
    }
    return 'OAuth2';
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            SSO Providers ({providers.length})
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add />}
              onClick={() => onAddProvider('saml')}
            >
              Add SAML
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add />}
              onClick={() => onAddProvider('oauth2')}
            >
              Add OAuth2
            </Button>
          </Box>
        </Box>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>

      {providers.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Security sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No SSO Providers Configured
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Add SAML or OAuth2 providers to enable single sign-on for your organization
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="contained"
                startIcon={<Security />}
                onClick={() => onAddProvider('saml')}
              >
                Add SAML Provider
              </Button>
              <Button
                variant="outlined"
                startIcon={<VpnKey />}
                onClick={() => onAddProvider('oauth2')}
              >
                Add OAuth2 Provider
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Provider</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Users</TableCell>
                <TableCell>Last Used</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="center">Enabled</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {providers.map((provider, index) => (
                <motion.tr
                  key={provider.id}
                  component={TableRow}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  hover
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {getProviderIcon(provider)}
                      <Box>
                        <Typography variant="subtitle2">
                          {provider.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {provider.type === 'saml' ? provider.entityId : provider.clientId}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {getProviderTypeLabel(provider)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {getStatusChip(provider)}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {provider.userCount || 0}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {provider.lastUsed ? formatDate(provider.lastUsed) : 'Never'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(provider.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      checked={provider.enabled}
                      onChange={() => handleToggleProvider(provider)}
                      disabled={loading}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="More actions">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, provider)}
                      >
                        <MoreVert />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <Edit sx={{ mr: 1 }} fontSize="small" />
          Edit
        </MenuItem>
        <MenuItem onClick={() => {/* TODO: Navigate to provider details */}}>
          <Settings sx={{ mr: 1 }} fontSize="small" />
          Configure
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <Delete sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Delete SSO Provider
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone. Users will no longer be able to sign in using this provider.
          </Alert>
          <Typography>
            Are you sure you want to delete the provider "{selectedProvider?.name}"?
          </Typography>
          {selectedProvider && selectedProvider.userCount && selectedProvider.userCount > 0 && (
            <Typography color="error" sx={{ mt: 1 }}>
              Warning: This provider is used by {selectedProvider.userCount} user(s).
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            color="error"
            variant="contained"
            disabled={loading}
          >
            Delete Provider
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Provider Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Edit {selectedProvider?.type === 'saml' ? 'SAML' : 'OAuth2'} Provider
        </DialogTitle>
        <DialogContent>
          {selectedProvider && selectedProvider.type === 'saml' && (
            <SAMLProviderSetup
              onComplete={() => {
                setEditDialogOpen(false);
                onRefresh();
              }}
              onCancel={() => setEditDialogOpen(false)}
              existingProvider={selectedProvider}
            />
          )}
          {selectedProvider && selectedProvider.type === 'oauth2' && (
            <OAuth2ProviderSetup
              onComplete={() => {
                setEditDialogOpen(false);
                onRefresh();
              }}
              onCancel={() => setEditDialogOpen(false)}
              existingProvider={selectedProvider}
            />
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};