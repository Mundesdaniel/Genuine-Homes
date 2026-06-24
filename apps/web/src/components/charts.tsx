import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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

const BRAND = '#A16207';
const GOLD = '#FACC15';
const MUTED = '#E7E5E4';

const compact = (v: number): string =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}k`;

/** Area chart of successful payments per month — feels "live" via polling. */
export function PaymentsTrendChart({ payments }: { payments: PaymentResponse[] }) {
  const byMonth = new Map<string, number>();
  for (const p of payments) {
    if (p.status !== 'successful') continue;
    const month = p.createdAt.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + p.amount);
  }
  const data = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount }));

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-stone-400">No payments yet.</p>;
  }
  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="paymentFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GOLD} stopOpacity={0.7} />
              <stop offset="100%" stopColor={GOLD} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
          <XAxis dataKey="month" fontSize={11} tickLine={false} />
          <YAxis tickFormatter={compact} fontSize={11} width={36} tickLine={false} />
          <Tooltip formatter={(v: number) => formatMoney(v)} />
          <Area
            type="monotone"
            dataKey="amount"
            stroke={BRAND}
            strokeWidth={2}
            fill="url(#paymentFill)"
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut of paid vs remaining for a plan. */
export function ProgressDonut({ paid, remaining }: { paid: number; remaining: number }) {
  const data = [
    { name: 'Paid', value: Math.max(paid, 0) },
    { name: 'Remaining', value: Math.max(remaining, 0) },
  ];
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={48}
            outerRadius={70}
            paddingAngle={2}
            animationDuration={600}
          >
            <Cell fill={BRAND} />
            <Cell fill={MUTED} />
          </Pie>
          <Tooltip formatter={(v: number) => formatMoney(v)} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Count of a seller's properties by status. */
export function PropertiesStatusChart({ properties }: { properties: PropertySummary[] }) {
  const counts = new Map<string, number>();
  for (const p of properties) counts.set(p.status, (counts.get(p.status) ?? 0) + 1);
  const data = [...counts.entries()].map(([status, count]) => ({
    status: titleCase(status),
    count,
  }));
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-stone-400">No properties yet.</p>;
  }
  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
          <XAxis dataKey="status" fontSize={11} tickLine={false} />
          <YAxis allowDecimals={false} fontSize={11} width={28} tickLine={false} />
          <Tooltip />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} animationDuration={600}>
            {data.map((_, i) => (
              <Cell key={i} fill={i % 2 ? GOLD : BRAND} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
