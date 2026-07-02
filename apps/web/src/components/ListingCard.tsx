import { Link } from 'react-router-dom';
import { Bath, BedDouble, Home, Ruler } from 'lucide-react';
import type { ListingSearchItem } from '@genuine-homes/shared';
import { formatDistance, formatMoney, titleCase } from '@/lib/format';
import { FavoriteButton } from './FavoriteButton';
import { Badge, statusTone } from './ui';

const PERIOD_SUFFIX: Record<string, string> = { monthly: '/mo', yearly: '/yr' };

export function ListingCard({
  item,
  index = 0,
}: {
  item: ListingSearchItem;
  /** Position in the results grid — staggers the entrance animation. */
  index?: number;
}) {
  const p = item.property;
  const distance = formatDistance(item.distanceM);
  const suffix =
    item.listingType === 'rent' && item.rentPeriod
      ? (PERIOD_SUFFIX[item.rentPeriod] ?? '')
      : '';

  return (
    <Link
      to={`/listings/${item.id}`}
      className="card card-hover group animate-slide-up overflow-hidden"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-brand-50">
        <FavoriteButton propertyId={p.id} />
        {p.coverImageUrl ? (
          <img
            src={p.coverImageUrl}
            alt={p.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-brand-50 to-brand-100 text-brand-300">
            <Home className="h-10 w-10" strokeWidth={1.5} />
          </div>
        )}
        {/* Soft top gradient keeps the badges legible over any photo. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/30 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge label={titleCase(item.listingType)} tone={statusTone(item.listingType)} />
          {p.verificationStatus === 'verified' && <Badge label="Verified" tone="success" />}
        </div>
      </div>
      <div className="space-y-2 p-5">
        <h3 className="line-clamp-1 font-sans font-semibold text-stone-800">{p.title}</h3>
        <p className="text-sm text-stone-500">
          {[p.area, p.district].filter(Boolean).join(', ')}
        </p>
        <div className="flex items-baseline justify-between pt-1">
          <span className="font-display text-lg font-bold tabular-nums text-brand-700">
            {formatMoney(item.price, item.currency)}
            <span className="font-sans text-sm font-medium text-stone-400">{suffix}</span>
          </span>
          {distance && <span className="text-xs text-stone-400">{distance}</span>}
        </div>
        {(p.bedrooms != null || p.bathrooms != null || p.sizeSqm != null) && (
          <div className="flex items-center gap-3 pt-0.5 text-xs text-stone-500">
            {p.bedrooms != null && (
              <span className="inline-flex items-center gap-1">
                <BedDouble className="h-3.5 w-3.5 text-stone-400" />
                {p.bedrooms} bd
              </span>
            )}
            {p.bathrooms != null && (
              <span className="inline-flex items-center gap-1">
                <Bath className="h-3.5 w-3.5 text-stone-400" />
                {p.bathrooms} ba
              </span>
            )}
            {p.sizeSqm != null && (
              <span className="inline-flex items-center gap-1">
                <Ruler className="h-3.5 w-3.5 text-stone-400" />
                {p.sizeSqm} m²
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
