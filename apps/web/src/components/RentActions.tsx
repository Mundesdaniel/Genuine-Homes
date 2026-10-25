import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PaymentProvider, RENTAL, type ListingSearchItem } from '@genuine-homes/shared';
import { rentalsApi } from '@/api/rentals';
import { apiErrorMessage } from '@/lib/apiClient';
import { handlePaymentResult } from '@/lib/checkout';
import { formatMoney } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';

const TERMS = [6, 12, 24, 36].filter((m) => m >= RENTAL.MIN_MONTHS && m <= RENTAL.MAX_MONTHS);

/**
 * Tenant actions for a rent listing: pick a move-in date and (optional) term,
 * then pay the first month's rent. Paying creates the agreement and activates it
 * once the payment settles.
 */
export function RentActions({ listing }: { listing: ListingSearchItem }) {
  const token = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();
  const returnUrl = `${window.location.origin}/payments/return`;

  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [months, setMonths] = useState<string>('');

  const monthly =
    listing.rentPeriod === 'yearly' ? Math.round(listing.price / 12) : listing.price;

  const rent = useMutation({
    mutationFn: async () => {
      const agreement = await rentalsApi.create({
        listingId: listing.id,
        startDate,
        months: months ? Number(months) : undefined,
      });
      return rentalsApi.payRent(agreement.id, {
        provider: PaymentProvider.CASH,
        redirectUrl: returnUrl,
      });
    },
    onSuccess: (res) => handlePaymentResult(res, navigate),
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (!token) {
    return (
      <div className="card space-y-3 p-5">
        <h3 className="font-semibold text-stone-800">Rent this property</h3>
        <p className="text-sm text-stone-500">
          Log in to start a rental and pay your first rent.
        </p>
        <Link to="/login" className="btn-primary w-full">
          Log in to continue
        </Link>
      </div>
    );
  }

  return (
    <div className="card space-y-4 p-5">
      <h3 className="font-semibold text-stone-800">Rent this property</h3>

      <div>
        <label className="label" htmlFor="rent-start">
          Move-in date
        </label>
        <input
          id="rent-start"
          type="date"
          className="input"
          value={startDate}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="rent-term">
          Term
        </label>
        <select
          id="rent-term"
          className="input"
          value={months}
          onChange={(e) => setMonths(e.target.value)}
        >
          <option value="">Open-ended</option>
          {TERMS.map((m) => (
            <option key={m} value={m}>
              {m} months
            </option>
          ))}
        </select>
      </div>

      <p className="rounded-lg bg-stone-50 p-3 text-xs text-stone-500">
        Rent is paid in cash, in person. Your payment is recorded as pending until the owner
        confirms they’ve received the cash.
      </p>

      <button
        className="btn-primary w-full"
        type="button"
        disabled={rent.isPending || !startDate}
        onClick={() => rent.mutate()}
      >
        {rent.isPending
          ? 'Opening…'
          : `Pay first month · ${formatMoney(monthly, listing.currency)}`}
      </button>
      <p className="text-center text-xs text-stone-400">
        You pay one month at a time. The home is only marked rented once this payment settles.
      </p>
    </div>
  );
}
