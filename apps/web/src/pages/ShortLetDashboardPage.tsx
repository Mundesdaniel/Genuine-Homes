import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { SelectableListing, ShortLetListingSummary } from '@genuine-homes/shared';
import { shortLetApi } from '@/api/short-let';
import { EarningsChart } from '@/components/charts';
import { ShortLetCalendar } from '@/components/ShortLetCalendar';
import { Badge, EmptyState, ErrorState, Spinner, statusTone } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';
import { formatMoney } from '@/lib/format';

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00.000Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
const pct = (rate: number) => `${Math.round(rate * 100)}%`;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="font-display text-2xl font-bold tabular-nums text-brand-dark">{value}</p>
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
    </div>
  );
}

/** A thin occupancy bar (0..1). */
function OccupancyBar({ rate }: { rate: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-gold"
        style={{ width: `${Math.min(100, Math.round(rate * 100))}%` }}
      />
    </div>
  );
}

function RecordActivity({
  listings,
  onDone,
}: {
  listings: SelectableListing[];
  onDone: () => void;
}) {
  const [booking, setBooking] = useState({
    listingId: listings[0]?.listingId ?? '',
    checkIn: '',
    checkOut: '',
    amount: '',
    guestName: '',
  });
  const [block, setBlock] = useState({
    listingId: listings[0]?.listingId ?? '',
    startDate: '',
    endDate: '',
    note: '',
  });

  const createBooking = useMutation({
    mutationFn: () =>
      shortLetApi.createBooking({
        listingId: booking.listingId,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        amount: Number(booking.amount),
        guestName: booking.guestName.trim() === '' ? undefined : booking.guestName,
      }),
    onSuccess: () => {
      toast.success('Booking recorded');
      setBooking((b) => ({ ...b, checkIn: '', checkOut: '', amount: '', guestName: '' }));
      onDone();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const createBlock = useMutation({
    mutationFn: () =>
      shortLetApi.createBlock({
        listingId: block.listingId,
        startDate: block.startDate,
        endDate: block.endDate,
        note: block.note.trim() === '' ? undefined : block.note,
      }),
    onSuccess: () => {
      toast.success('Dates blocked');
      setBlock((b) => ({ ...b, startDate: '', endDate: '', note: '' }));
      onDone();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (listings.length === 0) {
    return (
      <EmptyState
        title="No listings yet"
        hint="Create a property and a listing first — then record short-let bookings here."
      />
    );
  }

  const bookingReady =
    booking.listingId && booking.checkIn && booking.checkOut && Number(booking.amount) > 0;
  const blockReady = block.listingId && block.startDate && block.endDate;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Record a booking */}
      <form
        className="card space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          createBooking.mutate();
        }}
      >
        <h3 className="font-semibold text-stone-800">Record a booking</h3>
        <div>
          <label className="label" htmlFor="b-listing">
            Listing
          </label>
          <select
            id="b-listing"
            className="input"
            value={booking.listingId}
            onChange={(e) => setBooking((b) => ({ ...b, listingId: e.target.value }))}
          >
            {listings.map((l) => (
              <option key={l.listingId} value={l.listingId}>
                {l.title}
                {l.isShortLet ? '' : ' (not yet short-let)'}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="b-in">
              Check-in
            </label>
            <input
              id="b-in"
              type="date"
              className="input"
              value={booking.checkIn}
              onChange={(e) => setBooking((b) => ({ ...b, checkIn: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="b-out">
              Check-out
            </label>
            <input
              id="b-out"
              type="date"
              className="input"
              value={booking.checkOut}
              onChange={(e) => setBooking((b) => ({ ...b, checkOut: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="b-amount">
              Income (UGX)
            </label>
            <input
              id="b-amount"
              type="number"
              min="0"
              className="input"
              value={booking.amount}
              onChange={(e) => setBooking((b) => ({ ...b, amount: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="b-guest">
              Guest (optional)
            </label>
            <input
              id="b-guest"
              className="input"
              value={booking.guestName}
              onChange={(e) => setBooking((b) => ({ ...b, guestName: e.target.value }))}
            />
          </div>
        </div>
        <button
          className="btn-primary"
          type="submit"
          disabled={createBooking.isPending || !bookingReady}
        >
          {createBooking.isPending ? 'Saving…' : 'Record booking'}
        </button>
      </form>

      {/* Block dates */}
      <form
        className="card space-y-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          createBlock.mutate();
        }}
      >
        <h3 className="font-semibold text-stone-800">Block dates</h3>
        <div>
          <label className="label" htmlFor="k-listing">
            Listing
          </label>
          <select
            id="k-listing"
            className="input"
            value={block.listingId}
            onChange={(e) => setBlock((b) => ({ ...b, listingId: e.target.value }))}
          >
            {listings.map((l) => (
              <option key={l.listingId} value={l.listingId}>
                {l.title}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="k-start">
              From
            </label>
            <input
              id="k-start"
              type="date"
              className="input"
              value={block.startDate}
              onChange={(e) => setBlock((b) => ({ ...b, startDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="k-end">
              To (inclusive)
            </label>
            <input
              id="k-end"
              type="date"
              className="input"
              value={block.endDate}
              onChange={(e) => setBlock((b) => ({ ...b, endDate: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="k-note">
            Note (optional)
          </label>
          <input
            id="k-note"
            className="input"
            placeholder="e.g. Maintenance"
            value={block.note}
            onChange={(e) => setBlock((b) => ({ ...b, note: e.target.value }))}
          />
        </div>
        <button
          className="btn-outline"
          type="submit"
          disabled={createBlock.isPending || !blockReady}
        >
          {createBlock.isPending ? 'Saving…' : 'Block dates'}
        </button>
      </form>
    </div>
  );
}

function ListingCard({ listing }: { listing: ShortLetListingSummary }) {
  return (
    <div className="card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-stone-800">{listing.title}</h3>
          <p className="text-sm text-stone-500">
            {formatMoney(listing.nightlyPrice, listing.currency)} / night
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-bold tabular-nums text-brand-dark">
            {formatMoney(listing.income, listing.currency)}
          </p>
          <p className="text-xs text-stone-500">income</p>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
          <span>Occupancy (next 30 days)</span>
          <span className="font-semibold text-stone-700">{pct(listing.occupancyRate)}</span>
        </div>
        <OccupancyBar rate={listing.occupancyRate} />
        <p className="mt-1 text-xs text-stone-400">
          {listing.bookedNights} booked · {listing.availableNights} available nights
        </p>
      </div>

      <ShortLetCalendar bookings={listing.bookings} blocks={listing.blocks} />

      {listing.bookings.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-stone-500">
                <th className="py-2 pr-4">Stay</th>
                <th className="py-2 pr-4">Guest</th>
                <th className="py-2 pr-4">Nights</th>
                <th className="py-2 pr-4 text-right">Income</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {listing.bookings.map((b) => (
                <tr key={b.id} className="border-b border-stone-100">
                  <td className="py-2 pr-4 text-stone-600">
                    {formatDate(b.checkIn)} → {formatDate(b.checkOut)}
                  </td>
                  <td className="py-2 pr-4 text-stone-500">{b.guestName ?? '—'}</td>
                  <td className="py-2 pr-4 tabular-nums">{b.nights}</td>
                  <td className="py-2 pr-4 text-right font-medium tabular-nums text-stone-800">
                    {formatMoney(b.amount, b.currency)}
                  </td>
                  <td className="py-2 pr-4">
                    <Badge label={b.status} tone={statusTone(b.status)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ShortLetDashboardPage() {
  const queryClient = useQueryClient();
  const [showForms, setShowForms] = useState(false);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['short-let', 'dashboard'],
    queryFn: () => shortLetApi.dashboard(),
  });

  if (isLoading) return <Spinner label="Loading short-let dashboard…" />;
  if (isError || !data)
    return <ErrorState message={apiErrorMessage(error)} onRetry={() => refetch()} />;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['short-let', 'dashboard'] });

  return (
    <div className="animate-fade-in space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-800">
            Short-let dashboard
          </h1>
          <p className="text-sm text-stone-500">
            {data.subscription.plan} subscription · active until{' '}
            {formatDate(data.subscription.expiresAt.slice(0, 10))}
          </p>
        </div>
        <button
          className={showForms ? 'btn-primary' : 'btn-outline'}
          type="button"
          onClick={() => setShowForms((v) => !v)}
        >
          {showForms ? 'Close' : 'Record booking / block'}
        </button>
      </div>

      {showForms && (
        <RecordActivity
          listings={data.selectableListings}
          onDone={() => {
            refresh();
            setShowForms(false);
          }}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Income" value={formatMoney(data.totals.income, data.totals.currency)} />
        <Stat label="Occupancy (30d)" value={pct(data.totals.occupancyRate)} />
        <Stat label="Short-let listings" value={String(data.totals.listings)} />
        <Stat label="Bookings" value={String(data.totals.bookings)} />
      </div>

      {/* Income trend (reuses the dashboard EarningsChart) */}
      <div className="card p-5">
        <h2 className="mb-2 text-sm font-semibold text-stone-700">Income over time</h2>
        <EarningsChart
          byMonth={data.incomeByMonth}
          total={data.totals.income}
          currency={data.totals.currency}
        />
      </div>

      {/* Per-listing */}
      {data.listings.length === 0 ? (
        <EmptyState
          title="No short-let listings yet"
          hint="Record a booking against one of your listings to start tracking it here."
        />
      ) : (
        <div className="space-y-6">
          {data.listings.map((l) => (
            <ListingCard key={l.listingId} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}
