import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Tooltip,
  Badge,
  Stack,
} from '@mui/material';
import {
  Speed,
  Warning,
  CheckCircle,
  Edit,
  Refresh,
  TrendingUp,
  TrendingDown,
  Queue,
  Bolt,
  Schedule,
} from '@mui/icons-material';
import { api } from '@/services/api';
import { toast } from 'react-hot-toast';
import { logger } from '@/utils/logger';

interface AgentCapacityInfo {
  agentId: string;
  maxConcurrentTasks: number;
  currentTasks: string[];
  queuedTasks: string[];
  totalProcessed: number;
  averageTaskDuration: number;
  lastTaskCompletedAt?: string;
  utilizationPercentage: number;
}

interface CapacityMetrics {
  totalCapacity: number;
  usedCapacity: number;
  availableCapacity: number;
  queuedTasks: number;
  agentUtilization: Record<string, number>;
  bottleneckAgents: string[];
  underutilizedAgents: string[];
}

interface LoadBalancingRecommendations {
  scaleUp: string[];
  scaleDown: string[];
  redistribute: Array<{
    from: string;
    to: string;
    taskCount: number;
  }>;
}

export const AgentCapacity: React.FC = () => {
  const [metrics, setMetrics] = useState<CapacityMetrics | null>(null);
  const [agentCapacities, setAgentCapacities] = useState<Map<string, AgentCapacityInfo>>(new Map());
  const [recommendations, setRecommendations] = useState<LoadBalancingRecommendations | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [newCapacity, setNewCapacity] = useState<number>(1);

  useEffect(() => {
    fetchCapacityData();
    const interval = setInterval(fetchCapacityData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchCapacityData = async () => {
    try {
      const [metricsRes, recommendationsRes] = await Promise.all([
        api.get('/capacity/metrics'),
        api.get('/capacity/recommendations')
      ]);

      setMetrics(metricsRes.data.metrics);
      setRecommendations(recommendationsRes.data.recommendations);

      // Fetch individual agent capacities
      const agentIds = Object.keys(metricsRes.data.metrics.agentUtilization);
      const capacityPromises = agentIds.map(id => 
        api.get(`/capacity/agents/${id}`)
      );
      
      const capacityResponses = await Promise.all(capacityPromises);
      const newCapacities = new Map<string, AgentCapacityInfo>();
      
      capacityResponses.forEach((res, index) => {
        if (res.data.success) {
          newCapacities.set(agentIds[index], res.data.capacity);
        }
      });
      
      setAgentCapacities(newCapacities);
    } catch (error) {
      logger.error('Failed to fetch capacity data', error);
      toast.error('Failed to fetch capacity data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCapacity = async () => {
    if (!selectedAgent) return;

    try {
      await api.put(`/capacity/agents/${selectedAgent}`, {
        maxConcurrentTasks: newCapacity
      });
      
      toast.success('Agent capacity updated successfully');
      setEditDialogOpen(false);
      fetchCapacityData();
    } catch (error) {
      logger.error('Failed to update agent capacity', error);
      toast.error('Failed to update agent capacity');
    }
  };

  const handleRebalance = async () => {
    try {
      await api.post('/capacity/rebalance');
      toast.success('Task rebalancing initiated');
      fetchCapacityData();
    } catch (error) {
      logger.error('Failed to rebalance tasks', error);
      toast.error('Failed to rebalance tasks');
    }
  };

  const openEditDialog = (agentId: string) => {
    setSelectedAgent(agentId);
    const capacity = agentCapacities.get(agentId);
    if (capacity) {
      setNewCapacity(capacity.maxConcurrentTasks);
    }
    setEditDialogOpen(true);
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 80) return 'error';
    if (utilization >= 60) return 'warning';
    if (utilization >= 20) return 'success';
    return 'info';
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <Typography>Loading capacity data...</Typography>
      </Box>
    );
  }

  if (!metrics) {
    return (
      <Alert severity="error">
        <AlertTitle>Error</AlertTitle>
        Failed to load capacity data
      </Alert>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Agent Capacity Management
        </Typography>
        <Box display="flex" gap={1}>
          <IconButton onClick={fetchCapacityData} color="primary">
            <Refresh />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<Bolt />}
            onClick={handleRebalance}
            disabled={metrics.queuedTasks === 0}
          >
            Rebalance Tasks
          </Button>
        </Box>
      </Box>

      {/* Overall Metrics */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Total Capacity
                  </Typography>
                  <Typography variant="h4">
                    {metrics.totalCapacity}
                  </Typography>
                </Box>
                <Speed color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Used Capacity
                  </Typography>
                  <Typography variant="h4">
                    {metrics.usedCapacity}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(metrics.usedCapacity / metrics.totalCapacity) * 100}
                    sx={{ mt: 1 }}
                  />
                </Box>
                <CheckCircle color="success" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Available
                  </Typography>
                  <Typography variant="h4">
                    {metrics.availableCapacity}
                  </Typography>
                </Box>
                <TrendingUp color="info" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    Queued Tasks
                  </Typography>
                  <Typography variant="h4">
                    {metrics.queuedTasks}
                  </Typography>
                </Box>
                <Badge badgeContent={metrics.queuedTasks} color="warning">
                  <Queue />
                </Badge>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Alerts */}
      {metrics.bottleneckAgents.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>Bottleneck Detected</AlertTitle>
          Agents at high capacity: {metrics.bottleneckAgents.join(', ')}
        </Alert>
      )}

      {/* Agent Details */}
      <Typography variant="h5" gutterBottom>
        Agent Details
      </Typography>
      <Grid container spacing={2}>
        {Array.from(agentCapacities.entries()).map(([agentId, capacity]) => {
          const utilization = metrics.agentUtilization[agentId] || 0;
          const isBottleneck = metrics.bottleneckAgents.includes(agentId);
          const isUnderutilized = metrics.underutilizedAgents.includes(agentId);

          return (
            <Grid item xs={12} md={6} key={agentId}>
              <Paper elevation={2} sx={{ p: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="h6">{agentId}</Typography>
                    {isBottleneck && (
                      <Chip label="Bottleneck" color="error" size="small" icon={<Warning />} />
                    )}
                    {isUnderutilized && (
                      <Chip label="Underutilized" color="info" size="small" icon={<TrendingDown />} />
                    )}
                  </Box>
                  <IconButton size="small" onClick={() => openEditDialog(agentId)}>
                    <Edit />
                  </IconButton>
                </Box>

                <Box mb={2}>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      Utilization
                    </Typography>
                    <Typography variant="body2">
                      {capacity.currentTasks.length}/{capacity.maxConcurrentTasks} tasks
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={utilization}
                    color={getUtilizationColor(utilization) as any}
                    sx={{ height: 10, borderRadius: 5 }}
                  />
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Stack spacing={1}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Total Processed
                        </Typography>
                        <Typography variant="body1">
                          {capacity.totalProcessed}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Avg Duration
                        </Typography>
                        <Typography variant="body1">
                          {formatDuration(capacity.averageTaskDuration)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>
                  <Grid item xs={6}>
                    <Stack spacing={1}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Queued
                        </Typography>
                        <Typography variant="body1">
                          {capacity.queuedTasks.length} tasks
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Last Activity
                        </Typography>
                        <Typography variant="body1">
                          {capacity.lastTaskCompletedAt
                            ? new Date(capacity.lastTaskCompletedAt).toLocaleTimeString()
                            : 'N/A'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      {/* Recommendations */}
      {recommendations && (
        <Box mt={4}>
          <Typography variant="h5" gutterBottom>
            Load Balancing Recommendations
          </Typography>
          <Grid container spacing={2}>
            {recommendations.scaleUp.length > 0 && (
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      <TrendingUp /> Scale Up
                    </Typography>
                    <List dense>
                      {recommendations.scaleUp.map(agentId => (
                        <ListItem key={agentId}>
                          <ListItemText primary={agentId} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {recommendations.scaleDown.length > 0 && (
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      <TrendingDown /> Scale Down
                    </Typography>
                    <List dense>
                      {recommendations.scaleDown.map(agentId => (
                        <ListItem key={agentId}>
                          <ListItemText primary={agentId} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {recommendations.redistribute.length > 0 && (
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      <Refresh /> Redistribute Tasks
                    </Typography>
                    <List dense>
                      {recommendations.redistribute.map((item, index) => (
                        <ListItem key={index}>
                          <ListItemText
                            primary={`${item.taskCount} tasks`}
                            secondary={`${item.from} → ${item.to}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Update Agent Capacity</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Agent: {selectedAgent}
          </Typography>
          <TextField
            fullWidth
            type="number"
            label="Max Concurrent Tasks"
            value={newCapacity}
            onChange={(e) => setNewCapacity(parseInt(e.target.value) || 1)}
            inputProps={{ min: 1, max: 100 }}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateCapacity} variant="contained">
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};