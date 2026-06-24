import { Link } from 'react-router-dom';
import type { ListingSearchItem } from '@genuine-homes/shared';
import { formatDistance, formatMoney, titleCase } from '@/lib/format';
import { Badge } from './ui';

const PERIOD_SUFFIX: Record<string, string> = { monthly: '/mo', yearly: '/yr' };

export function ListingCard({ item }: { item: ListingSearchItem }) {
  const p = item.property;
  const distance = formatDistance(item.distanceM);
  const suffix =
    item.listingType === 'rent' && item.rentPeriod
      ? PERIOD_SUFFIX[item.rentPeriod] ?? ''
      : '';
  const specs = [
    p.bedrooms != null ? `${p.bedrooms} bd` : null,
    p.bathrooms != null ? `${p.bathrooms} ba` : null,
    p.sizeSqm != null ? `${p.sizeSqm} m²` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      to={`/listings/${item.id}`}
      className="card card-hover group animate-fade-in overflow-hidden"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-stone-100">
        {p.coverImageUrl ? (
          <img
            src={p.coverImageUrl}
            alt={p.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-stone-400">
            No photo
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={titleCase(item.listingType)} tone={item.listingType} />
          {p.verificationStatus === 'verified' && (
            <Badge label="Verified" tone="verified" />
          )}
        </div>
        <h3 className="line-clamp-1 font-semibold text-stone-800">{p.title}</h3>
        <p className="text-sm text-stone-500">
          {[p.area, p.district].filter(Boolean).join(', ')}
        </p>
        <div className="flex items-baseline justify-between pt-1">
          <span className="text-lg font-bold text-brand-dark">
            {formatMoney(item.price, item.currency)}
            <span className="text-sm font-medium text-stone-400">{suffix}</span>
          </span>
          {distance && <span className="text-xs text-stone-400">{distance}</span>}
        </div>
        {specs && <p className="text-xs text-stone-500">{specs}</p>}
      </div>
    </Link>
  );
}
