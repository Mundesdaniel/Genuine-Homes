import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  type IdentityVerificationQueueItem,
  type IdentityVerificationResponse,
  NotificationType,
  type Paginated,
  UserRole,
  VerificationStatus,
} from '@genuine-homes/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { mapIdentityQueueItem, mapIdentityVerification } from '../common/mappers';
import { NotificationsService } from '../notifications/notifications.service';
import { UrlSignerService } from '../uploads/url-signer.service';
import { ReviewIdentityVerificationDto } from './dto/review-identity-verification.dto';
import { SubmitIdentityVerificationDto } from './dto/submit-identity-verification.dto';
import { IdentityRepository } from './identity.repository';
import { NinHasherService } from './nin-hasher.service';

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    private readonly repo: IdentityRepository,
    private readonly nin: NinHasherService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly signer: UrlSignerService,
  ) {}

  private readonly signDocumentUrl = (key: string): string =>
    this.signer.signedDocumentPath(key);

  /** Submit National ID details + documents; lands in the admin queue. */
  async submit(
    user: AuthenticatedUser,
    dto: SubmitIdentityVerificationDto,
  ): Promise<IdentityVerificationResponse> {
    const state = await this.repo.findUserState(user.id);
    if (!state) throw new NotFoundException('User not found');
    if (state.identityVerifiedAt) {
      throw new ConflictException('Your identity is already verified');
    }
    if (await this.repo.hasPending(user.id)) {
      throw new ConflictException('You already have a submission awaiting review');
    }

    // Developers are companies — the NIN belongs to the authorized
    // representative and must come with the company's registration.
    if (user.role === UserRole.DEVELOPER && !dto.organizationName) {
      throw new BadRequestException(
        'Developer accounts must include organizationName and registrationNumber (URSB)',
      );
    }

    const ninHash = this.nin.hash(dto.nin);
    if (await this.repo.ninVerifiedElsewhere(ninHash, user.id)) {
      throw new ConflictException(
        'This National ID is already verified on another account',
      );
    }

    const uploadedAt = new Date().toISOString();
    const documents = dto.documents.map((d) => ({
      kind: d.kind,
      key: d.key,
      uploadedAt,
    })) as unknown as Prisma.InputJsonValue;

    const row = await this.repo.createSubmission(user.id, {
      legalName: dto.legalName,
      ninMasked: this.nin.mask(dto.nin),
      ninHash,
      organizationName: dto.organizationName ?? null,
      registrationNumber: dto.registrationNumber ?? null,
      tin: dto.tin ?? null,
      documents,
    });

    await this.audit.record({
      actorId: user.id,
      action: 'identity.submitted',
      entityType: 'identity_verification',
      entityId: row.id,
      metadata: { ninMasked: row.ninMasked, role: user.role },
    });
    this.logger.log(`Identity verification ${row.id} submitted by user ${user.id}`);
    return mapIdentityVerification(row, this.signDocumentUrl);
  }

  /** The caller's latest submission, or null if they never submitted. */
  async myStatus(user: AuthenticatedUser): Promise<IdentityVerificationResponse | null> {
    const row = await this.repo.findLatestByUser(user.id);
    return row ? mapIdentityVerification(row, this.signDocumentUrl) : null;
  }

  /** Admin queue (oldest first). */
  async listPending(
    page: number,
    pageSize: number,
  ): Promise<Paginated<IdentityVerificationQueueItem>> {
    const [rows, total] = await this.repo.listByStatus(
      VerificationStatus.PENDING,
      (page - 1) * pageSize,
      pageSize,
    );
    return {
      items: rows.map((row) => mapIdentityQueueItem(row, this.signDocumentUrl)),
      total,
      page,
      pageSize,
    };
  }

  /** Admin decision. Four-eyes: nobody reviews their own identity. */
  async review(
    reviewer: AuthenticatedUser,
    id: string,
    dto: ReviewIdentityVerificationDto,
  ): Promise<IdentityVerificationResponse> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Identity verification not found');
    if (existing.userId === reviewer.id) {
      throw new ForbiddenException('You cannot review your own identity verification');
    }
    if (existing.status !== VerificationStatus.PENDING) {
      throw new ConflictException('This submission has already been reviewed');
    }

    const status =
      dto.decision === 'verified'
        ? VerificationStatus.VERIFIED
        : VerificationStatus.REJECTED;
    const row = await this.repo.review(id, reviewer.id, status, dto.notes ?? null);

    await this.audit.record({
      actorId: reviewer.id,
      action: 'identity.reviewed',
      entityType: 'identity_verification',
      entityId: id,
      metadata: {
        decision: status,
        userId: row.userId,
        ninMasked: row.ninMasked,
        notes: dto.notes ?? null,
      },
    });

    if (status === VerificationStatus.VERIFIED) {
      await this.notifications.notify(
        row.userId,
        NotificationType.IDENTITY_VERIFIED,
        'Identity verified',
        'Your National ID has been verified. You can now publish your properties.',
        { identityVerificationId: row.id },
      );
    } else {
      await this.notifications.notify(
        row.userId,
        NotificationType.IDENTITY_REJECTED,
        'Identity verification rejected',
        dto.notes
          ? `Your submission was rejected: ${dto.notes}`
          : 'Your submission was rejected. Please check your details and try again.',
        { identityVerificationId: row.id },
      );
    }

    return mapIdentityVerification(row, this.signDocumentUrl);
  }

  /** Publication gate: has this user's identity been verified? */
  async isVerified(userId: string): Promise<boolean> {
    const state = await this.repo.findUserState(userId);
    return state?.identityVerifiedAt != null;
  }
}
