import { hash } from '@node-rs/argon2';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Idempotent development seed.
 *
 * Re-runnable: every entity uses a fixed UUID and `upsert`, so running
 * `pnpm prisma:seed` repeatedly leaves the database in the same state.
 * Passwords are hashed with argon2id — the same scheme the auth module
 * (Stage 2) verifies against, so seeded users can actually log in.
 */
const prisma = new PrismaClient();

/** Known password for every seeded user — DEV ONLY. */
const DEV_PASSWORD = 'Password123!';

const IDS = {
  admin: '00000000-0000-4000-8000-000000000001',
  landlord: '00000000-0000-4000-8000-000000000002',
  tenant: '00000000-0000-4000-8000-000000000003',
  daniel: '00000000-0000-4000-8000-000000000004',
  roro: '00000000-0000-4000-8000-000000000005',
  propHouse: '00000000-0000-4000-8000-000000000010',
  propLand: '00000000-0000-4000-8000-000000000011',
  listingRent: '00000000-0000-4000-8000-000000000020',
  listingInstallment: '00000000-0000-4000-8000-000000000021',
  planRoro: '00000000-0000-4000-8000-000000000030',
  payDeposit: '00000000-0000-4000-8000-000000000040',
  payInst1: '00000000-0000-4000-8000-000000000041',
  payInst2: '00000000-0000-4000-8000-000000000042',
  payInst3: '00000000-0000-4000-8000-000000000043',
  payInst4: '00000000-0000-4000-8000-000000000044',
} as const;

/** Add n calendar months to a date (UTC). */
const addMonths = (date: Date, n: number): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, date.getUTCDate()));

/** Set a property's PostGIS location (Prisma can't write Unsupported columns). */
async function setLocation(
  propertyId: string,
  lng: number,
  lat: number,
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE properties
    SET location = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
    WHERE id = ${propertyId}::uuid`;
}

async function main(): Promise<void> {
  const passwordHash = await hash(DEV_PASSWORD);

  const admin = await prisma.user.upsert({
    where: { id: IDS.admin },
    update: {},
    create: {
      id: IDS.admin,
      fullName: 'Platform Admin',
      email: 'admin@genuinehomes.ug',
      phone: '+256700000001',
      passwordHash,
      role: 'admin',
      isVerified: true,
    },
  });

  const landlord = await prisma.user.upsert({
    where: { id: IDS.landlord },
    update: {},
    create: {
      id: IDS.landlord,
      fullName: 'Sarah Nambi',
      email: 'sarah.landlord@example.ug',
      phone: '+256700000002',
      passwordHash,
      role: 'landlord',
      isVerified: true,
    },
  });

  await prisma.user.upsert({
    where: { id: IDS.tenant },
    update: {},
    create: {
      id: IDS.tenant,
      fullName: 'David Okello',
      phone: '+256700000003',
      passwordHash,
      role: 'user',
    },
  });

  // Daniel — a property developer (can list).
  await prisma.user.upsert({
    where: { id: IDS.daniel },
    update: {},
    create: {
      id: IDS.daniel,
      fullName: 'Daniel Munde',
      email: 'daniel@gmail.com',
      phone: '+256700000004',
      passwordHash,
      role: 'developer',
      isVerified: true,
    },
  });

  // Roro — a buyer with a live installment plan (used by the dashboard charts).
  const roro = await prisma.user.upsert({
    where: { id: IDS.roro },
    update: {},
    create: {
      id: IDS.roro,
      fullName: 'Roro Nakato',
      email: 'roro@gmail.com',
      phone: '+256700000005',
      passwordHash,
      role: 'user',
    },
  });

  // A verified 4-bedroom house in Kampala, listed for monthly rent.
  const house = await prisma.property.upsert({
    where: { id: IDS.propHouse },
    update: {},
    create: {
      id: IDS.propHouse,
      ownerId: landlord.id,
      type: 'house',
      title: '4-Bedroom Family House in Nakawa',
      description:
        'Spacious family home with a fenced compound, parking, and 24/7 water and power. Close to schools and the city center.',
      district: 'Kampala',
      city: 'Kampala',
      area: 'Nakawa',
      sizeSqm: new Prisma.Decimal('250'),
      bedrooms: 4,
      bathrooms: 3,
      amenities: { water: true, power: true, fence: true, parking: true },
      verificationStatus: 'verified',
      status: 'active',
    },
  });
  await setLocation(house.id, 32.6155, 0.3325); // Nakawa, Kampala

  // A plot of land offered on an installment plan.
  const land = await prisma.property.upsert({
    where: { id: IDS.propLand },
    update: {},
    create: {
      id: IDS.propLand,
      ownerId: landlord.id,
      type: 'land',
      title: '50x100 Plot with Land Title in Gayaza',
      description:
        'Registered plot with a verified land title. Ideal for building or investment. Available on a flexible installment plan.',
      district: 'Wakiso',
      city: 'Gayaza',
      area: 'Gayaza',
      sizeSqm: new Prisma.Decimal('464.5'),
      amenities: { road_access: true, fenced: false },
      verificationStatus: 'verified',
      status: 'active',
    },
  });
  await setLocation(land.id, 32.6019, 0.4419); // Gayaza, Wakiso

  await prisma.listing.upsert({
    where: { id: IDS.listingRent },
    update: {},
    create: {
      id: IDS.listingRent,
      propertyId: house.id,
      listingType: 'rent',
      price: new Prisma.Decimal('1500000'),
      currency: 'UGX',
      rentPeriod: 'monthly',
      isActive: true,
    },
  });

  await prisma.listing.upsert({
    where: { id: IDS.listingInstallment },
    update: {},
    create: {
      id: IDS.listingInstallment,
      propertyId: land.id,
      listingType: 'installment',
      price: new Prisma.Decimal('80000000'),
      currency: 'UGX',
      minDepositPercent: new Prisma.Decimal('20'),
      maxInstallmentMonths: 36,
      isActive: true,
    },
  });

  // ── Demo installment plan for Roro on the Gayaza land (idempotent) ─────────
  // 24-month plan, 20% deposit; the first four months are already paid so the
  // dashboard's progress + "payments over time" charts have real data.
  const PLAN_MONTHS = 24;
  const planTotal = new Prisma.Decimal('80000000');
  const planDeposit = new Prisma.Decimal('16000000'); // 20%
  const financed = planTotal.minus(planDeposit); // 64,000,000
  const monthly = financed
    .div(PLAN_MONTHS)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
  const planStart = new Date('2026-01-15T00:00:00Z');

  await prisma.installmentPlan.upsert({
    where: { id: IDS.planRoro },
    update: {},
    create: {
      id: IDS.planRoro,
      listingId: IDS.listingInstallment,
      buyerId: roro.id,
      totalPrice: planTotal,
      depositAmount: planDeposit,
      months: PLAN_MONTHS,
      monthlyAmount: monthly,
      currency: 'UGX',
      status: 'active',
      nextDueDate: addMonths(planStart, 5), // months 1–4 paid → #5 is next
    },
  });

  const schedule: Prisma.InstallmentPaymentCreateManyInput[] = [];
  let allocated = new Prisma.Decimal(0);
  for (let i = 1; i <= PLAN_MONTHS; i++) {
    const amount = i < PLAN_MONTHS ? monthly : financed.minus(allocated);
    allocated = allocated.plus(amount);
    schedule.push({
      planId: IDS.planRoro,
      sequence: i,
      amount,
      dueDate: addMonths(planStart, i),
      status: 'upcoming',
    });
  }
  await prisma.installmentPayment.createMany({ data: schedule, skipDuplicates: true });
  await prisma.installmentPayment.updateMany({
    where: { planId: IDS.planRoro, sequence: { in: [1, 2, 3, 4] } },
    data: { status: 'paid', paidAt: addMonths(planStart, 4) },
  });

  // Matching ledger rows; past createdAt so the trend chart isn't a single spike.
  const ledger: Array<{
    id: string;
    purpose: 'deposit' | 'installment';
    amount: Prisma.Decimal;
    when: string;
    ref: string;
  }> = [
    { id: IDS.payDeposit, purpose: 'deposit', amount: planDeposit, when: '2026-01-20T10:00:00Z', ref: 'seed_dep' },
    { id: IDS.payInst1, purpose: 'installment', amount: monthly, when: '2026-02-15T10:00:00Z', ref: 'seed_i1' },
    { id: IDS.payInst2, purpose: 'installment', amount: monthly, when: '2026-03-15T10:00:00Z', ref: 'seed_i2' },
    { id: IDS.payInst3, purpose: 'installment', amount: monthly, when: '2026-04-15T10:00:00Z', ref: 'seed_i3' },
    { id: IDS.payInst4, purpose: 'installment', amount: monthly, when: '2026-05-15T10:00:00Z', ref: 'seed_i4' },
  ];
  for (const p of ledger) {
    await prisma.payment.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        userId: roro.id,
        purpose: p.purpose,
        referenceId: IDS.planRoro,
        amount: p.amount,
        currency: 'UGX',
        provider: 'mtn_momo',
        providerRef: p.ref,
        status: 'successful',
        createdAt: new Date(p.when),
      },
    });
  }

  console.log('✓ Seed complete.');
  console.log(`  Users: ${admin.email}, ${landlord.email}, daniel@gmail.com, roro@gmail.com, +256700000003`);
  console.log(`  Roro has a live 24-month installment plan (4 months paid).`);
  console.log(`  Dev password for all seeded users: ${DEV_PASSWORD}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
