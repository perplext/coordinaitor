import React from 'react';
import { Card, CardContent, Typography, Box, Chip, LinearProgress, Avatar } from '@mui/material';
import { Memory, CheckCircle, Error, OfflinePin, HourglassEmpty } from '@mui/icons-material';
import { Agent } from '@/types';

interface AgentCardProps {
  agent: Agent;
  onClick?: () => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onClick }) => {
  const getStatusIcon = () => {
    switch (agent.status.state) {
      case 'idle':
        return <CheckCircle color="success" />;
      case 'busy':
        return <HourglassEmpty color="warning" />;
      case 'error':
        return <Error color="error" />;
      case 'offline':
        return <OfflinePin color="disabled" />;
    }
  };

  const getStatusColor = () => {
    switch (agent.status.state) {
      case 'idle':
        return 'success';
      case 'busy':
        return 'warning';
      case 'error':
        return 'error';
      case 'offline':
        return 'default';
    }
  };

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      anthropic: '#8B5CF6',
      google: '#4285F4',
      openai: '#10A37F',
      aws: '#FF9900',
      azure: '#0078D4',
    };
    return colors[provider] || '#666';
  };

  return (
    <Card
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s',
        '&:hover': {
          transform: onClick ? 'translateY(-4px)' : 'none',
          boxShadow: onClick ? 4 : 1,
        },
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ bgcolor: getProviderColor(agent.provider) }}>
              <Memory />
            </Avatar>
            <Box>
              <Typography variant="h6" component="div">
                {agent.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {agent.provider} • v{agent.version}
              </Typography>
            </Box>
          </Box>
          <Chip
            icon={getStatusIcon()}
            label={agent.status.state.toUpperCase()}
            color={getStatusColor()}
            size="small"
          />
        </Box>

        <Box mb={2}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Performance
          </Typography>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Typography variant="body2" sx={{ minWidth: 100 }}>
              Success Rate
            </Typography>
            <Box sx={{ flexGrow: 1 }}>
              <LinearProgress
                variant="determinate"
                value={agent.status.successRate}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
            <Typography variant="body2" sx={{ minWidth: 40, textAlign: 'right' }}>
              {agent.status.successRate.toFixed(0)}%
            </Typography>
          </Box>
        </Box>

        <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
          {agent.capabilities.slice(0, 3).map((cap) => (
            <Chip
              key={cap.name}
              label={cap.name}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
          ))}
          {agent.capabilities.length > 3 && (
            <Chip
              label={`+${agent.capabilities.length - 3} more`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
          )}
        </Box>

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">
            {agent.status.totalTasksCompleted} tasks completed
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ~{(agent.status.averageResponseTime / 1000).toFixed(1)}s avg
          </Typography>
        </Box>

        {agent.status.currentTask && (
          <Box mt={2} p={1} bgcolor="action.hover" borderRadius={1}>
            <Typography variant="caption" color="text.secondary">
              Current Task: {agent.status.currentTask}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};