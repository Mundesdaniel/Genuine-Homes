import type {
  ApproveSubscriptionRequestInput,
  CreateSubscriptionRequestInput,
  Paginated,
  RecordSubscriptionPaymentInput,
  SubscriptionRequestResponse,
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

  // ── Subscription requests ──────────────────────────────────────────────────
  /** User: request to subscribe as an AirBnB agent. */
  request: (input: CreateSubscriptionRequestInput) =>
    api
      .post<SubscriptionRequestResponse>('/subscriptions/requests', input)
      .then((r) => r.data),
  /** User: your latest request (or null). */
  myRequest: () =>
    api
      .get<SubscriptionRequestResponse | null>('/subscriptions/requests/mine')
      .then((r) => r.data),
  /** Admin: list pending requests. */
  listRequests: (page = 1, pageSize = 100) =>
    api
      .get<Paginated<SubscriptionRequestResponse>>('/subscriptions/requests', {
        params: { page, pageSize },
      })
      .then((r) => r.data),
  /** Admin: approve a request (records subscription + grants role). */
  approveRequest: (id: string, input: ApproveSubscriptionRequestInput) =>
    api
      .post<SubscriptionResponse>(`/subscriptions/requests/${id}/approve`, input)
      .then((r) => r.data),
  /** Admin: decline a request. */
  declineRequest: (id: string) =>
    api
      .post<SubscriptionRequestResponse>(`/subscriptions/requests/${id}/decline`, {})
      .then((r) => r.data),
};
