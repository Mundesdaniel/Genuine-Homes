import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { installmentsApi } from '@/api/installments';
import { paymentsApi } from '@/api/payments';
import { propertiesApi } from '@/api/properties';
import { EarningsChart, PaymentsTrendChart, PropertiesStatusChart } from '@/components/charts';
import { NewListingForm } from '@/components/NewListingForm';
import { PropertyForm } from '@/components/PropertyForm';
import { PlanCard } from '@/components/PlanCard';
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Spinner,
  statusTone,
} from '@/components/ui';
import { useCurrentUser } from '@/hooks/useAuth';
import { apiErrorMessage } from '@/lib/apiClient';
import { formatMoney, titleCase } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';

const SELLER_ROLES = ['landlord', 'agent', 'developer', 'admin'];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="font-display text-2xl font-bold tabular-nums text-brand-dark">{value}</p>
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
    </div>
  );
}

// Loads the full property (with its gallery) before mounting the edit form.
function EditPropertyPanel({
  id,
  onSaved,
  onCancel,
}: {
  id: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const query = useQuery({
    queryKey: ['property', id],
    queryFn: () => propertiesApi.get(id),
  });
  if (query.isLoading) {
    return (
      <div className="card p-5">
        <Spinner label="Loading property…" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <ErrorState
        message={apiErrorMessage(query.error) || 'Could not load property'}
        onRetry={() => query.refetch()}
      />
    );
  }
  return (
    <PropertyForm
      key={id}
      initialProperty={query.data}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  );
}

export function DashboardPage() {
  useCurrentUser();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<'none' | 'property' | 'listing'>('none');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const seller = Boolean(user?.role && SELLER_ROLES.includes(user.role));

  const propertiesQuery = useQuery({
    queryKey: ['mine'],
    queryFn: () => propertiesApi.listMine(1, 50),
    enabled: seller,
  });
  // Buyer-side data (plans + payments made). Sellers don't buy, so skip it.
  // Polled so settlements (and the charts) feel live.
  const plansQuery = useQuery({
    queryKey: ['plans'],
    queryFn: () => installmentsApi.mine(),
    enabled: !seller,
    refetchInterval: 15_000,
  });
  const paymentsQuery = useQuery({
    queryKey: ['payments'],
    queryFn: () => paymentsApi.mine(),
    enabled: !seller,
    refetchInterval: 15_000,
  });
  // Seller-side income received across their listings.
  const earningsQuery = useQuery({
    queryKey: ['earnings'],
    queryFn: () => paymentsApi.earnings(),
    enabled: seller,
    refetchInterval: 15_000,
  });
  // Buyer-requested plans awaiting this landlord's decision.
  const requestsQuery = useQuery({
    queryKey: ['plan-requests'],
    queryFn: () => installmentsApi.requests(),
    enabled: seller,
    refetchInterval: 15_000,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => propertiesApi.remove(id),
    onSuccess: () => {
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['mine'] });
    },
  });

  const acceptRequest = useMutation({
    mutationFn: (id: string) => installmentsApi.accept(id),
    onSuccess: () => {
      toast.success('Plan approved — the buyer can now pay the deposit');
      void queryClient.invalidateQueries({ queryKey: ['plan-requests'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const declineRequest = useMutation({
    mutationFn: (id: string) => installmentsApi.decline(id),
    onSuccess: () => {
      toast.success('Plan request declined');
      void queryClient.invalidateQueries({ queryKey: ['plan-requests'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const properties = propertiesQuery.data?.items ?? [];
  const plans = plansQuery.data?.items ?? [];
  const payments = paymentsQuery.data?.items ?? [];
  const planRequests = requestsQuery.data?.items ?? [];
  const earnings = earningsQuery.data ?? { totalReceived: 0, currency: 'UGX', byMonth: [] };

  const paidTotal = payments
    .filter((p) => p.status === 'successful')
    .reduce((sum, p) => sum + p.amount, 0);
  const activePlans = plans.filter((p) => p.status === 'active').length;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['mine'] });
    setPanel('none');
  };

  const onEditSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['mine'] });
    if (editingId) {
      queryClient.invalidateQueries({ queryKey: ['property', editingId] });
    }
    setEditingId(null);
  };

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">
            Hi, {user?.fullName?.split(' ')[0] ?? 'there'} 👋
          </h1>
          <p className="text-sm text-stone-500">
            {seller
              ? 'Manage your properties and track your earnings.'
              : 'Track your home-ownership journey.'}
          </p>
        </div>
        {seller && (
          <div className="flex gap-2">
            <button
              className={panel === 'property' ? 'btn-primary' : 'btn-outline'}
              type="button"
              onClick={() => {
                setEditingId(null);
                setPanel(panel === 'property' ? 'none' : 'property');
              }}
            >
              Add Property
            </button>
          </div>
        )}
      </div>

      {seller && user?.role !== 'admin' && !user?.identityVerifiedAt && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div>
            <p className="font-medium text-amber-900">Verify your identity to publish</p>
            <p className="text-sm text-amber-800">
              You can draft properties now, but they only go live once your National ID
              has been verified.
            </p>
          </div>
          <Link className="btn-primary" to="/identity">
            Verify identity
          </Link>
        </div>
      )}

      {editingId ? (
        <EditPropertyPanel
          id={editingId}
          onSaved={onEditSaved}
          onCancel={() => setEditingId(null)}
        />
      ) : (
        <>
          {panel === 'property' && <PropertyForm onSaved={refresh} />}
          {panel === 'listing' && (
            <NewListingForm properties={properties} onCreated={refresh} />
          )}
        </>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {seller ? (
          <>
            <Stat
              label="Total received"
              value={formatMoney(earnings.totalReceived, earnings.currency)}
            />
            <Stat label="Properties" value={String(properties.length)} />
          </>
        ) : (
          <>
            <Stat label="Total paid" value={formatMoney(paidTotal)} />
            <Stat label="Active plans" value={String(activePlans)} />
            <Stat label="Plans" value={String(plans.length)} />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-2 text-sm font-semibold text-stone-700">
            {seller ? 'Earnings over time' : 'Payments over time'}
            {(seller ? earningsQuery.isFetching : paymentsQuery.isFetching) && (
              <span className="ml-2 text-xs font-normal text-stone-400">live</span>
            )}
          </h2>
          {seller ? (
            <EarningsChart
              byMonth={earnings.byMonth}
              total={earnings.totalReceived}
              currency={earnings.currency}
            />
          ) : (
            <PaymentsTrendChart payments={payments} />
          )}
        </div>
        {seller && (
          <div className="card p-5">
            <h2 className="mb-2 text-sm font-semibold text-stone-700">Properties by status</h2>
            <PropertiesStatusChart properties={properties} />
          </div>
        )}
      </div>

      {/* Plans (buyer-side) */}
      {!seller && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-800">Your installment plans</h2>
          {plansQuery.isLoading ? (
            <Spinner label="Loading plans…" />
          ) : plans.length === 0 ? (
            <EmptyState
              title="No installment plans yet"
              hint="Find an installment listing and choose “Buy on installment”."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Payment-plan requests (landlord approval) */}
      {seller && planRequests.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-800">
            Payment plan requests
          </h2>
          <div className="space-y-3">
            {planRequests.map((r) => (
              <div
                key={r.plan.id}
                className="card flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-semibold text-stone-800">{r.propertyTitle}</p>
                  <p className="text-sm text-stone-500">
                    {r.buyer.fullName} · {r.plan.months} months · deposit{' '}
                    {formatMoney(r.plan.depositAmount, r.plan.currency)} · monthly{' '}
                    {formatMoney(r.plan.monthlyAmount, r.plan.currency)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-primary"
                    type="button"
                    disabled={acceptRequest.isPending || declineRequest.isPending}
                    onClick={() => acceptRequest.mutate(r.plan.id)}
                  >
                    Accept
                  </button>
                  <button
                    className="btn-outline"
                    type="button"
                    disabled={acceptRequest.isPending || declineRequest.isPending}
                    onClick={() => declineRequest.mutate(r.plan.id)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Properties (sellers) */}
      {seller && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-800">Your properties</h2>
          {propertiesQuery.isLoading ? (
            <Spinner label="Loading properties…" />
          ) : propertiesQuery.isError ? (
            <ErrorState
              message={apiErrorMessage(propertiesQuery.error)}
              onRetry={() => propertiesQuery.refetch()}
            />
          ) : properties.length === 0 ? (
            <EmptyState title="No properties yet" hint="Add your first property above." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map((p) => (
                <div key={p.id} className="card card-hover overflow-hidden">
                  <div className="aspect-[4/3] bg-stone-100">
                    {p.coverImageUrl ? (
                      <img
                        src={p.coverImageUrl}
                        alt={p.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-sm text-stone-400">
                        No photo
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 p-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge label={titleCase(p.status)} tone={statusTone(p.status)} />
                      {p.verificationStatus === 'verified' && (
                        <Badge label="Verified" tone="success" />
                      )}
                    </div>
                    <h3 className="line-clamp-1 font-semibold text-stone-800">{p.title}</h3>
                    <p className="text-sm text-stone-500">
                      {[p.area, p.district].filter(Boolean).join(', ')}
                    </p>
                    <div className="flex gap-2">
                      <button
                        className="btn-outline w-full"
                        type="button"
                        onClick={() => {
                          setPanel('none');
                          setEditingId(p.id);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-outline w-full"
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setPanel('listing');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        List
                      </button>
                      <button
                        className="btn-outline w-full"
                        type="button"
                        disabled={removeMutation.isPending}
                        onClick={() => setDeleteTarget({ id: p.id, title: p.title })}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete “${deleteTarget?.title ?? ''}”?`}
        body="The property and its listings will no longer be visible. This cannot be undone from here."
        confirmLabel="Delete"
        danger
        busy={removeMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && removeMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
