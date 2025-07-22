import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Button, Grid, Chip, LinearProgress, Card, CardContent } from '@mui/material';
import { ArrowBack, PlayArrow, Stop } from '@mui/icons-material';
import { TaskCard } from '@/components/TaskCard';
import { useStore } from '@/store/useStore';
import { useProjectTasks } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { format } from 'date-fns';

export const ProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const projects = useStore((state) => state.projects);
  const { createTask } = useTasks();
  const { tasks: projectTasks } = useProjectTasks(projectId || '');

  const project = projects.find(p => p.id === projectId);

  if (!project) {
    return (
      <Box>
        <Typography variant="h5">Project not found</Typography>
        <Button onClick={() => navigate('/projects')} startIcon={<ArrowBack />}>
          Back to Projects
        </Button>
      </Box>
    );
  }

  const tasksByStatus = {
    pending: projectTasks.filter(t => t.status === 'pending'),
    inProgress: projectTasks.filter(t => ['assigned', 'in_progress'].includes(t.status)),
    completed: projectTasks.filter(t => t.status === 'completed'),
    failed: projectTasks.filter(t => t.status === 'failed'),
  };

  const progress = projectTasks.length > 0
    ? (tasksByStatus.completed.length / projectTasks.length) * 100
    : 0;

  const handleExecuteAllPending = () => {
    tasksByStatus.pending.forEach(task => {
      createTask({
        prompt: task.description,
        type: task.type,
        priority: task.priority,
        projectId: project.id,
      });
    });
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button onClick={() => navigate('/projects')} startIcon={<ArrowBack />}>
          Back
        </Button>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          {project.name}
        </Typography>
        <Chip
          label={project.status}
          color={project.status === 'active' ? 'primary' : 'default'}
        />
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Description
            </Typography>
            <Typography variant="body1" paragraph>
              {project.description}
            </Typography>

            {project.prd && (
              <>
                <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                  Product Requirements Document
                </Typography>
                <Box
                  sx={{
                    p: 2,
                    bgcolor: 'grey.100',
                    borderRadius: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    whiteSpace: 'pre-wrap',
                    maxHeight: 400,
                    overflow: 'auto',
                  }}
                >
                  {project.prd}
                </Box>
              </>
            )}
          </Paper>

          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Tasks</Typography>
            {tasksByStatus.pending.length > 0 && (
              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={handleExecuteAllPending}
              >
                Execute All Pending ({tasksByStatus.pending.length})
              </Button>
            )}
          </Box>

          <Grid container spacing={2}>
            {projectTasks.map((task) => (
              <Grid item xs={12} key={task.id}>
                <TaskCard
                  task={task}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  onExecute={() => createTask({
                    prompt: task.description,
                    type: task.type,
                    priority: task.priority,
                    projectId: project.id,
                  })}
                />
              </Grid>
            ))}
          </Grid>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Progress
              </Typography>
              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Overall Progress</Typography>
                  <Typography variant="body2">{progress.toFixed(0)}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{ height: 10, borderRadius: 5 }}
                />
              </Box>

              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Box textAlign="center" p={2} bgcolor="info.light" borderRadius={1}>
                    <Typography variant="h4">{projectTasks.length}</Typography>
                    <Typography variant="body2">Total Tasks</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center" p={2} bgcolor="success.light" borderRadius={1}>
                    <Typography variant="h4">{tasksByStatus.completed.length}</Typography>
                    <Typography variant="body2">Completed</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center" p={2} bgcolor="warning.light" borderRadius={1}>
                    <Typography variant="h4">{tasksByStatus.inProgress.length}</Typography>
                    <Typography variant="body2">In Progress</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center" p={2} bgcolor="error.light" borderRadius={1}>
                    <Typography variant="h4">{tasksByStatus.failed.length}</Typography>
                    <Typography variant="body2">Failed</Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Project Details
              </Typography>
              <Box display="flex" flexDirection="column" gap={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="textSecondary">
                    Created
                  </Typography>
                  <Typography variant="body2">
                    {format(new Date(project.createdAt), 'MMM d, yyyy HH:mm')}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="textSecondary">
                    Updated
                  </Typography>
                  <Typography variant="body2">
                    {format(new Date(project.updatedAt), 'MMM d, yyyy HH:mm')}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="textSecondary">
                    Status
                  </Typography>
                  <Typography variant="body2">{project.status}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};