-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'landlord', 'agent', 'developer', 'admin');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('house', 'apartment', 'villa', 'land', 'commercial');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('unverified', 'pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('draft', 'active', 'rented', 'sold', 'suspended');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('rent', 'sale', 'installment');

-- CreateEnum
CREATE TYPE "RentPeriod" AS ENUM ('monthly', 'yearly');

-- CreateEnum
CREATE TYPE "InstallmentPlanStatus" AS ENUM ('pending_deposit', 'active', 'completed', 'defaulted', 'cancelled');

-- CreateEnum
CREATE TYPE "InstallmentPaymentStatus" AS ENUM ('upcoming', 'paid', 'late', 'missed');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('rent', 'installment', 'deposit', 'verification_fee', 'featured_listing');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('mtn_momo', 'airtel_money', 'card', 'bank');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'successful', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "RentalAgreementStatus" AS ENUM ('pending', 'active', 'ended', 'terminated');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('payment_successful', 'payment_failed', 'installment_due_soon', 'installment_overdue', 'listing_verified', 'new_message', 'viewing_scheduled', 'saved_search_match');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "type" "PropertyType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT,
    "location" geography(Point, 4326),
    "size_sqm" DECIMAL(12,2),
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "amenities" JSONB NOT NULL DEFAULT '{}',
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'unverified',
    "status" "PropertyStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "listing_type" "ListingType" NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'UGX',
    "rent_period" "RentPeriod",
    "min_deposit_percent" DECIMAL(5,2),
    "max_installment_months" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_images" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installment_plans" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "total_price" DECIMAL(14,2) NOT NULL,
    "deposit_amount" DECIMAL(14,2) NOT NULL,
    "months" INTEGER NOT NULL,
    "monthly_amount" DECIMAL(14,2) NOT NULL,
    "service_fee_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'UGX',
    "status" "InstallmentPlanStatus" NOT NULL DEFAULT 'pending_deposit',
    "next_due_date" DATE,
    "signed_contract_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "installment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installment_payments" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "paid_at" TIMESTAMPTZ(6),
    "status" "InstallmentPaymentStatus" NOT NULL DEFAULT 'upcoming',
    "payment_ref" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "installment_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "reference_id" UUID,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'UGX',
    "provider" "PaymentProvider" NOT NULL,
    "provider_ref" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_agreements" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "monthly_rent" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'UGX',
    "status" "RentalAgreementStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rental_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "documents" JSONB NOT NULL DEFAULT '[]',
    "reviewer_id" UUID,
    "status" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "receiver_id" UUID NOT NULL,
    "listing_id" UUID,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "properties_owner_id_idx" ON "properties"("owner_id");

-- CreateIndex
CREATE INDEX "properties_district_type_idx" ON "properties"("district", "type");

-- CreateIndex
CREATE INDEX "properties_status_idx" ON "properties"("status");

-- CreateIndex
CREATE INDEX "properties_verification_status_idx" ON "properties"("verification_status");

-- CreateIndex
CREATE INDEX "properties_amenities_idx" ON "properties" USING GIN ("amenities");

-- CreateIndex
CREATE INDEX "listings_property_id_idx" ON "listings"("property_id");

-- CreateIndex
CREATE INDEX "listings_listing_type_is_active_price_idx" ON "listings"("listing_type", "is_active", "price");

-- CreateIndex
CREATE INDEX "property_images_property_id_idx" ON "property_images"("property_id");

-- CreateIndex
CREATE INDEX "installment_plans_buyer_id_idx" ON "installment_plans"("buyer_id");

-- CreateIndex
CREATE INDEX "installment_plans_listing_id_idx" ON "installment_plans"("listing_id");

-- CreateIndex
CREATE INDEX "installment_plans_status_idx" ON "installment_plans"("status");

-- CreateIndex
CREATE INDEX "installment_plans_next_due_date_idx" ON "installment_plans"("next_due_date");

-- CreateIndex
CREATE INDEX "installment_payments_plan_id_status_idx" ON "installment_payments"("plan_id", "status");

-- CreateIndex
CREATE INDEX "installment_payments_due_date_status_idx" ON "installment_payments"("due_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "installment_payments_plan_id_sequence_key" ON "installment_payments"("plan_id", "sequence");

-- CreateIndex
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

-- CreateIndex
CREATE INDEX "payments_purpose_status_idx" ON "payments"("purpose", "status");

-- CreateIndex
CREATE INDEX "payments_reference_id_idx" ON "payments"("reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_ref_key" ON "payments"("provider_ref");

-- CreateIndex
CREATE INDEX "rental_agreements_tenant_id_idx" ON "rental_agreements"("tenant_id");

-- CreateIndex
CREATE INDEX "rental_agreements_listing_id_status_idx" ON "rental_agreements"("listing_id", "status");

-- CreateIndex
CREATE INDEX "verifications_property_id_idx" ON "verifications"("property_id");

-- CreateIndex
CREATE INDEX "verifications_status_idx" ON "verifications"("status");

-- CreateIndex
CREATE INDEX "favorites_property_id_idx" ON "favorites"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_property_id_key" ON "favorites"("user_id", "property_id");

-- CreateIndex
CREATE INDEX "reviews_target_id_idx" ON "reviews"("target_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_author_id_target_id_key" ON "reviews"("author_id", "target_id");

-- CreateIndex
CREATE INDEX "messages_receiver_id_read_at_idx" ON "messages"("receiver_id", "read_at");

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");

-- CreateIndex
CREATE INDEX "messages_listing_id_idx" ON "messages"("listing_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_payments" ADD CONSTRAINT "installment_payments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "installment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_agreements" ADD CONSTRAINT "rental_agreements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
-- PostGIS GiST index on the geography column (powers "within N km" map search).
-- Added manually: Prisma cannot express indexes on Unsupported columns.
CREATE INDEX "properties_location_idx" ON "properties" USING GIST ("location");
