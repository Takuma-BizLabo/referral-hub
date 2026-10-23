-- 面談の日程が決まっている紹介案件（面談日時あり・面談確定・面談実施済）は、先方・人事とも OK にする（NG は触らない）
UPDATE "Referral" SET "contactApproval" = 'OK'
WHERE "contactApproval" = 'PENDING' AND ("meetingAt" IS NOT NULL OR "status" IN ('MEETING_CONFIRMED', 'MEETING_DONE'));
UPDATE "Referral" SET "vendorApproval" = 'OK'
WHERE "vendorApproval" = 'PENDING' AND ("meetingAt" IS NOT NULL OR "status" IN ('MEETING_CONFIRMED', 'MEETING_DONE'));
