/**
 * Admin analytics contracts. A lightweight platform overview for the admin
 * dashboard — headline counts plus settled revenue.
 */

export interface AdminOverviewResponse {
  users: number;
  properties: number;
  activeListings: number;
  activePlans: number;
  pendingVerifications: number;
  /** Sum of all successful payments (the unified ledger). */
  revenue: { currency: string; total: number };
}
