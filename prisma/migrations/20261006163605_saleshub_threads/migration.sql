-- CreateTable
CREATE TABLE "SaleshubThread" (
    "id" SERIAL NOT NULL,
    "proposalId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "requestTitle" TEXT,
    "lastSnippet" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "vendorId" INTEGER,
    "importedMeetingId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleshubThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleshubMessage" (
    "id" SERIAL NOT NULL,
    "threadId" INTEGER NOT NULL,
    "externalKey" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "isMine" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "body" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleshubMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SaleshubThread_proposalId_key" ON "SaleshubThread"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleshubMessage_externalKey_key" ON "SaleshubMessage"("externalKey");

-- CreateIndex
CREATE INDEX "SaleshubMessage_threadId_sentAt_idx" ON "SaleshubMessage"("threadId", "sentAt");

-- AddForeignKey
ALTER TABLE "SaleshubMessage" ADD CONSTRAINT "SaleshubMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "SaleshubThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
