import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Agents } from '@/pages/Agents';
import { Tasks } from '@/pages/Tasks';
import { Projects } from '@/pages/Projects';
import { ProjectDetail } from '@/pages/ProjectDetail';
import { TaskDetail } from '@/pages/TaskDetail';
import { socketService } from '@/services/socket';
import { useStore } from '@/store/useStore';
import { useAgents } from '@/hooks/useAgents';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { useSocketEvents } from '@/hooks/useSocketEvents';

function App() {
  const setConnected = useStore((state) => state.setConnected);
  
  // Initialize data fetching hooks
  useAgents();
  useTasks();
  useProjects();
  useSocketEvents();

  useEffect(() => {
    // Connect to WebSocket server
    socketService.connect();

    // Update connection status
    const unsubscribe = socketService.on('connected', (connected: boolean) => {
      setConnected(connected);
    });

    return () => {
      unsubscribe();
      socketService.disconnect();
    };
  }, [setConnected]);

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/tasks/:taskId" element={<TaskDetail />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />
        </Routes>
      </Layout>
    </Box>
  );
}

export default App;