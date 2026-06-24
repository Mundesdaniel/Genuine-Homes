import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Property } from '@prisma/client';
import { UserRole } from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { PropertiesService } from './properties.service';
import type { PropertiesRepository } from './properties.repository';
import type { CreatePropertyDto } from './dto/create-property.dto';

const owner: AuthenticatedUser = { id: 'owner-1', role: UserRole.LANDLORD };
const admin: AuthenticatedUser = { id: 'admin-1', role: UserRole.ADMIN };
const stranger: AuthenticatedUser = { id: 'other-1', role: UserRole.LANDLORD };

// A bare Prisma Property row (no PostGIS column — Prisma omits it).
const fakeProperty = (overrides: Partial<Property> = {}): Property =>
  ({
    id: 'prop-1',
    ownerId: owner.id,
    type: 'house',
    title: 'Test house',
    description: 'A nice house with space',
    district: 'Kampala',
    city: 'Kampala',
    area: null,
    sizeSqm: null,
    bedrooms: 3,
    bathrooms: 2,
    amenities: {},
    verificationStatus: 'verified',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }) as unknown as Property;

const baseDto: CreatePropertyDto = {
  type: 'house',
  title: 'Test house',
  description: 'A nice house with space',
  district: 'Kampala',
  city: 'Kampala',
};

describe('PropertiesService', () => {
  let repo: jest.Mocked<PropertiesRepository>;
  let service: PropertiesService;

  beforeEach(() => {
    repo = {
      create: jest.fn().mockResolvedValue('prop-1'),
      update: jest.fn().mockResolvedValue(undefined),
      softDelete: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      findDetailById: jest
        .fn()
        .mockResolvedValue({ ...fakeProperty(), images: [], listings: [] }),
      findByOwner: jest.fn(),
      findCoords: jest.fn().mockResolvedValue(new Map()),
      nextImagePosition: jest.fn().mockResolvedValue(0),
      addImage: jest.fn(),
      findImage: jest.fn(),
      removeImage: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PropertiesRepository>;
    service = new PropertiesService(repo);
  });

  describe('create', () => {
    it('creates with the current user as owner and no location', async () => {
      await service.create(owner, baseDto);
      expect(repo.create).toHaveBeenCalledWith(owner.id, expect.any(Object), null);
    });

    it('passes coordinates when both are supplied', async () => {
      await service.create(owner, { ...baseDto, latitude: 0.3, longitude: 32.6 });
      expect(repo.create).toHaveBeenCalledWith(owner.id, expect.any(Object), {
        lat: 0.3,
        lng: 32.6,
      });
    });

    it('rejects a half-specified coordinate', async () => {
      await expect(
        service.create(owner, { ...baseDto, latitude: 0.3 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('forbids updating a property you do not own', async () => {
      repo.findById.mockResolvedValue(fakeProperty());
      await expect(
        service.update(stranger, 'prop-1', { title: 'Hijacked' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('lets an admin update any property', async () => {
      repo.findById.mockResolvedValue(fakeProperty());
      await service.update(admin, 'prop-1', { title: 'Edited' });
      expect(repo.update).toHaveBeenCalled();
    });

    it('404s when the property is missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.update(owner, 'prop-1', { title: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('removeImage', () => {
    it('404s when the image is not on the property', async () => {
      repo.findById.mockResolvedValue(fakeProperty());
      repo.findImage.mockResolvedValue(null);
      await expect(
        service.removeImage(owner, 'prop-1', 'img-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.removeImage).not.toHaveBeenCalled();
    });
  });

  // Touch Prisma.Decimal so the import is exercised by the size mapper path.
  it('maps Decimal size to a number in the summary', async () => {
    repo.findByOwner.mockResolvedValue([
      [{ ...fakeProperty({ sizeSqm: new Prisma.Decimal('250.5') }), images: [] }],
      1,
    ]);
    const page = await service.listMine(owner, 1, 20);
    expect(page.items[0]?.sizeSqm).toBe(250.5);
    expect(page.total).toBe(1);
  });
});
