// Small presentational helpers used across pages.

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-stone-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-brand" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm font-medium text-red-700">{message}</p>
      {onRetry && (
        <button className="btn-outline mt-3" onClick={onRetry} type="button">
          Try again
        </button>
      )}
    </div>
  );
}

// Skeleton placeholders that mimic the card grid while results load.
export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card overflow-hidden">
          <div className="skeleton aspect-[4/3] rounded-b-none" />
          <div className="space-y-2 p-4">
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-3 w-1/2" />
            <div className="skeleton h-5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
      <p className="font-medium text-stone-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-stone-500">{hint}</p>}
    </div>
  );
}

/**
 * Badge tones are *intents*, not domain values — status colour is risk
 * communication on a payments product. Pages map their domain values through
 * `statusTone` so a defaulted plan can never accidentally render in a benign
 * colour just because some other domain value happened to share a key.
 */
export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE: Record<BadgeTone, string> = {
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-indigo-100 text-indigo-800',
  neutral: 'bg-stone-100 text-stone-700',
};

/** One domain→intent map for every status/category rendered as a badge. */
const STATUS_INTENT: Record<string, BadgeTone> = {
  // Listing categories (colour-coded for scanability, matching the old palette)
  rent: 'success',
  sale: 'warning',
  installment: 'info',
  // Verification
  verified: 'success',
  rejected: 'danger',
  unverified: 'neutral',
  // Payment statuses
  successful: 'success',
  failed: 'danger',
  refunded: 'neutral',
  // Plan lifecycle
  active: 'success',
  completed: 'success',
  pending_deposit: 'warning',
  pending: 'warning',
  defaulted: 'danger',
  cancelled: 'neutral',
  // Installment schedule items
  paid: 'success',
  upcoming: 'neutral',
  late: 'warning',
  missed: 'danger',
  // Property lifecycle
  draft: 'neutral',
  rented: 'info',
  sold: 'info',
  suspended: 'danger',
};

export function statusTone(value: string): BadgeTone {
  return STATUS_INTENT[value] ?? 'neutral';
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  return <span className={`chip ${TONE[tone]}`}>{label}</span>;
}
