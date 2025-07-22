import React, { useState } from 'react';
import { Grid, Typography, Box, Button, Tabs, Tab, Paper, TextField, MenuItem, Fab } from '@mui/material';
import { Add, FilterList } from '@mui/icons-material';
import { TaskCard } from '@/components/TaskCard';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { useStore } from '@/store/useStore';
import { useTasks } from '@/hooks/useTasks';

export const Tasks: React.FC = () => {
  const { tasks, createTask } = useTasks();
  const { setCreateTaskDialogOpen, createTaskDialogOpen } = useStore();
  const [tabValue, setTabValue] = useState(0);
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const filterTasks = () => {
    let filtered = tasks;

    // Status filter based on tab
    switch (tabValue) {
      case 1:
        filtered = filtered.filter(t => t.status === 'pending');
        break;
      case 2:
        filtered = filtered.filter(t => ['assigned', 'in_progress'].includes(t.status));
        break;
      case 3:
        filtered = filtered.filter(t => t.status === 'completed');
        break;
      case 4:
        filtered = filtered.filter(t => t.status === 'failed');
        break;
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(t => t.type === typeFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(t => t.priority === priorityFilter);
    }

    return filtered;
  };

  const filteredTasks = filterTasks();

  const handleExecuteTask = async (taskId: string) => {
    createTask({
      prompt: tasks.find(t => t.id === taskId)?.description || '',
      type: tasks.find(t => t.id === taskId)?.type,
      priority: tasks.find(t => t.id === taskId)?.priority,
    });
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Tasks</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateTaskDialogOpen(true)}
        >
          Create Task
        </Button>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          variant="fullWidth"
        >
          <Tab label={`All (${tasks.length})`} />
          <Tab label={`Pending (${tasks.filter(t => t.status === 'pending').length})`} />
          <Tab label={`In Progress (${tasks.filter(t => ['assigned', 'in_progress'].includes(t.status)).length})`} />
          <Tab label={`Completed (${tasks.filter(t => t.status === 'completed').length})`} />
          <Tab label={`Failed (${tasks.filter(t => t.status === 'failed').length})`} />
        </Tabs>
      </Paper>

      <Box display="flex" gap={2} mb={3}>
        <TextField
          select
          label="Type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          size="small"
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="all">All Types</MenuItem>
          <MenuItem value="requirement">Requirement</MenuItem>
          <MenuItem value="design">Design</MenuItem>
          <MenuItem value="implementation">Implementation</MenuItem>
          <MenuItem value="test">Test</MenuItem>
          <MenuItem value="deployment">Deployment</MenuItem>
          <MenuItem value="review">Review</MenuItem>
        </TextField>

        <TextField
          select
          label="Priority"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          size="small"
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="all">All Priorities</MenuItem>
          <MenuItem value="critical">Critical</MenuItem>
          <MenuItem value="high">High</MenuItem>
          <MenuItem value="medium">Medium</MenuItem>
          <MenuItem value="low">Low</MenuItem>
        </TextField>
      </Box>

      {filteredTasks.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="textSecondary">No tasks found</Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {filteredTasks.map((task) => (
            <Grid item xs={12} md={6} lg={4} key={task.id}>
              <TaskCard
                task={task}
                onClick={() => window.location.href = `/tasks/${task.id}`}
                onExecute={() => handleExecuteTask(task.id)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <CreateTaskDialog
        open={createTaskDialogOpen}
        onClose={() => setCreateTaskDialogOpen(false)}
        onCreate={(task) => {
          createTask(task);
          setCreateTaskDialogOpen(false);
        }}
      />

      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
        }}
        onClick={() => setCreateTaskDialogOpen(true)}
      >
        <Add />
      </Fab>
    </Box>
  );
};