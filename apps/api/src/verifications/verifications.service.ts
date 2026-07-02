import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  NotificationType,
  type Paginated,
  type VerificationResponse,
  VerificationStatus,
  UserRole,
} from '@genuine-homes/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { mapVerification } from '../common/mappers';
import { NotificationsService } from '../notifications/notifications.service';
import { UrlSignerService } from '../uploads/url-signer.service';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import { SubmitVerificationDto } from './dto/submit-verification.dto';
import { VerificationsRepository } from './verifications.repository';

@Injectable()
export class VerificationsService {
  private readonly logger = new Logger(VerificationsService.name);

  constructor(
    private readonly repo: VerificationsRepository,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly signer: UrlSignerService,
  ) {}

  // Documents live in private storage as opaque keys; every response gets
  // freshly signed, expiring links so nothing durable is ever handed out.
  private readonly signDocumentUrl = (key: string): string =>
    this.signer.signedDocumentPath(key);

  // Owner submits ownership/title documents; the property moves to `pending`.
  async submit(
    user: AuthenticatedUser,
    dto: SubmitVerificationDto,
  ): Promise<VerificationResponse> {
    const property = await this.repo.findProperty(dto.propertyId);
    if (!property) throw new NotFoundException('Property not found');
    if (user.role !== UserRole.ADMIN && property.ownerId !== user.id) {
      throw new ForbiddenException('You do not own this property');
    }

    const uploadedAt = new Date().toISOString();
    const documents = dto.documents.map((d) => ({
      kind: d.kind,
      key: d.key,
      uploadedAt,
    })) as unknown as Prisma.InputJsonValue;

    const verification = await this.repo.createSubmission(dto.propertyId, documents);
    this.logger.log(
      `Verification ${verification.id} submitted for property ${dto.propertyId}`,
    );
    return mapVerification(verification, this.signDocumentUrl);
  }

  // Admin queue (oldest first).
  async listPending(page: number, pageSize: number): Promise<Paginated<VerificationResponse>> {
    const [rows, total] = await this.repo.listByStatus(
      VerificationStatus.PENDING,
      (page - 1) * pageSize,
      pageSize,
    );
    return {
      items: rows.map((row) => mapVerification(row, this.signDocumentUrl)),
      total,
      page,
      pageSize,
    };
  }

  // Admin decision: approve or reject, update the badge, and tell the owner.
  async review(
    reviewer: AuthenticatedUser,
    id: string,
    dto: ReviewVerificationDto,
  ): Promise<VerificationResponse> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Verification not found');

    const status =
      dto.decision === 'verified' ? VerificationStatus.VERIFIED : VerificationStatus.REJECTED;

    const verification = await this.repo.review(id, reviewer.id, status, dto.notes ?? null);

    await this.audit.record({
      actorId: reviewer.id,
      action: 'verification.reviewed',
      entityType: 'verification',
      entityId: id,
      metadata: {
        decision: status,
        propertyId: verification.propertyId,
        notes: dto.notes ?? null,
      },
    });

    if (status === VerificationStatus.VERIFIED) {
      await this.notifications.notify(
        verification.property.ownerId,
        NotificationType.LISTING_VERIFIED,
        'Property verified',
        `"${verification.property.title}" has been verified and now shows the Verified badge.`,
        { propertyId: verification.propertyId, verificationId: verification.id },
      );
    } else {
      this.logger.log(`Verification ${id} rejected${dto.notes ? `: ${dto.notes}` : ''}`);
    }

    return mapVerification(verification, this.signDocumentUrl);
  }
}
