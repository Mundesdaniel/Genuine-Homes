import {
  ShortLetBookingStatus,
  type ShortLetBookingStatus as Status,
} from '@genuine-homes/shared';
import { computeListingMetrics, overlapNights } from './short-let.service';

const d = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const WIN_START = d('2026-11-01');
const WIN_END = d('2026-12-01'); // 30-night window

describe('overlapNights', () => {
  it('counts nights fully inside the window', () => {
    expect(
      overlapNights([{ start: d('2026-11-05'), end: d('2026-11-08') }], WIN_START, WIN_END),
    ).toBe(3);
  });

  it('clamps ranges that extend past the window edges', () => {
    expect(
      overlapNights([{ start: d('2026-10-28'), end: d('2026-11-03') }], WIN_START, WIN_END),
    ).toBe(2);
    expect(
      overlapNights([{ start: d('2026-11-29'), end: d('2026-12-10') }], WIN_START, WIN_END),
    ).toBe(2);
  });

  it('ignores ranges entirely outside the window', () => {
    expect(
      overlapNights([{ start: d('2026-09-01'), end: d('2026-09-05') }], WIN_START, WIN_END),
    ).toBe(0);
  });
});

describe('computeListingMetrics', () => {
  const booking = (
    checkIn: string,
    checkOut: string,
    amount: number,
    status: Status = ShortLetBookingStatus.BOOKED,
  ) => ({
    status,
    amount,
    checkIn: d(checkIn),
    checkOut: d(checkOut),
  });

  it('sums income and booked nights for booked stays', () => {
    const m = computeListingMetrics(
      [
        booking('2026-11-05', '2026-11-08', 300_000),
        booking('2026-11-10', '2026-11-12', 200_000),
      ],
      [],
      WIN_START,
      WIN_END,
    );
    expect(m.income).toBe(500_000);
    expect(m.bookedNights).toBe(5); // 3 + 2
    expect(m.availableNights).toBe(30);
    expect(m.occupancyRate).toBeCloseTo(5 / 30, 5);
  });

  it('excludes cancelled bookings from income and occupancy', () => {
    const m = computeListingMetrics(
      [
        booking('2026-11-05', '2026-11-08', 300_000),
        booking('2026-11-10', '2026-11-15', 999_000, ShortLetBookingStatus.CANCELLED),
      ],
      [],
      WIN_START,
      WIN_END,
    );
    expect(m.income).toBe(300_000);
    expect(m.bookedNights).toBe(3);
  });

  it('treats blocked nights as unavailable (not counted against occupancy)', () => {
    // 10 nights blocked -> 20 available; 5 booked -> 25% occupancy.
    const m = computeListingMetrics(
      [booking('2026-11-05', '2026-11-10', 500_000)],
      [{ startDate: d('2026-11-20'), endDate: d('2026-11-29') }], // inclusive -> 10 nights
      WIN_START,
      WIN_END,
    );
    expect(m.bookedNights).toBe(5);
    expect(m.availableNights).toBe(20);
    expect(m.occupancyRate).toBeCloseTo(5 / 20, 5);
  });

  it('is zero across the board with no bookings', () => {
    const m = computeListingMetrics([], [], WIN_START, WIN_END);
    expect(m).toEqual({ income: 0, bookedNights: 0, availableNights: 30, occupancyRate: 0 });
  });

  it('caps occupancy at 1 and never divides by zero when fully blocked', () => {
    const m = computeListingMetrics(
      [booking('2026-11-05', '2026-11-08', 1)],
      [{ startDate: d('2026-11-01'), endDate: d('2026-11-30') }], // whole window blocked
      WIN_START,
      WIN_END,
    );
    expect(m.availableNights).toBe(0);
    expect(m.occupancyRate).toBe(0);
  });
});
