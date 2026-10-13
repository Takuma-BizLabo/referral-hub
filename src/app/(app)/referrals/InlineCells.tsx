"use client";
import { updateReferralMeetingAtAction, updateRewardAmountAction, updateThankYouFeeAction } from "./actions";
import { InlineCell } from "@/components/InlineCell";

/** 面談日時（datetime-local の値と表示用文字列を受け取る） */
export function MeetingAtCell({ id, value, display }: { id: number; value: string; display: string | null }) {
  return <InlineCell id={id} initial={value} display={display} emptyLabel="日時を入力" inputType="datetime-local" save={updateReferralMeetingAtAction} />;
}

const yen = (raw: string) => {
  const d = raw.normalize("NFKC").replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
  return d === "" ? "" : Number(d).toLocaleString("ja-JP");
};

/** 謝礼金（null は未入力） */
export function ThankYouFeeCell({ id, value }: { id: number; value: number | null }) {
  return (
    <InlineCell
      id={id}
      initial={value === null ? "" : value.toLocaleString("ja-JP")}
      display={value === null ? null : `¥${value.toLocaleString("ja-JP")}`}
      emptyLabel="謝礼金"
      inputType="text"
      placeholder="例: 10,000"
      save={updateThankYouFeeAction}
      align="right"
      format={yen}
    />
  );
}

/** 報酬額（空欄で保存すると「未定」） */
export function RewardCell({ id, amount, undetermined }: { id: number; amount: number; undetermined: boolean }) {
  return (
    <InlineCell
      id={id}
      initial={undetermined ? "" : amount.toLocaleString("ja-JP")}
      display={undetermined ? "未定" : `¥${amount.toLocaleString("ja-JP")}`}
      emptyLabel="報酬"
      inputType="text"
      placeholder="空欄で未定"
      save={updateRewardAmountAction}
      align="right"
      format={yen}
    />
  );
}
