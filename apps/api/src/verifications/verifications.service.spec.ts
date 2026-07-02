import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationType, UserRole, VerificationStatus } from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import type { NotificationsService } from '../notifications/notifications.service';
import type { UrlSignerService } from '../uploads/url-signer.service';
import type {
  VerificationWithOwner,
  VerificationWithProperty,
  VerificationsRepository,
} from './verifications.repository';
import { VerificationsService } from './verifications.service';

const owner: AuthenticatedUser = { id: 'owner-1', role: UserRole.LANDLORD };
const admin: AuthenticatedUser = { id: 'admin-1', role: UserRole.ADMIN };

const DOC_KEY = '5e0da180-3d9f-4a5e-b3f7-1f9a2c4d6e8b.pdf';

const withProperty = (): VerificationWithProperty =>
  ({
    id: 'ver-1',
    propertyId: 'prop-1',
    documents: [{ kind: 'land_title', key: DOC_KEY, uploadedAt: '2026-06-01' }],
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
      findProperty: jest
        .fn()
        .mockResolvedValue({ id: 'prop-1', ownerId: owner.id, title: 'A home' }),
      createSubmission: jest.fn().mockResolvedValue(withProperty()),
      findById: jest.fn().mockResolvedValue(withOwner('pending')),
      listByStatus: jest.fn().mockResolvedValue([[withProperty()], 1]),
      review: jest.fn().mockResolvedValue(withOwner('verified')),
    } as unknown as jest.Mocked<VerificationsRepository>;
    notifications = {
      notify: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<NotificationsService>;
    const audit = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as import('../audit/audit.service').AuditService;
    const signer = {
      signedDocumentPath: jest.fn(
        (key: string) => `/api/uploads/documents/${key}?exp=99&sig=test`,
      ),
    } as unknown as UrlSignerService;
    service = new VerificationsService(repo, notifications, audit, signer);
  });

  it('lets an owner submit documents (stamped with uploadedAt, stored as keys)', async () => {
    const res = await service.submit(owner, {
      propertyId: 'prop-1',
      documents: [{ kind: 'land_title', key: DOC_KEY }],
    });
    const docs = repo.createSubmission.mock.calls[0][1] as Array<{
      key: string;
      uploadedAt: string;
    }>;
    expect(docs[0].uploadedAt).toBeDefined();
    expect(docs[0].key).toBe(DOC_KEY);
    // The response never exposes the raw key — only a signed, expiring link.
    expect(res.documents[0].url).toBe(`/api/uploads/documents/${DOC_KEY}?exp=99&sig=test`);
  });

  it("forbids submitting for a property you don't own", async () => {
    repo.findProperty.mockResolvedValue({
      id: 'prop-1',
      ownerId: 'someone-else',
      title: 'A home',
    });
    await expect(
      service.submit(owner, {
        propertyId: 'prop-1',
        documents: [{ kind: 'k', key: DOC_KEY }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404s submitting for an unknown property', async () => {
    repo.findProperty.mockResolvedValue(null);
    await expect(
      service.submit(owner, { propertyId: 'ghost', documents: [{ kind: 'k', key: DOC_KEY }] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('signs document keys in the admin queue and passes legacy URLs through', async () => {
    const legacy = withProperty();
    (legacy as unknown as { documents: unknown }).documents = [
      { kind: 'land_title', key: DOC_KEY, uploadedAt: '2026-06-01' },
      {
        kind: 'sale_agreement',
        url: 'https://legacy.example/d.pdf',
        uploadedAt: '2026-01-01',
      },
    ];
    repo.listByStatus.mockResolvedValue([[legacy], 1]);
    const page = await service.listPending(1, 20);
    expect(page.items[0].documents.map((d) => d.url)).toEqual([
      `/api/uploads/documents/${DOC_KEY}?exp=99&sig=test`,
      'https://legacy.example/d.pdf',
    ]);
  });

  it('approves and notifies the owner', async () => {
    await service.review(admin, 'ver-1', { decision: 'verified' });
    expect(repo.review).toHaveBeenCalledWith(
      'ver-1',
      admin.id,
      VerificationStatus.VERIFIED,
      null,
    );
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
    expect(repo.review).toHaveBeenCalledWith(
      'ver-1',
      admin.id,
      VerificationStatus.REJECTED,
      'blurry title',
    );
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
