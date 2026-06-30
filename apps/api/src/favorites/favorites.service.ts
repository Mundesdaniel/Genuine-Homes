import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  FavoriteIdsResponse,
  ListingSearchItem,
  Paginated,
} from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { mapListingSearchItem } from '../common/mappers';
import { PropertiesRepository } from '../properties/properties.repository';
import { FavoritesRepository } from './favorites.repository';

@Injectable()
export class FavoritesService {
  constructor(
    private readonly repo: FavoritesRepository,
    // Reused for the PostGIS coordinate lookup (the location column is not a
    // Prisma-selectable field).
    private readonly properties: PropertiesRepository,
  ) {}

  async add(user: AuthenticatedUser, propertyId: string): Promise<void> {
    const property = await this.repo.propertyExists(propertyId);
    if (!property) throw new NotFoundException('Property not found');
    await this.repo.add(user.id, propertyId);
  }

  async remove(user: AuthenticatedUser, propertyId: string): Promise<void> {
    await this.repo.remove(user.id, propertyId);
  }

  async listMine(
    user: AuthenticatedUser,
    page: number,
    pageSize: number,
  ): Promise<Paginated<ListingSearchItem>> {
    const [rows, total] = await this.repo.listActiveListings(
      user.id,
      (page - 1) * pageSize,
      pageSize,
    );
    const coords = await this.properties.findCoords(
      rows.map((l) => l.property.id),
    );
    const items = rows.map((listing) =>
      mapListingSearchItem(listing, {
        coords: coords.get(listing.property.id) ?? null,
      }),
    );
    return { items, total, page, pageSize };
  }

  async listIds(user: AuthenticatedUser): Promise<FavoriteIdsResponse> {
    return { propertyIds: await this.repo.listPropertyIds(user.id) };
  }
}
