import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationType, UserRole, VerificationStatus } from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import type { NotificationsService } from '../notifications/notifications.service';
import type {
  VerificationWithOwner,
  VerificationWithProperty,
  VerificationsRepository,
} from './verifications.repository';
import { VerificationsService } from './verifications.service';

const owner: AuthenticatedUser = { id: 'owner-1', role: UserRole.LANDLORD };
const admin: AuthenticatedUser = { id: 'admin-1', role: UserRole.ADMIN };

const withProperty = (): VerificationWithProperty =>
  ({
    id: 'ver-1',
    propertyId: 'prop-1',
    documents: [{ kind: 'land_title', url: 'http://x/d.pdf', uploadedAt: '2026-06-01' }],
    status: 'pending',
    reviewerId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    property: { title: 'A home' },
  }) as unknown as VerificationWithProperty;

const withOwner = (status = 'verified'): VerificationWithOwner =>
  ({
    ...withProperty(),
    status,
    reviewerId: admin.id,
    property: { title: 'A home', ownerId: owner.id },
  }) as unknown as VerificationWithOwner;

describe('VerificationsService', () => {
  let repo: jest.Mocked<VerificationsRepository>;
  let notifications: jest.Mocked<NotificationsService>;
  let service: VerificationsService;

  beforeEach(() => {
    repo = {
      findProperty: jest.fn().mockResolvedValue({ id: 'prop-1', ownerId: owner.id, title: 'A home' }),
      createSubmission: jest.fn().mockResolvedValue(withProperty()),
      findById: jest.fn().mockResolvedValue(withOwner('pending')),
      listByStatus: jest.fn().mockResolvedValue([[withProperty()], 1]),
      review: jest.fn().mockResolvedValue(withOwner('verified')),
    } as unknown as jest.Mocked<VerificationsRepository>;
    notifications = { notify: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<NotificationsService>;
    const audit = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as import('../audit/audit.service').AuditService;
    service = new VerificationsService(repo, notifications, audit);
  });

  it('lets an owner submit documents (stamped with uploadedAt)', async () => {
    await service.submit(owner, {
      propertyId: 'prop-1',
      documents: [{ kind: 'land_title', url: 'http://x/d.pdf' }],
    });
    const docs = repo.createSubmission.mock.calls[0][1] as Array<{ uploadedAt: string }>;
    expect(docs[0].uploadedAt).toBeDefined();
  });

  it("forbids submitting for a property you don't own", async () => {
    repo.findProperty.mockResolvedValue({ id: 'prop-1', ownerId: 'someone-else', title: 'A home' });
    await expect(
      service.submit(owner, { propertyId: 'prop-1', documents: [{ kind: 'k', url: 'http://x/d' }] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404s submitting for an unknown property', async () => {
    repo.findProperty.mockResolvedValue(null);
    await expect(
      service.submit(owner, { propertyId: 'ghost', documents: [{ kind: 'k', url: 'http://x/d' }] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('approves and notifies the owner', async () => {
    await service.review(admin, 'ver-1', { decision: 'verified' });
    expect(repo.review).toHaveBeenCalledWith('ver-1', admin.id, VerificationStatus.VERIFIED, null);
    expect(notifications.notify).toHaveBeenCalledWith(
      owner.id,
      NotificationType.LISTING_VERIFIED,
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ propertyId: 'prop-1' }),
    );
  });

  it('rejects without notifying (no rejection notification type)', async () => {
    repo.review.mockResolvedValue(withOwner('rejected'));
    await service.review(admin, 'ver-1', { decision: 'rejected', notes: 'blurry title' });
    expect(repo.review).toHaveBeenCalledWith('ver-1', admin.id, VerificationStatus.REJECTED, 'blurry title');
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
