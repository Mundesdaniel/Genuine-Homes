import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import { UserRole } from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import type { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

const admin: AuthenticatedUser = { id: 'admin-1', role: UserRole.ADMIN };
const self: AuthenticatedUser = { id: 'user-1', role: UserRole.USER };

const user = (over: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    fullName: 'Ada',
    email: 'ada@example.com',
    phone: '+256700000000',
    role: 'user',
    isVerified: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date(),
    deletedAt: null,
    passwordHash: 'x',
    ...over,
  }) as unknown as User;

describe('UsersService', () => {
  let repo: jest.Mocked<UsersRepository>;
  let service: UsersService;

  beforeEach(() => {
    repo = {
      findById: jest.fn().mockResolvedValue(user()),
      update: jest.fn().mockResolvedValue(user({ fullName: 'Ada N.' })),
      list: jest.fn().mockResolvedValue([[user()], 1]),
    } as unknown as jest.Mocked<UsersRepository>;
    service = new UsersService(repo);
  });

  it('returns the current profile', async () => {
    const profile = await service.getMe(self);
    expect(profile).toMatchObject({ id: 'user-1', email: 'ada@example.com' });
    // The password hash never leaks into the response shape.
    expect(profile).not.toHaveProperty('passwordHash');
  });

  it('updates the profile', async () => {
    const profile = await service.updateMe(self, { fullName: 'Ada N.' });
    expect(repo.update).toHaveBeenCalledWith('user-1', { fullName: 'Ada N.', email: undefined });
    expect(profile.fullName).toBe('Ada N.');
  });

  it('maps a duplicate-email error to a 409', async () => {
    repo.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '6' }),
    );
    await expect(service.updateMe(self, { email: 'taken@example.com' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('lets an admin change another user role', async () => {
    repo.update.mockResolvedValue(user({ role: 'agent' }));
    const result = await service.adminUpdate(admin, 'user-1', { role: UserRole.AGENT });
    expect(repo.update).toHaveBeenCalledWith('user-1', { role: 'agent', isVerified: undefined });
    expect(result.role).toBe('agent');
  });

  it('stops an admin from changing their own role', async () => {
    await expect(
      service.adminUpdate(admin, admin.id, { role: UserRole.USER }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s updating an unknown user', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(
      service.adminUpdate(admin, 'ghost', { isVerified: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
