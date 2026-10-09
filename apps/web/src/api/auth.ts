import type {
  AuthResponse,
  AuthUser,
  ForgotPasswordInput,
  LoginInput,
  RegisterRequest,
  ResetPasswordInput,
} from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const authApi = {
  login: (input: LoginInput) =>
    api.post<AuthResponse>('/auth/login', input).then((r) => r.data),
  register: (input: RegisterRequest) =>
    api.post<AuthResponse>('/auth/register', input).then((r) => r.data),
  me: () => api.get<AuthUser>('/auth/me').then((r) => r.data),
  /** The refresh token rides in the httpOnly cookie; the API also clears it. */
  logout: () => api.post('/auth/logout', {}).then((r) => r.data),
  forgotPassword: (input: ForgotPasswordInput) =>
    api.post<{ success: true }>('/auth/forgot-password', input).then((r) => r.data),
  resetPassword: (input: ResetPasswordInput) =>
    api.post<{ success: true }>('/auth/reset-password', input).then((r) => r.data),
};
