"use client";
import { useActionState } from "react";
import Link from "next/link";
import { createMeetingAction, updateMeetingAction } from "./actions";
import { ErrorMessage, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { EXECUTION_LABEL, EXECUTION_ORDER } from "@/lib/labels";
import { toInputDate, toInputDateTime } from "@/lib/utils";
import type { VendorMeeting } from "@prisma/client";

type Opt = { id: number; name: string };

export function MeetingForm({
  meeting,
  vendors,
  users,
  defaultVendorId,
  defaultAssigneeId,
}: {
  meeting?: VendorMeeting;
  vendors: Opt[];
  users: Opt[];
  defaultVendorId?: number;
  defaultAssigneeId?: number;
}) {
  const [state, action] = useActionState(meeting ? updateMeetingAction : createMeetingAction, undefined);
  return (
    <form action={action} className="card p-4 space-y-4 max-w-3xl">
      {meeting && <input type="hidden" name="id" value={meeting.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ベンダー" required>
          <select name="vendorId" className="input" defaultValue={meeting?.vendorId ?? defaultVendorId ?? ""} required>
            <option value="">選択してください</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="商談担当者" required>
          <select name="assigneeId" className="input" defaultValue={meeting?.assigneeId ?? defaultAssigneeId ?? ""} required>
            <option value="">選択してください</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="日時" hint="未定の場合は空欄">
          <input name="scheduledAt" type="datetime-local" className="input" defaultValue={toInputDateTime(meeting?.scheduledAt ?? null)} />
        </Field>
        <Field label="形式">
          <select name="format" className="input" defaultValue={meeting?.format ?? "ONLINE"}>
            <option value="ONLINE">オンライン</option>
            <option value="VISIT">訪問</option>
          </select>
        </Field>
        <Field label="会議URL・場所" className="sm:col-span-2">
          <input name="place" className="input" placeholder="Zoom URL や住所" defaultValue={meeting?.place ?? ""} />
        </Field>
        {!meeting && (
          <Field label="実施ステータス">
            <select name="executionStatus" className="input" defaultValue="SCHEDULING">
              {EXECUTION_ORDER.map((s) => (
                <option key={s} value={s}>
                  {EXECUTION_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="この依頼の紹介単価（円）" hint="セールスハブ依頼ページの「ご協力金」。ベンダー共通の単価と異なる場合に入力">
          <input name="fee" type="number" min={0} step={1000} className="input" defaultValue={meeting?.fee ?? ""} />
        </Field>
        <Field label="ベンダーからの依頼内容" className="sm:col-span-2" hint="セールスハブのチャット内容など">
          <textarea name="requestNote" className="input" rows={3} defaultValue={meeting?.requestNote ?? ""} />
        </Field>
        <Field label="次アクション">
          <input name="nextAction" className="input" defaultValue={meeting?.nextAction ?? ""} />
        </Field>
        <Field label="次アクション期限">
          <input name="nextActionDue" type="date" className="input" defaultValue={toInputDate(meeting?.nextActionDue ?? null)} />
        </Field>
      </div>
      {meeting?.approvalStatus === "REJECTED" && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          このMTGは差し戻されています。保存すると再申請（承認待ち）になります。
        </p>
      )}
      <ErrorMessage message={state?.error} />
      <div className="flex gap-2">
        <SubmitButton>{meeting ? "保存" : "登録して承認申請"}</SubmitButton>
        <Link href={meeting ? `/meetings/${meeting.id}` : "/meetings"} className="btn-secondary">
          キャンセル
        </Link>
      </div>
    </form>
  );
}
