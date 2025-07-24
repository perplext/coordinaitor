import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Avatar,
  AvatarGroup,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
  Paper,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Tooltip,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Groups,
  Code,
  BugReport,
  CheckCircle,
  Schedule,
  PlayArrow,
  Pause,
  SmartToy,
  AutoAwesome,
  Lightbulb,
  Security,
  Speed,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { api } from '@/services/api';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface CollaborationStepProps {
  onComplete: (data?: any) => void;
  onSkip: () => void;
  metadata?: Record<string, any>;
}

interface CollaborationExample {
  id: string;
  title: string;
  description: string;
  agents: string[];
  steps: {
    agent: string;
    action: string;
    duration: string;
    status: 'completed' | 'in-progress' | 'pending';
  }[];
  result: string;
}

const collaborationExamples: CollaborationExample[] = [
  {
    id: 'bug-fix',
    title: 'Collaborative Bug Fix',
    description: 'Multiple agents working together to identify and fix a complex bug',
    agents: ['Claude', 'GPT-4', 'GitHub Copilot'],
    steps: [
      {
        agent: 'Claude',
        action: 'Analyze bug report and identify potential causes',
        duration: '2 min',
        status: 'completed',
      },
      {
        agent: 'GPT-4',
        action: 'Search codebase for related issues and patterns',
        duration: '3 min',
        status: 'completed',
      },
      {
        agent: 'GitHub Copilot',
        action: 'Generate fix suggestions based on findings',
        duration: '1 min',
        status: 'completed',
      },
      {
        agent: 'Claude',
        action: 'Review and test the proposed solution',
        duration: '2 min',
        status: 'in-progress',
      },
    ],
    result: 'Bug fixed with comprehensive test coverage added',
  },
  {
    id: 'feature-dev',
    title: 'Feature Development',
    description: 'Building a new feature with multiple specialized agents',
    agents: ['Claude', 'Cursor AI', 'Perplexity AI', 'Amazon CodeWhisperer'],
    steps: [
      {
        agent: 'Perplexity AI',
        action: 'Research best practices and similar implementations',
        duration: '5 min',
        status: 'completed',
      },
      {
        agent: 'Claude',
        action: 'Design feature architecture and API',
        duration: '4 min',
        status: 'completed',
      },
      {
        agent: 'Cursor AI',
        action: 'Implement frontend components',
        duration: '10 min',
        status: 'completed',
      },
      {
        agent: 'Amazon CodeWhisperer',
        action: 'Implement backend logic and database schema',
        duration: '8 min',
        status: 'completed',
      },
      {
        agent: 'Claude',
        action: 'Write tests and documentation',
        duration: '5 min',
        status: 'pending',
      },
    ],
    result: 'Feature completed with full test coverage and documentation',
  },
];

export const CollaborationStep: React.FC<CollaborationStepProps> = ({ onComplete }) => {
  const [selectedExample, setSelectedExample] = useState<CollaborationExample | null>(null);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [expandedExample, setExpandedExample] = useState<string | null>(null);
  const [completedSimulations, setCompletedSimulations] = useState<Set<string>>(new Set());

  const runSimulation = async (example: CollaborationExample) => {
    setSelectedExample(example);
    setSimulationRunning(true);
    setSimulationProgress(0);

    // Simulate progress
    const interval = setInterval(() => {
      setSimulationProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setSimulationRunning(false);
          setCompletedSimulations(new Set([...completedSimulations, example.id]));
          toast.success('Collaboration simulation completed!');
          return 100;
        }
        return prev + 10;
      });
    }, 500);
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle />;
      case 'in-progress':
        return <Schedule />;
      default:
        return <Code />;
    }
  };

  const getStepColor = (status: string): any => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in-progress':
        return 'primary';
      default:
        return 'grey';
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Multi-Agent Collaboration
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        See how multiple AI agents work together to tackle complex tasks. Each agent brings unique strengths to deliver better results faster.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="subtitle2">
          🤝 Collaboration Benefits:
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon>
              <Speed fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Faster completion through parallel work" />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <Lightbulb fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Better solutions from diverse perspectives" />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <Security fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Built-in review and validation" />
          </ListItem>
        </List>
      </Alert>

      <Grid container spacing={3}>
        {collaborationExamples.map((example) => (
          <Grid item xs={12} key={example.id}>
            <Card
              variant="outlined"
              sx={{
                borderColor: selectedExample?.id === example.id ? 'primary.main' : 'divider',
                borderWidth: selectedExample?.id === example.id ? 2 : 1,
              }}
            >
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="start">
                  <Box flex={1}>
                    <Typography variant="h6" gutterBottom>
                      {example.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {example.description}
                    </Typography>
                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                      <Typography variant="subtitle2">Agents:</Typography>
                      <AvatarGroup max={4}>
                        {example.agents.map((agent) => (
                          <Tooltip key={agent} title={agent}>
                            <Avatar sx={{ width: 32, height: 32 }}>
                              <SmartToy fontSize="small" />
                            </Avatar>
                          </Tooltip>
                        ))}
                      </AvatarGroup>
                    </Box>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => setExpandedExample(
                      expandedExample === example.id ? null : example.id
                    )}
                  >
                    {expandedExample === example.id ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Box>

                <Collapse in={expandedExample === example.id}>
                  <Box mt={3}>
                    <Typography variant="subtitle2" gutterBottom>
                      Collaboration Timeline:
                    </Typography>
                    <Timeline position="alternate">
                      {example.steps.map((step, index) => (
                        <TimelineItem key={index}>
                          <TimelineOppositeContent color="text.secondary">
                            <Typography variant="caption">{step.duration}</Typography>
                          </TimelineOppositeContent>
                          <TimelineSeparator>
                            <TimelineDot color={getStepColor(step.status)}>
                              {getStepIcon(step.status)}
                            </TimelineDot>
                            {index < example.steps.length - 1 && <TimelineConnector />}
                          </TimelineSeparator>
                          <TimelineContent>
                            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
                              <Typography variant="subtitle2">{step.agent}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {step.action}
                              </Typography>
                            </Paper>
                          </TimelineContent>
                        </TimelineItem>
                      ))}
                    </Timeline>
                    <Alert severity="success" sx={{ mt: 2 }}>
                      <Typography variant="subtitle2">Result:</Typography>
                      <Typography variant="body2">{example.result}</Typography>
                    </Alert>
                  </Box>
                </Collapse>

                <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                  <Button
                    variant={completedSimulations.has(example.id) ? 'outlined' : 'contained'}
                    startIcon={
                      completedSimulations.has(example.id) ? (
                        <CheckCircle />
                      ) : simulationRunning && selectedExample?.id === example.id ? (
                        <Pause />
                      ) : (
                        <PlayArrow />
                      )
                    }
                    onClick={() => runSimulation(example)}
                    disabled={simulationRunning}
                  >
                    {completedSimulations.has(example.id)
                      ? 'Completed'
                      : simulationRunning && selectedExample?.id === example.id
                      ? 'Running...'
                      : 'Run Simulation'}
                  </Button>
                  {simulationRunning && selectedExample?.id === example.id && (
                    <Box sx={{ width: '50%' }}>
                      <LinearProgress variant="determinate" value={simulationProgress} />
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {selectedExample && (
        <Box mt={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Key Insights
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Groups color="primary" />
                      <Typography variant="subtitle1">Parallel Processing</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Multiple agents work simultaneously on different aspects, reducing overall completion time.
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <AutoAwesome color="primary" />
                      <Typography variant="subtitle1">Specialized Expertise</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Each agent contributes its unique strengths, resulting in higher quality outputs.
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <CheckCircle color="primary" />
                      <Typography variant="subtitle1">Built-in Validation</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Agents review each other's work, catching issues early and ensuring quality.
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Box>
      )}

      <Box display="flex" justifyContent="center" mt={4}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={() => onComplete({ completedSimulations: Array.from(completedSimulations) })}
          disabled={completedSimulations.size === 0}
        >
          Continue
        </Button>
        <Button
          variant="text"
          size="large"
          onClick={() => onComplete({ completedSimulations: [] })}
          sx={{ ml: 2 }}
        >
          Skip Simulations
        </Button>
      </Box>
    </Box>
  );
};