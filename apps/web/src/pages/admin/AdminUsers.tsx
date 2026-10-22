import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  STAFF_ASSIGNABLE_ROLES,
  UserRole,
  enumValues,
  type StaffAssignableRole,
  type UserProfileResponse,
} from '@genuine-homes/shared';
import { usersApi } from '@/api/users';
import { Badge, ConfirmDialog, ErrorState, Spinner } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';
import { titleCase } from '@/lib/format';

/** Add agent / landlord: create a staff account with an elevated role. */
function AddStaffForm() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    role: 'agent' as StaffAssignableRole,
  });
  // The single-use set-password link returned on success — shown for the admin
  // to share, since there is no email service to send it automatically.
  const [invitationLink, setInvitationLink] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      usersApi.createStaff({
        fullName: form.fullName,
        phone: form.phone,
        email: form.email.trim() === '' ? undefined : form.email,
        role: form.role,
      }),
    onSuccess: (res) => {
      setInvitationLink(res.invitationLink);
      setForm({ fullName: '', phone: '', email: '', role: 'agent' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success(`${titleCase(res.user.role)} account created`);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div className="card space-y-4 p-5">
      <div>
        <h2 className="font-semibold text-stone-800">Add agent / landlord</h2>
        <p className="mt-1 text-sm text-stone-500">
          Create a staff account with an elevated role. They’ll get a one-time link to set
          their own password.
        </p>
      </div>

      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div>
          <label className="label" htmlFor="staff-name">
            Full name
          </label>
          <input
            id="staff-name"
            className="input"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          />
        </div>
        <div>
          <label className="label" htmlFor="staff-phone">
            Phone
          </label>
          <input
            id="staff-phone"
            className="input"
            placeholder="+256700000000"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>
        <div>
          <label className="label" htmlFor="staff-email">
            Email <span className="text-stone-400">(optional)</span>
          </label>
          <input
            id="staff-email"
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div>
          <label className="label" htmlFor="staff-role">
            Role
          </label>
          <select
            id="staff-role"
            className="input"
            value={form.role}
            onChange={(e) =>
              setForm((f) => ({ ...f, role: e.target.value as StaffAssignableRole }))
            }
          >
            {STAFF_ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {titleCase(r)}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <button
            className="btn-primary"
            type="submit"
            disabled={create.isPending || !form.fullName || !form.phone}
          >
            {create.isPending ? 'Creating…' : 'Create account'}
          </button>
        </div>
      </form>

      {invitationLink && (
        <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-800">
            Account created. Share this one-time set-password link with them:
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded bg-white px-2 py-1 text-xs text-stone-700">
              {invitationLink}
            </code>
            <button
              type="button"
              className="btn-outline px-3 py-1 text-sm"
              onClick={() => {
                void navigator.clipboard?.writeText(invitationLink);
                toast.success('Link copied');
              }}
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The user list with inline role changes and a verified toggle. */
function UsersTable() {
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

/** Admin users page: create staff accounts and manage existing users' roles. */
export function AdminUsers() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-stone-800">Users</h1>
      <AddStaffForm />
      <UsersTable />
    </div>
  );
}
