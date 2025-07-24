import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  InputAdornment,
} from '@mui/material';
import {
  PersonAdd,
  Email,
  Delete,
  Edit,
  Send,
  Groups,
  AdminPanelSettings,
  Engineering,
  Support,
} from '@mui/icons-material';
import { api } from '@/services/api';
import { toast } from 'react-hot-toast';

interface TeamSetupStepProps {
  onComplete: (data?: any) => void;
  onSkip: () => void;
  metadata?: Record<string, any>;
}

interface TeamMember {
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: 'pending' | 'active';
}

const roleDefinitions = [
  {
    id: 'admin',
    name: 'Administrator',
    icon: <AdminPanelSettings />,
    description: 'Full system access, can manage users and settings',
    permissions: ['all'],
  },
  {
    id: 'manager',
    name: 'Project Manager',
    icon: <Groups />,
    description: 'Manage projects, view analytics, approve tasks',
    permissions: ['projects.manage', 'analytics.view', 'tasks.approve'],
  },
  {
    id: 'developer',
    name: 'Developer',
    icon: <Engineering />,
    description: 'Create tasks, use AI agents, manage own projects',
    permissions: ['tasks.create', 'agents.use', 'projects.create'],
  },
  {
    id: 'viewer',
    name: 'Viewer',
    icon: <Support />,
    description: 'View projects and tasks, read-only access',
    permissions: ['projects.view', 'tasks.view'],
  },
];

export const TeamSetupStep: React.FC<TeamSetupStepProps> = ({ onComplete }) => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'developer',
  });
  const [loading, setLoading] = useState(false);

  const handleInviteMember = async () => {
    if (!formData.email || !formData.firstName || !formData.lastName) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const newMember: TeamMember = {
        ...formData,
        status: 'pending',
        id: Date.now().toString(),
      };

      // In real implementation, this would send an invite
      await api.post('/invitations', {
        email: formData.email,
        role: formData.role,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });

      setTeamMembers([...teamMembers, newMember]);
      setInviteDialogOpen(false);
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        role: 'developer',
      });
      toast.success('Invitation sent successfully!');
    } catch (error) {
      console.error('Failed to send invitation:', error);
      toast.error('Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = (memberId: string) => {
    setTeamMembers(teamMembers.filter(m => m.id !== memberId));
    toast.success('Team member removed');
  };

  const handleEditMember = (member: TeamMember) => {
    setEditingMember(member);
    setFormData({
      email: member.email,
      firstName: member.firstName,
      lastName: member.lastName,
      role: member.role,
    });
    setInviteDialogOpen(true);
  };

  const handleUpdateMember = () => {
    if (!editingMember) return;

    const updatedMembers = teamMembers.map(m =>
      m.id === editingMember.id ? { ...m, ...formData } : m
    );
    setTeamMembers(updatedMembers);
    setEditingMember(null);
    setInviteDialogOpen(false);
    toast.success('Team member updated');
  };

  const getRoleIcon = (roleId: string) => {
    const role = roleDefinitions.find(r => r.id === roleId);
    return role?.icon || <Support />;
  };

  const getRoleColor = (roleId: string) => {
    const colors: Record<string, any> = {
      admin: 'error',
      manager: 'warning',
      developer: 'primary',
      viewer: 'default',
    };
    return colors[roleId] || 'default';
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Set Up Your Team
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Invite team members and assign roles to start collaborating on projects.
      </Typography>

      <Grid container spacing={3}>
        {/* Role Definitions */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Available Roles
          </Typography>
          <Grid container spacing={2}>
            {roleDefinitions.map((role) => (
              <Grid item xs={12} sm={6} key={role.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={2} mb={1}>
                      {role.icon}
                      <Typography variant="h6">{role.name}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {role.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Team Members */}
        <Grid item xs={12}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Team Members</Typography>
            <Button
              variant="contained"
              startIcon={<PersonAdd />}
              onClick={() => {
                setEditingMember(null);
                setFormData({
                  email: '',
                  firstName: '',
                  lastName: '',
                  role: 'developer',
                });
                setInviteDialogOpen(true);
              }}
            >
              Invite Member
            </Button>
          </Box>

          {teamMembers.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
              <Groups sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No team members yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Start by inviting your first team member
              </Typography>
            </Paper>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {teamMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Avatar sx={{ width: 32, height: 32 }}>
                          {member.firstName[0]}{member.lastName[0]}
                        </Avatar>
                        {member.firstName} {member.lastName}
                      </Box>
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Chip
                        icon={getRoleIcon(member.role)}
                        label={roleDefinitions.find(r => r.id === member.role)?.name}
                        size="small"
                        color={getRoleColor(member.role)}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={member.status === 'pending' ? 'Invitation Sent' : 'Active'}
                        size="small"
                        color={member.status === 'pending' ? 'warning' : 'success'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleEditMember(member)}>
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemoveMember(member.id!)}
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Grid>
      </Grid>

      <Alert severity="info" sx={{ mt: 3 }}>
        Team members will receive an email invitation to join your organization. They'll need to create an account to access the platform.
      </Alert>

      <Box display="flex" justifyContent="center" mt={4}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={() => onComplete({ teamMembers })}
        >
          Continue
        </Button>
        <Button
          variant="text"
          size="large"
          onClick={() => onComplete({ teamMembers: [] })}
          sx={{ ml: 2 }}
        >
          Skip for Now
        </Button>
      </Box>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingMember ? 'Edit Team Member' : 'Invite Team Member'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!!editingMember}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  label="Role"
                >
                  {roleDefinitions.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      <Box display="flex" alignItems="center" gap={1}>
                        {role.icon}
                        {role.name}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={editingMember ? handleUpdateMember : handleInviteMember}
            disabled={loading}
            startIcon={editingMember ? <Edit /> : <Send />}
          >
            {editingMember ? 'Update' : 'Send Invitation'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};