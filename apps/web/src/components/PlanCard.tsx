import { Link } from 'react-router-dom';
import type { InstallmentPlanDetail } from '@genuine-homes/shared';
import { formatMoney, titleCase } from '@/lib/format';
import { Badge, statusTone } from './ui';

export function PlanCard({ plan }: { plan: InstallmentPlanDetail }) {
  const pct = plan.months ? Math.round((plan.paidCount / plan.months) * 100) : 0;
  return (
    <Link to={`/plans/${plan.id}`} className="card card-hover block p-4">
      <div className="flex items-center justify-between">
        <Badge label={titleCase(plan.status)} tone={statusTone(plan.status)} />
        <span className="text-xs text-stone-400">{plan.months} months</span>
      </div>
      <p className="mt-2 font-display text-lg font-bold tabular-nums text-brand-dark">
        {formatMoney(plan.totalPrice, plan.currency)}
      </p>
      <p className="text-xs text-stone-500">
        Deposit {formatMoney(plan.depositAmount, plan.currency)}
      </p>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-stone-500">
          <span>
            {plan.paidCount}/{plan.months} paid
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
          <div
            className="h-full rounded-full bg-brand transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {plan.status === 'active' && plan.nextDueDate && (
        <p className="mt-2 text-xs text-stone-500">Next due {plan.nextDueDate}</p>
      )}
      {plan.status === 'pending_deposit' && (
        <p className="mt-2 text-xs font-medium text-brand-dark">Pay deposit to activate →</p>
      )}
    </Link>
  );
}
