import { Chip, Tooltip, Box, Typography } from '@mui/material';
import { Group } from '@mui/icons-material';

interface CollaborationIndicatorProps {
  taskId?: string;
  sessionId?: string;
  agentCount?: number;
  strategy?: string;
  status?: string;
  size?: 'small' | 'medium';
}

export function CollaborationIndicator({
  taskId,
  sessionId,
  agentCount = 2,
  strategy = 'sequential',
  status = 'active',
  size = 'small'
}: CollaborationIndicatorProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'planning': return 'info';
      case 'executing': return 'primary';
      case 'reviewing': return 'warning';
      case 'completed': return 'success';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const getStrategyIcon = () => {
    switch (strategy) {
      case 'consensus': return '🤝';
      case 'parallel': return '⚡';
      case 'hierarchical': return '📊';
      default: return '🔄';
    }
  };

  if (!sessionId && !taskId) {
    return null;
  }

  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="body2" fontWeight="bold">
            Multi-Agent Collaboration
          </Typography>
          <Typography variant="caption" display="block">
            Strategy: {strategy}
          </Typography>
          <Typography variant="caption" display="block">
            Agents: {agentCount}
          </Typography>
          {sessionId && (
            <Typography variant="caption" display="block">
              Session: {sessionId.slice(0, 8)}...
            </Typography>
          )}
        </Box>
      }
    >
      <Chip
        icon={<Group />}
        label={`${getStrategyIcon()} ${agentCount} agents`}
        color={getStatusColor()}
        size={size}
        variant="outlined"
        sx={{
          '& .MuiChip-icon': {
            fontSize: size === 'small' ? '1rem' : '1.25rem'
          }
        }}
      />
    </Tooltip>
  );
}