import { Injectable } from '@nestjs/common';
import { DEFAULT_CURRENCY, type AdminOverviewResponse } from '@genuine-homes/shared';
import { AdminRepository } from './admin.repository';

@Injectable()
export class AdminService {
  constructor(private readonly repo: AdminRepository) {}

  async overview(): Promise<AdminOverviewResponse> {
    const counts = await this.repo.overview();
    return {
      users: counts.users,
      properties: counts.properties,
      activeListings: counts.activeListings,
      activePlans: counts.activePlans,
      pendingVerifications: counts.pendingVerifications,
      revenue: { currency: DEFAULT_CURRENCY, total: counts.revenueTotal },
    };
  }
}
