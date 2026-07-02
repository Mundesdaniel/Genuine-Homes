import type { Paginated, PaymentResponse } from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const paymentsApi = {
  mine: (page = 1, pageSize = 100) =>
    api
      .get<Paginated<PaymentResponse>>('/payments/mine', {
        params: { page, pageSize },
      })
      .then((r) => r.data),
  get: (id: string) => api.get<PaymentResponse>(`/payments/${id}`).then((r) => r.data),
  /**
   * DEV ONLY: stand in for the payment gateway's webhook from the mock checkout
   * page. With the real gateway, signature verification would reject this.
   */
  simulateSettlement: (paymentId: string, status: 'successful' | 'failed') =>
    api
      .post('/payments/webhook', { tx_ref: paymentId, status, id: `web_${paymentId}` })
      .then((r) => r.data),
};
