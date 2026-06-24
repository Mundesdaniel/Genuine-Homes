import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Listing, Property, PropertyImage } from '@prisma/client';
import type {
  ListingType,
  PropertyType,
  RentPeriod,
} from '@genuine-homes/shared';
import type { Coords } from '../common/mappers';
import { PrismaService } from '../prisma/prisma.service';

// Full set of listing columns. Updates rewrite all of them, so switching
// listing type correctly clears fields that no longer apply.
export interface ListingWriteData {
  listingType: ListingType;
  price: number;
  currency: string;
  rentPeriod: RentPeriod | null;
  minDepositPercent: number | null;
  maxInstallmentMonths: number | null;
  isActive: boolean;
}

export type ListingWithProperty = Listing & {
  property: Property & { images: PropertyImage[] };
};

export interface ListingSearchParams {
  district?: string;
  type?: PropertyType;
  listingType?: ListingType;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  onlyVerified?: boolean;
  geo?: { lat: number; lng: number; radiusM: number };
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'distance';
  skip: number;
  take: number;
}

export interface ListingSearchRow {
  listing: ListingWithProperty;
  coords: Coords | null;
  distanceM: number | null;
}

@Injectable()
export class ListingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(propertyId: string, data: ListingWriteData): Promise<Listing> {
    return this.prisma.listing.create({ data: { propertyId, ...data } });
  }

  update(id: string, data: ListingWriteData): Promise<Listing> {
    return this.prisma.listing.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.listing.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // Listing + its property/gallery — used for ownership checks and detail view.
  findDetailById(id: string): Promise<ListingWithProperty | null> {
    return this.prisma.listing.findFirst({
      where: { id, deletedAt: null },
      include: {
        property: { include: { images: { orderBy: { position: 'asc' } } } },
      },
    });
  }

  /**
   * Faceted + optional "near me" search over active listings of active,
   * non-deleted properties. Built with parameterised Prisma.sql fragments
   * (no string interpolation), then the matching rows are hydrated via Prisma.
   */
  async search(
    params: ListingSearchParams,
  ): Promise<{ rows: ListingSearchRow[]; total: number }> {
    const where = this.buildWhere(params);

    // Distance is only computed/selected when searching by location.
    let distanceSelect: Prisma.Sql = Prisma.empty;
    if (params.geo) {
      const point = this.point(params.geo.lng, params.geo.lat);
      distanceSelect = Prisma.sql`, ST_Distance(p.location, ${point}) AS distance`;
    }

    const idRows = await this.prisma.$queryRaw<
      { id: string; lat: number | null; lng: number | null; distance?: number | null }[]
    >(Prisma.sql`
      SELECT l.id::text AS id,
             ST_Y(p.location::geometry) AS lat,
             ST_X(p.location::geometry) AS lng
             ${distanceSelect}
      FROM listings l
      JOIN properties p ON p.id = l.property_id
      WHERE ${where}
      ORDER BY ${this.buildOrderBy(params)}
      LIMIT ${params.take} OFFSET ${params.skip}
    `);

    const countRows = await this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM listings l
      JOIN properties p ON p.id = l.property_id
      WHERE ${where}
    `);
    const total = Number(countRows[0]?.count ?? 0n);

    const ids = idRows.map((r) => r.id);
    if (ids.length === 0) return { rows: [], total };

    // Hydrate full rows, then restore the SQL ordering.
    const listings = await this.prisma.listing.findMany({
      where: { id: { in: ids } },
      include: {
        property: { include: { images: { orderBy: { position: 'asc' } } } },
      },
    });
    const byId = new Map(listings.map((l) => [l.id, l]));

    const rows: ListingSearchRow[] = [];
    for (const r of idRows) {
      const listing = byId.get(r.id);
      if (!listing) continue;
      rows.push({
        listing,
        coords:
          r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null,
        distanceM: r.distance ?? null,
      });
    }
    return { rows, total };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private point(lng: number, lat: number): Prisma.Sql {
    return Prisma.sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
  }

  private buildWhere(params: ListingSearchParams): Prisma.Sql {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`l.is_active = true`,
      Prisma.sql`l.deleted_at IS NULL`,
      Prisma.sql`p.deleted_at IS NULL`,
      Prisma.sql`p.status::text = 'active'`,
    ];
    if (params.district)
      conditions.push(Prisma.sql`p.district = ${params.district}`);
    if (params.type) conditions.push(Prisma.sql`p.type::text = ${params.type}`);
    if (params.listingType)
      conditions.push(Prisma.sql`l.listing_type::text = ${params.listingType}`);
    if (params.minPrice != null)
      conditions.push(Prisma.sql`l.price >= ${params.minPrice}`);
    if (params.maxPrice != null)
      conditions.push(Prisma.sql`l.price <= ${params.maxPrice}`);
    if (params.minBedrooms != null)
      conditions.push(Prisma.sql`p.bedrooms >= ${params.minBedrooms}`);
    if (params.onlyVerified)
      conditions.push(Prisma.sql`p.verification_status::text = 'verified'`);
    if (params.geo) {
      conditions.push(Prisma.sql`p.location IS NOT NULL`);
      conditions.push(
        Prisma.sql`ST_DWithin(p.location, ${this.point(
          params.geo.lng,
          params.geo.lat,
        )}, ${params.geo.radiusM})`,
      );
    }
    return Prisma.join(conditions, ' AND ');
  }

  private buildOrderBy(params: ListingSearchParams): Prisma.Sql {
    // Geo searches default to nearest-first.
    const sort = params.sort ?? (params.geo ? 'distance' : 'newest');
    switch (sort) {
      case 'price_asc':
        return Prisma.sql`l.price ASC`;
      case 'price_desc':
        return Prisma.sql`l.price DESC`;
      case 'distance':
        return params.geo ? Prisma.sql`distance ASC` : Prisma.sql`l.created_at DESC`;
      default:
        return Prisma.sql`l.created_at DESC`;
    }
  }
}
