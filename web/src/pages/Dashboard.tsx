import React from 'react';
import { Grid, Paper, Typography, Box, Card, CardContent } from '@mui/material';
import { Assignment, Memory, FolderOpen, CheckCircle, Error, HourglassEmpty } from '@mui/icons-material';
import { useStore } from '@/store/useStore';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export const Dashboard: React.FC = () => {
  const { agents, tasks, projects } = useStore();

  // Calculate statistics
  const stats = {
    totalAgents: agents.length,
    activeAgents: agents.filter(a => a.status.state === 'busy').length,
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.status === 'completed').length,
    failedTasks: tasks.filter(t => t.status === 'failed').length,
    pendingTasks: tasks.filter(t => t.status === 'pending').length,
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.status === 'active').length,
  };

  const taskStatusData = [
    { name: 'Completed', value: stats.completedTasks, color: '#4CAF50' },
    { name: 'Pending', value: stats.pendingTasks, color: '#2196F3' },
    { name: 'Failed', value: stats.failedTasks, color: '#F44336' },
    { name: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, color: '#FF9800' },
  ];

  const agentPerformanceData = agents.map(agent => ({
    name: agent.name.split(' ')[0],
    tasks: agent.status.totalTasksCompleted,
    successRate: agent.status.successRate,
  }));

  const StatCard = ({ icon, title, value, color }: any) => (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4">{value}</Typography>
          </Box>
          <Box sx={{ color }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={3}>
        {/* Statistics Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<Memory sx={{ fontSize: 40 }} />}
            title="Total Agents"
            value={stats.totalAgents}
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<Assignment sx={{ fontSize: 40 }} />}
            title="Total Tasks"
            value={stats.totalTasks}
            color="#2e7d32"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<CheckCircle sx={{ fontSize: 40 }} />}
            title="Completed Tasks"
            value={stats.completedTasks}
            color="#4caf50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<FolderOpen sx={{ fontSize: 40 }} />}
            title="Active Projects"
            value={stats.activeProjects}
            color="#ed6c02"
          />
        </Grid>

        {/* Task Status Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Task Status Distribution
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={taskStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {taskStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Agent Performance Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Agent Performance
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agentPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="tasks" fill="#8884d8" name="Tasks Completed" />
                <Bar yAxisId="right" dataKey="successRate" fill="#82ca9d" name="Success Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Tasks
            </Typography>
            <Box>
              {tasks.slice(0, 5).map((task) => (
                <Box
                  key={task.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    py: 1,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box display="flex" alignItems="center" gap={2}>
                    {task.status === 'completed' ? (
                      <CheckCircle color="success" />
                    ) : task.status === 'failed' ? (
                      <Error color="error" />
                    ) : (
                      <HourglassEmpty color="warning" />
                    )}
                    <Box>
                      <Typography variant="body1">{task.title}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        {task.type} • {task.priority} priority
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="caption" color="textSecondary">
                    {new Date(task.createdAt).toLocaleString()}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};