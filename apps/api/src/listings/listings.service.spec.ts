import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Listing, Property, PropertyImage } from '@prisma/client';
import { UserRole } from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { ListingsService } from './listings.service';
import type {
  ListingWithProperty,
  ListingsRepository,
} from './listings.repository';
import type { PropertiesRepository } from '../properties/properties.repository';
import type { CreateListingDto } from './dto/create-listing.dto';
import type { SearchListingsDto } from './dto/search-listings.dto';

const owner: AuthenticatedUser = { id: 'owner-1', role: UserRole.LANDLORD };
const stranger: AuthenticatedUser = { id: 'other-1', role: UserRole.LANDLORD };

const fakeListing = (overrides: Partial<Listing> = {}): Listing =>
  ({
    id: 'listing-1',
    propertyId: 'prop-1',
    listingType: 'rent',
    price: new Prisma.Decimal('1500000'),
    currency: 'UGX',
    rentPeriod: 'monthly',
    minDepositPercent: null,
    maxInstallmentMonths: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }) as unknown as Listing;

const fakeProperty = (): Property =>
  ({ id: 'prop-1', ownerId: owner.id }) as unknown as Property;

const withProperty = (listing: Listing): ListingWithProperty =>
  ({
    ...listing,
    property: { ...fakeProperty(), images: [] as PropertyImage[] },
  }) as unknown as ListingWithProperty;

const search = (overrides: Partial<SearchListingsDto> = {}): SearchListingsDto =>
  ({ page: 1, pageSize: 20, ...overrides }) as SearchListingsDto;

describe('ListingsService', () => {
  let repo: jest.Mocked<ListingsRepository>;
  let properties: jest.Mocked<PropertiesRepository>;
  let service: ListingsService;

  beforeEach(() => {
    repo = {
      create: jest.fn().mockImplementation((_pid, _data) => fakeListing()),
      update: jest.fn().mockResolvedValue(fakeListing()),
      softDelete: jest.fn().mockResolvedValue(undefined),
      findDetailById: jest.fn(),
      search: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
    } as unknown as jest.Mocked<ListingsRepository>;
    properties = {
      findById: jest.fn().mockResolvedValue(fakeProperty()),
      findCoords: jest.fn().mockResolvedValue(new Map()),
    } as unknown as jest.Mocked<PropertiesRepository>;
    service = new ListingsService(repo, properties);
  });

  describe('create — type rules', () => {
    const make = (dto: Partial<CreateListingDto>) =>
      service.create(owner, 'prop-1', {
        price: 1_500_000,
        ...dto,
      } as CreateListingDto);

    it('accepts a valid rent listing', async () => {
      const result = await make({ listingType: 'rent', rentPeriod: 'monthly' });
      expect(result.price).toBe(1_500_000);
      expect(repo.create).toHaveBeenCalled();
    });

    it('rejects a rent listing with no rentPeriod', async () => {
      await expect(make({ listingType: 'rent' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rejects an installment listing missing deposit/months', async () => {
      await expect(
        make({ listingType: 'installment' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a sale listing that carries a rentPeriod', async () => {
      await expect(
        make({ listingType: 'sale', rentPeriod: 'monthly' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('create — ownership', () => {
    it('forbids creating on a property you do not own', async () => {
      await expect(
        service.create(stranger, 'prop-1', {
          listingType: 'sale',
          price: 1,
        } as CreateListingDto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('404s when the property is missing', async () => {
      properties.findById.mockResolvedValue(null);
      await expect(
        service.create(owner, 'prop-1', {
          listingType: 'sale',
          price: 1,
        } as CreateListingDto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update — type switch clears stale fields', () => {
    it('drops installment terms when switching to rent', async () => {
      repo.findDetailById.mockResolvedValue(
        withProperty(
          fakeListing({
            listingType: 'installment',
            rentPeriod: null,
            minDepositPercent: new Prisma.Decimal('20'),
            maxInstallmentMonths: 36,
          }),
        ),
      );

      await service.update(owner, 'listing-1', {
        listingType: 'rent',
        rentPeriod: 'monthly',
      });

      expect(repo.update).toHaveBeenCalledWith(
        'listing-1',
        expect.objectContaining({
          listingType: 'rent',
          rentPeriod: 'monthly',
          minDepositPercent: null,
          maxInstallmentMonths: null,
        }),
      );
    });
  });

  describe('search', () => {
    it('rejects minPrice greater than maxPrice', async () => {
      await expect(
        service.search(search({ minPrice: 100, maxPrice: 50 })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a half-specified location', async () => {
      await expect(service.search(search({ lat: 0.3 }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('passes a geo filter (with default radius) to the repository', async () => {
      await service.search(search({ lat: 0.3, lng: 32.6 }));
      expect(repo.search).toHaveBeenCalledWith(
        expect.objectContaining({
          geo: { lat: 0.3, lng: 32.6, radiusM: 5000 },
          skip: 0,
          take: 20,
        }),
      );
    });
  });
});
