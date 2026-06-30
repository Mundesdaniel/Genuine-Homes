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

/** Build a valid v4-shaped UUID from a small integer — for bulk seed rows. */
const uuid = (n: number): string =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

/** A real, hot-linkable Unsplash image (verified to resolve). */
const img = (id: string): string =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=70`;

/** Curated, verified Unsplash photo ids by theme. */
const PHOTO = {
  houseExt: '1568605114967-8130f3a36994',
  houseModern: '1570129477492-45c003edd2be',
  houseSuburb: '1512917774080-9991f1c4c750',
  homeModern: '1605276374104-dee2a0ed3cd6',
  villaPool: '1613490493576-7fde63acd811',
  living: '1502672260266-1c1ef2d93688',
  bedroom: '1522708323590-d24dbb6b0267',
  house2: '1564013799919-ab600027ffc6',
  houseEnt: '1449844908441-8829872d2607',
  aptBlock: '1480074568708-e7b720bb3f09',
  commercial: '1486406146926-c627a92ad1ab',
  land1: '1500382017468-9049fed747ef',
  land2: '1416331108676-a22ccb276e35',
  house3: '1600596542815-ffad4c1539a9',
  houseExt2: '1600585154340-be6161a56a0c',
  aptInterior: '1600607687939-ce8a6c25118c',
  shop: '1582268611958-ebfd161ef9cf',
} as const;

/** A property row plus the bits createMany can't take (PostGIS point, images). */
interface SeedProp {
  id: string;
  ownerId: string;
  type: Prisma.PropertyCreateManyInput['type'];
  title: string;
  description: string;
  district: string;
  city: string;
  area: string;
  sizeSqm?: string;
  bedrooms?: number;
  bathrooms?: number;
  amenities: Prisma.InputJsonValue;
  verificationStatus: Prisma.PropertyCreateManyInput['verificationStatus'];
  status: Prisma.PropertyCreateManyInput['status'];
  lng: number;
  lat: number;
  photos: string[];
}

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

  // ─────────────────────────────────────────────────────────────────────────
  // Richer demo data (Stage 7 modules): more users/properties/listings with
  // real images, plus favorites, reviews, a rental, a second installment plan
  // with an overdue payment, verifications, notifications, and a chat thread.
  // ─────────────────────────────────────────────────────────────────────────

  // Extra people: two agents, a developer company, two buyers, a landlord.
  const newUsers: Prisma.UserCreateManyInput[] = [
    { id: uuid(101), fullName: 'James Mukasa', email: 'james.agent@example.ug', phone: '+256700000006', passwordHash, role: 'agent', isVerified: true },
    { id: uuid(102), fullName: 'Grace Auma', email: 'grace.agent@example.ug', phone: '+256700000007', passwordHash, role: 'agent' },
    { id: uuid(103), fullName: 'Pearl Estates Ltd', email: 'pearl@estates.ug', phone: '+256700000008', passwordHash, role: 'developer', isVerified: true },
    { id: uuid(104), fullName: 'Brenda Akello', email: 'brenda@gmail.com', phone: '+256700000009', passwordHash, role: 'user' },
    { id: uuid(105), fullName: 'Tonny Ssaka', email: 'tonny@gmail.com', phone: '+256700000010', passwordHash, role: 'user' },
    { id: uuid(106), fullName: 'Moses Kato', email: 'moses.landlord@example.ug', phone: '+256700000011', passwordHash, role: 'landlord', isVerified: true },
  ];
  await prisma.user.createMany({ data: newUsers, skipDuplicates: true });

  const newProps: SeedProp[] = [
    {
      id: uuid(200), ownerId: uuid(101), type: 'apartment',
      title: '2-Bedroom Apartment in Kololo', district: 'Kampala', city: 'Kampala', area: 'Kololo',
      description: 'Modern furnished apartment in an upscale neighbourhood with secure parking, lift, and standby power. Walking distance to embassies and offices.',
      sizeSqm: '120', bedrooms: 2, bathrooms: 2,
      amenities: { water: true, power: true, parking: true, security: true, furnished: true },
      verificationStatus: 'verified', status: 'active', lng: 32.594, lat: 0.336,
      photos: [PHOTO.aptInterior, PHOTO.living, PHOTO.bedroom],
    },
    {
      id: uuid(201), ownerId: uuid(103), type: 'villa',
      title: 'Luxury 5-Bedroom Villa in Munyonyo', district: 'Kampala', city: 'Kampala', area: 'Munyonyo',
      description: 'Lakeside villa with a swimming pool, manicured garden, staff quarters, and a double garage. Available outright or on installments.',
      sizeSqm: '380', bedrooms: 5, bathrooms: 4,
      amenities: { water: true, power: true, parking: true, security: true, pool: true, garden: true },
      verificationStatus: 'verified', status: 'active', lng: 32.620, lat: 0.250,
      photos: [PHOTO.villaPool, PHOTO.homeModern, PHOTO.living, PHOTO.bedroom],
    },
    {
      id: uuid(202), ownerId: uuid(106), type: 'apartment',
      title: '2-Bedroom Apartment in Ntinda', district: 'Kampala', city: 'Kampala', area: 'Ntinda',
      description: 'Well-maintained apartment in a quiet residential block with reliable water and power, and allocated parking.',
      sizeSqm: '95', bedrooms: 2, bathrooms: 1,
      amenities: { water: true, power: true, parking: true },
      verificationStatus: 'verified', status: 'active', lng: 32.611, lat: 0.360,
      photos: [PHOTO.aptBlock, PHOTO.aptInterior, PHOTO.living],
    },
    {
      id: uuid(203), ownerId: uuid(101), type: 'commercial',
      title: 'Retail Space in Kampala CBD', district: 'Kampala', city: 'Kampala', area: 'Central',
      description: 'Ground-floor retail/office space on a busy street with high foot traffic. Suitable for a shop, bank branch, or showroom.',
      sizeSqm: '200',
      amenities: { power: true, parking: true, security: true, water: true },
      verificationStatus: 'verified', status: 'active', lng: 32.578, lat: 0.313,
      photos: [PHOTO.commercial, PHOTO.shop],
    },
    {
      id: uuid(204), ownerId: uuid(103), type: 'land',
      title: '1-Acre Plot in Mukono', district: 'Mukono', city: 'Mukono', area: 'Seeta',
      description: 'Prime plot along a tarmac road, ideal for an estate or commercial development. Title verification in progress. Available on installments.',
      sizeSqm: '4047',
      amenities: { road_access: true, fenced: false },
      verificationStatus: 'pending', status: 'active', lng: 32.755, lat: 0.353,
      photos: [PHOTO.land1, PHOTO.land2],
    },
    {
      id: uuid(205), ownerId: uuid(106), type: 'house',
      title: '4-Bedroom House in Entebbe', district: 'Wakiso', city: 'Entebbe', area: 'Kitoro',
      description: 'Family home minutes from the lake and the airport, with a garden, parking, and a self-contained boys’ quarter.',
      sizeSqm: '300', bedrooms: 4, bathrooms: 3,
      amenities: { water: true, power: true, parking: true, garden: true, lake_view: true },
      verificationStatus: 'verified', status: 'active', lng: 32.464, lat: 0.051,
      photos: [PHOTO.houseEnt, PHOTO.houseExt2, PHOTO.living, PHOTO.bedroom],
    },
    {
      id: uuid(206), ownerId: uuid(102), type: 'house',
      title: '3-Bedroom Bungalow in Jinja', district: 'Jinja', city: 'Jinja', area: 'Mpumudde',
      description: 'Cosy bungalow with a fenced compound and borehole water. Close to town and the Source of the Nile.',
      sizeSqm: '180', bedrooms: 3, bathrooms: 2,
      amenities: { water: true, power: true, fence: true },
      verificationStatus: 'unverified', status: 'active', lng: 33.204, lat: 0.424,
      photos: [PHOTO.houseSuburb, PHOTO.house2],
    },
    {
      id: uuid(207), ownerId: landlord.id, type: 'apartment',
      title: 'Studio Apartment in Bukoto', district: 'Kampala', city: 'Kampala', area: 'Bukoto',
      description: 'Affordable self-contained studio, great for a student or young professional. Water and power included.',
      sizeSqm: '45', bedrooms: 1, bathrooms: 1,
      amenities: { water: true, power: true },
      verificationStatus: 'verified', status: 'active', lng: 32.602, lat: 0.345,
      photos: [PHOTO.aptInterior, PHOTO.living],
    },
    {
      id: uuid(208), ownerId: uuid(103), type: 'house',
      title: '4-Bedroom Home in Naalya', district: 'Wakiso', city: 'Kampala', area: 'Naalya',
      description: 'Newly built home in a gated estate with a paved compound, solar backup, and a modern kitchen. Buy outright or on installments.',
      sizeSqm: '260', bedrooms: 4, bathrooms: 3,
      amenities: { water: true, power: true, parking: true, security: true, fence: true },
      verificationStatus: 'verified', status: 'active', lng: 32.633, lat: 0.378,
      photos: [PHOTO.house3, PHOTO.houseModern, PHOTO.living, PHOTO.bedroom],
    },
  ];
  await prisma.property.createMany({
    data: newProps.map(({ lng, lat, photos, ...row }) => row),
    skipDuplicates: true,
  });
  for (const p of newProps) await setLocation(p.id, p.lng, p.lat);

  // Gallery images for every property (including the two from the base seed).
  const imageSources: Array<{ id: string; photos: string[] }> = [
    { id: IDS.propHouse, photos: [PHOTO.houseExt, PHOTO.living, PHOTO.bedroom] },
    { id: IDS.propLand, photos: [PHOTO.land2, PHOTO.land1] },
    ...newProps.map((p) => ({ id: p.id, photos: p.photos })),
  ];
  let imgSeq = 1000;
  const propertyImages: Prisma.PropertyImageCreateManyInput[] = [];
  for (const src of imageSources) {
    src.photos.forEach((pid, i) =>
      propertyImages.push({ id: uuid(imgSeq++), propertyId: src.id, url: img(pid), position: i }),
    );
  }
  await prisma.propertyImage.createMany({ data: propertyImages, skipDuplicates: true });

  // Listings across rent / sale / installment.
  const newListings: Prisma.ListingCreateManyInput[] = [
    { id: uuid(300), propertyId: uuid(200), listingType: 'rent', price: new Prisma.Decimal('2200000'), currency: 'UGX', rentPeriod: 'monthly', isActive: true },
    { id: uuid(301), propertyId: uuid(201), listingType: 'sale', price: new Prisma.Decimal('450000000'), currency: 'UGX', isActive: true },
    { id: uuid(302), propertyId: uuid(201), listingType: 'installment', price: new Prisma.Decimal('450000000'), currency: 'UGX', minDepositPercent: new Prisma.Decimal('30'), maxInstallmentMonths: 48, isActive: true },
    { id: uuid(303), propertyId: uuid(202), listingType: 'rent', price: new Prisma.Decimal('1200000'), currency: 'UGX', rentPeriod: 'monthly', isActive: true },
    { id: uuid(304), propertyId: uuid(203), listingType: 'rent', price: new Prisma.Decimal('3500000'), currency: 'UGX', rentPeriod: 'monthly', isActive: true },
    { id: uuid(305), propertyId: uuid(203), listingType: 'sale', price: new Prisma.Decimal('600000000'), currency: 'UGX', isActive: true },
    { id: uuid(306), propertyId: uuid(204), listingType: 'installment', price: new Prisma.Decimal('60000000'), currency: 'UGX', minDepositPercent: new Prisma.Decimal('20'), maxInstallmentMonths: 36, isActive: true },
    { id: uuid(307), propertyId: uuid(205), listingType: 'sale', price: new Prisma.Decimal('320000000'), currency: 'UGX', isActive: true },
    { id: uuid(308), propertyId: uuid(206), listingType: 'rent', price: new Prisma.Decimal('900000'), currency: 'UGX', rentPeriod: 'monthly', isActive: true },
    { id: uuid(309), propertyId: uuid(207), listingType: 'rent', price: new Prisma.Decimal('650000'), currency: 'UGX', rentPeriod: 'monthly', isActive: true },
    { id: uuid(310), propertyId: uuid(208), listingType: 'installment', price: new Prisma.Decimal('250000000'), currency: 'UGX', minDepositPercent: new Prisma.Decimal('25'), maxInstallmentMonths: 48, isActive: true },
    { id: uuid(311), propertyId: uuid(208), listingType: 'sale', price: new Prisma.Decimal('250000000'), currency: 'UGX', isActive: true },
  ];
  await prisma.listing.createMany({ data: newListings, skipDuplicates: true });

  // Second installment plan (Brenda buying the Naalya home) — months 1–2 paid,
  // month 3 left overdue so the nightly sweep / overdue UI has something to show.
  const plan2Id = uuid(400);
  const P2_MONTHS = 36;
  const p2Total = new Prisma.Decimal('250000000');
  const p2Deposit = new Prisma.Decimal('62500000'); // 25%
  const p2Financed = p2Total.minus(p2Deposit);
  const p2Monthly = p2Financed.div(P2_MONTHS).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
  const p2Start = new Date('2026-02-01T00:00:00Z');
  await prisma.installmentPlan.upsert({
    where: { id: plan2Id },
    update: {},
    create: {
      id: plan2Id, listingId: uuid(310), buyerId: uuid(104),
      totalPrice: p2Total, depositAmount: p2Deposit, months: P2_MONTHS,
      monthlyAmount: p2Monthly, currency: 'UGX', status: 'active',
      nextDueDate: addMonths(p2Start, 3),
    },
  });
  const p2Schedule: Prisma.InstallmentPaymentCreateManyInput[] = [];
  let p2Allocated = new Prisma.Decimal(0);
  for (let i = 1; i <= P2_MONTHS; i++) {
    const amount = i < P2_MONTHS ? p2Monthly : p2Financed.minus(p2Allocated);
    p2Allocated = p2Allocated.plus(amount);
    p2Schedule.push({ id: uuid(400 + i), planId: plan2Id, sequence: i, amount, dueDate: addMonths(p2Start, i), status: 'upcoming' });
  }
  await prisma.installmentPayment.createMany({ data: p2Schedule, skipDuplicates: true });
  await prisma.installmentPayment.updateMany({
    where: { planId: plan2Id, sequence: { in: [1, 2] } },
    data: { status: 'paid', paidAt: addMonths(p2Start, 2) },
  });

  // Active rental: Tonny renting the Ntinda apartment from Moses.
  await prisma.rentalAgreement.createMany({
    data: [{
      id: uuid(1300), listingId: uuid(303), tenantId: uuid(105),
      startDate: new Date('2026-03-01T00:00:00Z'), endDate: new Date('2027-03-01T00:00:00Z'),
      monthlyRent: new Prisma.Decimal('1200000'), currency: 'UGX', status: 'active',
    }],
    skipDuplicates: true,
  });

  // Ledger rows for plan 2 (deposit + 2 installments) and the rental (3 months).
  const extraLedger: Prisma.PaymentCreateManyInput[] = [
    { id: uuid(440), userId: uuid(104), purpose: 'deposit', referenceId: plan2Id, amount: p2Deposit, currency: 'UGX', provider: 'mtn_momo', providerRef: 'seed_p2_dep', status: 'successful', createdAt: new Date('2026-02-05T10:00:00Z') },
    { id: uuid(441), userId: uuid(104), purpose: 'installment', referenceId: plan2Id, amount: p2Monthly, currency: 'UGX', provider: 'airtel_money', providerRef: 'seed_p2_i1', status: 'successful', createdAt: new Date('2026-03-01T10:00:00Z') },
    { id: uuid(442), userId: uuid(104), purpose: 'installment', referenceId: plan2Id, amount: p2Monthly, currency: 'UGX', provider: 'mtn_momo', providerRef: 'seed_p2_i2', status: 'successful', createdAt: new Date('2026-04-01T10:00:00Z') },
    { id: uuid(1310), userId: uuid(105), purpose: 'rent', referenceId: uuid(1300), amount: new Prisma.Decimal('1200000'), currency: 'UGX', provider: 'mtn_momo', providerRef: 'seed_rent_1', status: 'successful', createdAt: new Date('2026-03-02T09:00:00Z') },
    { id: uuid(1311), userId: uuid(105), purpose: 'rent', referenceId: uuid(1300), amount: new Prisma.Decimal('1200000'), currency: 'UGX', provider: 'mtn_momo', providerRef: 'seed_rent_2', status: 'successful', createdAt: new Date('2026-04-02T09:00:00Z') },
    { id: uuid(1312), userId: uuid(105), purpose: 'rent', referenceId: uuid(1300), amount: new Prisma.Decimal('1200000'), currency: 'UGX', provider: 'airtel_money', providerRef: 'seed_rent_3', status: 'successful', createdAt: new Date('2026-05-02T09:00:00Z') },
  ];
  await prisma.payment.createMany({ data: extraLedger, skipDuplicates: true });

  // Verification records: four approved + one still pending (admin queue demo).
  const docAt = '2026-01-08T00:00:00Z';
  const doc = (kind: string) => [{ kind, url: 'https://example.com/docs/sample.pdf', uploadedAt: docAt }];
  const verifications: Prisma.VerificationCreateManyInput[] = [
    { id: uuid(1400), propertyId: IDS.propHouse, status: 'verified', reviewerId: admin.id, documents: doc('land_title'), notes: 'Title confirmed at the registry.' },
    { id: uuid(1401), propertyId: IDS.propLand, status: 'verified', reviewerId: admin.id, documents: doc('land_title'), notes: 'Survey + title verified.' },
    { id: uuid(1402), propertyId: uuid(201), status: 'verified', reviewerId: admin.id, documents: doc('sale_agreement'), notes: 'Ownership confirmed.' },
    { id: uuid(1403), propertyId: uuid(208), status: 'verified', reviewerId: admin.id, documents: doc('land_title') },
    { id: uuid(1404), propertyId: uuid(204), status: 'pending', documents: doc('land_title') },
  ];
  await prisma.verification.createMany({ data: verifications, skipDuplicates: true });

  // Favorites.
  const favorites: Prisma.FavoriteCreateManyInput[] = [
    { id: uuid(1100), userId: uuid(104), propertyId: uuid(201) },
    { id: uuid(1101), userId: uuid(104), propertyId: uuid(208) },
    { id: uuid(1102), userId: uuid(104), propertyId: IDS.propHouse },
    { id: uuid(1103), userId: uuid(105), propertyId: uuid(202) },
    { id: uuid(1104), userId: uuid(105), propertyId: uuid(205) },
    { id: uuid(1105), userId: roro.id, propertyId: IDS.propLand },
    { id: uuid(1106), userId: roro.id, propertyId: uuid(204) },
  ];
  await prisma.favorite.createMany({ data: favorites, skipDuplicates: true });

  // Reviews of agents / landlords / developers.
  const reviews: Prisma.ReviewCreateManyInput[] = [
    { id: uuid(1200), authorId: uuid(104), targetId: uuid(101), rating: 5, comment: 'Very professional and responsive — made buying easy.' },
    { id: uuid(1201), authorId: uuid(105), targetId: uuid(106), rating: 4, comment: 'Smooth rental process, fair landlord.' },
    { id: uuid(1202), authorId: roro.id, targetId: uuid(103), rating: 5, comment: 'Transparent installment plan with a clear schedule.' },
    { id: uuid(1203), authorId: IDS.tenant, targetId: landlord.id, rating: 4, comment: 'Good communication and a clean, well-kept house.' },
  ];
  await prisma.review.createMany({ data: reviews, skipDuplicates: true });

  // A chat thread between Brenda and agent James about the Munyonyo villa.
  const messages: Prisma.MessageCreateManyInput[] = [
    { id: uuid(1600), senderId: uuid(104), receiverId: uuid(101), listingId: uuid(301), body: 'Hello, is the Munyonyo villa still available?', readAt: new Date('2026-05-10T08:05:00Z'), createdAt: new Date('2026-05-10T08:00:00Z') },
    { id: uuid(1601), senderId: uuid(101), receiverId: uuid(104), listingId: uuid(301), body: 'Yes, it is available. Would you like to schedule a viewing?', readAt: new Date('2026-05-10T09:00:00Z'), createdAt: new Date('2026-05-10T08:30:00Z') },
    { id: uuid(1602), senderId: uuid(104), receiverId: uuid(101), listingId: uuid(301), body: 'Great — can I view it this weekend?', readAt: null, createdAt: new Date('2026-05-10T09:15:00Z') },
    { id: uuid(1603), senderId: uuid(101), receiverId: uuid(104), listingId: uuid(301), body: "I'll send you the location pin shortly.", readAt: null, createdAt: new Date('2026-05-10T09:30:00Z') },
  ];
  await prisma.message.createMany({ data: messages, skipDuplicates: true });

  // Notifications (some unread) for Roro and Brenda.
  const notifications: Prisma.NotificationCreateManyInput[] = [
    { id: uuid(1500), userId: roro.id, type: 'installment_due_soon', payload: { title: 'Installment due soon', body: 'Your next installment of UGX 2,666,666 is due on 2026-06-15.', planId: IDS.planRoro, sequence: 5, dueDate: '2026-06-15' }, createdAt: new Date('2026-06-12T06:00:00Z') },
    { id: uuid(1501), userId: roro.id, type: 'payment_successful', payload: { title: 'Installment payment received', body: 'Your installment payment of UGX 2,666,666 was successful.', paymentId: IDS.payInst4 }, readAt: new Date('2026-05-15T11:00:00Z'), createdAt: new Date('2026-05-15T10:30:00Z') },
    { id: uuid(1502), userId: roro.id, type: 'listing_verified', payload: { title: 'Property verified', body: '"50x100 Plot with Land Title in Gayaza" has been verified.', propertyId: IDS.propLand }, createdAt: new Date('2026-05-20T08:00:00Z') },
    { id: uuid(1503), userId: uuid(104), type: 'payment_successful', payload: { title: 'Deposit received', body: 'We received your deposit of UGX 62,500,000. Your installment plan is now active.', paymentId: uuid(440) }, readAt: new Date('2026-02-05T11:00:00Z'), createdAt: new Date('2026-02-05T10:05:00Z') },
    { id: uuid(1504), userId: uuid(104), type: 'installment_overdue', payload: { title: 'Installment overdue', body: 'Installment 3 of UGX 5,208,333 was due on 2026-05-01 and is now overdue.', planId: plan2Id, installmentId: uuid(403), sequence: 3, dueDate: '2026-05-01' }, createdAt: new Date('2026-05-02T02:00:00Z') },
    { id: uuid(1505), userId: uuid(104), type: 'new_message', payload: { title: 'New message', body: "I'll send you the location pin shortly.", senderId: uuid(101), messageId: uuid(1603) }, createdAt: new Date('2026-05-10T09:30:00Z') },
  ];
  await prisma.notification.createMany({ data: notifications, skipDuplicates: true });

  const totals = await prisma.$transaction([
    prisma.user.count(),
    prisma.property.count(),
    prisma.listing.count(),
    prisma.installmentPlan.count(),
  ]);

  console.log('✓ Seed complete.');
  console.log(`  ${totals[0]} users · ${totals[1]} properties · ${totals[2]} listings · ${totals[3]} installment plans`);
  console.log('  Demo logins (all use the same dev password):');
  console.log('    admin@genuinehomes.ug      (admin)');
  console.log('    james.agent@example.ug     (agent)');
  console.log('    pearl@estates.ug           (developer)');
  console.log('    sarah.landlord@example.ug  (landlord)');
  console.log('    roro@gmail.com             (buyer — live installment plan)');
  console.log('    brenda@gmail.com           (buyer — plan with an overdue payment)');
  console.log('    tonny@gmail.com            (tenant — active rental)');
  console.log(`  Dev password for all seeded users: ${DEV_PASSWORD}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
