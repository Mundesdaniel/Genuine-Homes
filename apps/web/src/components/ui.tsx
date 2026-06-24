// Small presentational helpers used across pages.

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-stone-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-brand" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
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

const TONE: Record<string, string> = {
  rent: 'bg-emerald-100 text-emerald-800',
  sale: 'bg-amber-100 text-amber-800',
  installment: 'bg-indigo-100 text-indigo-800',
  verified: 'bg-emerald-100 text-emerald-800',
  default: 'bg-stone-100 text-stone-700',
};

export function Badge({ label, tone }: { label: string; tone?: string }) {
  return <span className={`chip ${TONE[tone ?? 'default'] ?? TONE.default}`}>{label}</span>;
}
