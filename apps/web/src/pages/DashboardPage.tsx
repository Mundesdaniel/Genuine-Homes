import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NewListingForm } from '@/components/NewListingForm';
import { NewPropertyForm } from '@/components/NewPropertyForm';
import { Badge, EmptyState, ErrorState, Spinner } from '@/components/ui';
import { propertiesApi } from '@/api/properties';
import { useCurrentUser } from '@/hooks/useAuth';
import { apiErrorMessage } from '@/lib/apiClient';
import { titleCase } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';

const SELLER_ROLES = ['landlord', 'agent', 'developer', 'admin'];

export function DashboardPage() {
  useCurrentUser();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<'none' | 'property' | 'listing'>('none');

  const mineQuery = useQuery({
    queryKey: ['mine'],
    queryFn: () => propertiesApi.listMine(1, 50),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => propertiesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mine'] }),
  });

  const seller = Boolean(user?.role && SELLER_ROLES.includes(user.role));
  const properties = mineQuery.data?.items ?? [];
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['mine'] });
    setPanel('none');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">
            Hi, {user?.fullName?.split(' ')[0] ?? 'there'} 👋
          </h1>
          <p className="text-sm text-stone-500">
            {seller
              ? 'Manage your properties and listings.'
              : 'Your account is set up for renting and buying.'}
          </p>
        </div>
        {seller && (
          <div className="flex gap-2">
            <button
              className={panel === 'property' ? 'btn-primary' : 'btn-outline'}
              type="button"
              onClick={() => setPanel(panel === 'property' ? 'none' : 'property')}
            >
              + Property
            </button>
            <button
              className={panel === 'listing' ? 'btn-primary' : 'btn-outline'}
              type="button"
              onClick={() => setPanel(panel === 'listing' ? 'none' : 'listing')}
            >
              + Listing
            </button>
          </div>
        )}
      </div>

      {panel === 'property' && <NewPropertyForm onCreated={refresh} />}
      {panel === 'listing' && (
        <NewListingForm properties={properties} onCreated={refresh} />
      )}

      {!seller ? (
        <EmptyState
          title="Browse to get started"
          hint="Buyer and renter accounts don't list properties. Head to Browse to find a home."
        />
      ) : mineQuery.isLoading ? (
        <Spinner label="Loading your properties…" />
      ) : mineQuery.isError ? (
        <ErrorState
          message={apiErrorMessage(mineQuery.error)}
          onRetry={() => mineQuery.refetch()}
        />
      ) : properties.length === 0 ? (
        <EmptyState title="No properties yet" hint="Add your first property above." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <div key={p.id} className="card overflow-hidden">
              <div className="aspect-[4/3] bg-stone-100">
                {p.coverImageUrl ? (
                  <img src={p.coverImageUrl} alt={p.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-sm text-stone-400">
                    No photo
                  </div>
                )}
              </div>
              <div className="space-y-2 p-4">
                <div className="flex flex-wrap gap-2">
                  <Badge label={titleCase(p.status)} />
                  {p.verificationStatus === 'verified' && (
                    <Badge label="Verified" tone="verified" />
                  )}
                </div>
                <h3 className="line-clamp-1 font-semibold text-stone-800">{p.title}</h3>
                <p className="text-sm text-stone-500">
                  {[p.area, p.district].filter(Boolean).join(', ')}
                </p>
                <button
                  className="btn-outline w-full"
                  type="button"
                  disabled={removeMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete "${p.title}"?`)) {
                      removeMutation.mutate(p.id);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
