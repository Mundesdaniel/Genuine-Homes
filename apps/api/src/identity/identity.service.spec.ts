import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { NotificationType, UserRole, VerificationStatus } from '@genuine-homes/shared';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import type { NotificationsService } from '../notifications/notifications.service';
import type { UrlSignerService } from '../uploads/url-signer.service';
import type {
  IdentityRepository,
  IdentityVerificationWithUser,
} from './identity.repository';
import { IdentityService } from './identity.service';
import type { NinHasherService } from './nin-hasher.service';

const landlord: AuthenticatedUser = { id: 'seller-1', role: UserRole.LANDLORD };
const developer: AuthenticatedUser = { id: 'dev-1', role: UserRole.DEVELOPER };
const admin: AuthenticatedUser = { id: 'admin-1', role: UserRole.ADMIN };

const DOC_KEY = '5e0da180-3d9f-4a5e-b3f7-1f9a2c4d6e8b.jpg';
const NIN = 'CM90012100ABCD';

const row = (overrides: Record<string, unknown> = {}): IdentityVerificationWithUser =>
  ({
    id: 'idv-1',
    userId: landlord.id,
    legalName: 'Sarah Nambi',
    ninMasked: '**********ABCD',
    ninHash: 'hash',
    organizationName: null,
    registrationNumber: null,
    tin: null,
    documents: [{ kind: 'national_id_front', key: DOC_KEY, uploadedAt: '2026-07-01' }],
    status: 'pending',
    reviewerId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { fullName: 'Sarah Nambi', role: 'landlord' },
    ...overrides,
  }) as unknown as IdentityVerificationWithUser;

describe('IdentityService', () => {
  let repo: jest.Mocked<IdentityRepository>;
  let notifications: jest.Mocked<NotificationsService>;
  let service: IdentityService;

  const submitDto = {
    legalName: 'Sarah Nambi',
    nin: NIN,
    documents: [{ kind: 'national_id_front', key: DOC_KEY }],
  };

  beforeEach(() => {
    repo = {
      findUserState: jest.fn().mockResolvedValue({
        id: landlord.id,
        role: 'landlord',
        identityVerifiedAt: null,
      }),
      findLatestByUser: jest.fn().mockResolvedValue(null),
      hasPending: jest.fn().mockResolvedValue(false),
      ninVerifiedElsewhere: jest.fn().mockResolvedValue(false),
      createSubmission: jest.fn().mockResolvedValue(row()),
      findById: jest.fn().mockResolvedValue(row()),
      listByStatus: jest.fn().mockResolvedValue([[row()], 1]),
      review: jest.fn().mockResolvedValue(row({ status: 'verified', reviewerId: admin.id })),
    } as unknown as jest.Mocked<IdentityRepository>;
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
    const nin = {
      normalize: jest.fn((v: string) => v.toUpperCase()),
      mask: jest.fn(() => '**********ABCD'),
      hash: jest.fn(() => 'hash'),
    } as unknown as NinHasherService;
    service = new IdentityService(repo, nin, notifications, audit, signer);
  });

  it('stores the mask + hash, never the raw NIN', async () => {
    const res = await service.submit(landlord, submitDto);
    const data = repo.createSubmission.mock.calls[0][1];
    expect(data.ninMasked).toBe('**********ABCD');
    expect(data.ninHash).toBe('hash');
    expect(JSON.stringify(data)).not.toContain(NIN);
    expect(res.ninMasked).toBe('**********ABCD');
    // Documents come back only as signed, expiring links.
    expect(res.documents[0].url).toBe(`/api/uploads/documents/${DOC_KEY}?exp=99&sig=test`);
  });

  it('blocks resubmission while a submission is pending', async () => {
    repo.hasPending.mockResolvedValue(true);
    await expect(service.submit(landlord, submitDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('blocks submission when already verified', async () => {
    repo.findUserState.mockResolvedValue({
      id: landlord.id,
      role: 'landlord',
      identityVerifiedAt: new Date(),
    });
    await expect(service.submit(landlord, submitDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('blocks a NIN already verified on another account', async () => {
    repo.ninVerifiedElsewhere.mockResolvedValue(true);
    await expect(service.submit(landlord, submitDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('requires KYB fields for developer (company) accounts', async () => {
    repo.findUserState.mockResolvedValue({
      id: developer.id,
      role: 'developer',
      identityVerifiedAt: null,
    });
    await expect(service.submit(developer, submitDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.submit(developer, {
        ...submitDto,
        organizationName: 'Pearl Estates Ltd',
        registrationNumber: '80020001234567',
      }),
    ).resolves.toBeDefined();
  });

  it('approves, stamps the user via the repo, and notifies', async () => {
    await service.review(admin, 'idv-1', { decision: 'verified' });
    expect(repo.review).toHaveBeenCalledWith(
      'idv-1',
      admin.id,
      VerificationStatus.VERIFIED,
      null,
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      landlord.id,
      NotificationType.IDENTITY_VERIFIED,
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ identityVerificationId: 'idv-1' }),
    );
  });

  it('rejects with notes and notifies the rejection', async () => {
    repo.review.mockResolvedValue(row({ status: 'rejected', reviewerId: admin.id }));
    await service.review(admin, 'idv-1', { decision: 'rejected', notes: 'blurry photo' });
    expect(notifications.notify).toHaveBeenCalledWith(
      landlord.id,
      NotificationType.IDENTITY_REJECTED,
      expect.any(String),
      expect.stringContaining('blurry photo'),
      expect.anything(),
    );
  });

  it('four-eyes: an admin cannot review their own submission', async () => {
    repo.findById.mockResolvedValue(row({ userId: admin.id }));
    await expect(
      service.review(admin, 'idv-1', { decision: 'verified' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses to re-review a decided submission', async () => {
    repo.findById.mockResolvedValue(row({ status: 'verified' }));
    await expect(
      service.review(admin, 'idv-1', { decision: 'rejected' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
