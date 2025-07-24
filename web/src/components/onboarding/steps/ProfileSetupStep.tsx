import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Avatar,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
} from '@mui/material';
import { PhotoCamera, Save } from '@mui/icons-material';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/services/api';
import { toast } from 'react-hot-toast';

interface ProfileSetupStepProps {
  onComplete: (data?: any) => void;
  onSkip: () => void;
  metadata?: Record<string, any>;
}

export const ProfileSetupStep: React.FC<ProfileSetupStepProps> = ({ onComplete }) => {
  const { user, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    title: user?.metadata?.title || '',
    department: user?.metadata?.department || '',
    timezone: user?.metadata?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    notificationPreferences: user?.metadata?.notificationPreferences || {
      email: true,
      inApp: true,
      slack: false,
    },
    workingHours: user?.metadata?.workingHours || {
      start: '09:00',
      end: '17:00',
    },
    skills: user?.metadata?.skills || [],
  });

  const [newSkill, setNewSkill] = useState('');

  const departments = [
    'Engineering',
    'Product',
    'Design',
    'Marketing',
    'Sales',
    'Operations',
    'HR',
    'Finance',
    'Other',
  ];

  const commonSkills = [
    'JavaScript',
    'TypeScript',
    'Python',
    'React',
    'Node.js',
    'AWS',
    'Docker',
    'Kubernetes',
    'Machine Learning',
    'DevOps',
  ];

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await api.put('/users/profile', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        metadata: {
          ...user?.metadata,
          title: formData.title,
          department: formData.department,
          timezone: formData.timezone,
          notificationPreferences: formData.notificationPreferences,
          workingHours: formData.workingHours,
          skills: formData.skills,
          profileCompleted: true,
        },
      });

      updateUser(response.data.user);
      toast.success('Profile updated successfully!');
      onComplete({
        profileData: formData,
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSkill = (skill: string) => {
    if (skill && !formData.skills.includes(skill)) {
      setFormData({
        ...formData,
        skills: [...formData.skills, skill],
      });
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter(s => s !== skill),
    });
  };

  const isValid = formData.firstName && formData.lastName && formData.title && formData.department;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Complete Your Profile
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Let's personalize your experience by setting up your profile.
      </Typography>

      <Grid container spacing={3}>
        {/* Personal Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Personal Information
              </Typography>

              <Box display="flex" justifyContent="center" mb={3}>
                <Avatar
                  sx={{ width: 100, height: 100, fontSize: 40 }}
                  src={user?.metadata?.avatar}
                >
                  {formData.firstName[0]?.toUpperCase()}
                  {formData.lastName[0]?.toUpperCase()}
                </Avatar>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="First Name"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Last Name"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Job Title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Senior Developer, Product Manager"
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth required>
                    <InputLabel>Department</InputLabel>
                    <Select
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      label="Department"
                    >
                      {departments.map(dept => (
                        <MenuItem key={dept} value={dept}>
                          {dept}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Preferences */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Preferences
              </Typography>

              <Box mb={3}>
                <FormLabel component="legend">Notification Preferences</FormLabel>
                <FormControlLabel
                  control={
                    <input
                      type="checkbox"
                      checked={formData.notificationPreferences.email}
                      onChange={(e) => setFormData({
                        ...formData,
                        notificationPreferences: {
                          ...formData.notificationPreferences,
                          email: e.target.checked,
                        },
                      })}
                    />
                  }
                  label="Email notifications"
                />
                <FormControlLabel
                  control={
                    <input
                      type="checkbox"
                      checked={formData.notificationPreferences.inApp}
                      onChange={(e) => setFormData({
                        ...formData,
                        notificationPreferences: {
                          ...formData.notificationPreferences,
                          inApp: e.target.checked,
                        },
                      })}
                    />
                  }
                  label="In-app notifications"
                />
                <FormControlLabel
                  control={
                    <input
                      type="checkbox"
                      checked={formData.notificationPreferences.slack}
                      onChange={(e) => setFormData({
                        ...formData,
                        notificationPreferences: {
                          ...formData.notificationPreferences,
                          slack: e.target.checked,
                        },
                      })}
                    />
                  }
                  label="Slack notifications"
                />
              </Box>

              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom>
                  Working Hours
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Start Time"
                      type="time"
                      value={formData.workingHours.start}
                      onChange={(e) => setFormData({
                        ...formData,
                        workingHours: {
                          ...formData.workingHours,
                          start: e.target.value,
                        },
                      })}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="End Time"
                      type="time"
                      value={formData.workingHours.end}
                      onChange={(e) => setFormData({
                        ...formData,
                        workingHours: {
                          ...formData.workingHours,
                          end: e.target.value,
                        },
                      })}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Timezone
                </Typography>
                <TextField
                  fullWidth
                  value={formData.timezone}
                  disabled
                  helperText="Automatically detected from your browser"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Skills */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Skills & Expertise
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Add your skills to help AI agents better understand your expertise
              </Typography>

              <Box mb={2}>
                <Grid container spacing={1}>
                  {commonSkills.map(skill => (
                    <Grid item key={skill}>
                      <Chip
                        label={skill}
                        onClick={() => handleAddSkill(skill)}
                        variant={formData.skills.includes(skill) ? 'filled' : 'outlined'}
                        color={formData.skills.includes(skill) ? 'primary' : 'default'}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>

              <Box display="flex" gap={2} mb={2}>
                <TextField
                  fullWidth
                  label="Add custom skill"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddSkill(newSkill);
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  onClick={() => handleAddSkill(newSkill)}
                  disabled={!newSkill}
                >
                  Add
                </Button>
              </Box>

              {formData.skills.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Your Skills:
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {formData.skills.map(skill => (
                      <Chip
                        key={skill}
                        label={skill}
                        onDelete={() => handleRemoveSkill(skill)}
                        color="primary"
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box display="flex" justifyContent="center" mt={4}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={<Save />}
          onClick={handleSubmit}
          disabled={!isValid || loading}
        >
          Save Profile
        </Button>
      </Box>
    </Box>
  );
};