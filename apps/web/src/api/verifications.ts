import type {
  Paginated,
  SubmitVerificationInput,
  VerificationResponse,
} from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const verificationsApi = {
  submit: (input: SubmitVerificationInput) =>
    api.post<VerificationResponse>('/verifications', input).then((r) => r.data),
  pending: (page: number, pageSize: number) =>
    api
      .get<Paginated<VerificationResponse>>('/verifications/pending', {
        params: { page, pageSize },
      })
      .then((r) => r.data),
  review: (id: string, decision: 'verified' | 'rejected', notes?: string) =>
    api
      .patch<VerificationResponse>(`/verifications/${id}`, { decision, notes })
      .then((r) => r.data),
};
