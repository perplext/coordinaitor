import React from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Speed,
  Groups,
  AutoAwesome,
  Security,
  Analytics,
  Code,
} from '@mui/icons-material';
import { motion } from 'framer-motion';

interface WelcomeStepProps {
  onComplete: (data?: any) => void;
  onSkip: () => void;
  metadata?: Record<string, any>;
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({ onComplete }) => {
  const features = [
    {
      icon: <AutoAwesome color="primary" />,
      title: 'AI-Powered Development',
      description: 'Leverage multiple AI agents to accelerate your development workflow',
    },
    {
      icon: <Groups color="primary" />,
      title: 'CoordinAItor Collaboration',
      description: 'Coordinate multiple AI agents working together on complex tasks',
    },
    {
      icon: <Speed color="primary" />,
      title: 'Intelligent Task Management',
      description: 'Automatically decompose projects and assign tasks to the best agents',
    },
    {
      icon: <Analytics color="primary" />,
      title: 'Performance Analytics',
      description: 'Track agent performance, task completion rates, and team productivity',
    },
    {
      icon: <Security color="primary" />,
      title: 'Enterprise Security',
      description: 'Built-in security scanning, approval workflows, and audit logging',
    },
    {
      icon: <Code color="primary" />,
      title: 'Seamless Integration',
      description: 'Connect with your existing tools and workflows',
    },
  ];

  return (
    <Box>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Typography variant="h3" gutterBottom>
          Welcome to CoordinAItor! 🚀
        </Typography>
        <Typography variant="h6" color="text.secondary" paragraph>
          The ultimate platform for orchestrating AI coding agents to supercharge your development workflow.
        </Typography>

        <Box my={4}>
          <Typography variant="h5" gutterBottom>
            What You Can Do
          </Typography>
          <Grid container spacing={3}>
            {features.map((feature, index) => (
              <Grid item xs={12} md={6} key={index}>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={2}>
                        {feature.icon}
                        <Box>
                          <Typography variant="h6">{feature.title}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {feature.description}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Box>

        <Box my={4}>
          <Typography variant="h5" gutterBottom>
            How It Works
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <Typography variant="h6" color="primary">1</Typography>
              </ListItemIcon>
              <ListItemText
                primary="Create a Project"
                secondary="Define your project goals and requirements"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Typography variant="h6" color="primary">2</Typography>
              </ListItemIcon>
              <ListItemText
                primary="AI Task Decomposition"
                secondary="Our AI automatically breaks down your project into manageable tasks"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Typography variant="h6" color="primary">3</Typography>
              </ListItemIcon>
              <ListItemText
                primary="Agent Assignment"
                secondary="Tasks are assigned to the most suitable AI agents based on their capabilities"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Typography variant="h6" color="primary">4</Typography>
              </ListItemIcon>
              <ListItemText
                primary="Monitor Progress"
                secondary="Track task completion, review results, and iterate as needed"
              />
            </ListItem>
          </List>
        </Box>

        <Box display="flex" justifyContent="center" mt={4}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={() => onComplete()}
          >
            Get Started
          </Button>
        </Box>
      </motion.div>
    </Box>
  );
};