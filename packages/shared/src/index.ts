/**
 * @genuine-homes/shared
 *
 * Single source of truth for domain enums, constants, and Zod validation
 * schemas shared between the NestJS API and the React clients.
 *
 * Re-exports are written explicitly (not `export *`) so that when this package
 * is compiled to CommonJS, bundlers (Vite/Rollup) can statically detect every
 * named export. `export *` becomes an opaque `__exportStar` that Rollup can't
 * see through, which breaks `import { x } from '@genuine-homes/shared'`.
 */

// ── Enums (const object + same-named type travel together) ──────────────────
export {
  UserRole,
  PropertyType,
  VerificationStatus,
  PropertyStatus,
  ListingType,
  RentPeriod,
  InstallmentPlanStatus,
  InstallmentPaymentStatus,
  PaymentPurpose,
  PaymentProvider,
  PaymentStatus,
  Currency,
  RentalAgreementStatus,
  NotificationType,
  enumValues,
} from './enums';

// ── Constants ────────────────────────────────────────────────────────────────
export {
  DEFAULT_CURRENCY,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  INSTALLMENT,
  IMAGE_UPLOAD,
  SRID_WGS84,
  DEFAULT_SEARCH_RADIUS_M,
} from './constants';

// ── Auth ──────────────────────────────────────────────────────────────────────
export {
  SELF_ASSIGNABLE_ROLES,
  phoneSchema,
  passwordSchema,
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
} from './schemas/auth';
export type {
  SelfAssignableRole,
  RegisterInput,
  RegisterRequest,
  LoginInput,
  RefreshInput,
  LogoutInput,
  AuthUser,
  AuthTokens,
  AuthResponse,
} from './schemas/auth';

// ── Properties ──────────────────────────────────────────────────────────────
export {
  OWNER_SETTABLE_STATUSES,
  createPropertySchema,
  updatePropertySchema,
  addImageSchema,
} from './schemas/property';
export type {
  CreatePropertyInput,
  UpdatePropertyInput,
  AddImageInput,
  PropertySummary,
  PropertyImageResponse,
  PropertyDetail,
  UploadResponse,
} from './schemas/property';

// ── Listings ──────────────────────────────────────────────────────────────────
export {
  listingShapeError,
  createListingSchema,
  updateListingSchema,
  searchListingsSchema,
} from './schemas/listing';
export type {
  ListingShape,
  CreateListingInput,
  UpdateListingInput,
  SearchListingsInput,
  ListingResponse,
  ListingSearchItem,
  Paginated,
} from './schemas/listing';

// ── Payments ────────────────────────────────────────────────────────────────
export { initiatePaymentSchema } from './schemas/payment';
export type {
  InitiatePaymentInput,
  PaymentResponse,
  PaymentInitiation,
} from './schemas/payment';

// ── Installments ────────────────────────────────────────────────────────────
export { createPlanSchema, payViaSchema, PLAN_TRANSITIONS } from './schemas/installment';
export type {
  CreatePlanInput,
  PayViaInput,
  InstallmentPaymentItem,
  InstallmentPlanResponse,
  InstallmentPlanDetail,
} from './schemas/installment';

// ── Notifications ─────────────────────────────────────────────────────────────
export type {
  NotificationResponse,
  UnreadCountResponse,
} from './schemas/notification';
