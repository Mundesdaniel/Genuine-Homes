import type {
  CashPaymentToConfirm,
  EarningsResponse,
  Paginated,
  PaymentResponse,
} from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const paymentsApi = {
  mine: (page = 1, pageSize = 100) =>
    api
      .get<Paginated<PaymentResponse>>('/payments/mine', {
        params: { page, pageSize },
      })
      .then((r) => r.data),
  /** Seller income received across their listings. */
  earnings: () => api.get<EarningsResponse>('/payments/earnings').then((r) => r.data),
  /** Pending cash payments awaiting the owner's confirmation. */
  incomingCash: () =>
    api.get<CashPaymentToConfirm[]>('/payments/incoming-cash').then((r) => r.data),
  /** Owner confirms a cash payment was received in person. */
  confirmCash: (id: string) =>
    api.post<PaymentResponse>(`/payments/${id}/confirm-cash`, {}).then((r) => r.data),
  get: (id: string) => api.get<PaymentResponse>(`/payments/${id}`).then((r) => r.data),
};
