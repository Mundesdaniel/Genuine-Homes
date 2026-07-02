import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { installmentsApi } from '@/api/installments';
import { paymentsApi } from '@/api/payments';
import { propertiesApi } from '@/api/properties';
import { PaymentsTrendChart, PropertiesStatusChart } from '@/components/charts';
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
      <p className="text-2xl font-bold text-brand-dark">{value}</p>
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
  // Polled so settlements (and the charts) feel live.
  const plansQuery = useQuery({
    queryKey: ['plans'],
    queryFn: () => installmentsApi.mine(),
    refetchInterval: 15_000,
  });
  const paymentsQuery = useQuery({
    queryKey: ['payments'],
    queryFn: () => paymentsApi.mine(),
    refetchInterval: 15_000,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => propertiesApi.remove(id),
    onSuccess: () => {
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['mine'] });
    },
  });

  const properties = propertiesQuery.data?.items ?? [];
  const plans = plansQuery.data?.items ?? [];
  const payments = paymentsQuery.data?.items ?? [];

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
              ? 'Manage your properties and track payments.'
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
              + Property
            </button>
            <button
              className={panel === 'listing' ? 'btn-primary' : 'btn-outline'}
              type="button"
              onClick={() => {
                setEditingId(null);
                setPanel(panel === 'listing' ? 'none' : 'listing');
              }}
            >
              + Listing
            </button>
          </div>
        )}
      </div>

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
        <Stat label="Total paid" value={formatMoney(paidTotal)} />
        <Stat label="Active plans" value={String(activePlans)} />
        <Stat label="Plans" value={String(plans.length)} />
        {seller && <Stat label="Properties" value={String(properties.length)} />}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-2 text-sm font-semibold text-stone-700">
            Payments over time
            {paymentsQuery.isFetching && (
              <span className="ml-2 text-xs font-normal text-stone-400">live</span>
            )}
          </h2>
          <PaymentsTrendChart payments={payments} />
        </div>
        {seller && (
          <div className="card p-5">
            <h2 className="mb-2 text-sm font-semibold text-stone-700">Properties by status</h2>
            <PropertiesStatusChart properties={properties} />
          </div>
        )}
      </div>

      {/* Plans */}
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
