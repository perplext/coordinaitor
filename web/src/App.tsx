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
import { Analytics } from '@/pages/Analytics';
import { LoginForm } from '@/components/LoginForm';
import { RegisterForm } from '@/components/RegisterForm';
import { UserProfile } from '@/components/UserProfile';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { socketService } from '@/services/socket';
import { useStore } from '@/store/useStore';
import { useAuthStore } from '@/store/authStore';
import { useAgents } from '@/hooks/useAgents';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import { useSocketEvents } from '@/hooks/useSocketEvents';

function App() {
  const setConnected = useStore((state) => state.setConnected);
  const { isAuthenticated } = useAuthStore();
  
  // Initialize data fetching hooks only when authenticated
  if (isAuthenticated) {
    useAgents();
    useTasks();
    useProjects();
    useSocketEvents();
  }

  useEffect(() => {
    if (isAuthenticated) {
      // Connect to WebSocket server only when authenticated
      socketService.connect();

      // Update connection status
      const unsubscribe = socketService.on('connected', (connected: boolean) => {
        setConnected(connected);
      });

      return () => {
        unsubscribe();
        socketService.disconnect();
      };
    }
  }, [setConnected, isAuthenticated]);

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginForm />} />
        <Route path="/register" element={<RegisterForm />} />
        
        {/* Protected routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route 
                    path="/agents" 
                    element={
                      <ProtectedRoute permission="agents:read">
                        <Agents />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/tasks" 
                    element={
                      <ProtectedRoute permission="tasks:read">
                        <Tasks />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/tasks/:taskId" 
                    element={
                      <ProtectedRoute permission="tasks:read">
                        <TaskDetail />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/projects" 
                    element={
                      <ProtectedRoute permission="projects:read">
                        <Projects />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/projects/:projectId" 
                    element={
                      <ProtectedRoute permission="projects:read">
                        <ProjectDetail />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/analytics" 
                    element={
                      <ProtectedRoute permission="analytics:read">
                        <Analytics />
                      </ProtectedRoute>
                    } 
                  />
                  <Route path="/profile" element={<UserProfile />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Box>
  );
}

export default App;