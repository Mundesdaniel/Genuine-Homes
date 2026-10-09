import type {
  CreatePlanInput,
  InstallmentPlanDetail,
  Paginated,
  PaymentInitiation,
  PayViaInput,
  PlanRequestResponse,
} from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const installmentsApi = {
  mine: (page = 1, pageSize = 50) =>
    api
      .get<Paginated<InstallmentPlanDetail>>('/installment-plans/mine', {
        params: { page, pageSize },
      })
      .then((r) => r.data),
  get: (id: string) =>
    api.get<InstallmentPlanDetail>(`/installment-plans/${id}`).then((r) => r.data),
  create: (input: CreatePlanInput) =>
    api.post<InstallmentPlanDetail>('/installment-plans', input).then((r) => r.data),
  payDeposit: (id: string, input: PayViaInput) =>
    api
      .post<PaymentInitiation>(`/installment-plans/${id}/deposit`, input)
      .then((r) => r.data),
  payInstallment: (id: string, installmentId: string, input: PayViaInput) =>
    api
      .post<PaymentInitiation>(
        `/installment-plans/${id}/installments/${installmentId}/pay`,
        input,
      )
      .then((r) => r.data),
  cancel: (id: string) =>
    api
      .post<InstallmentPlanDetail>(`/installment-plans/${id}/cancel`, {})
      .then((r) => r.data),
  // Landlord: buyer-requested plans awaiting a decision on your properties.
  requests: (page = 1, pageSize = 50) =>
    api
      .get<Paginated<PlanRequestResponse>>('/installment-plans/requests', {
        params: { page, pageSize },
      })
      .then((r) => r.data),
  accept: (id: string) =>
    api
      .post<InstallmentPlanDetail>(`/installment-plans/${id}/accept`, {})
      .then((r) => r.data),
  decline: (id: string, reason?: string) =>
    api
      .post<InstallmentPlanDetail>(`/installment-plans/${id}/decline`, { reason })
      .then((r) => r.data),
};
