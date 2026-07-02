import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { MapPin, Search } from 'lucide-react';
import { ListingType, enumValues, type SearchListingsInput } from '@genuine-homes/shared';
import { listingsApi } from '@/api/listings';
import { ListingCard } from '@/components/ListingCard';
import { Pagination } from '@/components/Pagination';
import { ResultsMap } from '@/components/ResultsMap';
import { EMPTY_FILTERS, SearchFilters, type FiltersValue } from '@/components/SearchFilters';
import { CardSkeletonGrid, EmptyState, ErrorState } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';
import { titleCase } from '@/lib/format';

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
  const { t } = useTranslation();
  const [filters, setFilters] = useState<FiltersValue>(EMPTY_FILTERS);
  // Bumped when filters change from OUTSIDE the sidebar (hero search, empty-state
  // reset) — remounts SearchFilters so its internal draft picks up the new values.
  const [filtersEpoch, setFiltersEpoch] = useState(0);
  const [page, setPage] = useState(1);
  const [geo, setGeo] = useState<Geo>(null);
  const [radiusKm, setRadiusKm] = useState(5);
  const [locating, setLocating] = useState(false);

  const [quickDistrict, setQuickDistrict] = useState('');
  const [quickType, setQuickType] = useState('');

  const params = toParams(filters, geo, radiusKm * 1000, page);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['listings', params],
    queryFn: () => listingsApi.search(params),
    placeholderData: keepPreviousData,
  });

  const applyExternal = (value: FiltersValue) => {
    setFilters(value);
    setPage(1);
    setFiltersEpoch((e) => e + 1);
  };

  const onQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    applyExternal({ ...filters, district: quickDistrict, listingType: quickType });
  };

  const clearEverything = () => {
    setQuickDistrict('');
    setQuickType('');
    setGeo(null);
    applyExternal(EMPTY_FILTERS);
  };

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
    <div className="space-y-8">
      <section className="relative animate-slide-up overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-500 px-6 py-14 text-white shadow-card sm:px-10">
        {/* Decorative glows — depth without imagery to download. */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            {t('hero.eyebrow')}
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold sm:text-5xl">{t('hero.title')}</h1>
          <p className="mt-3 max-w-2xl text-amber-50/90">{t('hero.subtitle')}</p>

          <form
            onSubmit={onQuickSearch}
            className="mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl bg-white/95 p-2 shadow-card-hover backdrop-blur sm:flex-row sm:items-center sm:rounded-full"
          >
            <div className="flex flex-1 items-center gap-2 px-3">
              <Search className="h-4 w-4 shrink-0 text-stone-400" />
              <input
                className="w-full bg-transparent py-2 text-sm text-ink outline-none placeholder:text-stone-400"
                placeholder={t('hero.searchPlaceholder')}
                value={quickDistrict}
                onChange={(e) => setQuickDistrict(e.target.value)}
                aria-label={t('hero.searchPlaceholder')}
              />
            </div>
            <select
              className="rounded-full border-0 bg-stone-100 px-4 py-2 text-sm text-stone-700 outline-none"
              value={quickType}
              onChange={(e) => setQuickType(e.target.value)}
              aria-label={t('hero.anyType')}
            >
              <option value="">{t('hero.anyType')}</option>
              {enumValues(ListingType).map((lt) => (
                <option key={lt} value={lt}>
                  {titleCase(lt)}
                </option>
              ))}
            </select>
            <button className="btn-primary" type="submit">
              {t('hero.search')}
            </button>
          </form>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <SearchFilters
            key={filtersEpoch}
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
                  <MapPin className="h-4 w-4" />
                  {locating ? 'Locating…' : 'Search near me'}
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
              action={{ label: 'Clear filters', onClick: clearEverything }}
            />
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item, i) => (
                  <ListingCard key={item.id} item={item} index={i} />
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
