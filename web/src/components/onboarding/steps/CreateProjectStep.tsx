import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  Folder,
  Description,
  Code,
  Web,
  Science,
  DataObject,
  CheckCircle,
} from '@mui/icons-material';
import { api } from '@/services/api';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

interface CreateProjectStepProps {
  onComplete: (data?: any) => void;
  onSkip: () => void;
  metadata?: Record<string, any>;
}

const projectTypes = [
  {
    id: 'web-app',
    name: 'Web Application',
    icon: <Web />,
    description: 'Build a web application with frontend and backend',
    suggestedAgents: ['Claude', 'GPT-4', 'GitHub Copilot'],
  },
  {
    id: 'mobile-app',
    name: 'Mobile Application',
    icon: <Code />,
    description: 'Create iOS or Android mobile applications',
    suggestedAgents: ['Claude', 'Gemini Pro', 'Cursor AI'],
  },
  {
    id: 'api-service',
    name: 'API Service',
    icon: <DataObject />,
    description: 'Build RESTful or GraphQL API services',
    suggestedAgents: ['GPT-4', 'Claude', 'Amazon CodeWhisperer'],
  },
  {
    id: 'ml-project',
    name: 'Machine Learning',
    icon: <Science />,
    description: 'Develop ML models and data pipelines',
    suggestedAgents: ['Claude', 'Gemini Pro', 'Amazon Q'],
  },
  {
    id: 'documentation',
    name: 'Documentation',
    icon: <Description />,
    description: 'Create technical documentation or guides',
    suggestedAgents: ['Claude', 'GPT-4', 'Perplexity AI'],
  },
];

export const CreateProjectStep: React.FC<CreateProjectStepProps> = ({ onComplete }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: '',
    visibility: 'private',
    tags: [] as string[],
    estimatedDuration: '',
    priority: 'medium',
  });
  const [loading, setLoading] = useState(false);
  const [createdProject, setCreatedProject] = useState<any>(null);
  const [newTag, setNewTag] = useState('');

  const steps = [
    'Choose Project Type',
    'Project Details',
    'Configuration',
    'Review & Create',
  ];

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleCreateProject = async () => {
    setLoading(true);
    try {
      const response = await api.post('/projects', {
        name: formData.name,
        description: formData.description,
        metadata: {
          type: formData.type,
          visibility: formData.visibility,
          tags: formData.tags,
          estimatedDuration: formData.estimatedDuration,
          priority: formData.priority,
          createdDuringOnboarding: true,
        },
      });

      setCreatedProject(response.data.project);
      toast.success('Project created successfully!');
      
      // Move to final step
      setActiveStep(steps.length);
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error('Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = (tag: string) => {
    if (tag && !formData.tags.includes(tag)) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tag],
      });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(t => t !== tag),
    });
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 0:
        return !!formData.type;
      case 1:
        return !!formData.name && !!formData.description;
      case 2:
        return true;
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Create Your First Project
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Let's create a project to see how AI agents can help accelerate your development workflow.
      </Typography>

      {activeStep < steps.length ? (
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
              <StepContent>
                {index === 0 && (
                  <Box>
                    <Typography variant="body2" paragraph>
                      Select the type of project you want to create
                    </Typography>
                    <Grid container spacing={2}>
                      {projectTypes.map((type) => (
                        <Grid item xs={12} sm={6} key={type.id}>
                          <motion.div
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Card
                              variant={formData.type === type.id ? 'elevation' : 'outlined'}
                              sx={{
                                cursor: 'pointer',
                                border: formData.type === type.id ? 2 : 1,
                                borderColor: formData.type === type.id ? 'primary.main' : 'divider',
                              }}
                              onClick={() => setFormData({ ...formData, type: type.id })}
                            >
                              <CardContent>
                                <Box display="flex" alignItems="center" gap={2} mb={1}>
                                  {type.icon}
                                  <Typography variant="h6">{type.name}</Typography>
                                </Box>
                                <Typography variant="body2" color="text.secondary" paragraph>
                                  {type.description}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Suggested agents: {type.suggestedAgents.join(', ')}
                                </Typography>
                              </CardContent>
                            </Card>
                          </motion.div>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}

                {index === 1 && (
                  <Box>
                    <Grid container spacing={3}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Project Name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g., My Awesome Web App"
                          required
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          multiline
                          rows={4}
                          label="Project Description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Describe what you want to build..."
                          required
                        />
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {index === 2 && (
                  <Box>
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Visibility</InputLabel>
                          <Select
                            value={formData.visibility}
                            onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                            label="Visibility"
                          >
                            <MenuItem value="private">Private</MenuItem>
                            <MenuItem value="team">Team</MenuItem>
                            <MenuItem value="public">Public</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth>
                          <InputLabel>Priority</InputLabel>
                          <Select
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                            label="Priority"
                          >
                            <MenuItem value="low">Low</MenuItem>
                            <MenuItem value="medium">Medium</MenuItem>
                            <MenuItem value="high">High</MenuItem>
                            <MenuItem value="critical">Critical</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Estimated Duration"
                          value={formData.estimatedDuration}
                          onChange={(e) => setFormData({ ...formData, estimatedDuration: e.target.value })}
                          placeholder="e.g., 2 weeks, 1 month"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" gutterBottom>
                          Tags
                        </Typography>
                        <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                          {['frontend', 'backend', 'fullstack', 'prototype', 'mvp', 'production'].map(tag => (
                            <Chip
                              key={tag}
                              label={tag}
                              onClick={() => handleAddTag(tag)}
                              variant={formData.tags.includes(tag) ? 'filled' : 'outlined'}
                              color={formData.tags.includes(tag) ? 'primary' : 'default'}
                            />
                          ))}
                        </Box>
                        <Box display="flex" gap={2}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Add custom tag"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleAddTag(newTag);
                              }
                            }}
                          />
                          <Button
                            variant="outlined"
                            onClick={() => handleAddTag(newTag)}
                            disabled={!newTag}
                          >
                            Add
                          </Button>
                        </Box>
                        {formData.tags.length > 0 && (
                          <Box mt={2} display="flex" gap={1} flexWrap="wrap">
                            {formData.tags.map(tag => (
                              <Chip
                                key={tag}
                                label={tag}
                                onDelete={() => handleRemoveTag(tag)}
                                color="primary"
                              />
                            ))}
                          </Box>
                        )}
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {index === 3 && (
                  <Box>
                    <Alert severity="info" sx={{ mb: 3 }}>
                      Review your project details before creating
                    </Alert>
                    <Card variant="outlined">
                      <CardContent>
                        <List>
                          <ListItem>
                            <ListItemIcon>
                              <Folder />
                            </ListItemIcon>
                            <ListItemText
                              primary="Project Name"
                              secondary={formData.name}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon>
                              <Description />
                            </ListItemIcon>
                            <ListItemText
                              primary="Description"
                              secondary={formData.description}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText
                              primary="Type"
                              secondary={projectTypes.find(t => t.id === formData.type)?.name}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText
                              primary="Visibility"
                              secondary={formData.visibility}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText
                              primary="Priority"
                              secondary={formData.priority}
                            />
                          </ListItem>
                          {formData.tags.length > 0 && (
                            <ListItem>
                              <ListItemText
                                primary="Tags"
                                secondary={formData.tags.join(', ')}
                              />
                            </ListItem>
                          )}
                        </List>
                      </CardContent>
                    </Card>
                  </Box>
                )}

                <Box sx={{ mt: 2 }}>
                  <Button
                    disabled={activeStep === 0}
                    onClick={handleBack}
                    sx={{ mr: 1 }}
                  >
                    Back
                  </Button>
                  {activeStep === steps.length - 1 ? (
                    <Button
                      variant="contained"
                      onClick={handleCreateProject}
                      disabled={!isStepValid(activeStep) || loading}
                    >
                      Create Project
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      disabled={!isStepValid(activeStep)}
                    >
                      Continue
                    </Button>
                  )}
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Box textAlign="center" py={4}>
            <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Project Created Successfully!
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Your project "{createdProject?.name}" has been created. In the next step,
              you'll learn how to create tasks and let AI agents help you build it.
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => onComplete({ projectId: createdProject?.id })}
            >
              Continue to Task Creation
            </Button>
          </Box>
        </motion.div>
      )}
    </Box>
  );
};