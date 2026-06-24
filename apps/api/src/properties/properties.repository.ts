import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Listing, Property, PropertyImage } from '@prisma/client';
import type { PropertyStatus, PropertyType } from '@genuine-homes/shared';
import type { Coords } from '../common/mappers';
import { PrismaService } from '../prisma/prisma.service';

// Scalar fields the service sends in; `null` clears an optional column.
export interface PropertyWriteData {
  type: PropertyType;
  title: string;
  description: string;
  district: string;
  city: string;
  area: string | null;
  sizeSqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  amenities: Record<string, boolean>;
  status?: PropertyStatus;
}

export type PropertyDetailRow = Property & {
  images: PropertyImage[];
  listings: Listing[];
};

@Injectable()
export class PropertiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Create the row, then set the PostGIS point (Prisma can't write the
  // Unsupported `location` column). Both run in one transaction.
  async create(
    ownerId: string,
    data: PropertyWriteData,
    coords: Coords | null,
  ): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const property = await tx.property.create({
        data: {
          ownerId,
          type: data.type,
          title: data.title,
          description: data.description,
          district: data.district,
          city: data.city,
          area: data.area,
          sizeSqm: data.sizeSqm,
          bedrooms: data.bedrooms,
          bathrooms: data.bathrooms,
          amenities: data.amenities as Prisma.InputJsonValue,
          status: data.status,
        },
      });
      if (coords) await this.writeLocation(tx, property.id, coords);
      return property.id;
    });
  }

  async update(
    id: string,
    data: Partial<PropertyWriteData>,
    coords: Coords | null,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.property.update({ where: { id }, data: this.toPrismaData(data) });
      if (coords) await this.writeLocation(tx, id, coords);
    });
  }

  // Soft delete: hide the property and deactivate its listings so neither shows
  // up in search again. Financial history is preserved (no hard delete).
  async softDelete(id: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.listing.updateMany({
        where: { propertyId: id, deletedAt: null },
        data: { deletedAt: now, isActive: false },
      }),
      this.prisma.property.update({ where: { id }, data: { deletedAt: now } }),
    ]);
  }

  // Bare row for ownership/existence checks.
  findById(id: string): Promise<Property | null> {
    return this.prisma.property.findFirst({ where: { id, deletedAt: null } });
  }

  // Full detail: gallery (ordered) + active listings.
  findDetailById(id: string): Promise<PropertyDetailRow | null> {
    return this.prisma.property.findFirst({
      where: { id, deletedAt: null },
      include: {
        images: { orderBy: { position: 'asc' } },
        listings: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async findByOwner(
    ownerId: string,
    skip: number,
    take: number,
  ): Promise<[Array<Property & { images: PropertyImage[] }>, number]> {
    const where: Prisma.PropertyWhereInput = { ownerId, deletedAt: null };
    return this.prisma.$transaction([
      this.prisma.property.findMany({
        where,
        include: { images: { orderBy: { position: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.property.count({ where }),
    ]);
  }

  // ── Images ──────────────────────────────────────────────────────────────

  async nextImagePosition(propertyId: string): Promise<number> {
    const { _max } = await this.prisma.propertyImage.aggregate({
      where: { propertyId },
      _max: { position: true },
    });
    return (_max.position ?? -1) + 1;
  }

  addImage(
    propertyId: string,
    url: string,
    position: number,
  ): Promise<PropertyImage> {
    return this.prisma.propertyImage.create({
      data: { propertyId, url, position },
    });
  }

  findImage(propertyId: string, imageId: string): Promise<PropertyImage | null> {
    return this.prisma.propertyImage.findFirst({
      where: { id: imageId, propertyId },
    });
  }

  async removeImage(imageId: string): Promise<void> {
    await this.prisma.propertyImage.delete({ where: { id: imageId } });
  }

  // ── PostGIS ───────────────────────────────────────────────────────────────

  // Read lng/lat back for a set of properties (Prisma can't select the column).
  async findCoords(ids: string[]): Promise<Map<string, Coords>> {
    const map = new Map<string, Coords>();
    if (ids.length === 0) return map;
    const rows = await this.prisma.$queryRaw<
      { id: string; lat: number | null; lng: number | null }[]
    >(Prisma.sql`
      SELECT id::text AS id,
             ST_Y(location::geometry) AS lat,
             ST_X(location::geometry) AS lng
      FROM properties
      WHERE location IS NOT NULL AND id::text IN (${Prisma.join(ids)})
    `);
    for (const row of rows) {
      if (row.lat != null && row.lng != null) {
        map.set(row.id, { lat: row.lat, lng: row.lng });
      }
    }
    return map;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private writeLocation(
    tx: Prisma.TransactionClient,
    id: string,
    coords: Coords,
  ): Promise<number> {
    return tx.$executeRaw`
      UPDATE properties
      SET location = ST_SetSRID(ST_MakePoint(${coords.lng}, ${coords.lat}), 4326)::geography
      WHERE id = ${id}::uuid`;
  }

  // Map the domain write shape onto Prisma's input (JSON cast, undefined skips).
  private toPrismaData(
    data: Partial<PropertyWriteData>,
  ): Prisma.PropertyUncheckedUpdateInput {
    return {
      type: data.type,
      title: data.title,
      description: data.description,
      district: data.district,
      city: data.city,
      area: data.area,
      sizeSqm: data.sizeSqm,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      amenities:
        data.amenities !== undefined
          ? (data.amenities as Prisma.InputJsonValue)
          : undefined,
      status: data.status,
    };
  }
}
