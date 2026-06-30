import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { favoritesApi } from '@/api/favorites';
import { ListingCard } from '@/components/ListingCard';
import { Pagination } from '@/components/Pagination';
import { CardSkeletonGrid, EmptyState, ErrorState } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';

const PAGE_SIZE = 12;

export function FavoritesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['favorites', 'list', page],
    queryFn: () => favoritesApi.list(page, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-800">
          Saved properties
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {data ? `${data.total} saved` : 'Your saved listings'}
        </p>
      </div>

      {isLoading ? (
        <CardSkeletonGrid count={6} />
      ) : isError ? (
        <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title="You haven't saved any properties yet"
          hint="Tap the heart on any listing to save it here for later."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <ListingCard key={item.id} item={item} />
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={data?.total ?? 0}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
