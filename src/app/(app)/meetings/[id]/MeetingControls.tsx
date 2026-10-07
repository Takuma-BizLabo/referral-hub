"use client";
import { useStickyAction } from "@/lib/use-sticky-action";
import { useState } from "react";
import { rejectMeetingAction, saveMinutesAction, setExecutionStatusAction } from "../actions";
import { ErrorMessage, Field, SuccessMessage } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { EXECUTION_LABEL, EXECUTION_ORDER } from "@/lib/labels";
import type { ExecutionStatus } from "@prisma/client";

export function ExecutionControls({ id, current, vendorDone }: { id: number; current: ExecutionStatus; vendorDone: boolean }) {
  const [status, setStatus] = useState<ExecutionStatus>(current);
  return (
    <form action={setExecutionStatusAction} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <select name="status" className="input" value={status} onChange={(e) => setStatus(e.target.value as ExecutionStatus)}>
        {EXECUTION_ORDER.map((s) => (
          <option key={s} value={s}>
            {EXECUTION_LABEL[s]}
          </option>
        ))}
      </select>
      {status === "DONE" && !vendorDone && (
        <p className="text-xs text-gray-600">実施済にすると、ベンダーの「MTG状態」も実施済になり、紹介案件を打診中へ進められるようになります。</p>
      )}
      <SubmitButton className="btn-secondary w-full">ステータスを更新</SubmitButton>
    </form>
  );
}

export function RejectForm({ id }: { id: number }) {
  const [state, action, actionPending, actionSubmit] = useStickyAction(rejectMeetingAction, undefined);
  return (
    <form action={action} onSubmit={actionSubmit} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Field label="差し戻し理由" required>
        <textarea name="reason" className="input" rows={2} required />
      </Field>
      <ErrorMessage message={state?.error} />
      <SubmitButton pending={actionPending} className="btn-danger w-full">差し戻す</SubmitButton>
    </form>
  );
}

export function MinutesForm({
  id,
  minutes,
  nextAction,
  nextActionDue,
}: {
  id: number;
  minutes: string;
  nextAction: string;
  nextActionDue: string;
}) {
  const [state, action, actionPending, actionSubmit] = useStickyAction(saveMinutesAction, undefined);
  return (
    <form action={action} onSubmit={actionSubmit} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Field label="議事メモ" hint="実施後24時間以内に入力しないとリマインドされます">
        <textarea name="minutes" className="input" rows={6} defaultValue={minutes} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="次アクション">
          <input name="nextAction" className="input" defaultValue={nextAction} />
        </Field>
        <Field label="期限">
          <input name="nextActionDue" type="date" className="input" defaultValue={nextActionDue} />
        </Field>
      </div>
      <ErrorMessage message={state?.error} />
      <SuccessMessage message={state?.success} />
      <SubmitButton pending={actionPending}>保存</SubmitButton>
    </form>
  );
}
