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
  propHouse: '00000000-0000-4000-8000-000000000010',
  propLand: '00000000-0000-4000-8000-000000000011',
  listingRent: '00000000-0000-4000-8000-000000000020',
  listingInstallment: '00000000-0000-4000-8000-000000000021',
} as const;

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

  console.log('✓ Seed complete.');
  console.log(`  Users: ${admin.email}, ${landlord.email}, +256700000003`);
  console.log(`  Dev password for all seeded users: ${DEV_PASSWORD}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
