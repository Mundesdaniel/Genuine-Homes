import type {
  IdentityVerificationQueueItem,
  IdentityVerificationResponse,
  Paginated,
  SubmitIdentityVerificationInput,
} from '@genuine-homes/shared';
import { api } from '@/lib/apiClient';

export const identityApi = {
  submit: (input: SubmitIdentityVerificationInput) =>
    api
      .post<IdentityVerificationResponse>('/identity/verifications', input)
      .then((r) => r.data),
  me: () =>
    api
      .get<IdentityVerificationResponse | null>('/identity/verifications/me')
      .then((r) => r.data),
  pending: (page: number, pageSize: number) =>
    api
      .get<Paginated<IdentityVerificationQueueItem>>('/identity/verifications/pending', {
        params: { page, pageSize },
      })
      .then((r) => r.data),
  review: (id: string, decision: 'verified' | 'rejected', notes?: string) =>
    api
      .patch<IdentityVerificationResponse>(`/identity/verifications/${id}`, {
        decision,
        notes,
      })
      .then((r) => r.data),
};
