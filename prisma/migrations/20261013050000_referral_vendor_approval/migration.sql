-- CreateEnum
CREATE TYPE "VendorApproval" AS ENUM ('PENDING', 'OK', 'NG');

-- AlterTable
ALTER TABLE "Referral" ADD COLUMN     "vendorApproval" "VendorApproval" NOT NULL DEFAULT 'PENDING';


-- 既に紹介見送りになっている案件は「先方NG」、打診中以降に進んでいる案件は「先方OK」とみなす
UPDATE "Referral" SET "vendorApproval" = 'NG' WHERE "status" = 'DECLINED';
UPDATE "Referral" SET "vendorApproval" = 'OK' WHERE "status" IN ('CONTACTING', 'SCHEDULING', 'MEETING_CONFIRMED', 'MEETING_DONE');
