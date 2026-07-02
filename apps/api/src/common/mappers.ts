import type {
  InstallmentPayment,
  InstallmentPlan,
  Listing,
  Message,
  Notification,
  Payment,
  Property,
  PropertyImage,
  RentalAgreement,
  Review,
  User,
  Verification,
} from '@prisma/client';
import type {
  InstallmentPaymentItem,
  InstallmentPlanDetail,
  InstallmentPlanResponse,
  ListingResponse,
  ListingSearchItem,
  MessageResponse,
  NotificationResponse,
  PaymentResponse,
  PropertyDetail,
  PropertyImageResponse,
  PropertySummary,
  RentalAgreementResponse,
  ReviewResponse,
  UserProfileResponse,
  VerificationDocument,
  VerificationResponse,
} from '@genuine-homes/shared';

// PostgreSQL `date` columns come back as a Date at UTC midnight.
const toDateString = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Mappers from Prisma rows to the shared API response shapes. Centralised here
 * (rather than per-module) so properties and listings share one definition and
 * avoid a circular module dependency. Decimals become numbers and dates ISO
 * strings at this single boundary.
 */

export interface Coords {
  lat: number;
  lng: number;
}

export function mapImage(image: PropertyImage): PropertyImageResponse {
  return { id: image.id, url: image.url, position: image.position };
}

export function mapListing(listing: Listing): ListingResponse {
  return {
    id: listing.id,
    propertyId: listing.propertyId,
    listingType: listing.listingType,
    price: listing.price.toNumber(),
    currency: listing.currency,
    rentPeriod: listing.rentPeriod,
    minDepositPercent:
      listing.minDepositPercent != null ? listing.minDepositPercent.toNumber() : null,
    maxInstallmentMonths: listing.maxInstallmentMonths ?? null,
    isActive: listing.isActive,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

export function mapNotification(n: Notification): NotificationResponse {
  // `payload` holds the rendered title/body plus reference ids. Pull the text
  // out and expose the remaining keys as `data` for client deep-linking.
  const payload =
    n.payload && typeof n.payload === 'object' && !Array.isArray(n.payload)
      ? (n.payload as Record<string, unknown>)
      : {};
  const { title, body, ...data } = payload;
  return {
    id: n.id,
    type: n.type,
    title: typeof title === 'string' ? title : '',
    body: typeof body === 'string' ? body : '',
    data,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

export function mapMessage(message: Message): MessageResponse {
  return {
    id: message.id,
    senderId: message.senderId,
    receiverId: message.receiverId,
    listingId: message.listingId ?? null,
    body: message.body,
    readAt: message.readAt ? message.readAt.toISOString() : null,
    createdAt: message.createdAt.toISOString(),
  };
}

export function mapUserProfile(user: User): UserProfileResponse {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email ?? null,
    phone: user.phone,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt.toISOString(),
  };
}

// What the `documents` JSON column actually holds: new rows store a private
// storage `key`; rows from before signed URLs stored a plain `url`.
interface StoredVerificationDocument {
  kind: string;
  uploadedAt: string;
  key?: string;
  url?: string;
}

export function mapVerification(
  verification: Verification & { property: { title: string } },
  signDocumentUrl?: (key: string) => string,
): VerificationResponse {
  const stored = Array.isArray(verification.documents)
    ? (verification.documents as unknown as StoredVerificationDocument[])
    : [];
  const documents: VerificationDocument[] = stored.map((d) => ({
    kind: d.kind,
    // Keys become short-lived signed links; legacy URL entries pass through.
    url: d.key && signDocumentUrl ? signDocumentUrl(d.key) : (d.url ?? ''),
    uploadedAt: d.uploadedAt,
  }));
  return {
    id: verification.id,
    propertyId: verification.propertyId,
    propertyTitle: verification.property.title,
    status: verification.status,
    documents,
    notes: verification.notes ?? null,
    reviewerId: verification.reviewerId ?? null,
    createdAt: verification.createdAt.toISOString(),
    updatedAt: verification.updatedAt.toISOString(),
  };
}

export function mapRentalAgreement(agreement: RentalAgreement): RentalAgreementResponse {
  return {
    id: agreement.id,
    listingId: agreement.listingId,
    tenantId: agreement.tenantId,
    startDate: toDateString(agreement.startDate),
    endDate: agreement.endDate ? toDateString(agreement.endDate) : null,
    monthlyRent: agreement.monthlyRent.toNumber(),
    currency: agreement.currency,
    status: agreement.status,
    createdAt: agreement.createdAt.toISOString(),
    updatedAt: agreement.updatedAt.toISOString(),
  };
}

export function mapReview(
  review: Review & { author: Pick<User, 'id' | 'fullName'> },
): ReviewResponse {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment ?? null,
    author: { id: review.author.id, fullName: review.author.fullName },
    createdAt: review.createdAt.toISOString(),
  };
}

export function mapPayment(payment: Payment): PaymentResponse {
  return {
    id: payment.id,
    purpose: payment.purpose,
    referenceId: payment.referenceId ?? null,
    amount: payment.amount.toNumber(),
    currency: payment.currency,
    provider: payment.provider,
    providerRef: payment.providerRef ?? null,
    status: payment.status,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}

export function mapInstallmentPayment(item: InstallmentPayment): InstallmentPaymentItem {
  return {
    id: item.id,
    sequence: item.sequence,
    amount: item.amount.toNumber(),
    dueDate: toDateString(item.dueDate),
    paidAt: item.paidAt ? item.paidAt.toISOString() : null,
    status: item.status,
  };
}

export function mapPlan(plan: InstallmentPlan): InstallmentPlanResponse {
  return {
    id: plan.id,
    listingId: plan.listingId,
    buyerId: plan.buyerId,
    totalPrice: plan.totalPrice.toNumber(),
    depositAmount: plan.depositAmount.toNumber(),
    months: plan.months,
    monthlyAmount: plan.monthlyAmount.toNumber(),
    serviceFeePercent: plan.serviceFeePercent.toNumber(),
    currency: plan.currency,
    status: plan.status,
    nextDueDate: plan.nextDueDate ? toDateString(plan.nextDueDate) : null,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

export function mapPlanDetail(
  plan: InstallmentPlan & { payments: InstallmentPayment[] },
): InstallmentPlanDetail {
  const schedule = [...plan.payments]
    .sort((a, b) => a.sequence - b.sequence)
    .map(mapInstallmentPayment);
  const paid = schedule.filter((s) => s.status === 'paid');
  const paidAmount = paid.reduce((sum, s) => sum + s.amount, 0);
  const totalScheduled = schedule.reduce((sum, s) => sum + s.amount, 0);
  return {
    ...mapPlan(plan),
    schedule,
    paidCount: paid.length,
    remainingCount: schedule.length - paid.length,
    paidAmount,
    remainingAmount: totalScheduled - paidAmount,
  };
}

export function mapPropertySummary(
  property: Property,
  opts: { coords?: Coords | null; coverImageUrl?: string | null } = {},
): PropertySummary {
  return {
    id: property.id,
    ownerId: property.ownerId,
    type: property.type,
    title: property.title,
    description: property.description,
    district: property.district,
    city: property.city,
    area: property.area ?? null,
    sizeSqm: property.sizeSqm != null ? property.sizeSqm.toNumber() : null,
    bedrooms: property.bedrooms ?? null,
    bathrooms: property.bathrooms ?? null,
    amenities: (property.amenities as unknown as Record<string, boolean>) ?? {},
    verificationStatus: property.verificationStatus,
    status: property.status,
    latitude: opts.coords?.lat ?? null,
    longitude: opts.coords?.lng ?? null,
    coverImageUrl: opts.coverImageUrl ?? null,
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
  };
}

type PropertyWithRelations = Property & {
  images: PropertyImage[];
  listings: Listing[];
};

export function mapPropertyDetail(
  property: PropertyWithRelations,
  coords?: Coords | null,
): PropertyDetail {
  const images = [...property.images].sort((a, b) => a.position - b.position);
  return {
    ...mapPropertySummary(property, {
      coords,
      coverImageUrl: images[0]?.url ?? null,
    }),
    images: images.map(mapImage),
    listings: property.listings.map(mapListing),
  };
}

type ListingWithProperty = Listing & {
  property: Property & { images: PropertyImage[] };
};

export function mapListingSearchItem(
  listing: ListingWithProperty,
  opts: { coords?: Coords | null; distanceM?: number | null } = {},
): ListingSearchItem {
  const cover =
    [...listing.property.images].sort((a, b) => a.position - b.position)[0]?.url ?? null;
  return {
    ...mapListing(listing),
    property: mapPropertySummary(listing.property, {
      coords: opts.coords,
      coverImageUrl: cover,
    }),
    distanceM: opts.distanceM ?? null,
  };
}
