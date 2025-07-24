import React, { useState, useEffect } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Box,
  Alert,
  Tooltip,
  Skeleton,
  Avatar,
  Card,
  CardContent
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Login as LoginIcon,
  Groups as GroupsIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface OrganizationUser {
  id: string;
  organizationId: string;
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer' | 'billing';
  permissions: string[];
  status: 'active' | 'inactive' | 'suspended' | 'pending_activation';
  invitationId?: string;
  joinedAt: string;
  lastLoginAt?: string;
  lastActiveAt?: string;
  preferences?: {
    notifications: {
      email: boolean;
      slack: boolean;
      inApp: boolean;
    };
    timezone: string;
    language: string;
    theme: 'light' | 'dark' | 'auto';
  };
}

interface OrganizationUsersListProps {
  organizationId: string;
  onUserUpdate?: () => void;
}

export const OrganizationUsersList: React.FC<OrganizationUsersListProps> = ({
  organizationId,
  onUserUpdate
}) => {
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  
  // Menu states
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<OrganizationUser | null>(null);
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeReason, setRemoveReason] = useState('');
  
  // Edit form state
  const [editRole, setEditRole] = useState<string>('');
  const [editPermissions, setEditPermissions] = useState<string[]>([]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: rowsPerPage.toString(),
        offset: (page * rowsPerPage).toString()
      });
      
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      
      if (roleFilter) {
        params.append('role', roleFilter);
      }

      const response = await fetch(`/api/invitations/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Tenant-ID': organizationId
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchUsers();
    }
  }, [organizationId, page, rowsPerPage, statusFilter, roleFilter]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: OrganizationUser) => {
    setAnchorEl(event.currentTarget);
    setSelectedUser(user);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedUser(null);
  };

  const handleEditUser = () => {
    if (selectedUser) {
      setEditRole(selectedUser.role);
      setEditPermissions([...selectedUser.permissions]);
      setEditDialogOpen(true);
    }
    handleMenuClose();
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/invitations/users/${selectedUser.userId}/role`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Tenant-ID': organizationId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: editRole,
          permissions: editPermissions
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      await fetchUsers();
      onUserUpdate?.();
      setEditDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const handleRemoveUser = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/invitations/users/${selectedUser.userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Tenant-ID': organizationId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: removeReason })
      });

      if (!response.ok) {
        throw new Error('Failed to remove user');
      }

      await fetchUsers();
      onUserUpdate?.();
      setRemoveDialogOpen(false);
      setRemoveReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove user');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'suspended':
        return 'error';
      case 'pending_activation':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'error';
      case 'admin':
        return 'warning';
      case 'member':
        return 'primary';
      case 'viewer':
        return 'info';
      case 'billing':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDisplayName = (user: OrganizationUser) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email.split('@')[0];
  };

  const getInitials = (user: OrganizationUser) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
    }
    return user.email[0].toUpperCase();
  };

  const availablePermissions = [
    'users:read', 'users:write',
    'projects:read', 'projects:write',
    'tasks:read', 'tasks:write',
    'settings:read', 'settings:write',
    'billing:read', 'billing:write',
    'analytics:read'
  ];

  if (loading && users.length === 0) {
    return (
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Organization Users
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Joined</TableCell>
                  <TableCell>Last Active</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...Array(5)].map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton width={200} /></TableCell>
                    <TableCell><Skeleton width={80} /></TableCell>
                    <TableCell><Skeleton width={100} /></TableCell>
                    <TableCell><Skeleton width={120} /></TableCell>
                    <TableCell><Skeleton width={120} /></TableCell>
                    <TableCell><Skeleton width={60} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GroupsIcon />
            Organization Users
          </Typography>
          <Button
            startIcon={<RefreshIcon />}
            onClick={fetchUsers}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Status:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
              <Button
                variant={statusFilter === '' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setStatusFilter('')}
              >
                All
              </Button>
              {['active', 'inactive', 'suspended', 'pending_activation'].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setStatusFilter(status)}
                >
                  {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
                </Button>
              ))}
            </Box>
          </Box>
          
          <Box>
            <Typography variant="caption" color="text.secondary">
              Role:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
              <Button
                variant={roleFilter === '' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setRoleFilter('')}
              >
                All
              </Button>
              {['owner', 'admin', 'member', 'viewer', 'billing'].map((role) => (
                <Button
                  key={role}
                  variant={roleFilter === role ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setRoleFilter(role)}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </Button>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      <TableContainer>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Joined</TableCell>
              <TableCell>Last Active</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <AnimatePresence>
              {users.map((user) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  component={TableRow}
                  hover
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ width: 40, height: 40 }}>
                        {getInitials(user)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {getDisplayName(user)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.email}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.role}
                      size="small"
                      color={getRoleColor(user.role) as any}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.status.replace('_', ' ')}
                      size="small"
                      color={getStatusColor(user.status) as any}
                      variant={user.status === 'active' ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon fontSize="small" color="action" />
                      <Typography variant="body2">
                        {formatDate(user.joinedAt)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LoginIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {user.lastActiveAt ? formatDate(user.lastActiveAt) : 'Never'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    {user.role !== 'owner' && (
                      <Tooltip title="More actions">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, user)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </motion.tr>
              ))}
            </AnimatePresence>
            {users.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No users found
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={[10, 25, 50]}
        component="div"
        count={total}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
      />

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEditUser}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Edit Role & Permissions
        </MenuItem>
        <MenuItem onClick={() => {
          setRemoveDialogOpen(true);
          handleMenuClose();
        }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Remove from Organization
        </MenuItem>
      </Menu>

      {/* Edit User Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit User Role & Permissions</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Editing permissions for {selectedUser?.email}
          </Typography>
          
          <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={editRole}
              label="Role"
              onChange={(e) => setEditRole(e.target.value)}
            >
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="member">Member</MenuItem>
              <MenuItem value="viewer">Viewer</MenuItem>
              <MenuItem value="billing">Billing</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="body2" gutterBottom>
            Custom Permissions:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {availablePermissions.map((permission) => (
              <Chip
                key={permission}
                label={permission}
                size="small"
                clickable
                color={editPermissions.includes(permission) ? 'primary' : 'default'}
                variant={editPermissions.includes(permission) ? 'filled' : 'outlined'}
                onClick={() => {
                  if (editPermissions.includes(permission)) {
                    setEditPermissions(editPermissions.filter(p => p !== permission));
                  } else {
                    setEditPermissions([...editPermissions, permission]);
                  }
                }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleUpdateUser}
            variant="contained"
          >
            Update User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove User Dialog */}
      <Dialog
        open={removeDialogOpen}
        onClose={() => setRemoveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Remove User</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Are you sure you want to remove {selectedUser?.email} from the organization?
            This action cannot be undone.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Reason (optional)"
            value={removeReason}
            onChange={(e) => setRemoveReason(e.target.value)}
            placeholder="Provide a reason for removing this user..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleRemoveUser}
            color="error"
            variant="contained"
          >
            Remove User
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default OrganizationUsersList;