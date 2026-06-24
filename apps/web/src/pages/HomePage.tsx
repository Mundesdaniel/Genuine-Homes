import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { SearchListingsInput } from '@genuine-homes/shared';
import { listingsApi } from '@/api/listings';
import { ListingCard } from '@/components/ListingCard';
import { Pagination } from '@/components/Pagination';
import { ResultsMap } from '@/components/ResultsMap';
import {
  EMPTY_FILTERS,
  SearchFilters,
  type FiltersValue,
} from '@/components/SearchFilters';
import { CardSkeletonGrid, EmptyState, ErrorState } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';

const PAGE_SIZE = 12;
type Geo = { lat: number; lng: number } | null;

const numOrUndef = (s: string): number | undefined =>
  s.trim() === '' ? undefined : Number(s);

function toParams(
  f: FiltersValue,
  geo: Geo,
  radiusM: number,
  page: number,
): Partial<SearchListingsInput> {
  return {
    district: f.district.trim() || undefined,
    type: (f.type || undefined) as SearchListingsInput['type'],
    listingType: (f.listingType || undefined) as SearchListingsInput['listingType'],
    minPrice: numOrUndef(f.minPrice),
    maxPrice: numOrUndef(f.maxPrice),
    minBedrooms: numOrUndef(f.minBedrooms),
    onlyVerified: f.onlyVerified || undefined,
    sort: (f.sort || (geo ? 'distance' : undefined)) as SearchListingsInput['sort'],
    lat: geo?.lat,
    lng: geo?.lng,
    radiusM: geo ? radiusM : undefined,
    page,
    pageSize: PAGE_SIZE,
  };
}

export function HomePage() {
  const [filters, setFilters] = useState<FiltersValue>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [geo, setGeo] = useState<Geo>(null);
  const [radiusKm, setRadiusKm] = useState(5);
  const [locating, setLocating] = useState(false);

  const params = toParams(filters, geo, radiusKm * 1000, page);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['listings', params],
    queryFn: () => listingsApi.search(params),
    placeholderData: keepPreviousData,
  });

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPage(1);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <section className="animate-slide-up rounded-2xl bg-gradient-to-br from-brand-dark to-brand px-6 py-10 text-white shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">
          Find your next home in Uganda
        </h1>
        <p className="mt-2 max-w-2xl text-emerald-50/90">
          Rent, buy outright, or buy in installments — from verified listings,
          paid with Mobile Money.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <SearchFilters
            initial={filters}
            onApply={(value) => {
              setFilters(value);
              setPage(1);
            }}
          />
        </aside>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone-500">
              {data ? `${data.total} result${data.total === 1 ? '' : 's'}` : '—'}
              {isFetching && <span className="ml-2 text-stone-400">updating…</span>}
            </p>
            <div className="flex items-center gap-2">
              {geo ? (
                <>
                  <select
                    className="input w-auto py-1.5"
                    value={radiusKm}
                    onChange={(e) => {
                      setRadiusKm(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    {[5, 10, 25, 50].map((km) => (
                      <option key={km} value={km}>
                        within {km} km
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn-outline"
                    type="button"
                    onClick={() => {
                      setGeo(null);
                      setPage(1);
                    }}
                  >
                    Clear location
                  </button>
                </>
              ) : (
                <button
                  className="btn-outline"
                  type="button"
                  onClick={useMyLocation}
                  disabled={locating}
                >
                  📍 {locating ? 'Locating…' : 'Search near me'}
                </button>
              )}
            </div>
          </div>

          {items.length > 0 && (
            <ResultsMap
              items={items}
              center={geo ? [geo.lat, geo.lng] : null}
              radiusM={geo ? radiusKm * 1000 : undefined}
            />
          )}

          {isLoading ? (
            <CardSkeletonGrid count={6} />
          ) : isError ? (
            <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title="No listings match your search"
              hint="Try widening the filters or clearing the location."
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
        </section>
      </div>
    </div>
  );
}
