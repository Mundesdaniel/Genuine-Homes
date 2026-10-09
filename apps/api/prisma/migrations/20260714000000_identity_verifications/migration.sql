-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'identity_verified';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'identity_rejected';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "identity_verified_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "identity_verifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "legal_name" TEXT NOT NULL,
    "nin_masked" TEXT NOT NULL,
    "nin_hash" TEXT NOT NULL,
    "organization_name" TEXT,
    "registration_number" TEXT,
    "tin" TEXT,
    "documents" JSONB NOT NULL DEFAULT '[]',
    "status" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "reviewer_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "identity_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "identity_verifications_user_id_idx" ON "identity_verifications"("user_id");

-- CreateIndex
CREATE INDEX "identity_verifications_status_idx" ON "identity_verifications"("status");

-- CreateIndex
CREATE INDEX "identity_verifications_nin_hash_idx" ON "identity_verifications"("nin_hash");

-- AddForeignKey
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
