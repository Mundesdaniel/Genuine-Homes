import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PaymentResponse, PropertySummary } from '@genuine-homes/shared';
import { formatMoney, titleCase } from '@/lib/format';

const monthLabel = (ym: string): string => {
  const [year, month] = ym.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, 1).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });
};

// Compact currency for axis ticks, e.g. 1_200_000 -> "1.2M".
const compact = (v: number): string =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`;

// Distinct, brand-aligned colours per property status.
const STATUS_COLORS: Record<string, string> = {
  active: '#16a34a',
  reserved: '#ca8a04',
  rented: '#2563eb',
  sold: '#7c3aed',
  draft: '#a8a29e',
  suspended: '#dc2626',
};
const colorFor = (status: string): string => STATUS_COLORS[status] ?? '#a16207';

// Shared area chart over monthly { month, amount } points.
function MonthlyAreaChart({
  data,
  gradientId,
}: {
  data: { month: string; amount: number }[];
  gradientId: string;
}) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#facc15" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#facc15" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f1f1" />
          <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            tickFormatter={compact}
            fontSize={11}
            width={34}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ stroke: '#e7e5e4' }}
            formatter={(v: number) => [formatMoney(v), 'Amount']}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#a16207"
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={{ r: 3, fill: '#a16207', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Successful payments over time: a headline total for an instant read, plus an
 * area chart of the last six months with a currency tooltip.
 */
export function PaymentsTrendChart({ payments }: { payments: PaymentResponse[] }) {
  const byMonth = new Map<string, number>();
  let total = 0;
  for (const p of payments) {
    if (p.status !== 'successful') continue;
    const key = p.createdAt.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + p.amount);
    total += p.amount;
  }
  const data = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, amount]) => ({ month: monthLabel(month).split(' ')[0], amount }));

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-stone-400">No payments yet.</p>;
  }
  return (
    <div>
      <p className="font-display text-2xl font-bold tabular-nums text-brand-dark">
        {formatMoney(total)}
      </p>
      <p className="mb-3 text-xs text-stone-500">paid out to date</p>
      <MonthlyAreaChart data={data} gradientId="paymentFill" />
    </div>
  );
}

/**
 * Income a seller has received across their listings over time: a headline total
 * received plus an area chart of the last six months. Data arrives pre-aggregated
 * from the earnings endpoint.
 */
export function EarningsChart({
  byMonth,
  total,
  currency,
}: {
  byMonth: { month: string; amount: number }[];
  total: number;
  currency: string;
}) {
  const data = byMonth
    .slice()
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6)
    .map((r) => ({ month: monthLabel(r.month).split(' ')[0], amount: r.amount }));

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-stone-400">No earnings yet.</p>;
  }
  return (
    <div>
      <p className="font-display text-2xl font-bold tabular-nums text-brand-dark">
        {formatMoney(total, currency)}
      </p>
      <p className="mb-3 text-xs text-stone-500">received to date</p>
      <MonthlyAreaChart data={data} gradientId="earningsFill" />
    </div>
  );
}

/** Paid vs remaining for a plan as a gradient radial progress ring. */
export function ProgressRing({ paid, remaining }: { paid: number; remaining: number }) {
  const total = Math.max(paid + remaining, 0);
  const pct = total > 0 ? Math.round((Math.max(paid, 0) / total) * 100) : 0;
  const size = 136;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a16207" />
              <stop offset="100%" stopColor="#facc15" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e7e5e4"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 700ms ease' }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <span className="font-display text-3xl font-bold tabular-nums text-brand-dark">
              {pct}%
            </span>
            <span className="block text-[0.65rem] uppercase tracking-wide text-stone-400">
              paid
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex w-full justify-between text-xs text-stone-500">
        <span>{formatMoney(paid)} paid</span>
        <span>{formatMoney(Math.max(remaining, 0))} left</span>
      </div>
    </div>
  );
}

/**
 * Properties by status: a donut with the total in the centre and a legend that
 * spells out each status and its count — readable at a glance.
 */
export function PropertiesStatusChart({ properties }: { properties: PropertySummary[] }) {
  const counts = new Map<string, number>();
  for (const p of properties) counts.set(p.status, (counts.get(p.status) ?? 0) + 1);
  const data = [...counts.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([status, count]) => ({ raw: status, status: titleCase(status), count }));
  const total = properties.length;

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-stone-400">No properties yet.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              innerRadius={52}
              outerRadius={78}
              paddingAngle={2}
              animationDuration={600}
            >
              {data.map((d) => (
                <Cell key={d.raw} fill={colorFor(d.raw)} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number, n: string) => [v, n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <span className="font-display text-2xl font-bold tabular-nums text-brand-dark">
              {total}
            </span>
            <span className="block text-[0.65rem] uppercase tracking-wide text-stone-400">
              {total === 1 ? 'property' : 'total'}
            </span>
          </div>
        </div>
      </div>
      <ul className="min-w-[8rem] flex-1 space-y-2">
        {data.map((d) => (
          <li key={d.raw} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colorFor(d.raw) }}
            />
            <span className="text-stone-600">{d.status}</span>
            <span className="ml-auto font-semibold tabular-nums text-stone-800">{d.count}</span>
            <span className="w-10 text-right text-xs text-stone-400">
              {Math.round((d.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
