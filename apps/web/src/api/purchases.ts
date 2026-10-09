import type { PaymentInitiation, PayViaInput } from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const purchasesApi = {
  /** Pay a property's full sale price at once (outright purchase). */
  buy: (listingId: string, input: PayViaInput) =>
    api.post<PaymentInitiation>(`/purchases/${listingId}`, input).then((r) => r.data),
};
