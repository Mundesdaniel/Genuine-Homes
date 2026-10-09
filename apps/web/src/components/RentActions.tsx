import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  PaymentProvider,
  RENTAL,
  enumValues,
  type ListingSearchItem,
  type PaymentProvider as PaymentProviderValue,
} from '@genuine-homes/shared';
import { rentalsApi } from '@/api/rentals';
import { apiErrorMessage } from '@/lib/apiClient';
import { goToCheckout } from '@/lib/checkout';
import { formatMoney, titleCase } from '@/lib/format';
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

  const [provider, setProvider] = useState<string>('mtn_momo');
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
        provider: provider as PaymentProviderValue,
        redirectUrl: returnUrl,
      });
    },
    onSuccess: (res) => {
      toast.success('Opening checkout…');
      goToCheckout(res.redirectUrl, navigate);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (!token) {
    return (
      <div className="card space-y-3 p-5">
        <h3 className="font-semibold text-stone-800">Rent this property</h3>
        <p className="text-sm text-stone-500">Log in to start a rental and pay your first rent.</p>
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

      <div>
        <label className="label" htmlFor="rent-provider">
          Pay with
        </label>
        <select
          id="rent-provider"
          className="input"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          {enumValues(PaymentProvider).map((p) => (
            <option key={p} value={p}>
              {titleCase(p)}
            </option>
          ))}
        </select>
      </div>

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
