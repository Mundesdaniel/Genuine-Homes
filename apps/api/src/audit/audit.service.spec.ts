import type { AuditLog } from '@prisma/client';
import { AuditService } from './audit.service';
import type { AuditRepository, AuditLogWithActor } from './audit.repository';
import { requestContext } from '../common/request-context';

const row = (over: Partial<AuditLog> = {}): AuditLogWithActor =>
  ({
    id: 'audit-1',
    actorId: 'admin-1',
    action: 'payment.settled',
    entityType: 'payment',
    entityId: 'pay-1',
    metadata: { status: 'successful' },
    ip: '127.0.0.1',
    requestId: 'req-1',
    createdAt: new Date('2026-07-02T10:00:00Z'),
    actor: { id: 'admin-1', fullName: 'Admin One', role: 'admin' },
    ...over,
  }) as unknown as AuditLogWithActor;

describe('AuditService', () => {
  let repo: jest.Mocked<AuditRepository>;
  let service: AuditService;

  beforeEach(() => {
    repo = {
      create: jest.fn().mockResolvedValue(undefined),
      list: jest.fn().mockResolvedValue([[row()], 1]),
    } as unknown as jest.Mocked<AuditRepository>;
    service = new AuditService(repo);
  });

  it('writes an entry with nulls for omitted fields', async () => {
    await service.record({ action: 'payment.settled' });
    expect(repo.create).toHaveBeenCalledWith({
      actorId: null,
      action: 'payment.settled',
      entityType: null,
      entityId: null,
      metadata: {},
      ip: null,
      requestId: null,
    });
  });

  it('picks up the correlation id + ip from the request context', async () => {
    await requestContext.run({ requestId: 'req-42', ip: '10.0.0.9' }, () =>
      service.record({ actorId: 'admin-1', action: 'user.admin_updated' }),
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-42', ip: '10.0.0.9', actorId: 'admin-1' }),
    );
  });

  it('never throws when the write fails — audit must not break business ops', async () => {
    repo.create.mockRejectedValue(new Error('db down'));
    await expect(service.record({ action: 'payment.settled' })).resolves.toBeUndefined();
  });

  it('lists entries newest-first with actor names', async () => {
    const result = await service.list({}, 1, 20);
    expect(repo.list).toHaveBeenCalledWith({}, 0, 20);
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 'audit-1',
      actorName: 'Admin One',
      action: 'payment.settled',
      createdAt: '2026-07-02T10:00:00.000Z',
    });
  });
});
