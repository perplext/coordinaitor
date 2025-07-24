import React, { useState, useEffect } from 'react';
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
  ListItemSecondaryAction,
  IconButton,
  Collapse,
  LinearProgress,
  Avatar,
  AvatarGroup,
  Tooltip,
  Paper,
} from '@mui/material';
import {
  Task,
  AutoAwesome,
  ExpandMore,
  ExpandLess,
  Check,
  Schedule,
  Person,
  Lightbulb,
  Code,
  BugReport,
  Speed,
} from '@mui/icons-material';
import { api } from '@/services/api';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface CreateTaskStepProps {
  onComplete: (data?: any) => void;
  onSkip: () => void;
  metadata?: Record<string, any>;
}

const taskExamples = [
  {
    title: 'Create User Authentication',
    description: 'Implement user registration and login functionality with JWT tokens',
    type: 'feature',
    complexity: 'medium',
    estimatedAgents: 3,
  },
  {
    title: 'Add Dark Mode Support',
    description: 'Implement a toggle for dark/light theme across the application',
    type: 'enhancement',
    complexity: 'low',
    estimatedAgents: 2,
  },
  {
    title: 'Fix Navigation Bug',
    description: 'Resolve issue where navigation menu disappears on mobile devices',
    type: 'bug',
    complexity: 'low',
    estimatedAgents: 1,
  },
  {
    title: 'Optimize Database Queries',
    description: 'Improve performance by optimizing slow database queries',
    type: 'optimization',
    complexity: 'high',
    estimatedAgents: 2,
  },
];

export const CreateTaskStep: React.FC<CreateTaskStepProps> = ({ onComplete, metadata }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'feature',
    priority: 'medium',
    complexity: 'medium',
  });
  const [showAIDecomposition, setShowAIDecomposition] = useState(false);
  const [decomposing, setDecomposing] = useState(false);
  const [decomposedTasks, setDecomposedTasks] = useState<any[]>([]);
  const [createdTask, setCreatedTask] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);

  useEffect(() => {
    loadAvailableAgents();
  }, []);

  const loadAvailableAgents = async () => {
    try {
      const response = await api.get('/agents/status');
      setAvailableAgents(response.data.agents.filter((a: any) => a.status === 'available'));
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const handleExampleSelect = (example: typeof taskExamples[0]) => {
    setFormData({
      ...formData,
      title: example.title,
      description: example.description,
      type: example.type,
      complexity: example.complexity,
    });
    setShowExamples(false);
  };

  const handleAIDecompose = async () => {
    if (!formData.title || !formData.description) {
      toast.error('Please provide task title and description');
      return;
    }

    setDecomposing(true);
    setShowAIDecomposition(true);

    try {
      const response = await api.post('/ai/decompose-task', {
        title: formData.title,
        description: formData.description,
        type: formData.type,
        projectId: metadata?.projectId,
      });

      setDecomposedTasks(response.data.subtasks);
      toast.success('Task decomposed successfully!');
    } catch (error) {
      console.error('Failed to decompose task:', error);
      toast.error('Failed to decompose task');
    } finally {
      setDecomposing(false);
    }
  };

  const handleCreateTask = async () => {
    setLoading(true);
    try {
      const taskData = {
        projectId: metadata?.projectId,
        title: formData.title,
        description: formData.description,
        type: formData.type,
        priority: formData.priority,
        metadata: {
          complexity: formData.complexity,
          createdDuringOnboarding: true,
          aiDecomposed: decomposedTasks.length > 0,
          subtasks: decomposedTasks,
        },
      };

      const response = await api.post('/tasks', taskData);
      setCreatedTask(response.data.task);

      // If decomposed, create subtasks
      if (decomposedTasks.length > 0) {
        for (const subtask of decomposedTasks) {
          await api.post('/tasks', {
            ...subtask,
            parentTaskId: response.data.task.id,
            projectId: metadata?.projectId,
          });
        }
      }

      toast.success('Task created successfully!');
    } catch (error) {
      console.error('Failed to create task:', error);
      toast.error('Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const complexityColors = {
    low: 'success',
    medium: 'warning',
    high: 'error',
  };

  const typeIcons = {
    feature: <Code />,
    bug: <BugReport />,
    optimization: <Speed />,
    enhancement: <Lightbulb />,
  };

  if (createdTask) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Box textAlign="center" py={4}>
          <Check sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Task Created Successfully!
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Your task "{createdTask.title}" has been created and AI agents are ready to help.
            {decomposedTasks.length > 0 && (
              <> The task was decomposed into {decomposedTasks.length} subtasks.</>
            )}
          </Typography>
          <Card variant="outlined" sx={{ mt: 3, mb: 3, maxWidth: 600, mx: 'auto' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                What happens next?
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <AutoAwesome color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="AI agents will start working on your task"
                    secondary="The orchestrator assigns the best agents based on task requirements"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Schedule color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Track progress in real-time"
                    secondary="Monitor agent activity and task completion status"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Person color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Review and approve results"
                    secondary="Examine agent outputs and provide feedback"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
          <Button
            variant="contained"
            size="large"
            onClick={() => onComplete({ taskId: createdTask.id })}
          >
            Continue to Agent Overview
          </Button>
        </Box>
      </motion.div>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Create Your First Task
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Let's create a task and see how AI agents collaborate to complete it.
      </Typography>

      {showExamples && (
        <Box mb={4}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Need inspiration? Try one of these example tasks:
            </Typography>
          </Alert>
          <Grid container spacing={2}>
            {taskExamples.map((example, index) => (
              <Grid item xs={12} sm={6} key={index}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card
                    variant="outlined"
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleExampleSelect(example)}
                  >
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        {typeIcons[example.type as keyof typeof typeIcons]}
                        <Typography variant="h6">{example.title}</Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        {example.description}
                      </Typography>
                      <Box display="flex" gap={1}>
                        <Chip
                          label={example.type}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label={example.complexity}
                          size="small"
                          color={complexityColors[example.complexity as keyof typeof complexityColors] as any}
                        />
                        <Chip
                          label={`~${example.estimatedAgents} agents`}
                          size="small"
                          icon={<Person />}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      <Card>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Task Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="What needs to be done?"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Task Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Provide details about what you want to accomplish..."
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Task Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  label="Task Type"
                >
                  <MenuItem value="feature">Feature</MenuItem>
                  <MenuItem value="bug">Bug Fix</MenuItem>
                  <MenuItem value="enhancement">Enhancement</MenuItem>
                  <MenuItem value="optimization">Optimization</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
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
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Complexity</InputLabel>
                <Select
                  value={formData.complexity}
                  onChange={(e) => setFormData({ ...formData, complexity: e.target.value })}
                  label="Complexity"
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Box mt={3}>
            <Button
              variant="outlined"
              startIcon={<AutoAwesome />}
              onClick={handleAIDecompose}
              disabled={!formData.title || !formData.description || decomposing}
            >
              {decomposing ? 'Decomposing...' : 'AI Decompose Task'}
            </Button>
          </Box>

          <Collapse in={showAIDecomposition}>
            <Box mt={3}>
              {decomposing ? (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    AI is analyzing your task...
                  </Typography>
                  <LinearProgress />
                </Box>
              ) : decomposedTasks.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    AI suggested breaking this task into {decomposedTasks.length} subtasks:
                  </Typography>
                  <List>
                    {decomposedTasks.map((subtask, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Task color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={subtask.title}
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {subtask.description}
                              </Typography>
                              <Box display="flex" gap={1} mt={1}>
                                <Chip
                                  label={`${subtask.estimatedHours}h`}
                                  size="small"
                                  icon={<Schedule />}
                                />
                                <AvatarGroup max={3}>
                                  {subtask.suggestedAgents?.map((agent: string, i: number) => (
                                    <Tooltip key={i} title={agent}>
                                      <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                                        {agent[0]}
                                      </Avatar>
                                    </Tooltip>
                                  ))}
                                </AvatarGroup>
                              </Box>
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              ) : null}
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      <Box display="flex" justifyContent="center" mt={4}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleCreateTask}
          disabled={!formData.title || !formData.description || loading}
        >
          Create Task
        </Button>
      </Box>
    </Box>
  );
};