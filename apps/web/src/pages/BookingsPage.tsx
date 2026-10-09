import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CalendarClock, CheckCircle2, MapPin, MessageCircle } from 'lucide-react';
import type { BookingResponse } from '@genuine-homes/shared';
import { bookingsApi } from '@/api/bookings';
import { Badge, ConfirmDialog, EmptyState, ErrorState, Spinner, statusTone } from '@/components/ui';
import { apiErrorMessage } from '@/lib/apiClient';
import { titleCase } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';

const SELLER_ROLES = ['landlord', 'agent', 'developer', 'admin'];

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function BookingsPage() {
  const user = useAuthStore((s) => s.user);
  const isSeller = Boolean(user && SELLER_ROLES.includes(user.role));
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['bookings'] });

  const [declineFor, setDeclineFor] = useState<string | null>(null);
  const [cancelFor, setCancelFor] = useState<string | null>(null);

  const mine = useQuery({
    queryKey: ['bookings', 'mine'],
    queryFn: () => bookingsApi.mine(),
  });
  const incoming = useQuery({
    queryKey: ['bookings', 'incoming'],
    queryFn: () => bookingsApi.incoming(),
    enabled: isSeller,
  });

  const onError = (e: unknown) => toast.error(apiErrorMessage(e));

  const accept = useMutation({
    mutationFn: (id: string) => bookingsApi.accept(id),
    onSuccess: () => {
      toast.success('Viewing accepted');
      void invalidate();
    },
    onError,
  });
  const decline = useMutation({
    mutationFn: (vars: { id: string; reason?: string }) =>
      bookingsApi.decline(vars.id, vars.reason),
    onSuccess: () => {
      toast.success('Viewing declined');
      setDeclineFor(null);
      void invalidate();
    },
    onError,
  });
  const cancel = useMutation({
    mutationFn: (id: string) => bookingsApi.cancel(id),
    onSuccess: () => {
      toast.success('Viewing cancelled');
      setCancelFor(null);
      void invalidate();
    },
    onError,
  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-800">My viewings</h1>
        <p className="mt-1 text-sm text-stone-500">
          Viewings you have requested. The owner is notified and accepts or declines.
        </p>

        <div className="mt-4">
          {mine.isLoading ? (
            <Spinner label="Loading your viewings…" />
          ) : mine.isError ? (
            <ErrorState
              message={apiErrorMessage(mine.error) || 'Could not load your viewings'}
              onRetry={() => void mine.refetch()}
            />
          ) : mine.data && mine.data.items.length > 0 ? (
            <ul className="space-y-3">
              {mine.data.items.map((b) => (
                <MyBookingRow
                  key={b.id}
                  booking={b}
                  onCancel={() => setCancelFor(b.id)}
                  canceling={cancel.isPending && cancelFor === b.id}
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No viewings yet"
              hint="Find a property you like and book a viewing from its page."
              action={{ label: 'Browse listings', onClick: () => (window.location.href = '/') }}
            />
          )}
        </div>
      </div>

      {isSeller && (
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-stone-800">
            Requests for your properties
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Buyers who want to view a property you posted.
          </p>

          <div className="mt-4">
            {incoming.isLoading ? (
              <Spinner label="Loading requests…" />
            ) : incoming.isError ? (
              <ErrorState
                message={apiErrorMessage(incoming.error) || 'Could not load requests'}
                onRetry={() => void incoming.refetch()}
              />
            ) : incoming.data && incoming.data.items.length > 0 ? (
              <ul className="space-y-3">
                {incoming.data.items.map((b) => (
                  <IncomingBookingRow
                    key={b.id}
                    booking={b}
                    onAccept={() => accept.mutate(b.id)}
                    onDecline={() => setDeclineFor(b.id)}
                    busy={accept.isPending || decline.isPending}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No viewing requests"
                hint="When a buyer books a viewing of your property, it shows up here."
              />
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={declineFor !== null}
        title="Decline this viewing?"
        body="The buyer will be notified."
        confirmLabel="Decline"
        danger
        busy={decline.isPending}
        notes={{ label: 'Reason (optional)', placeholder: 'e.g. that slot is taken' }}
        onConfirm={(reason) => declineFor && decline.mutate({ id: declineFor, reason })}
        onCancel={() => setDeclineFor(null)}
      />
      <ConfirmDialog
        open={cancelFor !== null}
        title="Cancel this viewing?"
        body="The owner will be notified that you cancelled."
        confirmLabel="Cancel viewing"
        danger
        busy={cancel.isPending}
        onConfirm={() => cancelFor && cancel.mutate(cancelFor)}
        onCancel={() => setCancelFor(null)}
      />
    </div>
  );
}

function MyBookingRow({
  booking,
  onCancel,
  canceling,
}: {
  booking: BookingResponse;
  onCancel: () => void;
  canceling: boolean;
}) {
  const cancellable = booking.status === 'pending' || booking.status === 'accepted';
  // Snapshot "now" once (Date.now() is impure and can't run during render).
  const [now] = useState(() => Date.now());
  // Once an accepted viewing's time has passed, the buyer has had the chance to
  // see the house — offer the decision: proceed to payment, or cancel.
  const viewed =
    booking.status === 'accepted' && new Date(booking.scheduledAt).getTime() <= now;
  return (
    <li className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/listings/${booking.listingId}`}
            className="font-medium text-stone-800 hover:text-brand"
          >
            {booking.propertyTitle}
          </Link>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-stone-500">
            <CalendarClock className="h-3.5 w-3.5 text-stone-400" />
            {formatWhen(booking.scheduledAt)}
          </p>
          {booking.message && (
            <p className="mt-1 text-sm text-stone-500">“{booking.message}”</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Badge label={titleCase(booking.status)} tone={statusTone(booking.status)} />
          {booking.status === 'accepted' && (
            <Link
              to={`/messages?to=${booking.ownerId}&listingId=${booking.listingId}`}
              className="btn-outline"
            >
              <MessageCircle className="h-4 w-4" />
              Message
            </Link>
          )}
          {cancellable && !viewed && (
            <button
              className="btn-outline"
              type="button"
              onClick={onCancel}
              disabled={canceling}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {viewed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="flex items-center gap-1.5 text-sm text-emerald-900">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Been to see it? If you like it, continue to payment — otherwise let the owner know.
          </p>
          <div className="flex gap-2">
            <button
              className="btn-outline"
              type="button"
              onClick={onCancel}
              disabled={canceling}
            >
              Not interested
            </button>
            <Link to={`/listings/${booking.listingId}`} className="btn-primary">
              Proceed to payment
            </Link>
          </div>
        </div>
      )}
    </li>
  );
}

function IncomingBookingRow({
  booking,
  onAccept,
  onDecline,
  busy,
}: {
  booking: BookingResponse;
  onAccept: () => void;
  onDecline: () => void;
  busy: boolean;
}) {
  return (
    <li className="card flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <Link
          to={`/listings/${booking.listingId}`}
          className="flex items-center gap-1.5 font-medium text-stone-800 hover:text-brand"
        >
          <MapPin className="h-3.5 w-3.5 text-stone-400" />
          {booking.propertyTitle}
        </Link>
        <p className="mt-0.5 text-sm text-stone-600">
          {booking.buyer.fullName} · {booking.buyer.phone}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-stone-500">
          <CalendarClock className="h-3.5 w-3.5 text-stone-400" />
          {formatWhen(booking.scheduledAt)}
        </p>
        {booking.message && (
          <p className="mt-1 text-sm text-stone-500">“{booking.message}”</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {booking.status === 'pending' ? (
          <>
            <button className="btn-outline" type="button" onClick={onDecline} disabled={busy}>
              Decline
            </button>
            <button className="btn-primary" type="button" onClick={onAccept} disabled={busy}>
              Accept
            </button>
          </>
        ) : (
          <>
            <Badge label={titleCase(booking.status)} tone={statusTone(booking.status)} />
            {booking.status === 'accepted' && (
              <Link
                to={`/messages?to=${booking.buyerId}&listingId=${booking.listingId}`}
                className="btn-outline"
              >
                <MessageCircle className="h-4 w-4" />
                Message
              </Link>
            )}
          </>
        )}
      </div>
    </li>
  );
}
