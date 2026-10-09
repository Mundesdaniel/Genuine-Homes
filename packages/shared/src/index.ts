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
  BookingStatus,
  enumValues,
} from './enums';

// ── Constants ────────────────────────────────────────────────────────────────
export {
  DEFAULT_CURRENCY,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  INSTALLMENT,
  IMAGE_UPLOAD,
  DOCUMENT_UPLOAD,
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
  forgotPasswordSchema,
  resetPasswordSchema,
} from './schemas/auth';
export type {
  SelfAssignableRole,
  RegisterInput,
  RegisterRequest,
  LoginInput,
  RefreshInput,
  LogoutInput,
  ForgotPasswordInput,
  ResetPasswordInput,
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
  EarningsResponse,
} from './schemas/payment';

// ── Installments ────────────────────────────────────────────────────────────
export { createPlanSchema, payViaSchema, PLAN_TRANSITIONS } from './schemas/installment';
export type {
  CreatePlanInput,
  PayViaInput,
  InstallmentPaymentItem,
  InstallmentPlanResponse,
  InstallmentPlanDetail,
  PlanRequestResponse,
} from './schemas/installment';

// ── Notifications ─────────────────────────────────────────────────────────────
export type { NotificationResponse, UnreadCountResponse } from './schemas/notification';

// ── Favorites ─────────────────────────────────────────────────────────────────
export type { FavoriteIdsResponse } from './schemas/favorite';

// ── Reviews ───────────────────────────────────────────────────────────────────
export { REVIEW, createReviewSchema } from './schemas/review';
export type { CreateReviewInput, ReviewResponse, ReviewSummary } from './schemas/review';

// ── Rentals ───────────────────────────────────────────────────────────────────
export { RENTAL, createRentalSchema } from './schemas/rental';
export type { CreateRentalInput, RentalAgreementResponse } from './schemas/rental';

// ── Verifications ─────────────────────────────────────────────────────────────
export {
  VERIFICATION,
  verificationDocumentSchema,
  submitVerificationSchema,
  reviewVerificationSchema,
} from './schemas/verification';
export type {
  VerificationDocumentInput,
  SubmitVerificationInput,
  ReviewVerificationInput,
  DocumentUploadResponse,
  VerificationDocument,
  VerificationResponse,
} from './schemas/verification';

// ── Identity (KYC) ────────────────────────────────────────────────────────────
export {
  IDENTITY,
  submitIdentityVerificationSchema,
  reviewIdentityVerificationSchema,
} from './schemas/identity';
export type {
  SubmitIdentityVerificationInput,
  ReviewIdentityVerificationInput,
  IdentityDocumentInput,
  IdentityVerificationResponse,
  IdentityVerificationQueueItem,
} from './schemas/identity';

// ── Users ─────────────────────────────────────────────────────────────────────
export { updateProfileSchema, adminUpdateUserSchema } from './schemas/user';
export type {
  UpdateProfileInput,
  AdminUpdateUserInput,
  UserProfileResponse,
} from './schemas/user';

// ── Admin ─────────────────────────────────────────────────────────────────────
export type { AdminOverviewResponse } from './schemas/admin';

// ── Chat ──────────────────────────────────────────────────────────────────────
export { CHAT, CHAT_MESSAGE_EVENT, sendMessageSchema } from './schemas/chat';
export type { SendMessageInput, MessageResponse, ConversationSummary } from './schemas/chat';

// ── Bookings (viewings) ───────────────────────────────────────────────────────
export { BOOKING, createBookingSchema, declineBookingSchema } from './schemas/booking';
export type {
  CreateBookingInput,
  DeclineBookingInput,
  BookingResponse,
} from './schemas/booking';
