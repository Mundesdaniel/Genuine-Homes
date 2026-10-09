/**
 * Canonical domain enumerations for Genuine Homes.
 *
 * These mirror the PostgreSQL enums defined in the Prisma schema and are the
 * single source of truth shared between the backend (NestJS) and the frontend
 * (React / React Native). Defined as `const` objects + derived union types so
 * they are usable both as runtime values and as TypeScript types.
 */

export const UserRole = {
  USER: 'user',
  LANDLORD: 'landlord',
  AGENT: 'agent',
  DEVELOPER: 'developer',
  ADMIN: 'admin',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const PropertyType = {
  HOUSE: 'house',
  FURNISHED_HOUSE: 'furnished_house',
  APARTMENT: 'apartment',
  VILLA: 'villa',
  LAND: 'land',
  COMMERCIAL: 'commercial',
} as const;
export type PropertyType = (typeof PropertyType)[keyof typeof PropertyType];

/** Status of document/ownership verification for a property. */
export const VerificationStatus = {
  UNVERIFIED: 'unverified',
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
} as const;
export type VerificationStatus =
  (typeof VerificationStatus)[keyof typeof VerificationStatus];

/**
 * Lifecycle status of a property.
 *
 * `reserved` is a soft hold: a tenant has an open rental agreement, or a buyer
 * has paid an installment deposit, but the deal isn't finalised. `rented`/`sold`
 * are the taken (finalised) states. Search only ever surfaces `active`
 * properties, so anything past `active` drops out of listings automatically.
 */
export const PropertyStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  RESERVED: 'reserved',
  RENTED: 'rented',
  SOLD: 'sold',
  SUSPENDED: 'suspended',
} as const;
export type PropertyStatus =
  (typeof PropertyStatus)[keyof typeof PropertyStatus];

export const ListingType = {
  RENT: 'rent',
  SALE: 'sale',
  INSTALLMENT: 'installment',
} as const;
export type ListingType = (typeof ListingType)[keyof typeof ListingType];

export const RentPeriod = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;
export type RentPeriod = (typeof RentPeriod)[keyof typeof RentPeriod];

/**
 * Installment plan state machine.
 * Allowed transitions are enforced in the installments module:
 *   pending_approval -> pending_deposit -> active -> completed | defaulted
 *   pending_approval -> cancelled (landlord declines)
 *   pending_deposit -> cancelled
 *   active -> cancelled (admin/dispute)
 *
 * `pending_approval` is where a buyer-requested plan waits for the landlord to
 * accept it. Plans created off a seller's own `installment` listing are already
 * offered, so they start at `pending_deposit` and skip the approval step.
 */
export const InstallmentPlanStatus = {
  PENDING_APPROVAL: 'pending_approval',
  PENDING_DEPOSIT: 'pending_deposit',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DEFAULTED: 'defaulted',
  CANCELLED: 'cancelled',
} as const;
export type InstallmentPlanStatus =
  (typeof InstallmentPlanStatus)[keyof typeof InstallmentPlanStatus];

export const InstallmentPaymentStatus = {
  UPCOMING: 'upcoming',
  PAID: 'paid',
  LATE: 'late',
  MISSED: 'missed',
} as const;
export type InstallmentPaymentStatus =
  (typeof InstallmentPaymentStatus)[keyof typeof InstallmentPaymentStatus];

/** What a row in the unified `payments` ledger is for. */
export const PaymentPurpose = {
  RENT: 'rent',
  INSTALLMENT: 'installment',
  DEPOSIT: 'deposit',
  /** Paying a property's full sale price in one go (outright purchase). */
  PURCHASE: 'purchase',
  VERIFICATION_FEE: 'verification_fee',
  FEATURED_LISTING: 'featured_listing',
} as const;
export type PaymentPurpose =
  (typeof PaymentPurpose)[keyof typeof PaymentPurpose];

export const PaymentProvider = {
  MTN_MOMO: 'mtn_momo',
  AIRTEL_MONEY: 'airtel_money',
  CARD: 'card',
  BANK: 'bank',
} as const;
export type PaymentProvider =
  (typeof PaymentProvider)[keyof typeof PaymentProvider];

export const PaymentStatus = {
  PENDING: 'pending',
  SUCCESSFUL: 'successful',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

/** ISO-4217 currency codes. UGX now; ready for KES, TZS as the platform expands. */
export const Currency = {
  UGX: 'UGX',
  KES: 'KES',
  TZS: 'TZS',
} as const;
export type Currency = (typeof Currency)[keyof typeof Currency];

export const RentalAgreementStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  ENDED: 'ended',
  TERMINATED: 'terminated',
} as const;
export type RentalAgreementStatus =
  (typeof RentalAgreementStatus)[keyof typeof RentalAgreementStatus];

export const NotificationType = {
  PAYMENT_SUCCESSFUL: 'payment_successful',
  PAYMENT_FAILED: 'payment_failed',
  INSTALLMENT_DUE_SOON: 'installment_due_soon',
  INSTALLMENT_OVERDUE: 'installment_overdue',
  PLAN_DEFAULTED: 'plan_defaulted',
  PLAN_REINSTATED: 'plan_reinstated',
  LISTING_VERIFIED: 'listing_verified',
  IDENTITY_VERIFIED: 'identity_verified',
  IDENTITY_REJECTED: 'identity_rejected',
  PASSWORD_RESET: 'password_reset',
  NEW_MESSAGE: 'new_message',
  VIEWING_SCHEDULED: 'viewing_scheduled',
  SAVED_SEARCH_MATCH: 'saved_search_match',
} as const;
export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

/**
 * Viewing-booking state machine.
 * Allowed transitions (enforced in the bookings module):
 *   pending  -> accepted | declined   (owner's decision)
 *   pending  -> cancelled             (buyer withdraws)
 *   accepted -> cancelled             (buyer withdraws)
 */
export const BookingStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

/** Helper to extract the runtime values of a const-enum object as a tuple. */
export const enumValues = <T extends Record<string, string>>(
  e: T,
): [T[keyof T], ...T[keyof T][]] =>
  Object.values(e) as [T[keyof T], ...T[keyof T][]];
