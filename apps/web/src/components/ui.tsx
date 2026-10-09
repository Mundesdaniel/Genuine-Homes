// Small presentational helpers used across pages.
import { useEffect, useRef, useState } from 'react';
import { SearchX } from 'lucide-react';

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

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  /** Optional way out — e.g. "Clear filters" — so an empty view is never a dead end. */
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand">
        <SearchX className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <p className="mt-3 font-medium text-stone-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-stone-500">{hint}</p>}
      {action && (
        <button className="btn-outline mt-4" type="button" onClick={action.onClick}>
          {action.label}
        </button>
      )}
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
  pending_approval: 'warning',
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
  reserved: 'warning',
  rented: 'info',
  sold: 'info',
  suspended: 'danger',
  // Booking (viewing) lifecycle — 'pending'/'cancelled' shared with the above.
  accepted: 'success',
  declined: 'danger',
};

export function statusTone(value: string): BadgeTone {
  return STATUS_INTENT[value] ?? 'neutral';
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  return <span className={`chip ${TONE[tone]}`}>{label}</span>;
}

/**
 * In-app confirmation dialog — replaces `window.confirm` (unstylable, jarring)
 * for destructive or consequential actions. Optionally collects a note (e.g. a
 * rejection reason). ESC or the backdrop cancels; the panel takes focus on open.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  danger = false,
  notes,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
  /** Show a textarea and pass its value to onConfirm. */
  notes?: { label: string; placeholder?: string };
  busy?: boolean;
  onConfirm: (notes?: string) => void;
  onCancel: () => void;
}) {
  const [noteText, setNoteText] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const cancel = () => {
    setNoteText('');
    onCancel();
  };
  const confirm = () => {
    const value = noteText.trim() || undefined;
    setNoteText('');
    onConfirm(value);
  };

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[1100] grid place-items-center bg-black/40 p-4"
      onClick={cancel}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card w-full max-w-sm p-6 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-stone-800">{title}</h2>
        {body && <p className="mt-2 text-sm text-stone-600">{body}</p>}
        {notes && (
          <div className="mt-4">
            <label className="label" htmlFor="confirm-dialog-notes">
              {notes.label}
            </label>
            <textarea
              id="confirm-dialog-notes"
              className="input min-h-[70px]"
              placeholder={notes.placeholder}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-outline" type="button" onClick={cancel} disabled={busy}>
            Cancel
          </button>
          <button
            className={danger ? 'btn bg-red-600 text-white hover:bg-red-700' : 'btn-primary'}
            type="button"
            disabled={busy}
            onClick={confirm}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
