import type { AdminOverviewResponse } from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const adminApi = {
  overview: () =>
    api.get<AdminOverviewResponse>('/admin/overview').then((r) => r.data),
};
