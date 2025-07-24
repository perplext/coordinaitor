import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { authService } from '../services/authService';
import { User, LoginCredentials, RegisterData } from '../types/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  loginWithSSO: (provider: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await getStoredToken();
      if (token) {
        const userData = await authService.getCurrentUser();
        setUser(userData);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      await clearAuthData();
    } finally {
      setIsLoading(false);
    }
  };

  const getStoredToken = async (): Promise<string | null> => {
    try {
      // Try to get from Keychain first (more secure)
      const credentials = await Keychain.getInternetCredentials('orchestrator-api');
      if (credentials) {
        return credentials.password;
      }
      // Fallback to AsyncStorage
      return await AsyncStorage.getItem('authToken');
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  };

  const storeToken = async (token: string) => {
    try {
      // Store in Keychain for security
      await Keychain.setInternetCredentials(
        'orchestrator-api',
        'token',
        token
      );
      // Also store in AsyncStorage as backup
      await AsyncStorage.setItem('authToken', token);
    } catch (error) {
      console.error('Failed to store token:', error);
    }
  };

  const clearAuthData = async () => {
    try {
      await Keychain.resetInternetCredentials('orchestrator-api');
      await AsyncStorage.multiRemove(['authToken', 'user']);
      setUser(null);
    } catch (error) {
      console.error('Failed to clear auth data:', error);
    }
  };

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const response = await authService.login(credentials);
      const { user, token } = response;
      
      await storeToken(token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      setUser(user);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithSSO = async (provider: string) => {
    setIsLoading(true);
    try {
      const response = await authService.loginWithSSO(provider);
      const { user, token } = response;
      
      await storeToken(token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      setUser(user);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    setIsLoading(true);
    try {
      const response = await authService.register(data);
      const { user, token } = response;
      
      await storeToken(token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      setUser(user);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      await clearAuthData();
    } catch (error) {
      console.error('Logout failed:', error);
      // Clear local data even if API call fails
      await clearAuthData();
    } finally {
      setIsLoading(false);
    }
  };

  const refreshToken = async () => {
    try {
      const currentToken = await getStoredToken();
      if (!currentToken) throw new Error('No token found');
      
      const response = await authService.refreshToken(currentToken);
      await storeToken(response.token);
      setUser(response.user);
    } catch (error) {
      console.error('Token refresh failed:', error);
      await logout();
      throw error;
    }
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    loginWithSSO,
    register,
    logout,
    refreshToken,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};