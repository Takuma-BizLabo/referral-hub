-- AlterTable
ALTER TABLE "VendorMeeting" ADD COLUMN     "schedulingUrl" TEXT;

-- 既存データ：「会議URL・場所」に入っていた日程調整ツールのURLを日程調整URLへ移す
UPDATE "VendorMeeting"
SET "schedulingUrl" = "place", "place" = NULL
WHERE "place" ~* '^https?://[^ ]*(timerex|spirinc|spir\.|jicoo|calendly|eeasy|youcanbook|calendar\.app\.google|tidycal|savvycal|receptionist|meetings\.hubspot|hubspot\.[a-z.]+/meetings)';
