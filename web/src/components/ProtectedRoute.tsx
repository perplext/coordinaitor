import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Box, CircularProgress, Typography } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean; // For multiple permissions
  role?: string;
  fallback?: string; // Where to redirect if access denied
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  permission,
  permissions,
  requireAll = false,
  role,
  fallback = '/login',
}) => {
  const location = useLocation();
  const { isAuthenticated, user, hasPermission, hasRole, hasAnyPermission, hasAllPermissions } = useAuthStore();

  // If not authenticated, redirect to login
  if (!isAuthenticated || !user) {
    return <Navigate to={fallback} state={{ from: location }} replace />;
  }

  // Check role if specified
  if (role && !hasRole(role)) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: 2,
        }}
      >
        <Typography variant="h5" color="error">
          Access Denied
        </Typography>
        <Typography variant="body1" color="text.secondary">
          You don't have the required role to access this page.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Required role: {role}
        </Typography>
      </Box>
    );
  }

  // Check single permission if specified
  if (permission && !hasPermission(permission)) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: 2,
        }}
      >
        <Typography variant="h5" color="error">
          Access Denied
        </Typography>
        <Typography variant="body1" color="text.secondary">
          You don't have permission to access this page.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Required permission: {permission}
        </Typography>
      </Box>
    );
  }

  // Check multiple permissions if specified
  if (permissions && permissions.length > 0) {
    const hasAccess = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);

    if (!hasAccess) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: 2,
          }}
        >
          <Typography variant="h5" color="error">
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You don't have the required permissions to access this page.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Required permissions ({requireAll ? 'all' : 'any'}): {permissions.join(', ')}
          </Typography>
        </Box>
      );
    }
  }

  // User is authenticated and has required permissions
  return <>{children}</>;
};

// Higher-order component for easier use
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<ProtectedRouteProps, 'children'>
) {
  return (props: P) => (
    <ProtectedRoute {...options}>
      <Component {...props} />
    </ProtectedRoute>
  );
}