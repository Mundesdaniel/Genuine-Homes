-- AlterEnum
ALTER TYPE "PaymentPurpose" ADD VALUE 'purchase' AFTER 'deposit';

-- AlterEnum
ALTER TYPE "InstallmentPlanStatus" ADD VALUE 'pending_approval' BEFORE 'pending_deposit';
