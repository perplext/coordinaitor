import axios, { AxiosError, AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { API_BASE_URL, TIMEOUTS, STORAGE_KEYS } from '../constants/config';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUTS.apiRequest,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

const getAuthToken = async (): Promise<string | null> => {
  try {
    const credentials = await Keychain.getInternetCredentials('orchestrator-api');
    if (credentials) {
      return credentials.password;
    }
    return await AsyncStorage.getItem(STORAGE_KEYS.authToken);
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
};

const refreshAuthToken = async (): Promise<string | null> => {
  try {
    const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.refreshToken);
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refreshToken,
    });

    const { token, refreshToken: newRefreshToken } = response.data;

    // Store new tokens
    await Keychain.setInternetCredentials('orchestrator-api', 'token', token);
    await AsyncStorage.setItem(STORAGE_KEYS.authToken, token);
    if (newRefreshToken) {
      await AsyncStorage.setItem(STORAGE_KEYS.refreshToken, newRefreshToken);
    }

    return token;
  } catch (error) {
    console.error('Failed to refresh token:', error);
    // Clear auth data on refresh failure
    await Keychain.resetInternetCredentials('orchestrator-api');
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.authToken,
      STORAGE_KEYS.refreshToken,
      STORAGE_KEYS.user,
    ]);
    throw error;
  }
};

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest: any = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      return new Promise((resolve, reject) => {
        refreshAuthToken()
          .then((newToken) => {
            api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            processQueue(null, newToken);
            resolve(api(originalRequest));
          })
          .catch((err) => {
            processQueue(err, null);
            reject(err);
          })
          .finally(() => {
            isRefreshing = false;
          });
      });
    }

    return Promise.reject(error);
  }
);

export const setupAxiosInterceptors = () => {
  // Additional setup if needed
};

export default api;