-- AlterTable
ALTER TABLE "Referral" ADD COLUMN     "contactApproval" "VendorApproval" NOT NULL DEFAULT 'PENDING';


-- 日程調整中以降に進んでいる案件は、人事側もOKだったとみなす
UPDATE "Referral" SET "contactApproval" = 'OK' WHERE "status" IN ('SCHEDULING', 'MEETING_CONFIRMED', 'MEETING_DONE');
