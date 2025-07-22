import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Tab,
  Tabs,
  Chip,
  LinearProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Speed,
  Timer,
  TrendingUp,
  Warning,
  Info,
  AttachMoney,
  Group,
  Assignment,
  Folder,
} from '@mui/icons-material';
import { api } from '@/services/api';
import {
  MetricSnapshot,
  AgentMetrics,
  ProjectMetrics,
  TaskMetrics,
  CostMetrics,
  PerformanceInsight,
} from '@/types';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  
  const [snapshot, setSnapshot] = useState<MetricSnapshot | null>(null);
  const [agentMetrics, setAgentMetrics] = useState<AgentMetrics[]>([]);
  const [projectMetrics, setProjectMetrics] = useState<ProjectMetrics[]>([]);
  const [taskMetrics, setTaskMetrics] = useState<TaskMetrics | null>(null);
  const [costMetrics, setCostMetrics] = useState<CostMetrics | null>(null);
  const [insights, setInsights] = useState<PerformanceInsight[]>([]);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [
        snapshotRes,
        agentsRes,
        projectsRes,
        tasksRes,
        costsRes,
        insightsRes,
      ] = await Promise.all([
        apiService.getAnalyticsSnapshot(),
        apiService.getAgentAnalytics(),
        apiService.getProjectAnalytics(),
        apiService.getTaskAnalytics(),
        apiService.getCostAnalytics(),
        apiService.getPerformanceInsights(),
      ]);

      setSnapshot(snapshotRes);
      setAgentMetrics(agentsRes.metrics);
      setProjectMetrics(projectsRes.metrics);
      setTaskMetrics(tasksRes);
      setCostMetrics(costsRes);
      setInsights(insightsRes.insights);
      setError(null);
    } catch (err) {
      setError('Failed to fetch analytics data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading && !snapshot) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Analytics Dashboard
      </Typography>

      {/* Overview Cards */}
      {snapshot && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Active Agents
                    </Typography>
                    <Typography variant="h4">
                      {snapshot.agents.active}/{snapshot.agents.total}
                    </Typography>
                  </Box>
                  <Group fontSize="large" color="primary" />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Task Success Rate
                    </Typography>
                    <Typography variant="h4">
                      {snapshot.tasks.successRate.toFixed(1)}%
                    </Typography>
                  </Box>
                  <CheckCircle fontSize="large" color="success" />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Active Projects
                    </Typography>
                    <Typography variant="h4">
                      {snapshot.projects.active}
                    </Typography>
                  </Box>
                  <Folder fontSize="large" color="primary" />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      Avg Response Time
                    </Typography>
                    <Typography variant="h4">
                      {(snapshot.tasks.averageDuration / 1000).toFixed(1)}s
                    </Typography>
                  </Box>
                  <Timer fontSize="large" color="primary" />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Performance Insights */}
      {insights.length > 0 && (
        <Paper sx={{ mb: 3, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Performance Insights
          </Typography>
          <List>
            {insights.map((insight, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  {insight.type === 'warning' && <Warning color="warning" />}
                  {insight.type === 'success' && <CheckCircle color="success" />}
                  {insight.type === 'info' && <Info color="info" />}
                </ListItemIcon>
                <ListItemText
                  primary={insight.title}
                  secondary={insight.message}
                />
                {insight.metric && (
                  <Chip label={`${insight.metric.toFixed(1)}%`} size="small" />
                )}
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Tabbed Content */}
      <Paper>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="analytics tabs">
          <Tab label="Agents" />
          <Tab label="Tasks" />
          <Tab label="Projects" />
          <Tab label="Costs" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {/* Agent Metrics */}
          <Grid container spacing={3}>
            {agentMetrics.map((agent) => (
              <Grid item xs={12} md={6} key={agent.agentId}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {agent.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      {agent.provider}
                    </Typography>
                    
                    <Box sx={{ mt: 2 }}>
                      <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2">Success Rate</Typography>
                        <Typography variant="body2">
                          {agent.successRate.toFixed(1)}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={agent.successRate}
                        color={agent.successRate > 80 ? 'success' : 'warning'}
                      />
                    </Box>

                    <Grid container spacing={2} sx={{ mt: 2 }}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">
                          Tasks Completed
                        </Typography>
                        <Typography variant="h6">{agent.tasksCompleted}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">
                          Avg Response Time
                        </Typography>
                        <Typography variant="h6">
                          {(agent.averageResponseTime / 1000).toFixed(1)}s
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">
                          Utilization
                        </Typography>
                        <Typography variant="h6">
                          {agent.utilizationRate.toFixed(0)}%
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">
                          Total Cost
                        </Typography>
                        <Typography variant="h6">
                          ${agent.totalCost.toFixed(2)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {/* Task Metrics */}
          {taskMetrics && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Tasks by Type
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(taskMetrics.byType).map(([type, data]) => ({
                        name: type,
                        value: data.count,
                      }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label
                    >
                      {Object.entries(taskMetrics.byType).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Tasks by Priority
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={Object.entries(taskMetrics.byPriority).map(([priority, data]) => ({
                      priority,
                      count: data.count,
                      successRate: data.successRate,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="priority" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#8884d8" />
                    <Bar dataKey="successRate" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Task Timeline (Last 30 Days)
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={taskMetrics.timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => new Date(date).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(date) => new Date(date).toLocaleDateString()}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      stroke="#82ca9d"
                      name="Completed"
                    />
                    <Line
                      type="monotone"
                      dataKey="failed"
                      stroke="#ff7979"
                      name="Failed"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Grid>
            </Grid>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {/* Project Metrics */}
          <Grid container spacing={3}>
            {projectMetrics.map((project) => (
              <Grid item xs={12} key={project.projectId}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6">{project.name}</Typography>
                      <Chip
                        label={project.status}
                        color={project.status === 'active' ? 'primary' : 'default'}
                        size="small"
                      />
                    </Box>

                    <Box sx={{ mb: 2 }}>
                      <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2">Progress</Typography>
                        <Typography variant="body2">
                          {project.progressPercentage.toFixed(0)}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={project.progressPercentage}
                      />
                    </Box>

                    <Grid container spacing={2}>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="textSecondary">
                          Total Tasks
                        </Typography>
                        <Typography variant="h6">{project.tasksTotal}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="textSecondary">
                          Completed
                        </Typography>
                        <Typography variant="h6" color="success.main">
                          {project.tasksCompleted}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="textSecondary">
                          Velocity
                        </Typography>
                        <Typography variant="h6">
                          {project.velocity.toFixed(1)} tasks/day
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="textSecondary">
                          Est. Completion
                        </Typography>
                        <Typography variant="h6">
                          {project.estimatedCompletion
                            ? new Date(project.estimatedCompletion).toLocaleDateString()
                            : 'N/A'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          {/* Cost Metrics */}
          {costMetrics && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Total Cost
                    </Typography>
                    <Typography variant="h3" color="primary">
                      ${costMetrics.totalCost.toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                      Projected Monthly: ${costMetrics.projectedMonthlyCost.toFixed(2)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={8}>
                <Typography variant="h6" gutterBottom>
                  Cost Trend (Last 30 Days)
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={costMetrics.costByDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => new Date(date).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(date) => new Date(date).toLocaleDateString()}
                      formatter={(value: number) => `$${value.toFixed(2)}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="cost"
                      stroke="#8884d8"
                      name="Daily Cost"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Cost by Agent
                </Typography>
                <List>
                  {Object.entries(costMetrics.costByAgent).map(([agentId, cost]) => {
                    const agent = agentMetrics.find((a) => a.agentId === agentId);
                    return (
                      <ListItem key={agentId}>
                        <ListItemText
                          primary={agent?.name || agentId}
                          secondary={agent?.provider}
                        />
                        <Typography variant="h6">${cost.toFixed(2)}</Typography>
                      </ListItem>
                    );
                  })}
                </List>
              </Grid>
            </Grid>
          )}
        </TabPanel>
      </Paper>
    </Box>
  );
}