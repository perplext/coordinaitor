import React from 'react';
import { Grid, Typography, Box, Button, Card, CardContent, CardActions, Chip, LinearProgress } from '@mui/material';
import { Add, FolderOpen, Schedule, CheckCircle, Cancel } from '@mui/icons-material';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { useStore } from '@/store/useStore';
import { useProjects } from '@/hooks/useProjects';
import { format } from 'date-fns';

export const Projects: React.FC = () => {
  const { projects, deleteProject } = useProjects();
  const { tasks, setCreateProjectDialogOpen, createProjectDialogOpen } = useStore();

  const getProjectProgress = (projectId: string) => {
    const projectTasks = tasks.filter(t => t.projectId === projectId);
    if (projectTasks.length === 0) return 0;
    
    const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
    return (completedTasks / projectTasks.length) * 100;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'planning':
        return <Schedule />;
      case 'active':
        return <FolderOpen />;
      case 'completed':
        return <CheckCircle />;
      case 'cancelled':
        return <Cancel />;
      default:
        return <FolderOpen />;
    }
  };

  const getStatusColor = (status: string): any => {
    switch (status) {
      case 'planning':
        return 'info';
      case 'active':
        return 'primary';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Projects</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateProjectDialogOpen(true)}
        >
          Create Project
        </Button>
      </Box>

      {projects.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <FolderOpen sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="textSecondary" gutterBottom>
              No projects yet
            </Typography>
            <Typography variant="body2" color="textSecondary" mb={3}>
              Create your first project to get started
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateProjectDialogOpen(true)}
            >
              Create Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {projects.map((project) => {
            const progress = getProjectProgress(project.id);
            const projectTasks = tasks.filter(t => t.projectId === project.id);
            
            return (
              <Grid item xs={12} md={6} lg={4} key={project.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4,
                    },
                  }}
                  onClick={() => window.location.href = `/projects/${project.id}`}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Typography variant="h6" component="div">
                        {project.name}
                      </Typography>
                      <Chip
                        icon={getStatusIcon(project.status)}
                        label={project.status}
                        color={getStatusColor(project.status)}
                        size="small"
                      />
                    </Box>

                    <Typography variant="body2" color="text.secondary" mb={2}>
                      {project.description}
                    </Typography>

                    <Box mb={2}>
                      <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2" color="text.secondary">
                          Progress
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {progress.toFixed(0)}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>

                    <Box display="flex" gap={1} flexWrap="wrap">
                      <Chip
                        label={`${projectTasks.length} tasks`}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={`${projectTasks.filter(t => t.status === 'completed').length} completed`}
                        size="small"
                        variant="outlined"
                        color="success"
                      />
                      {projectTasks.filter(t => t.status === 'failed').length > 0 && (
                        <Chip
                          label={`${projectTasks.filter(t => t.status === 'failed').length} failed`}
                          size="small"
                          variant="outlined"
                          color="error"
                        />
                      )}
                    </Box>
                  </CardContent>

                  <CardActions sx={{ px: 2, pb: 2 }}>
                    <Box display="flex" justifyContent="space-between" width="100%">
                      <Typography variant="caption" color="text.secondary">
                        Created: {format(new Date(project.createdAt), 'MMM d, yyyy')}
                      </Typography>
                      <Button
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete project "${project.name}"?`)) {
                            deleteProject(project.id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </Box>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <CreateProjectDialog
        open={createProjectDialogOpen}
        onClose={() => setCreateProjectDialogOpen(false)}
      />
    </Box>
  );
};