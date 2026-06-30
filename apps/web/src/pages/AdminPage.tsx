import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserRole,
  enumValues,
  type UserProfileResponse,
} from '@genuine-homes/shared';
import { adminApi } from '@/api/admin';
import { usersApi } from '@/api/users';
import { verificationsApi } from '@/api/verifications';
import { Badge, EmptyState, ErrorState, Spinner } from '@/components/ui';
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
      <Stat label="Revenue (settled)" value={formatMoney(data.revenue.total, data.revenue.currency)} />
    </div>
  );
}

function VerificationsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'verifications'],
    queryFn: () => verificationsApi.pending(1, 50),
  });

  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'verified' | 'rejected' }) =>
      verificationsApi.review(id, decision),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'verifications'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
  });

  if (isLoading) return <Spinner label="Loading verification queue…" />;
  if (isError) return <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />;
  const items = data?.items ?? [];
  if (items.length === 0)
    return <EmptyState title="No pending verifications" hint="The queue is clear." />;

  return (
    <ul className="space-y-2">
      {items.map((v) => (
        <li
          key={v.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 p-3"
        >
          <div>
            <p className="font-medium text-stone-800">{v.propertyTitle}</p>
            <p className="text-sm text-stone-500">
              {v.documents.length} document{v.documents.length === 1 ? '' : 's'} ·{' '}
              {v.documents.map((d) => titleCase(d.kind)).join(', ')}
            </p>
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
              onClick={() => review.mutate({ id: v.id, decision: 'rejected' })}
            >
              Reject
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function UsersSection() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => usersApi.list(1, 50),
  });

  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: string; role?: UserRole; isVerified?: boolean }) =>
      usersApi.adminUpdate(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  if (isLoading) return <Spinner label="Loading users…" />;
  if (isError) return <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />;
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
                  onChange={(e) =>
                    update.mutate({ id: u.id, role: e.target.value as UserRole })
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
                    tone={u.isVerified ? 'verified' : 'default'}
                  />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
