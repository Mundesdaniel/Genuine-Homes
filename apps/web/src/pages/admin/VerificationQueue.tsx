import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { verificationsApi } from '@/api/verifications';
import { ConfirmDialog, EmptyState, ErrorState, Spinner } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';
import { titleCase } from '@/lib/format';

/** Admin: review pending property verification submissions (approve / reject). */
export function VerificationQueue() {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<{ id: string; title: string } | null>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'verifications'],
    queryFn: () => verificationsApi.pending(1, 50),
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
    }) => verificationsApi.review(id, decision, notes),
    onSuccess: () => {
      setRejecting(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'verifications'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-stone-800">Verification queue</h1>

      {isLoading ? (
        <Spinner label="Loading verification queue…" />
      ) : isError ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />
      ) : (data?.items ?? []).length === 0 ? (
        <EmptyState title="No pending verifications" hint="The queue is clear." />
      ) : (
        <ul className="space-y-2">
          {(data?.items ?? []).map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 p-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-stone-800">{v.propertyTitle}</p>
                {/* The whole point of this queue is reviewing the documents —
                    link each one so the admin can actually open them. */}
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
                  onClick={() => setRejecting({ id: v.id, title: v.propertyTitle })}
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
        title={`Reject verification for “${rejecting?.title ?? ''}”?`}
        body="The owner will be notified. A short reason helps them fix the submission."
        confirmLabel="Reject"
        danger
        busy={review.isPending}
        notes={{ label: 'Reason (optional)', placeholder: 'e.g. land title is illegible' }}
        onCancel={() => setRejecting(null)}
        onConfirm={(notes) =>
          rejecting && review.mutate({ id: rejecting.id, decision: 'rejected', notes })
        }
      />
    </div>
  );
}
