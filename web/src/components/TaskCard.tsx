import React from 'react';
import { Card, CardContent, Typography, Box, Chip, IconButton, Tooltip } from '@mui/material';
import { PlayArrow, CheckCircle, Error, Block, Schedule, PriorityHigh } from '@mui/icons-material';
import { Task } from '@/types';
import { format } from 'date-fns';
import { CollaborationIndicator } from './CollaborationIndicator';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  onExecute?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, onExecute }) => {
  const getStatusIcon = () => {
    switch (task.status) {
      case 'pending':
        return <Schedule fontSize="small" />;
      case 'assigned':
      case 'in_progress':
        return <PlayArrow fontSize="small" />;
      case 'completed':
        return <CheckCircle fontSize="small" />;
      case 'failed':
        return <Error fontSize="small" />;
      case 'blocked':
        return <Block fontSize="small" />;
    }
  };

  const getStatusColor = () => {
    switch (task.status) {
      case 'pending':
        return 'default';
      case 'assigned':
      case 'in_progress':
        return 'info';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'blocked':
        return 'warning';
    }
  };

  const getPriorityColor = () => {
    switch (task.priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'default';
    }
  };

  const getTypeColor = () => {
    const colors: Record<Task['type'], string> = {
      requirement: '#9C27B0',
      design: '#2196F3',
      implementation: '#4CAF50',
      test: '#FF9800',
      deployment: '#F44336',
      review: '#607D8B',
    };
    return colors[task.type];
  };

  return (
    <Card
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s',
        '&:hover': {
          transform: onClick ? 'translateY(-2px)' : 'none',
          boxShadow: onClick ? 3 : 1,
        },
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Typography variant="h6" component="div" sx={{ pr: 2 }}>
            {task.title}
          </Typography>
          <Box display="flex" gap={0.5}>
            <Chip
              icon={getStatusIcon()}
              label={task.status}
              color={getStatusColor()}
              size="small"
            />
            {task.status === 'pending' && onExecute && (
              <Tooltip title="Execute Task">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExecute();
                  }}
                >
                  <PlayArrow />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {task.description.length > 150
            ? task.description.substring(0, 150) + '...'
            : task.description}
        </Typography>

        <Box display="flex" gap={1} mb={2} flexWrap="wrap">
          <Chip
            label={task.type}
            size="small"
            sx={{
              bgcolor: getTypeColor(),
              color: 'white',
            }}
          />
          <Chip
            icon={<PriorityHigh fontSize="small" />}
            label={task.priority}
            color={getPriorityColor()}
            size="small"
          />
          {task.assignedAgent && (
            <Chip
              label={`Agent: ${task.assignedAgent}`}
              size="small"
              variant="outlined"
            />
          )}
          {task.metadata?.collaborationSessionId && (
            <CollaborationIndicator
              taskId={task.id}
              sessionId={task.metadata.collaborationSessionId}
              agentCount={task.metadata.collaborationAgents?.length}
              status={task.status === 'completed' ? 'completed' : 'executing'}
            />
          )}
        </Box>

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Created: {format(new Date(task.createdAt), 'MMM d, HH:mm')}
          </Typography>
          {task.completedAt && (
            <Typography variant="caption" color="text.secondary">
              Duration: {((new Date(task.completedAt).getTime() - new Date(task.startedAt!).getTime()) / 1000).toFixed(1)}s
            </Typography>
          )}
        </Box>

        {task.dependencies && task.dependencies.length > 0 && (
          <Box mt={1}>
            <Typography variant="caption" color="text.secondary">
              Dependencies: {task.dependencies.length}
            </Typography>
          </Box>
        )}

        {task.error && (
          <Box mt={2} p={1} bgcolor="error.light" borderRadius={1}>
            <Typography variant="caption" color="error.contrastText">
              Error: {task.error}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};