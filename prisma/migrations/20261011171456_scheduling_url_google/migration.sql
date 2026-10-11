-- Google カレンダーの予約ページ（appointments）も日程調整URLとして扱う
UPDATE "VendorMeeting"
SET "schedulingUrl" = COALESCE("schedulingUrl", "place"), "place" = NULL
WHERE "place" ~* '^https?://calendar\.google\.com/(calendar/)?appointments';
