import type {
  CreateRentalInput,
  PaymentInitiation,
  PayViaInput,
  RentalAgreementResponse,
} from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const rentalsApi = {
  /** Start a rental agreement from a rent listing (pending until first rent). */
  create: (input: CreateRentalInput) =>
    api.post<RentalAgreementResponse>('/rentals', input).then((r) => r.data),
  /** Pay one month's rent; activates the agreement once the payment settles. */
  payRent: (id: string, input: PayViaInput) =>
    api.post<PaymentInitiation>(`/rentals/${id}/pay-rent`, input).then((r) => r.data),
};
