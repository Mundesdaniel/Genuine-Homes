import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { SubscriptionRequestResponse, SubscriptionResponse } from '@genuine-homes/shared';
import { subscriptionsApi } from '@/api/subscriptions';
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Spinner,
  statusTone,
} from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';
import { titleCase } from '@/lib/format';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

/** Admin: record a cash subscription payment and activate it. */
function RecordPaymentForm() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    userId: '',
    plan: 'airbnb_monthly',
    startsAt: '',
    expiresAt: '',
  });

  const record = useMutation({
    mutationFn: () =>
      subscriptionsApi.record({
        userId: form.userId.trim(),
        plan: form.plan.trim(),
        // Date inputs are day-only; send full ISO timestamps (UTC midnight).
        startsAt: new Date(form.startsAt).toISOString(),
        expiresAt: new Date(form.expiresAt).toISOString(),
      }),
    onSuccess: () => {
      setForm({ userId: '', plan: 'airbnb_monthly', startsAt: '', expiresAt: '' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] });
      toast.success('Subscription recorded and activated');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const ready =
    form.userId.trim() !== '' &&
    form.plan.trim() !== '' &&
    form.startsAt !== '' &&
    form.expiresAt !== '';

  return (
    <div className="card space-y-4 p-5">
      <div>
        <h2 className="font-semibold text-stone-800">Record a cash payment</h2>
        <p className="mt-1 text-sm text-stone-500">
          Billing is cash-only. Recording a payment activates the subscription for the dates
          you set. The holder also needs the <span className="font-medium">airbnb_agent</span>{' '}
          role (set it on the Users page).
        </p>
      </div>

      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          record.mutate();
        }}
      >
        <div className="sm:col-span-2">
          <label className="label" htmlFor="sub-user">
            User ID
          </label>
          <input
            id="sub-user"
            className="input"
            placeholder="UUID of the account (from the Users page)"
            value={form.userId}
            onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
          />
        </div>
        <div>
          <label className="label" htmlFor="sub-plan">
            Plan
          </label>
          <input
            id="sub-plan"
            className="input"
            value={form.plan}
            onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="sub-starts">
              Starts
            </label>
            <input
              id="sub-starts"
              type="date"
              className="input"
              value={form.startsAt}
              onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="sub-expires">
              Expires
            </label>
            <input
              id="sub-expires"
              type="date"
              className="input"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <button className="btn-primary" type="submit" disabled={record.isPending || !ready}>
            {record.isPending ? 'Recording…' : 'Record payment'}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Admin: list subscriptions with a cancel action. */
function SubscriptionsTable() {
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState<SubscriptionResponse | null>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'subscriptions'],
    queryFn: () => subscriptionsApi.list(),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => subscriptionsApi.cancel(id),
    onSuccess: () => {
      setCancelling(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] });
      toast.success('Subscription cancelled');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (isLoading) return <Spinner label="Loading subscriptions…" />;
  if (isError)
    return <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />;
  const subs = data?.items ?? [];
  if (subs.length === 0)
    return (
      <EmptyState title="No subscriptions yet" hint="Record a cash payment to create one." />
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-left text-stone-500">
            <th className="py-2 pr-4">Account</th>
            <th className="py-2 pr-4">Plan</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Starts</th>
            <th className="py-2 pr-4">Expires</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {subs.map((s) => (
            <tr key={s.id} className="border-b border-stone-100">
              <td className="py-2 pr-4">
                <div className="font-medium text-stone-800">
                  {s.user?.fullName ?? s.userId}
                </div>
                {s.user && <div className="text-xs text-stone-500">{s.user.phone}</div>}
              </td>
              <td className="py-2 pr-4">{s.plan}</td>
              <td className="py-2 pr-4">
                <Badge label={titleCase(s.status)} tone={statusTone(s.status)} />
              </td>
              <td className="py-2 pr-4 text-stone-500">{formatDate(s.startsAt)}</td>
              <td className="py-2 pr-4 text-stone-500">{formatDate(s.expiresAt)}</td>
              <td className="py-2 text-right">
                {s.status !== 'cancelled' && (
                  <button
                    type="button"
                    className="text-sm font-medium text-red-600 hover:underline"
                    disabled={cancel.isPending}
                    onClick={() => setCancelling(s)}
                  >
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmDialog
        open={cancelling !== null}
        title={`Cancel ${cancelling?.user?.fullName ?? 'this'} subscription?`}
        body="Access to the short-let dashboard is revoked immediately."
        confirmLabel="Cancel subscription"
        danger
        busy={cancel.isPending}
        onCancel={() => setCancelling(null)}
        onConfirm={() => cancelling && cancel.mutate(cancelling.id)}
      />
    </div>
  );
}

/** Admin: pending subscription requests — approve (record + grant role) or decline. */
function PendingRequests() {
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState<SubscriptionRequestResponse | null>(null);
  const [declining, setDeclining] = useState<SubscriptionRequestResponse | null>(null);
  const [dates, setDates] = useState({ startsAt: '', expiresAt: '' });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'sub-requests'],
    queryFn: () => subscriptionsApi.listRequests(),
  });

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'sub-requests'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  };

  const approve = useMutation({
    mutationFn: (req: SubscriptionRequestResponse) =>
      subscriptionsApi.approveRequest(req.id, {
        startsAt: new Date(dates.startsAt).toISOString(),
        expiresAt: new Date(dates.expiresAt).toISOString(),
      }),
    onSuccess: () => {
      setApproving(null);
      setDates({ startsAt: '', expiresAt: '' });
      refreshAll();
      toast.success('Request approved — subscription active, role granted');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const decline = useMutation({
    mutationFn: (id: string) => subscriptionsApi.declineRequest(id),
    onSuccess: () => {
      setDeclining(null);
      refreshAll();
      toast.success('Request declined');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (isLoading) return <Spinner label="Loading requests…" />;
  if (isError)
    return <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />;
  const requests = data?.items ?? [];
  if (requests.length === 0) return null; // nothing pending → hide the section

  const datesReady = dates.startsAt !== '' && dates.expiresAt !== '';

  return (
    <div className="card border-amber-200 bg-amber-50/60 p-5">
      <h2 className="font-semibold text-amber-900">Pending subscription requests</h2>
      <p className="mt-1 text-sm text-amber-800">
        Approve to record the cash payment and grant the AirBnB agent role, or decline.
      </p>
      <ul className="mt-4 space-y-2">
        {requests.map((r) => (
          <li key={r.id} className="rounded-lg border border-amber-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-stone-800">{r.user?.fullName ?? r.userId}</p>
                <p className="text-xs text-stone-500">
                  {r.plan}
                  {r.user ? ` · ${r.user.phone}` : ''}
                  {r.message ? ` · “${r.message}”` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-primary px-3 py-1.5 text-sm"
                  onClick={() => setApproving((cur) => (cur?.id === r.id ? null : r))}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn-outline px-3 py-1.5 text-sm"
                  onClick={() => setDeclining(r)}
                >
                  Decline
                </button>
              </div>
            </div>

            {approving?.id === r.id && (
              <form
                className="mt-3 flex flex-wrap items-end gap-3 border-t border-amber-100 pt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  approve.mutate(r);
                }}
              >
                <div>
                  <label className="label" htmlFor={`start-${r.id}`}>
                    Starts
                  </label>
                  <input
                    id={`start-${r.id}`}
                    type="date"
                    className="input"
                    value={dates.startsAt}
                    onChange={(e) => setDates((d) => ({ ...d, startsAt: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`end-${r.id}`}>
                    Expires
                  </label>
                  <input
                    id={`end-${r.id}`}
                    type="date"
                    className="input"
                    value={dates.expiresAt}
                    onChange={(e) => setDates((d) => ({ ...d, expiresAt: e.target.value }))}
                  />
                </div>
                <button
                  className="btn-primary"
                  type="submit"
                  disabled={approve.isPending || !datesReady}
                >
                  {approve.isPending ? 'Activating…' : 'Record & activate'}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={declining !== null}
        title={`Decline ${declining?.user?.fullName ?? 'this'} request?`}
        body="They will need to submit a new request to subscribe."
        confirmLabel="Decline request"
        danger
        busy={decline.isPending}
        onCancel={() => setDeclining(null)}
        onConfirm={() => declining && decline.mutate(declining.id)}
      />
    </div>
  );
}

/** Admin subscriptions page: record cash payments and manage subscriptions. */
export function AdminSubscriptions() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-stone-800">Subscriptions</h1>
      <PendingRequests />
      <RecordPaymentForm />
      <SubscriptionsTable />
    </div>
  );
}
