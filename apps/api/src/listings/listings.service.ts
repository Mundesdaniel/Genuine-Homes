import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DEFAULT_CURRENCY,
  DEFAULT_SEARCH_RADIUS_M,
  type ListingResponse,
  type ListingSearchItem,
  type Paginated,
  UserRole,
  listingShapeError,
} from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { mapListing, mapListingSearchItem } from '../common/mappers';
import { PropertiesRepository } from '../properties/properties.repository';
import { CreateListingDto } from './dto/create-listing.dto';
import { SearchListingsDto } from './dto/search-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import {
  type ListingWithProperty,
  type ListingWriteData,
  ListingsRepository,
} from './listings.repository';

@Injectable()
export class ListingsService {
  constructor(
    private readonly repo: ListingsRepository,
    private readonly properties: PropertiesRepository,
  ) {}

  async create(
    user: AuthenticatedUser,
    propertyId: string,
    dto: CreateListingDto,
  ): Promise<ListingResponse> {
    const property = await this.properties.findById(propertyId);
    if (!property) throw new NotFoundException('Property not found');
    this.assertOwner(property.ownerId, user);

    const data: ListingWriteData = {
      listingType: dto.listingType,
      price: dto.price,
      currency: dto.currency ?? DEFAULT_CURRENCY,
      rentPeriod: dto.rentPeriod ?? null,
      minDepositPercent: dto.minDepositPercent ?? null,
      maxInstallmentMonths: dto.maxInstallmentMonths ?? null,
      isActive: dto.isActive ?? true,
    };
    this.assertValidShape(data);

    const listing = await this.repo.create(propertyId, data);
    return mapListing(listing);
  }

  async update(
    user: AuthenticatedUser,
    listingId: string,
    dto: UpdateListingDto,
  ): Promise<ListingResponse> {
    const current = await this.loadManageable(listingId, user);
    const data = this.mergeForUpdate(current, dto);
    this.assertValidShape(data);

    const listing = await this.repo.update(listingId, data);
    return mapListing(listing);
  }

  async remove(user: AuthenticatedUser, listingId: string): Promise<void> {
    await this.loadManageable(listingId, user);
    await this.repo.softDelete(listingId);
  }

  // Public listing detail (with its property summary + coordinates).
  async getOne(listingId: string): Promise<ListingSearchItem> {
    const listing = await this.repo.findDetailById(listingId);
    if (!listing) throw new NotFoundException('Listing not found');
    const coords =
      (await this.properties.findCoords([listing.propertyId])).get(
        listing.propertyId,
      ) ?? null;
    return mapListingSearchItem(listing, { coords, distanceM: null });
  }

  // Public faceted + "near me" search.
  async search(dto: SearchListingsDto): Promise<Paginated<ListingSearchItem>> {
    if (dto.minPrice != null && dto.maxPrice != null && dto.minPrice > dto.maxPrice) {
      throw new BadRequestException('minPrice cannot exceed maxPrice');
    }
    const geo = this.resolveGeo(dto);
    const { rows, total } = await this.repo.search({
      district: dto.district,
      type: dto.type,
      listingType: dto.listingType,
      minPrice: dto.minPrice,
      maxPrice: dto.maxPrice,
      minBedrooms: dto.minBedrooms,
      onlyVerified: dto.onlyVerified,
      geo,
      sort: dto.sort,
      skip: (dto.page - 1) * dto.pageSize,
      take: dto.pageSize,
    });

    const items = rows.map((row) =>
      mapListingSearchItem(row.listing, {
        coords: row.coords,
        distanceM: row.distanceM,
      }),
    );
    return { items, total, page: dto.page, pageSize: dto.pageSize };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async loadManageable(
    listingId: string,
    user: AuthenticatedUser,
  ): Promise<ListingWithProperty> {
    const listing = await this.repo.findDetailById(listingId);
    if (!listing) throw new NotFoundException('Listing not found');
    this.assertOwner(listing.property.ownerId, user);
    return listing;
  }

  private assertOwner(ownerId: string, user: AuthenticatedUser): void {
    if (user.role !== UserRole.ADMIN && ownerId !== user.id) {
      throw new ForbiddenException('You do not own this property');
    }
  }

  private assertValidShape(data: ListingWriteData): void {
    const message = listingShapeError(data);
    if (message) throw new BadRequestException(message);
  }

  // Merge an update over the current row. When the listing type changes, the
  // type-specific fields are dropped unless the request supplies new ones.
  private mergeForUpdate(
    current: ListingWithProperty,
    dto: UpdateListingDto,
  ): ListingWriteData {
    const typeChanged =
      dto.listingType !== undefined && dto.listingType !== current.listingType;
    const carry = <T>(value: T | undefined, fallback: T): T =>
      value !== undefined ? value : typeChanged ? (null as T) : fallback;

    return {
      listingType: dto.listingType ?? current.listingType,
      price: dto.price ?? current.price.toNumber(),
      currency: dto.currency ?? current.currency,
      isActive: dto.isActive ?? current.isActive,
      rentPeriod: carry(dto.rentPeriod, current.rentPeriod),
      minDepositPercent: carry(
        dto.minDepositPercent,
        current.minDepositPercent != null
          ? current.minDepositPercent.toNumber()
          : null,
      ),
      maxInstallmentMonths: carry(
        dto.maxInstallmentMonths,
        current.maxInstallmentMonths ?? null,
      ),
    };
  }

  private resolveGeo(
    dto: SearchListingsDto,
  ): { lat: number; lng: number; radiusM: number } | undefined {
    if (dto.lat == null && dto.lng == null) return undefined;
    if (dto.lat == null || dto.lng == null) {
      throw new BadRequestException('lat and lng must be provided together');
    }
    return {
      lat: dto.lat,
      lng: dto.lng,
      radiusM: dto.radiusM ?? DEFAULT_SEARCH_RADIUS_M,
    };
  }
}
