import type {
  ApprovalStatus,
  ExecutionStatus,
  MeetingFormat,
  ReferralStatus,
  RewardStatus,
  Role,
  VendorMeetingStatus,
} from "@prisma/client";

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "管理者",
  MEMBER: "商談担当者",
};

export const FORMAT_LABEL: Record<MeetingFormat, string> = {
  ONLINE: "オンライン",
  VISIT: "訪問",
};

export const VENDOR_MEETING_STATUS_LABEL: Record<VendorMeetingStatus, string> = {
  NOT_DONE: "未実施",
  DONE: "実施済",
};

export const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  PENDING: "承認待ち",
  APPROVED: "承認済",
  REJECTED: "差し戻し",
};

export const EXECUTION_LABEL: Record<ExecutionStatus, string> = {
  SCHEDULING: "日程調整中",
  CONFIRMED: "確定",
  DONE: "実施済",
  RESCHEDULE: "リスケ",
  CANCELLED: "キャンセル",
};
export const EXECUTION_ORDER: ExecutionStatus[] = ["SCHEDULING", "CONFIRMED", "DONE", "RESCHEDULE", "CANCELLED"];

export const REFERRAL_LABEL: Record<ReferralStatus, string> = {
  RECEIVED: "ピックアップ受付",
  CONTACTING: "紹介先に打診中",
  SCHEDULING: "日程調整中",
  MEETING_CONFIRMED: "面談確定",
  MEETING_DONE: "面談実施済",
  DECLINED: "紹介見送り",
};
export const REFERRAL_ORDER: ReferralStatus[] = [
  "RECEIVED",
  "CONTACTING",
  "SCHEDULING",
  "MEETING_CONFIRMED",
  "MEETING_DONE",
  "DECLINED",
];
/** ベンダーMTG実施済が必要になるステータス */
export const REFERRAL_REQUIRES_VENDOR_DONE: ReferralStatus[] = [
  "CONTACTING",
  "SCHEDULING",
  "MEETING_CONFIRMED",
  "MEETING_DONE",
];

export const REWARD_LABEL: Record<RewardStatus, string> = {
  UNFIXED: "未確定",
  APPLIED: "計上申請",
  APPROVED: "承認済",
  INVOICED: "請求済",
  PAID: "入金済",
};
export const REWARD_ORDER: RewardStatus[] = ["UNFIXED", "APPLIED", "APPROVED", "INVOICED", "PAID"];

/** ステータス表示用の色クラス */
export const STATUS_COLOR: Record<string, string> = {
  // 承認
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-100 text-rose-800 border-rose-200",
  // 実施
  SCHEDULING: "bg-slate-100 text-slate-700 border-slate-200",
  CONFIRMED: "bg-sky-100 text-sky-800 border-sky-200",
  DONE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  RESCHEDULE: "bg-amber-100 text-amber-800 border-amber-200",
  CANCELLED: "bg-gray-200 text-gray-600 border-gray-300",
  // 紹介
  RECEIVED: "bg-slate-100 text-slate-700 border-slate-200",
  CONTACTING: "bg-sky-100 text-sky-800 border-sky-200",
  MEETING_CONFIRMED: "bg-indigo-100 text-indigo-800 border-indigo-200",
  MEETING_DONE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  DECLINED: "bg-gray-200 text-gray-600 border-gray-300",
  // 報酬
  UNFIXED: "bg-slate-100 text-slate-700 border-slate-200",
  APPLIED: "bg-amber-100 text-amber-800 border-amber-200",
  INVOICED: "bg-sky-100 text-sky-800 border-sky-200",
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  // ベンダー
  NOT_DONE: "bg-slate-100 text-slate-700 border-slate-200",
};

export const NOTIFICATION_TYPES = [
  { key: "MEETING_1DAY", label: "MTG・面談の前日", defaultLine: true },
  { key: "MEETING_1HOUR", label: "MTG・面談の1時間前", defaultLine: true },
  { key: "MINUTES_MISSING", label: "議事メモ未入力（実施後24時間）", defaultLine: true },
  { key: "DUE_TODAY", label: "次アクション期限当日", defaultLine: true },
  { key: "OVERDUE", label: "次アクション期限超過", defaultLine: false },
  { key: "APPROVAL_PENDING", label: "承認待ち発生（管理者へ）", defaultLine: true },
  { key: "REJECTED", label: "差し戻し（担当者へ）", defaultLine: true },
  { key: "APPROVED", label: "承認完了（担当者へ）", defaultLine: false },
  { key: "TASK_ASSIGNED", label: "新しいタスクの割当（担当者へ）", defaultLine: true },
  { key: "STAGNANT", label: "紹介案件の停滞", defaultLine: false },
  { key: "PAYMENT_LATE", label: "入金予定日超過（管理者へ）", defaultLine: true },
  { key: "SALESHUB_MESSAGE", label: "セールスハブの新着・連携状態（全員へ）", defaultLine: true },
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]["key"];
