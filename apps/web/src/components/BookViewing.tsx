import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CalendarCheck } from 'lucide-react';
import type { ListingSearchItem } from '@genuine-homes/shared';
import { bookingsApi } from '@/api/bookings';
import { apiErrorMessage } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

// YYYY-MM-DD for an <input type="date"> default of tomorrow.
function tomorrow(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * "Book a viewing" — replaces the old "Contact seller" action. A logged-in
 * buyer picks a date/time (+ optional note); the owner who posted the property
 * is notified and can accept or decline from their bookings page.
 */
export function BookViewing({
  listing,
  taken,
}: {
  listing: ListingSearchItem;
  taken: boolean;
}) {
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(tomorrow());
  const [time, setTime] = useState('10:00');
  const [message, setMessage] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const book = useMutation({
    mutationFn: () =>
      bookingsApi.create({
        listingId: listing.id,
        scheduledAt: new Date(`${date}T${time}`).toISOString(),
        message: message.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Viewing requested — the owner has been notified');
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setOpen(false);
      setMessage('');
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // The owner never books their own property; a taken property can't be viewed.
  if (user?.id === listing.property.ownerId || taken) return null;

  if (!token) {
    return (
      <button
        className="btn-primary mt-4 w-full"
        type="button"
        onClick={() => navigate('/login')}
      >
        Log in to book a viewing
      </button>
    );
  }

  const submit = () => {
    if (!date || !time) {
      toast.error('Pick a date and time');
      return;
    }
    if (new Date(`${date}T${time}`).getTime() <= Date.now()) {
      toast.error('Pick a viewing time in the future');
      return;
    }
    book.mutate();
  };

  return (
    <>
      <button
        className="btn-primary mt-4 w-full"
        type="button"
        onClick={() => setOpen(true)}
      >
        <CalendarCheck className="h-4 w-4" />
        Book a viewing
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[1100] grid place-items-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Book a viewing"
            className="card w-full max-w-sm p-6 outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-stone-800">Book a viewing</h2>
            <p className="mt-1 text-sm text-stone-500">{listing.property.title}</p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="booking-date">
                  Date
                </label>
                <input
                  id="booking-date"
                  type="date"
                  className="input"
                  min={tomorrow()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="booking-time">
                  Time
                </label>
                <input
                  id="booking-time"
                  type="time"
                  className="input"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="label" htmlFor="booking-message">
                Message <span className="font-normal text-stone-400">(optional)</span>
              </label>
              <textarea
                id="booking-message"
                className="input min-h-[70px]"
                placeholder="Anything the owner should know?"
                maxLength={500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                className="btn-outline"
                type="button"
                onClick={() => setOpen(false)}
                disabled={book.isPending}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                type="button"
                onClick={submit}
                disabled={book.isPending}
              >
                {book.isPending ? 'Sending…' : 'Request viewing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
