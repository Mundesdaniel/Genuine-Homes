import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  INSTALLMENT,
  PaymentProvider,
  enumValues,
  type ListingSearchItem,
} from '@genuine-homes/shared';
import { installmentsApi } from '@/api/installments';
import { purchasesApi } from '@/api/purchases';
import { apiErrorMessage } from '@/lib/apiClient';
import { goToCheckout } from '@/lib/checkout';
import { formatMoney, titleCase } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';

/**
 * Buyer actions for a for-sale listing: pay the full price at once, or request
 * an installment plan. A requested plan isn't payable until the landlord accepts
 * it — so this offers both, the buyer's choice, on any for-sale property.
 */
export function SaleActions({ listing }: { listing: ListingSearchItem }) {
  const token = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();
  const returnUrl = `${window.location.origin}/payments/return`;

  const [provider, setProvider] = useState<string>('mtn_momo');
  const [showPlan, setShowPlan] = useState(false);
  const [depositPercent, setDepositPercent] = useState<number>(
    INSTALLMENT.MIN_DEPOSIT_PERCENT,
  );
  const [months, setMonths] = useState<number>(
    INSTALLMENT.ALLOWED_MONTHS[INSTALLMENT.ALLOWED_MONTHS.length - 1] ?? 12,
  );

  const buy = useMutation({
    mutationFn: () =>
      purchasesApi.buy(listing.id, {
        provider: provider as PaymentProvider,
        redirectUrl: returnUrl,
      }),
    onSuccess: (res) => {
      toast.success('Opening checkout…');
      goToCheckout(res.redirectUrl, navigate);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const requestPlan = useMutation({
    mutationFn: () =>
      installmentsApi.create({ listingId: listing.id, depositPercent, months }),
    onSuccess: (plan) => {
      toast.success('Plan requested — waiting for the owner to accept');
      navigate(`/plans/${plan.id}`);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deposit = Math.round((listing.price * depositPercent) / 100);
  const monthly = months ? Math.round((listing.price - deposit) / months) : 0;

  if (!token) {
    return (
      <div className="card space-y-3 p-5">
        <h3 className="font-semibold text-stone-800">Buy this property</h3>
        <p className="text-sm text-stone-500">
          Log in to pay in full or request a payment plan.
        </p>
        <Link to="/login" className="btn-primary w-full">
          Log in to continue
        </Link>
      </div>
    );
  }

  return (
    <div className="card space-y-4 p-5">
      <h3 className="font-semibold text-stone-800">Buy this property</h3>

      <div>
        <label className="label" htmlFor="buy-provider">
          Pay with
        </label>
        <select
          id="buy-provider"
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
        disabled={buy.isPending}
        onClick={() => buy.mutate()}
      >
        {buy.isPending
          ? 'Opening…'
          : `Pay in full · ${formatMoney(listing.price, listing.currency)}`}
      </button>

      <div className="border-t border-stone-100 pt-3">
        {!showPlan ? (
          <button
            className="btn-outline w-full"
            type="button"
            onClick={() => setShowPlan(true)}
          >
            Or request a payment plan
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-stone-500">
              Propose a plan — the owner reviews and accepts it before you pay the deposit.
            </p>
            <div>
              <label className="label">Deposit: {depositPercent}%</label>
              <input
                type="range"
                min={INSTALLMENT.MIN_DEPOSIT_PERCENT}
                max={INSTALLMENT.MAX_DEPOSIT_PERCENT}
                value={depositPercent}
                onChange={(e) => setDepositPercent(Number(e.target.value))}
                className="w-full accent-brand"
              />
            </div>
            <div>
              <label className="label">Duration</label>
              <select
                className="input"
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
              >
                {INSTALLMENT.ALLOWED_MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m} months
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 rounded-lg bg-amber-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500">Deposit</span>
                <span className="font-semibold">{formatMoney(deposit, listing.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Monthly × {months}</span>
                <span className="font-semibold">{formatMoney(monthly, listing.currency)}</span>
              </div>
            </div>
            <button
              className="btn-primary w-full"
              type="button"
              disabled={requestPlan.isPending}
              onClick={() => requestPlan.mutate()}
            >
              {requestPlan.isPending ? 'Sending…' : 'Request this plan'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
