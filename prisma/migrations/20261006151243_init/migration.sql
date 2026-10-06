-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "MeetingFormat" AS ENUM ('ONLINE', 'VISIT');

-- CreateEnum
CREATE TYPE "VendorMeetingStatus" AS ENUM ('NOT_DONE', 'DONE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('SCHEDULING', 'CONFIRMED', 'DONE', 'RESCHEDULE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('RECEIVED', 'CONTACTING', 'SCHEDULING', 'MEETING_CONFIRMED', 'MEETING_DONE', 'DECLINED');

-- CreateEnum
CREATE TYPE "RewardStatus" AS ENUM ('UNFIXED', 'APPLIED', 'APPROVED', 'INVOICED', 'PAID');

-- CreateEnum
CREATE TYPE "HistoryEntity" AS ENUM ('VENDOR', 'VENDOR_MEETING', 'REFERRAL');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "loginId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "lineUserId" TEXT,
    "lineLinkCode" TEXT,
    "lineLinkCodeExpiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "serviceSummary" TEXT,
    "referralFee" INTEGER NOT NULL DEFAULT 0,
    "saleshubUrl" TEXT,
    "meetingStatus" "VendorMeetingStatus" NOT NULL DEFAULT 'NOT_DONE',
    "memo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorMeeting" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "assigneeId" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "format" "MeetingFormat" NOT NULL DEFAULT 'ONLINE',
    "place" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "executionStatus" "ExecutionStatus" NOT NULL DEFAULT 'SCHEDULING',
    "minutes" TEXT,
    "nextAction" TEXT,
    "nextActionDue" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "title" TEXT,
    "industry" TEXT,
    "employeeSize" TEXT,
    "region" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "otherContact" TEXT,
    "isOnSaleshub" BOOLEAN NOT NULL DEFAULT false,
    "relationMemo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactTag" (
    "contactId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "ContactTag_pkey" PRIMARY KEY ("contactId","tagId")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "pickedUpAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ReferralStatus" NOT NULL DEFAULT 'RECEIVED',
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meetingAt" TIMESTAMP(3),
    "meetingFormat" "MeetingFormat",
    "meetingPlace" TEXT,
    "meetingResult" TEXT,
    "meetingDoneAt" TIMESTAMP(3),
    "nextAction" TEXT,
    "nextActionDue" TIMESTAMP(3),
    "rewardAmount" INTEGER NOT NULL DEFAULT 0,
    "rewardStatus" "RewardStatus" NOT NULL DEFAULT 'UNFIXED',
    "rewardApprovedAt" TIMESTAMP(3),
    "invoicedAt" TIMESTAMP(3),
    "paymentDueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "forceUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "forceUnlockReason" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusHistory" (
    "id" SERIAL NOT NULL,
    "entityType" "HistoryEntity" NOT NULL,
    "entityId" INTEGER NOT NULL,
    "field" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "note" TEXT,
    "changedById" INTEGER,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "linkUrl" TEXT,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "lineSentAt" TIMESTAMP(3),
    "lineError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyGoal" (
    "id" SERIAL NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "userId" INTEGER,
    "meetingTarget" INTEGER NOT NULL DEFAULT 0,
    "referralTarget" INTEGER NOT NULL DEFAULT 0,
    "rewardAccrualTarget" INTEGER NOT NULL DEFAULT 0,
    "rewardPaidTarget" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MonthlyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_loginId_key" ON "User"("loginId");

-- CreateIndex
CREATE UNIQUE INDEX "User_lineUserId_key" ON "User"("lineUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_lineLinkCode_key" ON "User"("lineLinkCode");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "VendorMeeting_vendorId_idx" ON "VendorMeeting"("vendorId");

-- CreateIndex
CREATE INDEX "VendorMeeting_assigneeId_idx" ON "VendorMeeting"("assigneeId");

-- CreateIndex
CREATE INDEX "VendorMeeting_scheduledAt_idx" ON "VendorMeeting"("scheduledAt");

-- CreateIndex
CREATE INDEX "Contact_name_idx" ON "Contact"("name");

-- CreateIndex
CREATE INDEX "Contact_company_idx" ON "Contact"("company");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "Referral_vendorId_idx" ON "Referral"("vendorId");

-- CreateIndex
CREATE INDEX "Referral_contactId_idx" ON "Referral"("contactId");

-- CreateIndex
CREATE INDEX "Referral_status_idx" ON "Referral"("status");

-- CreateIndex
CREATE INDEX "Referral_rewardStatus_idx" ON "Referral"("rewardStatus");

-- CreateIndex
CREATE INDEX "StatusHistory_entityType_entityId_idx" ON "StatusHistory"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "MonthlyGoal_yearMonth_idx" ON "MonthlyGoal"("yearMonth");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorMeeting" ADD CONSTRAINT "VendorMeeting_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorMeeting" ADD CONSTRAINT "VendorMeeting_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyGoal" ADD CONSTRAINT "MonthlyGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
