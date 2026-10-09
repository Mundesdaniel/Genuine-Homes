import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { listingsApi } from '@/api/listings';
import { propertiesApi } from '@/api/properties';
import { BookViewing } from '@/components/BookViewing';
import { FavoriteButton } from '@/components/FavoriteButton';
import { InstallmentPanel } from '@/components/InstallmentPanel';
import { RentActions } from '@/components/RentActions';
import { ResultsMap } from '@/components/ResultsMap';
import { SaleActions } from '@/components/SaleActions';
import { Badge, ErrorState, Spinner, statusTone } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';
import { formatMoney, titleCase } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';

const PERIOD_SUFFIX: Record<string, string> = { monthly: '/mo', yearly: '/yr' };

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const token = useAuthStore((s) => s.accessToken);

  const listingQuery = useQuery({
    queryKey: ['listing', id],
    queryFn: () => listingsApi.get(id as string),
    enabled: Boolean(id),
  });

  const propertyId = listingQuery.data?.property.id;
  const propertyQuery = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => propertiesApi.get(propertyId as string),
    enabled: Boolean(propertyId),
  });

  if (listingQuery.isLoading) return <Spinner label="Loading listing…" />;
  if (listingQuery.isError || !listingQuery.data) {
    return <ErrorState message={apiErrorMessage(listingQuery.error) || 'Listing not found'} />;
  }

  const listing = listingQuery.data;
  const property = propertyQuery.data;
  const p = listing.property;
  const images = property?.images ?? [];
  const amenities = Object.entries(p.amenities).filter(([, on]) => on);

  // Search only surfaces active properties, but a bookmark/favorite/shared link
  // can still land here after it's been taken — so gate the actions on status.
  const TAKEN_LABEL: Record<string, string> = {
    reserved: 'Reserved',
    rented: 'Rented',
    sold: 'Sold',
    suspended: 'Unavailable',
  };
  const takenLabel = property ? TAKEN_LABEL[property.status] : undefined;
  const suffix =
    listing.listingType === 'rent' && listing.rentPeriod
      ? (PERIOD_SUFFIX[listing.rentPeriod] ?? '')
      : '';

  return (
    <div className="space-y-6">
      <Link to="/" className="text-sm font-medium text-brand">
        ← Back to search
      </Link>

      {/* Gallery */}
      <div className="grid gap-2 sm:grid-cols-4">
        <div className="sm:col-span-3 aspect-[16/9] overflow-hidden rounded-xl bg-stone-100">
          {p.coverImageUrl ? (
            <img src={p.coverImageUrl} alt={p.title} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-stone-400">No photo</div>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-1">
          {images.slice(1, 4).map((img) => (
            <div
              key={img.id}
              className="aspect-square overflow-hidden rounded-lg bg-stone-100"
            >
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                label={titleCase(listing.listingType)}
                tone={statusTone(listing.listingType)}
              />
              {p.verificationStatus === 'verified' && (
                <Badge label="Verified" tone="success" />
              )}
              <Badge label={titleCase(p.type)} />
              {takenLabel && (
                <Badge label={takenLabel} tone={statusTone(property!.status)} />
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-stone-800">{p.title}</h1>
            <p className="text-stone-500">
              {[p.area, p.city, p.district].filter(Boolean).join(', ')}
            </p>
          </div>

          <div className="flex flex-wrap gap-6 text-sm text-stone-600">
            {p.bedrooms != null && <span>{p.bedrooms} bedrooms</span>}
            {p.bathrooms != null && <span>{p.bathrooms} bathrooms</span>}
            {p.sizeSqm != null && <span>{p.sizeSqm} m²</span>}
          </div>

          <div>
            <h2 className="mb-1 font-semibold text-stone-800">Description</h2>
            <p className="whitespace-pre-line text-stone-600">{p.description}</p>
          </div>

          {amenities.length > 0 && (
            <div>
              <h2 className="mb-2 font-semibold text-stone-800">Amenities</h2>
              <div className="flex flex-wrap gap-2">
                {amenities.map(([name]) => (
                  <span key={name} className="chip bg-stone-100 text-stone-700">
                    {titleCase(name)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {p.latitude != null && p.longitude != null && (
            <div>
              <h2 className="mb-2 font-semibold text-stone-800">Location</h2>
              <ResultsMap items={[listing]} center={[p.latitude, p.longitude]} />
            </div>
          )}
        </div>

        {/* Price + other listings */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="card p-5">
            <p className="text-sm text-stone-500">{titleCase(listing.listingType)} price</p>
            <p className="font-display text-3xl font-bold tabular-nums text-brand-dark">
              {formatMoney(listing.price, listing.currency)}
              <span className="font-sans text-base font-medium text-stone-400">{suffix}</span>
            </p>
            {listing.listingType === 'installment' && listing.minDepositPercent != null && (
              <p className="mt-2 text-sm text-stone-600">
                From {listing.minDepositPercent}% deposit · up to{' '}
                {listing.maxInstallmentMonths} months
              </p>
            )}
            {(p.contactName || p.ownerName) && (
              <div className="mt-4 border-t border-stone-100 pt-3">
                <p className="text-xs uppercase tracking-wide text-stone-400">Listed by</p>
                <p className="mt-0.5 text-sm font-medium text-stone-800">
                  {p.contactName || p.ownerName}
                  {p.ownerRole && (
                    <span className="font-normal text-stone-400"> · {titleCase(p.ownerRole)}</span>
                  )}
                </p>
              </div>
            )}
            <BookViewing listing={listing} taken={Boolean(takenLabel)} />
            {/* Secondary action: free-form questions to the owner (booking is
                the primary CTA above). Hidden for the owner's own listing. */}
            {p.ownerId !== currentUserId && (
              <Link
                to={
                  token
                    ? `/messages?to=${p.ownerId}&listingId=${listing.id}`
                    : '/login'
                }
                className="btn-outline mt-2 w-full"
              >
                <MessageCircle className="h-4 w-4" />
                Message owner
              </Link>
            )}
            <div className="mt-2">
              <FavoriteButton propertyId={p.id} variant="inline" />
            </div>
          </div>

          {takenLabel ? (
            <div className="card border-amber-200 bg-amber-50 p-5">
              <p className="font-semibold text-amber-900">
                This property is no longer available
              </p>
              <p className="mt-1 text-sm text-amber-800">
                It has been marked <span className="font-medium">{takenLabel.toLowerCase()}</span>,
                so viewings can no longer be booked for it.
              </p>
            </div>
          ) : p.ownerId === currentUserId ? (
            // The owner can't pay for their own property — manage it from the dashboard.
            <div className="card p-5">
              <p className="text-sm text-stone-600">
                This is your listing. Manage it from your{' '}
                <Link to="/dashboard" className="font-medium text-brand">
                  dashboard
                </Link>
                .
              </p>
            </div>
          ) : listing.listingType === 'installment' ? (
            <InstallmentPanel listing={listing} />
          ) : listing.listingType === 'sale' ? (
            <SaleActions listing={listing} />
          ) : listing.listingType === 'rent' ? (
            <RentActions listing={listing} />
          ) : null}

          {property && property.listings.length > 1 && (
            <div className="card p-5">
              <h3 className="mb-2 text-sm font-semibold text-stone-700">
                Other ways to get this property
              </h3>
              <ul className="space-y-2">
                {property.listings
                  .filter((l) => l.id !== listing.id)
                  .map((l) => (
                    <li key={l.id}>
                      <Link
                        to={`/listings/${l.id}`}
                        className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2 text-sm hover:border-brand"
                      >
                        <span>{titleCase(l.listingType)}</span>
                        <span className="font-semibold text-brand-dark">
                          {formatMoney(l.price, l.currency)}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
