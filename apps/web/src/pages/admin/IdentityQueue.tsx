import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { identityApi } from '@/api/identity';
import { ConfirmDialog, EmptyState, ErrorState, Spinner } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';
import { titleCase } from '@/lib/format';

/** Admin: review pending National ID (KYC) submissions (approve / reject). */
export function IdentityQueue() {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<{ id: string; name: string } | null>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'identity'],
    queryFn: () => identityApi.pending(1, 50),
  });

  const review = useMutation({
    mutationFn: ({
      id,
      decision,
      notes,
    }: {
      id: string;
      decision: 'verified' | 'rejected';
      notes?: string;
    }) => identityApi.review(id, decision, notes),
    onSuccess: () => {
      setRejecting(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'identity'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-stone-800">
        Identity checks (National ID)
      </h1>

      {isLoading ? (
        <Spinner label="Loading identity queue…" />
      ) : isError ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />
      ) : (data?.items ?? []).length === 0 ? (
        <EmptyState title="No pending identity checks" hint="The queue is clear." />
      ) : (
        <ul className="space-y-2">
          {(data?.items ?? []).map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 p-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-stone-800">
                  {v.legalName}{' '}
                  <span className="text-sm font-normal text-stone-500">
                    ({titleCase(v.userRole)}
                    {v.userFullName !== v.legalName ? ` · account: ${v.userFullName}` : ''})
                  </span>
                </p>
                <p className="text-sm text-stone-500">
                  NIN {v.ninMasked}
                  {v.organizationName
                    ? ` · ${v.organizationName} (URSB ${v.registrationNumber ?? '—'}${v.tin ? `, TIN ${v.tin}` : ''})`
                    : ''}
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {v.documents.map((d, i) => (
                    <a
                      key={i}
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="chip bg-stone-100 text-stone-700 underline-offset-2 transition hover:bg-stone-200 hover:underline"
                    >
                      {titleCase(d.kind)} ↗
                    </a>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-primary"
                  type="button"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: v.id, decision: 'verified' })}
                >
                  Approve
                </button>
                <button
                  className="btn-outline"
                  type="button"
                  disabled={review.isPending}
                  onClick={() => setRejecting({ id: v.id, name: v.legalName })}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={rejecting !== null}
        title={`Reject ${rejecting?.name ?? ''}'s identity submission?`}
        body="They will be notified and can resubmit. A short reason helps them fix it."
        confirmLabel="Reject"
        danger
        busy={review.isPending}
        notes={{ label: 'Reason (optional)', placeholder: 'e.g. ID photo is blurry' }}
        onCancel={() => setRejecting(null)}
        onConfirm={(notes) =>
          rejecting && review.mutate({ id: rejecting.id, decision: 'rejected', notes })
        }
      />
    </div>
  );
}
