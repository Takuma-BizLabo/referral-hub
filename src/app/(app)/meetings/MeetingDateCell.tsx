"use client";
import { InlineCell } from "@/components/InlineCell";
import { updateMeetingScheduledAtAction } from "./actions";

/** ベンダーMTG一覧の日時をその場で入力・変更する */
export function MeetingDateCell({ id, value, display }: { id: number; value: string; display: string | null }) {
  return <InlineCell id={id} initial={value} display={display} emptyLabel="日時を入力" inputType="datetime-local" save={updateMeetingScheduledAtAction} />;
}
