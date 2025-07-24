import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Tabs,
  Tab,
  Paper,
  Alert,
  Fab,
  Chip,
  Avatar,
  AvatarGroup,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  People as PeopleIcon,
  Mail as MailIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  AccessTime as AccessTimeIcon,
  Download as DownloadIcon,
  Upload as UploadIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import InviteUserDialog from './InviteUserDialog';
import InvitationList from './InvitationList';
import OrganizationUsersList from './OrganizationUsersList';

interface UserManagementDashboardProps {
  organizationId: string;
}

interface InvitationStats {
  totalInvitations: number;
  pendingInvitations: number;
  acceptedInvitations: number;
  declinedInvitations: number;
  expiredInvitations: number;
  revokedInvitations: number;
  recentInvitations: any[];
}

interface InvitationData {
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer' | 'billing';
  permissions?: string[];
  personalMessage?: string;
}

export const UserManagementDashboard: React.FC<UserManagementDashboardProps> = ({
  organizationId
}) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [stats, setStats] = useState<InvitationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/invitations/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Tenant-ID': organizationId
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch invitation stats');
      }

      const data = await response.json();
      setStats(data.stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchStats();
    }
  }, [organizationId]);

  const handleInviteUsers = async (invitations: InvitationData[]) => {
    try {
      if (invitations.length === 1) {
        // Single invitation
        const response = await fetch('/api/invitations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'X-Tenant-ID': organizationId,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invitations[0])
        });

        if (!response.ok) {
          throw new Error('Failed to send invitation');
        }
      } else {
        // Bulk invitation
        const response = await fetch('/api/invitations/bulk', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'X-Tenant-ID': organizationId,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ invitations })
        });

        if (!response.ok) {
          throw new Error('Failed to send bulk invitations');
        }
      }

      await fetchStats();
    } catch (err) {
      throw err;
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const statCards = [
    {
      title: 'Total Users',
      value: stats ? stats.acceptedInvitations : 0,
      icon: <PeopleIcon />,
      color: 'primary',
      trend: '+12%'
    },
    {
      title: 'Pending Invitations',
      value: stats ? stats.pendingInvitations : 0,
      icon: <MailIcon />,
      color: 'warning',
      action: stats?.pendingInvitations ? 'View' : undefined
    },
    {
      title: 'Total Invitations',
      value: stats ? stats.totalInvitations : 0,
      icon: <TrendingUpIcon />,
      color: 'info',
      trend: '+5%'
    },
    {
      title: 'Declined/Expired',
      value: stats ? stats.declinedInvitations + stats.expiredInvitations : 0,
      icon: <WarningIcon />,
      color: 'error'
    }
  ];

  const recentActivity = stats?.recentInvitations?.slice(0, 5) || [];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          User Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage users, invitations, and team permissions for your organization
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h4" fontWeight="bold">
                        {loading ? '...' : card.value}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {card.title}
                      </Typography>
                      {card.trend && (
                        <Chip
                          label={card.trend}
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{ mt: 1 }}
                        />
                      )}
                    </Box>
                    <Avatar sx={{ bgcolor: `${card.color}.main`, width: 56, height: 56 }}>
                      {card.icon}
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Recent Invitations
              </Typography>
              <AvatarGroup max={4}>
                {recentActivity.map((invitation, index) => (
                  <Avatar key={index} sx={{ width: 32, height: 32 }}>
                    {invitation.email[0].toUpperCase()}
                  </Avatar>
                ))}
              </AvatarGroup>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {recentActivity.map((invitation, index) => (
                <Chip
                  key={index}
                  size="small"
                  label={`${invitation.email} (${invitation.status})`}
                  color={invitation.status === 'pending' ? 'warning' : invitation.status === 'accepted' ? 'success' : 'default'}
                  icon={
                    invitation.status === 'pending' ? <AccessTimeIcon /> :
                    invitation.status === 'accepted' ? <CheckCircleIcon /> :
                    <CancelIcon />
                  }
                />
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab 
            label="Organization Users" 
            icon={<PeopleIcon />}
            iconPosition="start"
          />
          <Tab 
            label="Invitations" 
            icon={<MailIcon />}
            iconPosition="start"
          />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {currentTab === 0 && (
            <OrganizationUsersList
              organizationId={organizationId}
              onUserUpdate={fetchStats}
            />
          )}
          {currentTab === 1 && (
            <InvitationList
              organizationId={organizationId}
              onInvitationUpdate={fetchStats}
            />
          )}
        </Box>
      </Paper>

      {/* Quick Actions */}
      <Box sx={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Tooltip title="Export user data" placement="left">
          <Fab color="secondary" size="small">
            <DownloadIcon />
          </Fab>
        </Tooltip>
        <Tooltip title="Import users" placement="left">
          <Fab color="default" size="small">
            <UploadIcon />
          </Fab>
        </Tooltip>
        <Tooltip title="Invite users" placement="left">
          <Fab 
            color="primary" 
            onClick={() => setInviteDialogOpen(true)}
            sx={{ 
              '&:hover': { 
                transform: 'scale(1.1)',
                transition: 'transform 0.2s'
              }
            }}
          >
            <AddIcon />
          </Fab>
        </Tooltip>
      </Box>

      {/* Invite User Dialog */}
      <InviteUserDialog
        open={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
        onInvite={handleInviteUsers}
        organizationId={organizationId}
      />
    </Box>
  );
};

export default UserManagementDashboard;