import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { INSTALLMENT, type ListingSearchItem } from '@genuine-homes/shared';
import { installmentsApi } from '@/api/installments';
import { apiErrorMessage } from '@/lib/apiClient';
import { formatMoney } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';

/** Lets a buyer turn an installment listing into a plan, with a live preview. */
export function InstallmentPanel({ listing }: { listing: ListingSearchItem }) {
  const token = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();

  const minDeposit = listing.minDepositPercent ?? INSTALLMENT.MIN_DEPOSIT_PERCENT;
  const maxMonths = listing.maxInstallmentMonths ?? INSTALLMENT.MAX_MONTHS;
  const monthOptions = INSTALLMENT.ALLOWED_MONTHS.filter((m) => m <= maxMonths);

  const [depositPercent, setDepositPercent] = useState<number>(minDeposit);
  const [months, setMonths] = useState<number>(
    monthOptions[monthOptions.length - 1] ?? maxMonths,
  );

  const create = useMutation({
    mutationFn: () =>
      installmentsApi.create({ listingId: listing.id, depositPercent, months }),
    onSuccess: (plan) => {
      toast.success('Plan created — pay the deposit to activate');
      navigate(`/plans/${plan.id}`);
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const deposit = Math.round((listing.price * depositPercent) / 100);
  const monthly = months ? Math.round((listing.price - deposit) / months) : 0;

  return (
    <div className="card space-y-3 p-5">
      <h3 className="font-semibold text-stone-800">Buy on installment</h3>

      <div>
        <label className="label">Deposit: {depositPercent}%</label>
        <input
          type="range"
          min={minDeposit}
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
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {m} months
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1 rounded-lg bg-amber-50 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-stone-500">Deposit today</span>
          <span className="font-semibold">{formatMoney(deposit, listing.currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-500">Monthly × {months}</span>
          <span className="font-semibold">{formatMoney(monthly, listing.currency)}</span>
        </div>
      </div>

      {token ? (
        <button
          className="btn-primary w-full"
          type="button"
          disabled={create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? 'Creating…' : 'Start plan'}
        </button>
      ) : (
        <Link to="/login" className="btn-primary w-full">
          Log in to start a plan
        </Link>
      )}
    </div>
  );
}
