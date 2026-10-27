import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Property } from '@prisma/client';
import {
  type ManagedAgentResponse,
  type Paginated,
  type PropertyDetail,
  type PropertyImageResponse,
  PropertyStatus,
  type PropertySummary,
  UserRole,
} from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { IdentityService } from '../identity/identity.service';
import {
  type Coords,
  mapImage,
  mapPropertyDetail,
  mapPropertySummary,
} from '../common/mappers';
import { AddImageDto } from './dto/add-image.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { AssignAgentDto } from './dto/assign-agent.dto';
import {
  type AssignmentWithAgent,
  PropertiesRepository,
  type PropertyWriteData,
} from './properties.repository';

const mapAssignedAgent = (a: AssignmentWithAgent): ManagedAgentResponse => ({
  id: a.agent.id,
  fullName: a.agent.fullName,
  phone: a.agent.phone,
  email: a.agent.email ?? null,
  role: a.agent.role,
  assignedAt: a.assignedAt.toISOString(),
});

@Injectable()
export class PropertiesService {
  constructor(
    private readonly repo: PropertiesRepository,
    private readonly identity: IdentityService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreatePropertyDto): Promise<PropertyDetail> {
    await this.assertMayPublish(user, dto.status);
    const coords = this.resolveCoords(dto.latitude, dto.longitude);
    const data: PropertyWriteData = {
      type: dto.type,
      title: dto.title,
      description: dto.description,
      district: dto.district,
      city: dto.city,
      area: dto.area ?? null,
      contactName: dto.contactName ?? null,
      landlordName: dto.landlordName,
      landlordImageUrl: dto.landlordImageUrl ?? null,
      unitCount: dto.unitCount ?? null,
      sizeSqm: dto.sizeSqm ?? null,
      bedrooms: dto.bedrooms ?? null,
      bathrooms: dto.bathrooms ?? null,
      amenities: dto.amenities ?? {},
      status: dto.status,
    };
    const id = await this.repo.create(user.id, data, coords);
    return this.getDetail(id);
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdatePropertyDto,
  ): Promise<PropertyDetail> {
    await this.loadManageable(id, user);
    await this.assertMayPublish(user, dto.status);
    const coords = this.resolveCoords(dto.latitude, dto.longitude);
    // Undefined fields are skipped by the repository; only sent fields change.
    const data: Partial<PropertyWriteData> = {
      type: dto.type,
      title: dto.title,
      description: dto.description,
      district: dto.district,
      city: dto.city,
      area: dto.area,
      contactName: dto.contactName,
      landlordName: dto.landlordName,
      landlordImageUrl: dto.landlordImageUrl,
      unitCount: dto.unitCount,
      sizeSqm: dto.sizeSqm,
      bedrooms: dto.bedrooms,
      bathrooms: dto.bathrooms,
      amenities: dto.amenities,
      status: dto.status,
    };
    await this.repo.update(id, data, coords);
    return this.getDetail(id);
  }

  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    await this.loadManageable(id, user);
    await this.repo.softDelete(id);
  }

  // Public property detail (gallery + listings + coordinates).
  async getDetail(id: string): Promise<PropertyDetail> {
    const property = await this.repo.findDetailById(id);
    if (!property) throw new NotFoundException('Property not found');
    const coords = (await this.repo.findCoords([id])).get(id) ?? null;
    return mapPropertyDetail(property, coords);
  }

  // The current user's own properties (seller dashboard).
  async listMine(
    user: AuthenticatedUser,
    page: number,
    pageSize: number,
  ): Promise<Paginated<PropertySummary>> {
    const [rows, total] = await this.repo.findByOwner(
      user.id,
      (page - 1) * pageSize,
      pageSize,
    );
    const coords = await this.repo.findCoords(rows.map((p) => p.id));
    const items = rows.map((p) =>
      mapPropertySummary(p, {
        coords: coords.get(p.id) ?? null,
        coverImageUrl: p.images[0]?.url ?? null,
      }),
    );
    return { items, total, page, pageSize };
  }

  async addImage(
    user: AuthenticatedUser,
    propertyId: string,
    dto: AddImageDto,
  ): Promise<PropertyImageResponse> {
    await this.loadManageable(propertyId, user);
    const position = dto.position ?? (await this.repo.nextImagePosition(propertyId));
    const image = await this.repo.addImage(propertyId, dto.url, position);
    return mapImage(image);
  }

  async removeImage(
    user: AuthenticatedUser,
    propertyId: string,
    imageId: string,
  ): Promise<void> {
    await this.loadManageable(propertyId, user);
    const image = await this.repo.findImage(propertyId, imageId);
    if (!image) throw new NotFoundException('Image not found');
    await this.repo.removeImage(imageId);
  }

  // ── Agent assignments ───────────────────────────────────────────────────────

  /** Agents a manager/owner has assigned to help run this property. */
  async listAssignedAgents(
    user: AuthenticatedUser,
    propertyId: string,
  ): Promise<ManagedAgentResponse[]> {
    await this.loadManageable(propertyId, user);
    const rows = await this.repo.listAssignments(propertyId);
    return rows.map(mapAssignedAgent);
  }

  /** Assign an agent (by email/phone) to help handle this property's tenants. */
  async assignAgent(
    user: AuthenticatedUser,
    propertyId: string,
    dto: AssignAgentDto,
  ): Promise<ManagedAgentResponse> {
    const property = await this.loadManageable(propertyId, user);
    const agent = await this.repo.findUserByEmailOrPhone(dto.emailOrPhone);
    if (!agent) {
      throw new NotFoundException('No user found with that email or phone');
    }
    if (agent.role !== UserRole.AGENT) {
      throw new BadRequestException('Only an agent can be assigned to a property');
    }
    if (agent.id === property.ownerId) {
      throw new BadRequestException('The property owner already manages this property');
    }
    if (await this.repo.findAssignment(propertyId, agent.id)) {
      throw new BadRequestException('That agent is already assigned to this property');
    }
    const assignment = await this.repo.assign(propertyId, agent.id);
    return mapAssignedAgent(assignment);
  }

  /** Remove an assigned agent from this property. */
  async unassignAgent(
    user: AuthenticatedUser,
    propertyId: string,
    agentId: string,
  ): Promise<void> {
    await this.loadManageable(propertyId, user);
    await this.repo.unassign(propertyId, agentId);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Publication gate: a property only becomes publicly visible (search joins
  // on `status = 'active'`) once the seller's National ID has been verified.
  // Drafting, editing, and every other status stay open — only going live is
  // gated. Admins bypass (they manage on behalf of the platform).
  private async assertMayPublish(
    user: AuthenticatedUser,
    requestedStatus: string | undefined,
  ): Promise<void> {
    if (requestedStatus !== PropertyStatus.ACTIVE) return;
    if (user.role === UserRole.ADMIN) return;
    if (await this.identity.isVerified(user.id)) return;
    throw new ForbiddenException(
      'Verify your identity (National ID) before publishing a property. Submit it under Account → Identity verification.',
    );
  }

  // Load a property and assert the user owns it (admins may manage any).
  private async loadManageable(id: string, user: AuthenticatedUser): Promise<Property> {
    const property = await this.repo.findById(id);
    if (!property) throw new NotFoundException('Property not found');
    if (user.role !== UserRole.ADMIN && property.ownerId !== user.id) {
      throw new ForbiddenException('You do not own this property');
    }
    return property;
  }

  // Coordinates are all-or-nothing.
  private resolveCoords(lat: number | undefined, lng: number | undefined): Coords | null {
    if ((lat == null) !== (lng == null)) {
      throw new BadRequestException('latitude and longitude must be provided together');
    }
    return lat != null && lng != null ? { lat, lng } : null;
  }
}
