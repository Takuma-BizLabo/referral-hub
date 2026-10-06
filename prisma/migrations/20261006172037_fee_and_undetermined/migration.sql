-- AlterTable
ALTER TABLE "Referral" ADD COLUMN     "rewardUndetermined" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SaleshubThread" ADD COLUMN     "fee" INTEGER;

-- AlterTable
ALTER TABLE "VendorMeeting" ADD COLUMN     "fee" INTEGER;
