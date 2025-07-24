import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/services/api';

interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  roles: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  permissions: Array<{
    id: string;
    resource: string;
    action: string;
  }>;
  isActive: boolean;
  lastLogin?: Date;
  metadata?: {
    onboarding?: {
      completedAt?: string;
      currentStep?: string;
      completedSteps?: string[];
    };
    profileCompleted?: boolean;
    [key: string]: any;
  };
}

interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

interface AuthState {
  user: User | null;
  token: AuthToken | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  
  // Actions
  login: (username: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  checkAuth: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (roleId: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  updateUser: (user: User) => void;
  needsOnboarding: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loading: false,
      error: null,
      isAuthenticated: false,

      login: async (username: string, password: string) => {
        set({ loading: true, error: null });
        try {
          const response = await api.post('/auth/login', { username, password });
          const { user, token } = response.data;
          
          // Set auth header for future requests
          api.defaults.headers.common['Authorization'] = `Bearer ${token.accessToken}`;
          
          set({ 
            user, 
            token, 
            isAuthenticated: true, 
            loading: false,
            error: null 
          });
        } catch (error: any) {
          set({ 
            loading: false, 
            error: error.response?.data?.error || 'Login failed',
            isAuthenticated: false 
          });
          throw error;
        }
      },

      register: async (data) => {
        set({ loading: true, error: null });
        try {
          const response = await api.post('/auth/register', data);
          const { user, token } = response.data;
          
          // Set auth header for future requests
          api.defaults.headers.common['Authorization'] = `Bearer ${token.accessToken}`;
          
          set({ 
            user, 
            token, 
            isAuthenticated: true, 
            loading: false,
            error: null 
          });
        } catch (error: any) {
          set({ 
            loading: false, 
            error: error.response?.data?.error || 'Registration failed' 
          });
          throw error;
        }
      },

      logout: () => {
        // Clear auth header
        delete api.defaults.headers.common['Authorization'];
        
        set({ 
          user: null, 
          token: null, 
          isAuthenticated: false,
          error: null 
        });
      },

      refreshToken: async () => {
        const currentToken = get().token;
        if (!currentToken) return;

        try {
          const response = await api.post('/auth/refresh', { 
            refreshToken: currentToken.refreshToken 
          });
          const { token } = response.data;
          
          // Update auth header
          api.defaults.headers.common['Authorization'] = `Bearer ${token.accessToken}`;
          
          set({ token });
        } catch (error) {
          // If refresh fails, logout
          get().logout();
          throw error;
        }
      },

      updateProfile: async (data) => {
        set({ loading: true, error: null });
        try {
          const response = await api.put('/auth/me', data);
          const { user } = response.data;
          set({ user, loading: false });
        } catch (error: any) {
          set({ 
            loading: false, 
            error: error.response?.data?.error || 'Update failed' 
          });
          throw error;
        }
      },

      changePassword: async (oldPassword: string, newPassword: string) => {
        set({ loading: true, error: null });
        try {
          await api.post('/auth/me/change-password', { oldPassword, newPassword });
          set({ loading: false });
        } catch (error: any) {
          set({ 
            loading: false, 
            error: error.response?.data?.error || 'Password change failed' 
          });
          throw error;
        }
      },

      checkAuth: async () => {
        const token = get().token;
        if (!token) {
          set({ isAuthenticated: false });
          return;
        }

        // Set auth header
        api.defaults.headers.common['Authorization'] = `Bearer ${token.accessToken}`;

        try {
          const response = await api.get('/auth/me');
          const { user } = response.data;
          set({ user, isAuthenticated: true });
        } catch (error) {
          // Token might be expired
          get().logout();
        }
      },

      hasPermission: (permission: string) => {
        const user = get().user;
        if (!user) return false;
        
        // Admin has all permissions
        if (user.roles.some(r => r.id === 'admin')) return true;
        
        // Check if user has specific permission
        return user.permissions.some(p => p.id === permission || p.id === '*:*');
      },

      hasRole: (roleId: string) => {
        const user = get().user;
        if (!user) return false;
        return user.roles.some(r => r.id === roleId);
      },

      hasAnyPermission: (permissions: string[]) => {
        return permissions.some(p => get().hasPermission(p));
      },

      hasAllPermissions: (permissions: string[]) => {
        return permissions.every(p => get().hasPermission(p));
      },

      updateUser: (user: User) => {
        set({ user });
      },

      needsOnboarding: () => {
        const user = get().user;
        if (!user) return false;
        
        // Check if user has completed onboarding
        const onboarding = user.metadata?.onboarding;
        return !onboarding?.completedAt;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token,
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);

// Initialize auth on app load
if (typeof window !== 'undefined') {
  useAuthStore.getState().checkAuth();
}