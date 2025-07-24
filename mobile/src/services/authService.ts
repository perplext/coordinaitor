import axios from 'axios';
import { API_BASE_URL } from '../constants/config';
import { LoginCredentials, RegisterData, AuthResponse, User } from '../types/auth';

class AuthService {
  private baseURL = `${API_BASE_URL}/auth`;

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await axios.post(`${this.baseURL}/login`, credentials);
    return response.data;
  }

  async loginWithSSO(provider: string): Promise<string> {
    const response = await axios.get(`${this.baseURL}/sso/${provider}/init`, {
      params: { mobile: true },
    });
    return response.data.authUrl;
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await axios.post(`${this.baseURL}/register`, data);
    return response.data;
  }

  async logout(): Promise<void> {
    await axios.post(`${this.baseURL}/logout`);
  }

  async refreshToken(token: string): Promise<AuthResponse> {
    const response = await axios.post(`${this.baseURL}/refresh`, { token });
    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    const response = await axios.get(`${this.baseURL}/me`);
    return response.data;
  }

  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const response = await axios.patch(`${this.baseURL}/users/${userId}`, updates);
    return response.data;
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await axios.post(`${this.baseURL}/change-password`, {
      oldPassword,
      newPassword,
    });
  }

  async requestPasswordReset(email: string): Promise<void> {
    await axios.post(`${this.baseURL}/forgot-password`, { email });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await axios.post(`${this.baseURL}/reset-password`, {
      token,
      newPassword,
    });
  }
}

export const authService = new AuthService();