import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UserRole } from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import type { PropertiesRepository } from '../properties/properties.repository';
import type { FavoriteListing, FavoritesRepository } from './favorites.repository';
import { FavoritesService } from './favorites.service';

const user: AuthenticatedUser = { id: 'user-1', role: UserRole.USER };

const favoriteListing = (propertyId: string): FavoriteListing =>
  ({
    id: 'listing-1',
    propertyId,
    listingType: 'sale',
    price: new Prisma.Decimal('80000000'),
    currency: 'UGX',
    rentPeriod: null,
    minDepositPercent: null,
    maxInstallmentMonths: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    property: {
      id: propertyId,
      ownerId: 'owner-1',
      type: 'house',
      title: 'A home',
      description: 'desc',
      district: 'Kampala',
      city: 'Kampala',
      area: null,
      sizeSqm: null,
      bedrooms: null,
      bathrooms: null,
      amenities: {},
      verificationStatus: 'unverified',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      images: [{ url: 'http://img/1.jpg', position: 0 }],
    },
  }) as unknown as FavoriteListing;

describe('FavoritesService', () => {
  let repo: jest.Mocked<FavoritesRepository>;
  let properties: jest.Mocked<PropertiesRepository>;
  let service: FavoritesService;

  beforeEach(() => {
    repo = {
      add: jest.fn().mockResolvedValue(true),
      remove: jest.fn().mockResolvedValue(undefined),
      listActiveListings: jest.fn().mockResolvedValue([[favoriteListing('p-1')], 1]),
      listPropertyIds: jest.fn().mockResolvedValue(['p-1', 'p-2']),
      propertyExists: jest.fn().mockResolvedValue({ id: 'p-1' }),
    } as unknown as jest.Mocked<FavoritesRepository>;
    properties = {
      findCoords: jest.fn().mockResolvedValue(new Map()),
    } as unknown as jest.Mocked<PropertiesRepository>;
    service = new FavoritesService(repo, properties);
  });

  it('saves a property that exists', async () => {
    await service.add(user, 'p-1');
    expect(repo.add).toHaveBeenCalledWith(user.id, 'p-1');
  });

  it('404s when saving a property that does not exist', async () => {
    repo.propertyExists.mockResolvedValue(null);
    await expect(service.add(user, 'missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.add).not.toHaveBeenCalled();
  });

  it('lists saved properties as listing search items with a cover image', async () => {
    const page = await service.listMine(user, 1, 20);
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      id: 'listing-1',
      property: { id: 'p-1', coverImageUrl: 'http://img/1.jpg' },
    });
  });

  it('returns the favorited property ids', async () => {
    expect(await service.listIds(user)).toEqual({ propertyIds: ['p-1', 'p-2'] });
  });
});
