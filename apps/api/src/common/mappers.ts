import type { Listing, Payment, Property, PropertyImage } from '@prisma/client';
import type {
  ListingResponse,
  ListingSearchItem,
  PaymentResponse,
  PropertyDetail,
  PropertyImageResponse,
  PropertySummary,
} from '@genuine-homes/shared';

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
      listing.minDepositPercent != null
        ? listing.minDepositPercent.toNumber()
        : null,
    maxInstallmentMonths: listing.maxInstallmentMonths ?? null,
    isActive: listing.isActive,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
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
    [...listing.property.images].sort((a, b) => a.position - b.position)[0]
      ?.url ?? null;
  return {
    ...mapListing(listing),
    property: mapPropertySummary(listing.property, {
      coords: opts.coords,
      coverImageUrl: cover,
    }),
    distanceM: opts.distanceM ?? null,
  };
}
