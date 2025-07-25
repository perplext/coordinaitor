import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  Grid,
} from '@mui/material';
import {
  Timer,
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Psychology,
  AttachMoney,
  Group,
  Speed,
} from '@mui/icons-material';
import { format } from 'date-fns';

interface TaskEstimation {
  taskId: string;
  estimatedDuration: number;
  confidence: number;
  complexity: 'low' | 'medium' | 'high' | 'very-high';
  requiredAgents: number;
  recommendedStrategy?: 'single' | 'collaboration';
  similarTasks: Array<{
    taskId: string;
    similarity: number;
    actualDuration: number;
    actualCost?: number;
    agentsUsed: number;
    wasSuccessful: boolean;
  }>;
  factors: Array<{
    name: string;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
    description: string;
  }>;
  estimatedCost?: number;
}

interface TaskEstimationProps {
  estimation: TaskEstimation;
  showDetails?: boolean;
}

export function TaskEstimation({ estimation, showDetails = true }: TaskEstimationProps) {
  const formatDuration = (ms: number): string => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getComplexityColor = () => {
    switch (estimation.complexity) {
      case 'low': return 'success';
      case 'medium': return 'info';
      case 'high': return 'warning';
      case 'very-high': return 'error';
      default: return 'default';
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'positive': return <TrendingDown color="success" />;
      case 'negative': return <TrendingUp color="error" />;
      case 'neutral': return <TrendingFlat color="action" />;
      default: return null;
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          ML-Based Task Estimation
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <Timer />
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Estimated Duration
                </Typography>
                <Typography variant="h5">
                  {formatDuration(estimation.estimatedDuration)}
                </Typography>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <Psychology />
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Confidence Level
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <LinearProgress
                    variant="determinate"
                    value={estimation.confidence * 100}
                    sx={{ width: 100, height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="body1">
                    {Math.round(estimation.confidence * 100)}%
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Box display="flex" alignItems="center" gap={1}>
              <Speed />
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Complexity
                </Typography>
                <Chip
                  label={estimation.complexity.toUpperCase()}
                  color={getComplexityColor()}
                  size="small"
                />
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Box display="flex" alignItems="center" gap={1}>
              <Group />
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Required Agents
                </Typography>
                <Typography variant="body1">
                  {estimation.requiredAgents}
                </Typography>
              </Box>
            </Box>
          </Grid>

          {estimation.estimatedCost && (
            <Grid item xs={12} sm={4}>
              <Box display="flex" alignItems="center" gap={1}>
                <AttachMoney />
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Estimated Cost
                  </Typography>
                  <Typography variant="body1">
                    ${estimation.estimatedCost.toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          )}
        </Grid>

        {estimation.recommendedStrategy === 'collaboration' && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Recommendation:</strong> This task would benefit from CoordinAItor collaboration
              based on its complexity and requirements.
            </Typography>
          </Alert>
        )}

        {showDetails && (
          <>
            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" gutterBottom>
              Estimation Factors
            </Typography>
            <List dense>
              {estimation.factors.map((factor, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    {getImpactIcon(factor.impact)}
                  </ListItemIcon>
                  <ListItemText
                    primary={factor.name}
                    secondary={
                      <>
                        {factor.description}
                        <Chip
                          label={`Weight: ${(factor.weight * 100).toFixed(0)}%`}
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>

            {estimation.similarTasks.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom>
                  Similar Historical Tasks
                </Typography>
                <List dense>
                  {estimation.similarTasks.map((task, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2">
                              {task.wasSuccessful ? '✓' : '✗'} Task #{index + 1}
                            </Typography>
                            <Chip
                              label={`${Math.round(task.similarity * 100)}% similar`}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption">
                              Duration: {formatDuration(task.actualDuration)} • 
                              Agents: {task.agentsUsed}
                              {task.actualCost && ` • Cost: $${task.actualCost.toFixed(2)}`}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}