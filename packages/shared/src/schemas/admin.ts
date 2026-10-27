/**
 * Admin analytics contracts. A lightweight platform overview for the admin
 * dashboard — headline counts plus settled revenue — plus internal visibility
 * into which agent added each property and which agents closed deals.
 */

import type { PropertyStatus, PropertyType, UserRole, VerificationStatus } from '../enums';

export interface AdminOverviewResponse {
  users: number;
  properties: number;
  activeListings: number;
  activePlans: number;
  pendingVerifications: number;
  /** Sum of all successful payments (the unified ledger). */
  revenue: { currency: string; total: number };
}

/** A person referenced from an admin row (the agent, or the tenant/buyer). */
export interface AdminPersonRef {
  id: string;
  fullName: string;
  phone: string;
  /** Present for the agent/owner side; omitted for tenants/buyers. */
  role?: UserRole;
}

/** One property in the internal "all properties" table — with the agent who
 *  added it (the record owner). */
export interface AdminPropertyRow {
  id: string;
  title: string;
  type: PropertyType;
  district: string;
  city: string;
  status: PropertyStatus;
  verificationStatus: VerificationStatus;
  /** The land-owner shown on the listing (stored on the property). */
  landlordName: string;
  createdAt: string;
  /** The agent/manager who added (owns) this property record. */
  agent: AdminPersonRef;
}

/** What kind of deal an agent closed with a client. */
export type AdminDealKind = 'rental' | 'installment' | 'purchase';

/** One successful deal in the internal "deals" table — the agent who closed it
 *  and the tenant/buyer on the other side. */
export interface AdminDealRow {
  /** Id of the underlying record (rental agreement / installment plan / payment). */
  id: string;
  kind: AdminDealKind;
  propertyId: string;
  propertyTitle: string;
  /** The agent/owner behind the listing. */
  agent: AdminPersonRef;
  /** The tenant (rental) or buyer (installment/purchase). */
  client: AdminPersonRef;
  clientKind: 'tenant' | 'buyer';
  /** Underlying status (rental/installment status; 'completed' for a purchase). */
  status: string;
  /** Monthly rent (rental) or total/settled price (sale). */
  amount: number;
  currency: string;
  /** Rental start date, or the plan/purchase creation date (ISO). */
  date: string;
}

/** Per-agent rollup for the internal "agents" leaderboard. */
export interface AdminAgentPerformanceRow {
  agent: AdminPersonRef;
  propertiesAdded: number;
  rentals: number;
  /** Installment plans + outright purchases. */
  sales: number;
  /** rentals + sales. */
  successfulDeals: number;
}
