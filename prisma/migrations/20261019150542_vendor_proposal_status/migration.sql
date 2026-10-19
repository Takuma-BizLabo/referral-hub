-- CreateEnum
CREATE TYPE "VendorProposalStatus" AS ENUM ('NOT_PROPOSED', 'PROPOSING', 'PROPOSED');

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "proposalStatus" "VendorProposalStatus" NOT NULL DEFAULT 'NOT_PROPOSED';

