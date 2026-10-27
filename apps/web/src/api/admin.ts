import type {
  AdminAgentPerformanceRow,
  AdminDealRow,
  AdminOverviewResponse,
  AdminPropertyRow,
  Paginated,
} from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const adminApi = {
  overview: () => api.get<AdminOverviewResponse>('/admin/overview').then((r) => r.data),

  /** All properties with the agent who added each. */
  properties: (page = 1, pageSize = 50) =>
    api
      .get<Paginated<AdminPropertyRow>>('/admin/properties', { params: { page, pageSize } })
      .then((r) => r.data),

  /** Successful deals (rental/installment/purchase) with agent + client. */
  deals: (page = 1, pageSize = 50) =>
    api
      .get<Paginated<AdminDealRow>>('/admin/deals', { params: { page, pageSize } })
      .then((r) => r.data),

  /** Per-agent rollup: properties added + successful deals. */
  agents: () => api.get<AdminAgentPerformanceRow[]>('/admin/agents').then((r) => r.data),
};
