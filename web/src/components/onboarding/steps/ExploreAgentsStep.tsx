import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Grid,
  Button,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tabs,
  Tab,
  Paper,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  Badge,
  Collapse,
} from '@mui/material';
import {
  SmartToy,
  Code,
  Language,
  Science,
  Security,
  Speed,
  Star,
  InfoOutlined,
  ExpandMore,
  ExpandLess,
  CheckCircle,
  Schedule,
  TrendingUp,
} from '@mui/icons-material';
import { api } from '@/services/api';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

interface ExploreAgentsStepProps {
  onComplete: (data?: any) => void;
  onSkip: () => void;
  metadata?: Record<string, any>;
}

interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'available' | 'busy' | 'offline';
  description: string;
  capabilities: string[];
  specialties: string[];
  performance: {
    tasksCompleted: number;
    averageCompletionTime: number;
    successRate: number;
    rating: number;
  };
  currentLoad: number;
  maxConcurrentTasks: number;
}

const agentCategories = [
  { id: 'all', label: 'All Agents', icon: <SmartToy /> },
  { id: 'coding', label: 'Coding Assistants', icon: <Code /> },
  { id: 'language', label: 'Language Models', icon: <Language /> },
  { id: 'specialized', label: 'Specialized AI', icon: <Science /> },
  { id: 'security', label: 'Security Agents', icon: <Security /> },
];

export const ExploreAgentsStep: React.FC<ExploreAgentsStepProps> = ({ onComplete }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [testingAgent, setTestingAgent] = useState<string | null>(null);
  const [testedAgents, setTestedAgents] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const response = await api.get('/agents');
      setAgents(response.data.agents);
    } catch (error) {
      console.error('Failed to load agents:', error);
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const handleTestAgent = async (agentId: string) => {
    setTestingAgent(agentId);
    try {
      const response = await api.post(`/agents/${agentId}/test`, {
        testTask: {
          title: 'Test Task',
          description: 'Simple test to verify agent functionality',
          type: 'test',
        },
      });

      if (response.data.success) {
        toast.success('Agent test completed successfully!');
        setTestedAgents(new Set([...testedAgents, agentId]));
      }
    } catch (error) {
      console.error('Failed to test agent:', error);
      toast.error('Failed to test agent');
    } finally {
      setTestingAgent(null);
    }
  };

  const filteredAgents = agents.filter(agent => {
    if (selectedCategory === 'all') return true;
    return agent.type === selectedCategory;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'success';
      case 'busy':
        return 'warning';
      case 'offline':
        return 'error';
      default:
        return 'default';
    }
  };

  const getLoadPercentage = (agent: Agent) => {
    return (agent.currentLoad / agent.maxConcurrentTasks) * 100;
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Explore AI Agents
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Discover the AI agents available to help with your development tasks. Each agent has unique capabilities and specializations.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="subtitle2">
          💡 Pro tip: Different agents excel at different tasks. CoordinAItor automatically selects the best agents for each task based on their capabilities and current workload.
        </Typography>
      </Alert>

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={selectedCategory}
          onChange={(_, value) => setSelectedCategory(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {agentCategories.map(category => (
            <Tab
              key={category.id}
              label={category.label}
              value={category.id}
              icon={category.icon}
              iconPosition="start"
            />
          ))}
        </Tabs>
      </Paper>

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <LinearProgress sx={{ width: '50%' }} />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filteredAgents.map((agent) => (
            <Grid item xs={12} md={6} key={agent.id}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    borderColor: expandedAgent === agent.id ? 'primary.main' : 'divider',
                    borderWidth: expandedAgent === agent.id ? 2 : 1,
                  }}
                >
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          <SmartToy />
                        </Avatar>
                        <Box>
                          <Typography variant="h6">{agent.name}</Typography>
                          <Box display="flex" gap={1} alignItems="center">
                            <Chip
                              label={agent.status}
                              size="small"
                              color={getStatusColor(agent.status) as any}
                            />
                            <Badge
                              badgeContent={`${agent.currentLoad}/${agent.maxConcurrentTasks}`}
                              color="primary"
                            >
                              <Schedule fontSize="small" />
                            </Badge>
                          </Box>
                        </Box>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => setExpandedAgent(
                          expandedAgent === agent.id ? null : agent.id
                        )}
                      >
                        {expandedAgent === agent.id ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    </Box>

                    <Typography variant="body2" color="text.secondary" paragraph>
                      {agent.description}
                    </Typography>

                    <Box mb={2}>
                      <Typography variant="subtitle2" gutterBottom>
                        Specialties:
                      </Typography>
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {agent.specialties.slice(0, 3).map((specialty) => (
                          <Chip key={specialty} label={specialty} size="small" variant="outlined" />
                        ))}
                        {agent.specialties.length > 3 && (
                          <Chip
                            label={`+${agent.specialties.length - 3} more`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>

                    <Box mb={2}>
                      <Typography variant="subtitle2" gutterBottom>
                        Current Load:
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={getLoadPercentage(agent)}
                        sx={{ height: 8, borderRadius: 1 }}
                      />
                    </Box>

                    <Collapse in={expandedAgent === agent.id}>
                      <Box mt={2}>
                        <Typography variant="subtitle2" gutterBottom>
                          Performance Metrics:
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Paper variant="outlined" sx={{ p: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Tasks Completed
                              </Typography>
                              <Typography variant="h6">
                                {agent.performance.tasksCompleted}
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={6}>
                            <Paper variant="outlined" sx={{ p: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Success Rate
                              </Typography>
                              <Typography variant="h6">
                                {agent.performance.successRate}%
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={6}>
                            <Paper variant="outlined" sx={{ p: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Avg. Time
                              </Typography>
                              <Typography variant="h6">
                                {agent.performance.averageCompletionTime}m
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={6}>
                            <Paper variant="outlined" sx={{ p: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Rating
                              </Typography>
                              <Box display="flex" alignItems="center">
                                <Star sx={{ color: 'warning.main', mr: 0.5 }} />
                                <Typography variant="h6">
                                  {agent.performance.rating.toFixed(1)}
                                </Typography>
                              </Box>
                            </Paper>
                          </Grid>
                        </Grid>

                        <Box mt={2}>
                          <Typography variant="subtitle2" gutterBottom>
                            Capabilities:
                          </Typography>
                          <List dense>
                            {agent.capabilities.map((capability) => (
                              <ListItem key={capability}>
                                <ListItemIcon>
                                  <CheckCircle fontSize="small" color="primary" />
                                </ListItemIcon>
                                <ListItemText primary={capability} />
                              </ListItem>
                            ))}
                          </List>
                        </Box>
                      </Box>
                    </Collapse>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      variant={testedAgents.has(agent.id) ? 'outlined' : 'contained'}
                      onClick={() => handleTestAgent(agent.id)}
                      disabled={testingAgent === agent.id || agent.status === 'offline'}
                      startIcon={testedAgents.has(agent.id) ? <CheckCircle /> : null}
                    >
                      {testingAgent === agent.id
                        ? 'Testing...'
                        : testedAgents.has(agent.id)
                        ? 'Tested'
                        : 'Test Agent'}
                    </Button>
                    <Tooltip title="View full agent details">
                      <IconButton size="small">
                        <InfoOutlined />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      )}

      <Box display="flex" justifyContent="center" mt={4}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={() => onComplete({ testedAgents: Array.from(testedAgents) })}
          disabled={testedAgents.size === 0}
        >
          Continue
        </Button>
        <Button
          variant="text"
          size="large"
          onClick={() => onComplete({ testedAgents: [] })}
          sx={{ ml: 2 }}
        >
          Skip Testing
        </Button>
      </Box>
    </Box>
  );
};