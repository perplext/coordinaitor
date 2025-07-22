import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Avatar,
  Button,
  TextField,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Person,
  Email,
  Badge,
  Security,
  VpnKey,
  Edit,
  Save,
  Cancel,
  CheckCircle,
} from '@mui/icons-material';
import { useAuthStore } from '@/store/authStore';
import { format } from 'date-fns';

export const UserProfile: React.FC = () => {
  const { user, updateProfile, changePassword, loading, error } = useAuthStore();
  const [editMode, setEditMode] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
  });
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');

  if (!user) return null;

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
    setPasswordError('');
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile(profileData);
      setEditMode(false);
    } catch (error) {
      // Error handled by store
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    try {
      await changePassword(passwordData.oldPassword, passwordData.newPassword);
      setPasswordDialogOpen(false);
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      // Error handled by store
    }
  };

  const getInitials = () => {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        User Profile
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Avatar
              sx={{
                width: 120,
                height: 120,
                fontSize: 48,
                bgcolor: 'primary.main',
                mx: 'auto',
                mb: 2,
              }}
            >
              {getInitials()}
            </Avatar>
            <Typography variant="h5" gutterBottom>
              {user.firstName} {user.lastName}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              @{user.username}
            </Typography>
            <Box sx={{ mt: 2 }}>
              {user.roles.map(role => (
                <Chip
                  key={role.id}
                  label={role.name}
                  color="primary"
                  size="small"
                  sx={{ m: 0.5 }}
                />
              ))}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6">
                Profile Information
              </Typography>
              {!editMode ? (
                <Button
                  startIcon={<Edit />}
                  onClick={() => setEditMode(true)}
                >
                  Edit Profile
                </Button>
              ) : (
                <Box display="flex" gap={1}>
                  <Button
                    startIcon={<Save />}
                    variant="contained"
                    onClick={handleSaveProfile}
                    disabled={loading}
                  >
                    Save
                  </Button>
                  <Button
                    startIcon={<Cancel />}
                    onClick={() => {
                      setEditMode(false);
                      setProfileData({
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                      });
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </Box>
              )}
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="First Name"
                  name="firstName"
                  value={profileData.firstName}
                  onChange={handleProfileChange}
                  fullWidth
                  disabled={!editMode || loading}
                  InputProps={{
                    startAdornment: <Person sx={{ mr: 1, color: 'action.disabled' }} />,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Last Name"
                  name="lastName"
                  value={profileData.lastName}
                  onChange={handleProfileChange}
                  fullWidth
                  disabled={!editMode || loading}
                  InputProps={{
                    startAdornment: <Person sx={{ mr: 1, color: 'action.disabled' }} />,
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  value={profileData.email}
                  onChange={handleProfileChange}
                  fullWidth
                  disabled={!editMode || loading}
                  InputProps={{
                    startAdornment: <Email sx={{ mr: 1, color: 'action.disabled' }} />,
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Username"
                  value={user.username}
                  fullWidth
                  disabled
                  InputProps={{
                    startAdornment: <Badge sx={{ mr: 1, color: 'action.disabled' }} />,
                  }}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Security
              </Typography>
              <Button
                startIcon={<VpnKey />}
                onClick={() => setPasswordDialogOpen(true)}
              >
                Change Password
              </Button>
            </Box>

            <List>
              <ListItem>
                <ListItemIcon>
                  <CheckCircle color="success" />
                </ListItemIcon>
                <ListItemText
                  primary="Account Status"
                  secondary={user.isActive ? 'Active' : 'Inactive'}
                />
              </ListItem>
              {user.lastLogin && (
                <ListItem>
                  <ListItemIcon>
                    <Security />
                  </ListItemIcon>
                  <ListItemText
                    primary="Last Login"
                    secondary={format(new Date(user.lastLogin), 'PPpp')}
                  />
                </ListItem>
              )}
            </List>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              Permissions
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {user.permissions.map(permission => (
                <Chip
                  key={permission.id}
                  label={`${permission.resource}:${permission.action}`}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)}>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {passwordError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {passwordError}
              </Alert>
            )}
            <TextField
              label="Current Password"
              name="oldPassword"
              type="password"
              value={passwordData.oldPassword}
              onChange={handlePasswordChange}
              fullWidth
              margin="normal"
              autoFocus
            />
            <TextField
              label="New Password"
              name="newPassword"
              type="password"
              value={passwordData.newPassword}
              onChange={handlePasswordChange}
              fullWidth
              margin="normal"
              helperText="Must be at least 8 characters"
            />
            <TextField
              label="Confirm New Password"
              name="confirmPassword"
              type="password"
              value={passwordData.confirmPassword}
              onChange={handlePasswordChange}
              fullWidth
              margin="normal"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleChangePassword}
            variant="contained"
            disabled={loading}
          >
            Change Password
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};