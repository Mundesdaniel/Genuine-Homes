import type { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  it('shapes the overview with settled revenue', async () => {
    const repo = {
      overview: jest.fn().mockResolvedValue({
        users: 12,
        properties: 5,
        activeListings: 7,
        activePlans: 3,
        pendingVerifications: 2,
        revenueTotal: 48_000_000,
      }),
    } as unknown as jest.Mocked<AdminRepository>;
    const service = new AdminService(repo);

    expect(await service.overview()).toEqual({
      users: 12,
      properties: 5,
      activeListings: 7,
      activePlans: 3,
      pendingVerifications: 2,
      revenue: { currency: 'UGX', total: 48_000_000 },
    });
  });
});
