import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Alert,
  Chip,
  IconButton,
  Collapse,
  Card,
  CardContent,
  Divider,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
  onInvite: (invitations: InvitationData[]) => Promise<void>;
  organizationId: string;
}

interface InvitationData {
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer' | 'billing';
  permissions?: string[];
  personalMessage?: string;
}

const defaultPermissions = {
  owner: ['*'],
  admin: ['users:read', 'users:write', 'projects:read', 'projects:write', 'tasks:read', 'tasks:write', 'settings:read', 'settings:write'],
  member: ['projects:read', 'projects:write', 'tasks:read', 'tasks:write'],
  viewer: ['projects:read', 'tasks:read'],
  billing: ['billing:read', 'billing:write', 'users:read']
};

const roleDescriptions = {
  owner: 'Full access to all organization features and settings',
  admin: 'Manage users, projects, and organization settings',
  member: 'Create and manage projects and tasks',
  viewer: 'Read-only access to projects and tasks',
  billing: 'Manage billing and subscription settings'
};

export const InviteUserDialog: React.FC<InviteUserDialogProps> = ({
  open,
  onClose,
  onInvite,
  organizationId
}) => {
  const [invitations, setInvitations] = useState<InvitationData[]>([
    { email: '', role: 'member', permissions: defaultPermissions.member, personalMessage: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkEmails, setBulkEmails] = useState('');
  const [defaultRole, setDefaultRole] = useState<'owner' | 'admin' | 'member' | 'viewer' | 'billing'>('member');
  const [defaultMessage, setDefaultMessage] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleClose = () => {
    setInvitations([{ email: '', role: 'member', permissions: defaultPermissions.member, personalMessage: '' }]);
    setBulkMode(false);
    setBulkEmails('');
    setDefaultRole('member');
    setDefaultMessage('');
    setAdvancedOpen(false);
    setError(null);
    onClose();
  };

  const handleInvitationChange = (index: number, field: keyof InvitationData, value: any) => {
    const newInvitations = [...invitations];
    newInvitations[index] = { ...newInvitations[index], [field]: value };
    
    // Update permissions when role changes
    if (field === 'role') {
      newInvitations[index].permissions = [...defaultPermissions[value as keyof typeof defaultPermissions]];
    }
    
    setInvitations(newInvitations);
  };

  const addInvitation = () => {
    setInvitations([
      ...invitations,
      { email: '', role: 'member', permissions: defaultPermissions.member, personalMessage: '' }
    ]);
  };

  const removeInvitation = (index: number) => {
    if (invitations.length > 1) {
      setInvitations(invitations.filter((_, i) => i !== index));
    }
  };

  const processBulkEmails = () => {
    const emails = bulkEmails
      .split(/[,\n]/)
      .map(email => email.trim())
      .filter(email => email && email.includes('@'));

    const newInvitations = emails.map(email => ({
      email,
      role: defaultRole,
      permissions: [...defaultPermissions[defaultRole]],
      personalMessage: defaultMessage
    }));

    setInvitations(newInvitations);
    setBulkMode(false);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate invitations
      const validInvitations = invitations.filter(inv => 
        inv.email.trim() && inv.email.includes('@')
      );

      if (validInvitations.length === 0) {
        throw new Error('Please provide at least one valid email address');
      }

      await onInvite(validInvitations);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitations');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (invitationIndex: number, permission: string) => {
    const newInvitations = [...invitations];
    const currentPermissions = newInvitations[invitationIndex].permissions || [];
    
    if (currentPermissions.includes(permission)) {
      newInvitations[invitationIndex].permissions = currentPermissions.filter(p => p !== permission);
    } else {
      newInvitations[invitationIndex].permissions = [...currentPermissions, permission];
    }
    
    setInvitations(newInvitations);
  };

  const availablePermissions = [
    'users:read', 'users:write',
    'projects:read', 'projects:write',
    'tasks:read', 'tasks:write',
    'settings:read', 'settings:write',
    'billing:read', 'billing:write',
    'analytics:read'
  ];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '60vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon />
          Invite Users to Organization
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={bulkMode}
                onChange={(e) => setBulkMode(e.target.checked)}
              />
            }
            label="Bulk invite mode"
          />
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            Invite multiple users at once
          </Typography>
        </Box>

        {bulkMode ? (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Bulk Invitation
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={6}
                label="Email addresses"
                placeholder="Enter email addresses separated by commas or new lines..."
                value={bulkEmails}
                onChange={(e) => setBulkEmails(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel>Default Role</InputLabel>
                  <Select
                    value={defaultRole}
                    label="Default Role"
                    onChange={(e) => setDefaultRole(e.target.value as any)}
                  >
                    {Object.entries(roleDescriptions).map(([role, description]) => (
                      <MenuItem key={role} value={role}>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {description}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <TextField
                fullWidth
                label="Default personal message"
                placeholder="Welcome to our organization!"
                value={defaultMessage}
                onChange={(e) => setDefaultMessage(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                onClick={processBulkEmails}
                disabled={!bulkEmails.trim()}
              >
                Process Emails ({bulkEmails.split(/[,\n]/).filter(e => e.trim()).length} found)
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Box>
            <AnimatePresence>
              {invitations.map((invitation, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card sx={{ mb: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6">
                          Invitation {index + 1}
                        </Typography>
                        {invitations.length > 1 && (
                          <IconButton
                            size="small"
                            onClick={() => removeInvitation(index)}
                            color="error"
                          >
                            <RemoveIcon />
                          </IconButton>
                        )}
                      </Box>

                      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <TextField
                          fullWidth
                          label="Email address"
                          type="email"
                          value={invitation.email}
                          onChange={(e) => handleInvitationChange(index, 'email', e.target.value)}
                          InputProps={{
                            startAdornment: <EmailIcon sx={{ mr: 1, color: 'action.active' }} />
                          }}
                          required
                        />
                        <FormControl sx={{ minWidth: 150 }}>
                          <InputLabel>Role</InputLabel>
                          <Select
                            value={invitation.role}
                            label="Role"
                            onChange={(e) => handleInvitationChange(index, 'role', e.target.value)}
                            startAdornment={<SecurityIcon sx={{ mr: 1, color: 'action.active' }} />}
                          >
                            {Object.entries(roleDescriptions).map(([role, description]) => (
                              <MenuItem key={role} value={role}>
                                <Box>
                                  <Typography variant="body2" fontWeight="medium">
                                    {role.charAt(0).toUpperCase() + role.slice(1)}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {description}
                                  </Typography>
                                </Box>
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Box>

                      <TextField
                        fullWidth
                        label="Personal message (optional)"
                        multiline
                        rows={2}
                        value={invitation.personalMessage}
                        onChange={(e) => handleInvitationChange(index, 'personalMessage', e.target.value)}
                        placeholder="Add a personal welcome message..."
                        sx={{ mb: 2 }}
                      />

                      {invitation.role !== 'owner' && (
                        <Box>
                          <Button
                            size="small"
                            onClick={() => setAdvancedOpen(!advancedOpen)}
                            endIcon={advancedOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          >
                            Custom Permissions
                          </Button>
                          <Collapse in={advancedOpen}>
                            <Box sx={{ mt: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                Select specific permissions for this user:
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {availablePermissions.map((permission) => (
                                  <Chip
                                    key={permission}
                                    label={permission}
                                    size="small"
                                    clickable
                                    color={invitation.permissions?.includes(permission) ? 'primary' : 'default'}
                                    variant={invitation.permissions?.includes(permission) ? 'filled' : 'outlined'}
                                    onClick={() => togglePermission(index, permission)}
                                  />
                                ))}
                              </Box>
                            </Box>
                          </Collapse>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>

            <Button
              startIcon={<AddIcon />}
              onClick={addInvitation}
              variant="outlined"
              fullWidth
              sx={{ mb: 2 }}
            >
              Add Another Invitation
            </Button>
          </Box>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || invitations.every(inv => !inv.email.trim())}
        >
          {loading ? 'Sending...' : `Send ${invitations.filter(inv => inv.email.trim()).length} Invitation${invitations.filter(inv => inv.email.trim()).length !== 1 ? 's' : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InviteUserDialog;