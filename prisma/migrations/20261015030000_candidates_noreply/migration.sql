-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "criteria" JSONB;

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "noReply" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "noReplyAt" TIMESTAMP(3);

