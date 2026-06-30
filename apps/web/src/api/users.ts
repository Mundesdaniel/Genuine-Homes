import type {
  AdminUpdateUserInput,
  Paginated,
  UpdateProfileInput,
  UserProfileResponse,
  UserRole,
} from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const usersApi = {
  me: () => api.get<UserProfileResponse>('/users/me').then((r) => r.data),
  updateMe: (input: UpdateProfileInput) =>
    api.patch<UserProfileResponse>('/users/me', input).then((r) => r.data),
  list: (page: number, pageSize: number, role?: UserRole) =>
    api
      .get<Paginated<UserProfileResponse>>('/users', {
        params: { page, pageSize, role },
      })
      .then((r) => r.data),
  adminUpdate: (id: string, input: AdminUpdateUserInput) =>
    api.patch<UserProfileResponse>(`/users/${id}`, input).then((r) => r.data),
};
