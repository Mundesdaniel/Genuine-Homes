import type {
  Paginated,
  RecordSubscriptionPaymentInput,
  ShortLetDashboardResponse,
  SubscriptionResponse,
} from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const subscriptionsApi = {
  /** The current user's subscription, or null. Used by the client-side guard. */
  mine: () => api.get<SubscriptionResponse | null>('/subscriptions/me').then((r) => r.data),
  /** Admin: list all subscriptions. */
  list: (page = 1, pageSize = 100) =>
    api
      .get<Paginated<SubscriptionResponse>>('/subscriptions', { params: { page, pageSize } })
      .then((r) => r.data),
  /** Admin: record a cash payment and activate a subscription. */
  record: (input: RecordSubscriptionPaymentInput) =>
    api.post<SubscriptionResponse>('/subscriptions', input).then((r) => r.data),
  /** Admin: cancel a subscription. */
  cancel: (id: string) =>
    api.post<SubscriptionResponse>(`/subscriptions/${id}/cancel`, {}).then((r) => r.data),
  /** Short-let dashboard (requires airbnb_agent role + active subscription). */
  shortLetDashboard: () =>
    api.get<ShortLetDashboardResponse>('/short-let/dashboard').then((r) => r.data),
};
