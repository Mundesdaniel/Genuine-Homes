import type {
  ShortLetAvailabilityBlockResponse,
  ShortLetBookingResponse,
} from '@genuine-homes/shared';

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const key = (d: Date): string => d.toISOString().slice(0, 10);
const parse = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

// All day-keys a booking covers: [checkIn, checkOut).
function bookingDays(b: ShortLetBookingResponse): string[] {
  const out: string[] = [];
  for (let t = parse(b.checkIn).getTime(); t < parse(b.checkOut).getTime(); t += DAY_MS) {
    out.push(key(new Date(t)));
  }
  return out;
}

// All day-keys a block covers: [startDate, endDate] inclusive.
function blockDays(b: ShortLetAvailabilityBlockResponse): string[] {
  const out: string[] = [];
  for (let t = parse(b.startDate).getTime(); t <= parse(b.endDate).getTime(); t += DAY_MS) {
    out.push(key(new Date(t)));
  }
  return out;
}

function MonthGrid({
  year,
  month,
  booked,
  blocked,
}: {
  year: number;
  month: number;
  booked: Set<string>;
  blocked: Set<string>;
}) {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-stone-700">
        {MONTHS[month]} {year}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 font-medium text-stone-400">
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />;
          const k = key(new Date(Date.UTC(year, month, day)));
          const isBooked = booked.has(k);
          const isBlocked = !isBooked && blocked.has(k);
          const cls = isBooked
            ? 'bg-brand-100 font-semibold text-brand-800'
            : isBlocked
              ? 'bg-stone-200 text-stone-400 line-through'
              : 'bg-white text-stone-600 ring-1 ring-inset ring-stone-100';
          return (
            <div key={k} className={`rounded py-1.5 ${cls}`}>
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Availability calendar for one short-let listing: the current month plus the
 * next, with each day marked booked / blocked / available.
 */
export function ShortLetCalendar({
  bookings,
  blocks,
}: {
  bookings: ShortLetBookingResponse[];
  blocks: ShortLetAvailabilityBlockResponse[];
}) {
  const booked = new Set<string>();
  for (const b of bookings) {
    if (b.status !== 'booked') continue;
    for (const k of bookingDays(b)) booked.add(k);
  }
  const blocked = new Set<string>();
  for (const b of blocks) for (const k of blockDays(b)) blocked.add(k);

  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const next = m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 };

  return (
    <div className="space-y-4">
      <div className="grid gap-5 sm:grid-cols-2">
        <MonthGrid year={y} month={m} booked={booked} blocked={blocked} />
        <MonthGrid year={next.year} month={next.month} booked={booked} blocked={blocked} />
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-stone-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-brand-100 ring-1 ring-inset ring-brand-200" />{' '}
          Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-stone-200" /> Blocked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-white ring-1 ring-inset ring-stone-200" />{' '}
          Available
        </span>
      </div>
    </div>
  );
}
