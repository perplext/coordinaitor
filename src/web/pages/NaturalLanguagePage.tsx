import React, { useState } from 'react';
import {
  Container,
  Grid,
  Typography,
  Paper,
  Box,
  Tab,
  Tabs,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Divider,
  Alert,
  Button
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  Task as TaskIcon,
  Timeline as TimelineIcon,
  Code as CodeIcon,
  DataObject as DataIcon,
  Description as DocIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import NaturalLanguageInput from '../components/natural-language/NaturalLanguageInput';
import { motion } from 'framer-motion';

interface Task {
  id: string;
  prompt: string;
  type: string;
  priority: string;
  status: string;
  createdAt: string;
  context?: any;
}

const NaturalLanguagePage: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [createdTasks, setCreatedTasks] = useState<Task[]>([]);
  const [parseHistory, setParseHistory] = useState<any[]>([]);

  const handleTaskCreate = (task: Task) => {
    setCreatedTasks([task, ...createdTasks]);
    // In a real app, you might navigate to the task detail page
    console.log('Task created:', task);
  };

  const handleParse = (result: any) => {
    setParseHistory([result, ...parseHistory]);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
  };

  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case 'code-generation':
        return <CodeIcon />;
      case 'data-analysis':
        return <DataIcon />;
      case 'documentation':
        return <DocIcon />;
      default:
        return <TaskIcon />;
    }
  };

  const examplePrompts = [
    {
      category: 'Code Generation',
      icon: <CodeIcon />,
      examples: [
        'Create a React component for user authentication with TypeScript',
        'Build a REST API endpoint for processing payments using Express.js',
        'Generate unit tests for the UserService class'
      ]
    },
    {
      category: 'Data Analysis',
      icon: <DataIcon />,
      examples: [
        'Analyze the sales data from last quarter and identify trends',
        'Generate a report on user engagement metrics for the past month',
        'Compare performance metrics between different product versions'
      ]
    },
    {
      category: 'Documentation',
      icon: <DocIcon />,
      examples: [
        'Document the API endpoints for the authentication service',
        'Create a comprehensive README for the project',
        'Write user guide for the new dashboard features'
      ]
    }
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box mb={4}>
          <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
            <PsychologyIcon sx={{ fontSize: 48, verticalAlign: 'middle', mr: 2 }} />
            Natural Language Interface
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Create tasks using natural language - just describe what you need!
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Main Input Section */}
          <Grid item xs={12} lg={8}>
            <NaturalLanguageInput
              onTaskCreate={handleTaskCreate}
              onParse={handleParse}
              showExamples={true}
              showChat={true}
            />

            {/* Recent Tasks */}
            {createdTasks.length > 0 && (
              <Paper sx={{ mt: 3, p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Recently Created Tasks
                </Typography>
                <List>
                  {createdTasks.slice(0, 5).map((task, index) => (
                    <ListItem key={task.id}>
                      <ListItemIcon>
                        {getTaskTypeIcon(task.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={task.prompt}
                        secondary={
                          <Box display="flex" gap={1} mt={1}>
                            <Chip label={task.type} size="small" />
                            <Chip label={task.priority} size="small" color="primary" />
                            <Chip
                              icon={<ScheduleIcon />}
                              label={new Date(task.createdAt).toLocaleTimeString()}
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Grid>

          {/* Examples and Help Section */}
          <Grid item xs={12} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Example Prompts
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Try these examples to get started:
                </Typography>

                {examplePrompts.map((category, index) => (
                  <Box key={index} mb={3}>
                    <Box display="flex" alignItems="center" mb={1}>
                      {category.icon}
                      <Typography variant="subtitle2" sx={{ ml: 1 }}>
                        {category.category}
                      </Typography>
                    </Box>
                    <List dense>
                      {category.examples.map((example, idx) => (
                        <ListItem key={idx}>
                          <ListItemText
                            primary={
                              <Typography variant="body2" color="text.secondary">
                                "{example}"
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                ))}
              </CardContent>
            </Card>

            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Tips for Better Results
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <CheckIcon color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Be specific about technologies"
                      secondary="Mention languages, frameworks, or tools"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckIcon color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Include priority indicators"
                      secondary="Use words like 'urgent', 'ASAP', or 'low priority'"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckIcon color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Specify deliverables"
                      secondary="Describe what you expect as output"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckIcon color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Add context when needed"
                      secondary="Include relevant files or constraints"
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                AI-Powered Understanding
              </Typography>
              <Typography variant="body2">
                Our natural language processor understands context, extracts key information, 
                and suggests the best agent for your task.
              </Typography>
            </Alert>
          </Grid>
        </Grid>

        {/* Advanced Features */}
        <Paper sx={{ mt: 4, p: 3 }}>
          <Tabs value={selectedTab} onChange={handleTabChange}>
            <Tab label="Features" icon={<PsychologyIcon />} iconPosition="start" />
            <Tab label="Parse History" icon={<TimelineIcon />} iconPosition="start" />
          </Tabs>

          {selectedTab === 0 && (
            <Box mt={3}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Typography variant="h6" gutterBottom>
                    Intelligent Parsing
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Automatically detects task type, priority, technologies, and requirements 
                    from your natural language description.
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="h6" gutterBottom>
                    Agent Recommendation
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Suggests the best AI agent for your task based on the requirements 
                    and capabilities needed.
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="h6" gutterBottom>
                    Collaboration Detection
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Identifies complex tasks that benefit from multi-agent collaboration 
                    for better results.
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}

          {selectedTab === 1 && (
            <Box mt={3}>
              {parseHistory.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No parsing history yet. Try creating a task!
                </Typography>
              ) : (
                <List>
                  {parseHistory.slice(0, 10).map((result, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={result.task?.prompt}
                        secondary={
                          <Box>
                            <Typography variant="caption">
                              Type: {result.intent.taskType} | 
                              Priority: {result.intent.priority} | 
                              Confidence: {Math.round(result.intent.confidence * 100)}%
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}
        </Paper>
      </motion.div>
    </Container>
  );
};

export default NaturalLanguagePage;