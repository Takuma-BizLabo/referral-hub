import type { StatusHistory, User } from "@prisma/client";
import { fmtDateTime } from "@/lib/utils";
import {
  APPROVAL_LABEL,
  EXECUTION_LABEL,
  REFERRAL_LABEL,
  REWARD_LABEL,
  VENDOR_MEETING_STATUS_LABEL,
} from "@/lib/labels";
import { EmptyState } from "./ui";

const FIELD_LABEL: Record<string, string> = {
  meetingStatus: "MTG状態",
  approvalStatus: "承認",
  executionStatus: "実施",
  status: "紹介ステータス",
  rewardStatus: "報酬",
  forceUnlocked: "強制解除",
  assigneeId: "担当者",
};

function valueLabel(field: string, v: string | null) {
  if (v === null) return "（なし）";
  const maps: Record<string, Record<string, string>> = {
    meetingStatus: VENDOR_MEETING_STATUS_LABEL,
    approvalStatus: APPROVAL_LABEL,
    executionStatus: EXECUTION_LABEL,
    status: REFERRAL_LABEL,
    rewardStatus: REWARD_LABEL,
  };
  return maps[field]?.[v] ?? v;
}

export function HistoryList({ histories }: { histories: (StatusHistory & { changedBy: User | null })[] }) {
  if (histories.length === 0) return <EmptyState message="履歴はありません" />;
  return (
    <ul className="divide-y divide-gray-100 text-sm">
      {histories.map((h) => (
        <li key={h.id} className="py-2 flex flex-wrap gap-x-3 gap-y-1">
          <span className="text-gray-400 whitespace-nowrap text-xs pt-0.5">{fmtDateTime(h.changedAt)}</span>
          <span className="text-gray-600 whitespace-nowrap">{h.changedBy?.name ?? "システム"}</span>
          <span>
            <span className="text-gray-500">{FIELD_LABEL[h.field] ?? h.field}：</span>
            {valueLabel(h.field, h.fromValue)} → <span className="font-medium">{valueLabel(h.field, h.toValue)}</span>
          </span>
          {h.note && <span className="text-gray-500 basis-full sm:basis-auto">（{h.note}）</span>}
        </li>
      ))}
    </ul>
  );
}
