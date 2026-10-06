-- AlterTable
ALTER TABLE "SaleshubThread" ADD COLUMN     "proposedCache" JSONB;

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_type_readAt_idx" ON "Notification"("userId", "type", "readAt");

-- CreateIndex
CREATE INDEX "Referral_meetingAt_idx" ON "Referral"("meetingAt");

-- CreateIndex
CREATE INDEX "Referral_nextActionDue_idx" ON "Referral"("nextActionDue");

-- CreateIndex
CREATE INDEX "Referral_statusChangedAt_idx" ON "Referral"("statusChangedAt");

-- CreateIndex
CREATE INDEX "Referral_rewardApprovedAt_idx" ON "Referral"("rewardApprovedAt");

-- CreateIndex
CREATE INDEX "Referral_paidAt_idx" ON "Referral"("paidAt");

-- CreateIndex
CREATE INDEX "SaleshubThread_vendorId_idx" ON "SaleshubThread"("vendorId");

-- CreateIndex
CREATE INDEX "SaleshubThread_lastMessageAt_idx" ON "SaleshubThread"("lastMessageAt");

-- CreateIndex
CREATE INDEX "VendorMeeting_executionStatus_idx" ON "VendorMeeting"("executionStatus");

-- CreateIndex
CREATE INDEX "VendorMeeting_approvalStatus_idx" ON "VendorMeeting"("approvalStatus");

-- CreateIndex
CREATE INDEX "VendorMeeting_nextActionDue_idx" ON "VendorMeeting"("nextActionDue");
