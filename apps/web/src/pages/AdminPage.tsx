import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRole, enumValues, type UserProfileResponse } from '@genuine-homes/shared';
import { adminApi } from '@/api/admin';
import { usersApi } from '@/api/users';
import { verificationsApi } from '@/api/verifications';
import { Badge, ConfirmDialog, EmptyState, ErrorState, Spinner } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';
import { formatMoney, titleCase } from '@/lib/format';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-stone-800">{value}</p>
    </div>
  );
}

function OverviewSection() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => adminApi.overview(),
  });

  if (isLoading) return <Spinner label="Loading overview…" />;
  if (isError || !data)
    return <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Stat label="Users" value={data.users} />
      <Stat label="Properties" value={data.properties} />
      <Stat label="Active listings" value={data.activeListings} />
      <Stat label="Active plans" value={data.activePlans} />
      <Stat label="Pending verifications" value={data.pendingVerifications} />
      <Stat
        label="Revenue (settled)"
        value={formatMoney(data.revenue.total, data.revenue.currency)}
      />
    </div>
  );
}

function VerificationsSection() {
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

  if (isLoading) return <Spinner label="Loading verification queue…" />;
  if (isError)
    return <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />;
  const items = data?.items ?? [];
  if (items.length === 0)
    return <EmptyState title="No pending verifications" hint="The queue is clear." />;

  return (
    <>
      <ul className="space-y-2">
        {items.map((v) => (
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
    </>
  );
}

function UsersSection() {
  const queryClient = useQueryClient();
  const [roleChange, setRoleChange] = useState<{
    user: UserProfileResponse;
    role: UserRole;
  } | null>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => usersApi.list(1, 50),
  });

  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: string; role?: UserRole; isVerified?: boolean }) =>
      usersApi.adminUpdate(id, input),
    onSuccess: () => {
      setRoleChange(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  if (isLoading) return <Spinner label="Loading users…" />;
  if (isError)
    return <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />;
  const users = data?.items ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-left text-stone-500">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Contact</th>
            <th className="py-2 pr-4">Role</th>
            <th className="py-2 pr-4">Verified</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u: UserProfileResponse) => (
            <tr key={u.id} className="border-b border-stone-100">
              <td className="py-2 pr-4 font-medium text-stone-800">{u.fullName}</td>
              <td className="py-2 pr-4 text-stone-500">
                {u.phone}
                {u.email ? ` · ${u.email}` : ''}
              </td>
              <td className="py-2 pr-4">
                <select
                  className="input w-auto py-1"
                  value={u.role}
                  disabled={update.isPending}
                  aria-label={`Role for ${u.fullName}`}
                  onChange={(e) =>
                    // Role changes grant/revoke real capabilities — confirm first.
                    setRoleChange({ user: u, role: e.target.value as UserRole })
                  }
                >
                  {enumValues(UserRole).map((r) => (
                    <option key={r} value={r}>
                      {titleCase(r)}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-2 pr-4">
                <button
                  type="button"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ id: u.id, isVerified: !u.isVerified })}
                >
                  <Badge
                    label={u.isVerified ? 'Verified' : 'Unverified'}
                    tone={u.isVerified ? 'success' : 'neutral'}
                  />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmDialog
        open={roleChange !== null}
        title={`Change ${roleChange?.user.fullName ?? ''}'s role?`}
        body={
          roleChange
            ? `${titleCase(roleChange.user.role)} → ${titleCase(roleChange.role)}. This changes what they can do immediately.`
            : undefined
        }
        confirmLabel="Change role"
        busy={update.isPending}
        onCancel={() => setRoleChange(null)}
        onConfirm={() =>
          roleChange && update.mutate({ id: roleChange.user.id, role: roleChange.role })
        }
      />
    </div>
  );
}

export function AdminPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-stone-800">Admin</h1>

      <section className="space-y-3">
        <h2 className="font-semibold text-stone-700">Overview</h2>
        <OverviewSection />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-stone-700">Verification queue</h2>
        <VerificationsSection />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-stone-700">Users</h2>
        <UsersSection />
      </section>
    </div>
  );
}
