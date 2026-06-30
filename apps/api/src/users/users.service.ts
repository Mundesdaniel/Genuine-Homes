import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  type Paginated,
  type UserProfileResponse,
  type UserRole,
} from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { mapUserProfile } from '../common/mappers';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  async getMe(user: AuthenticatedUser): Promise<UserProfileResponse> {
    return this.getProfile(user.id);
  }

  async updateMe(
    user: AuthenticatedUser,
    dto: UpdateProfileDto,
  ): Promise<UserProfileResponse> {
    try {
      const updated = await this.repo.update(user.id, {
        fullName: dto.fullName,
        email: dto.email,
      });
      return mapUserProfile(updated);
    } catch (err) {
      throw this.rethrow(err);
    }
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  async list(
    page: number,
    pageSize: number,
    role?: UserRole,
  ): Promise<Paginated<UserProfileResponse>> {
    const [rows, total] = await this.repo.list((page - 1) * pageSize, pageSize, role);
    return { items: rows.map(mapUserProfile), total, page, pageSize };
  }

  async getOne(id: string): Promise<UserProfileResponse> {
    return this.getProfile(id);
  }

  async adminUpdate(
    actor: AuthenticatedUser,
    id: string,
    dto: AdminUpdateUserDto,
  ): Promise<UserProfileResponse> {
    // Guard against an admin accidentally locking themselves out of admin.
    if (id === actor.id && dto.role !== undefined) {
      throw new BadRequestException('You cannot change your own role');
    }
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('User not found');
    const updated = await this.repo.update(id, {
      role: dto.role,
      isVerified: dto.isVerified,
    });
    return mapUserProfile(updated);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async getProfile(id: string): Promise<UserProfileResponse> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return mapUserProfile(user);
  }

  private rethrow(err: unknown): Error {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return new ConflictException('That email is already in use');
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
