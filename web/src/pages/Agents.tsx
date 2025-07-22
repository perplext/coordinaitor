import React from 'react';
import { Grid, Typography, Box, Paper, Chip } from '@mui/material';
import { AgentCard } from '@/components/AgentCard';
import { useStore } from '@/store/useStore';

export const Agents: React.FC = () => {
  const agents = useStore((state) => state.agents);

  const agentsByStatus = {
    idle: agents.filter(a => a.status.state === 'idle'),
    busy: agents.filter(a => a.status.state === 'busy'),
    error: agents.filter(a => a.status.state === 'error'),
    offline: agents.filter(a => a.status.state === 'offline'),
  };

  const StatusSection = ({ title, agents, color }: { title: string; agents: any[]; color: any }) => (
    <Box mb={4}>
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <Typography variant="h6">{title}</Typography>
        <Chip label={agents.length} color={color} size="small" />
      </Box>
      {agents.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="textSecondary">No agents in this state</Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {agents.map((agent) => (
            <Grid item xs={12} sm={6} md={4} key={agent.id}>
              <AgentCard agent={agent} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Agents
      </Typography>

      <StatusSection
        title="Available Agents"
        agents={agentsByStatus.idle}
        color="success"
      />

      <StatusSection
        title="Busy Agents"
        agents={agentsByStatus.busy}
        color="warning"
      />

      <StatusSection
        title="Error State"
        agents={agentsByStatus.error}
        color="error"
      />

      <StatusSection
        title="Offline Agents"
        agents={agentsByStatus.offline}
        color="default"
      />
    </Box>
  );
};