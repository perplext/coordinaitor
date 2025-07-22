import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Button, Chip, Card, CardContent, Grid } from '@mui/material';
import { ArrowBack, PlayArrow, CheckCircle, Error, Schedule } from '@mui/icons-material';
import { useStore } from '@/store/useStore';
import { format } from 'date-fns';
import { TaskEstimation } from '@/components/TaskEstimation';
import { SecurityScanResults } from '@/components/SecurityScanResults';
import { api } from '@/services/api';

export const TaskDetail: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { tasks, agents } = useStore();
  const [estimation, setEstimation] = useState<any>(null);

  const task = tasks.find(t => t.id === taskId);

  useEffect(() => {
    if (task?.id) {
      // Check if estimation exists in metadata first
      if (task.metadata?.mlEstimation) {
        setEstimation(task.metadata.mlEstimation);
      } else {
        // Fetch estimation from API
        api.get(`/tasks/${task.id}/estimation`)
          .then(response => setEstimation(response.data))
          .catch(err => console.error('Failed to fetch estimation:', err));
      }
    }
  }, [task?.id]);

  if (!task) {
    return (
      <Box>
        <Typography variant="h5">Task not found</Typography>
        <Button onClick={() => navigate('/tasks')} startIcon={<ArrowBack />}>
          Back to Tasks
        </Button>
      </Box>
    );
  }

  const assignedAgent = task.assignedAgent ? agents.find(a => a.id === task.assignedAgent) : null;

  const getStatusIcon = () => {
    switch (task.status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'failed':
        return <Error color="error" />;
      default:
        return <Schedule color="action" />;
    }
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button onClick={() => navigate(-1)} startIcon={<ArrowBack />}>
          Back
        </Button>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Task Details
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              {getStatusIcon()}
              <Typography variant="h5">{task.title}</Typography>
            </Box>

            <Box display="flex" gap={1} mb={3}>
              <Chip label={task.type} color="primary" />
              <Chip label={task.priority} color={
                task.priority === 'critical' ? 'error' :
                task.priority === 'high' ? 'warning' :
                task.priority === 'medium' ? 'info' : 'default'
              } />
              <Chip label={task.status} />
            </Box>

            <Typography variant="h6" gutterBottom>
              Description
            </Typography>
            <Typography variant="body1" paragraph sx={{ whiteSpace: 'pre-wrap' }}>
              {task.description}
            </Typography>

            {task.output && (
              <>
                <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                  Output
                </Typography>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: 'grey.100',
                    borderRadius: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    whiteSpace: 'pre-wrap',
                    maxHeight: 600,
                    overflow: 'auto',
                  }}
                >
                  {typeof task.output === 'string' ? task.output :
                   task.output.content || JSON.stringify(task.output, null, 2)}
                </Box>
              </>
            )}

            {task.error && (
              <Paper sx={{ p: 2, bgcolor: 'error.light', color: 'error.contrastText', mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Error
                </Typography>
                <Typography variant="body2">
                  {task.error}
                </Typography>
              </Paper>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Timeline
              </Typography>
              <Box display="flex" flexDirection="column" gap={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="textSecondary">
                    Created
                  </Typography>
                  <Typography variant="body2">
                    {format(new Date(task.createdAt), 'MMM d, yyyy HH:mm:ss')}
                  </Typography>
                </Box>
                {task.startedAt && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="textSecondary">
                      Started
                    </Typography>
                    <Typography variant="body2">
                      {format(new Date(task.startedAt), 'MMM d, yyyy HH:mm:ss')}
                    </Typography>
                  </Box>
                )}
                {task.completedAt && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="textSecondary">
                      Completed
                    </Typography>
                    <Typography variant="body2">
                      {format(new Date(task.completedAt), 'MMM d, yyyy HH:mm:ss')}
                    </Typography>
                  </Box>
                )}
                {task.actualDuration && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="textSecondary">
                      Duration
                    </Typography>
                    <Typography variant="body2">
                      {(task.actualDuration / 1000).toFixed(1)}s
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>

          {assignedAgent && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Assigned Agent
                </Typography>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box>
                    <Typography variant="body1">{assignedAgent.name}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {assignedAgent.provider} • v{assignedAgent.version}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}

          {estimation && (
            <Box mb={3}>
              <TaskEstimation estimation={estimation} showDetails={true} />
            </Box>
          )}

          {(task.status === 'completed' || task.metadata?.securityScan) && (
            <Box mb={3}>
              <SecurityScanResults taskId={task.id} autoScan={!!task.metadata?.securityScan} />
            </Box>
          )}

          {task.metadata && Object.keys(task.metadata).length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Metadata
                </Typography>
                <Box
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {JSON.stringify(task.metadata, null, 2)}
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};