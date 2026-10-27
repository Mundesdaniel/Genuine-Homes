import { Injectable } from '@nestjs/common';
import {
  DEFAULT_CURRENCY,
  type AdminAgentPerformanceRow,
  type AdminDealRow,
  type AdminOverviewResponse,
  type AdminPersonRef,
  type AdminPropertyRow,
  type Paginated,
  type UserRole,
} from '@genuine-homes/shared';
import { AdminRepository } from './admin.repository';

/** Minimal shape every person reference is built from. */
interface PersonLike {
  id: string;
  fullName: string;
  phone: string;
  role?: string | null;
}

const personRef = (p: PersonLike): AdminPersonRef => ({
  id: p.id,
  fullName: p.fullName,
  phone: p.phone,
  ...(p.role ? { role: p.role as UserRole } : {}),
});

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

  /** All properties with the agent who added each — internal visibility. */
  async properties(page: number, pageSize: number): Promise<Paginated<AdminPropertyRow>> {
    const [rows, total] = await this.repo.listProperties((page - 1) * pageSize, pageSize);
    const items: AdminPropertyRow[] = rows.map((p) => ({
      id: p.id,
      title: p.title,
      type: p.type,
      district: p.district,
      city: p.city,
      status: p.status,
      verificationStatus: p.verificationStatus,
      landlordName: p.landlordName,
      createdAt: p.createdAt.toISOString(),
      agent: personRef(p.owner),
    }));
    return { items, total, page, pageSize };
  }

  /** Every successful deal (rental + installment + outright purchase) with the
   *  agent who closed it and the tenant/buyer on the other side. Merged from
   *  three sources, sorted newest first, then paginated in memory (admin-scale). */
  async deals(page: number, pageSize: number): Promise<Paginated<AdminDealRow>> {
    const all = await this.collectDeals();
    all.sort((a, b) => b.date.localeCompare(a.date));
    const start = (page - 1) * pageSize;
    return {
      items: all.slice(start, start + pageSize),
      total: all.length,
      page,
      pageSize,
    };
  }

  /** Per-agent rollup: properties added + successful deals closed. */
  async agents(): Promise<AdminAgentPerformanceRow[]> {
    const [propCounts, deals] = await Promise.all([
      this.repo.propertiesByOwner(),
      this.collectDeals(),
    ]);

    const propsByAgent = new Map<string, number>();
    for (const row of propCounts) propsByAgent.set(row.ownerId, row.count);

    const rentalsByAgent = new Map<string, number>();
    const salesByAgent = new Map<string, number>();
    const info = new Map<string, AdminPersonRef>();
    for (const d of deals) {
      info.set(d.agent.id, d.agent);
      const bucket = d.kind === 'rental' ? rentalsByAgent : salesByAgent;
      bucket.set(d.agent.id, (bucket.get(d.agent.id) ?? 0) + 1);
    }

    // Agents that own properties but have no deals yet need their details filled.
    const missing = [...propsByAgent.keys()].filter((id) => !info.has(id));
    const users = await this.repo.usersByIds(missing);
    for (const [id, u] of users) info.set(id, personRef(u));

    const agentIds = new Set<string>([...propsByAgent.keys(), ...info.keys()]);
    const rows: AdminAgentPerformanceRow[] = [];
    for (const id of agentIds) {
      const agent = info.get(id);
      if (!agent) continue; // owner row with no resolvable account (shouldn't happen)
      const rentals = rentalsByAgent.get(id) ?? 0;
      const sales = salesByAgent.get(id) ?? 0;
      rows.push({
        agent,
        propertiesAdded: propsByAgent.get(id) ?? 0,
        rentals,
        sales,
        successfulDeals: rentals + sales,
      });
    }

    rows.sort(
      (a, b) => b.successfulDeals - a.successfulDeals || b.propertiesAdded - a.propertiesAdded,
    );
    return rows;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async collectDeals(): Promise<AdminDealRow[]> {
    const [rentals, plans, purchases] = await Promise.all([
      this.repo.successfulRentals(),
      this.repo.successfulPlans(),
      this.repo.successfulPurchases(),
    ]);

    const deals: AdminDealRow[] = [];

    for (const r of rentals) {
      const property = r.listing.property;
      deals.push({
        id: r.id,
        kind: 'rental',
        propertyId: property.id,
        propertyTitle: property.title,
        agent: personRef(property.owner),
        client: personRef(r.tenant),
        clientKind: 'tenant',
        status: r.status,
        amount: r.monthlyRent.toNumber(),
        currency: r.currency,
        date: r.startDate.toISOString(),
      });
    }

    for (const p of plans) {
      const property = p.listing.property;
      deals.push({
        id: p.id,
        kind: 'installment',
        propertyId: property.id,
        propertyTitle: property.title,
        agent: personRef(property.owner),
        client: personRef(p.buyer),
        clientKind: 'buyer',
        status: p.status,
        amount: p.totalPrice.toNumber(),
        currency: p.currency,
        date: p.createdAt.toISOString(),
      });
    }

    // Purchase payments point at a listing id (no FK) — resolve them in a batch.
    const listingIds = purchases
      .map((pay) => pay.referenceId)
      .filter((id): id is string => Boolean(id));
    const listings = await this.repo.listingsByIds(listingIds);
    for (const pay of purchases) {
      const listing = pay.referenceId ? listings.get(pay.referenceId) : undefined;
      if (!listing) continue; // orphaned reference — skip
      const property = listing.property;
      deals.push({
        id: pay.id,
        kind: 'purchase',
        propertyId: property.id,
        propertyTitle: property.title,
        agent: personRef(property.owner),
        client: personRef(pay.user),
        clientKind: 'buyer',
        status: 'completed',
        amount: pay.amount.toNumber(),
        currency: pay.currency,
        date: pay.createdAt.toISOString(),
      });
    }

    return deals;
  }
}
