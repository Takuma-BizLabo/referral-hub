"use client";
import { useActionState } from "react";
import { saveGoalsAction } from "./actions";
import { ErrorMessage, Field, SuccessMessage } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import type { MonthlyGoal } from "@prisma/client";

export function GoalsForm({
  yearMonth,
  overall,
  users,
}: {
  yearMonth: string;
  overall: MonthlyGoal | null;
  users: { id: number; name: string; target: number }[];
}) {
  const [state, action] = useActionState(saveGoalsAction, undefined);
  return (
    <form action={action} className="space-y-4" key={yearMonth}>
      <input type="hidden" name="yearMonth" value={yearMonth} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ベンダーMTG件数（全体）">
          <input name="meetingTarget" type="number" min={0} className="input" defaultValue={overall?.meetingTarget ?? 0} />
        </Field>
        <Field label="紹介件数">
          <input name="referralTarget" type="number" min={0} className="input" defaultValue={overall?.referralTarget ?? 0} />
        </Field>
        <Field label="報酬・計上ベース（円）">
          <input name="rewardAccrualTarget" type="number" min={0} step={10000} className="input" defaultValue={overall?.rewardAccrualTarget ?? 0} />
        </Field>
        <Field label="報酬・入金ベース（円）">
          <input name="rewardPaidTarget" type="number" min={0} step={10000} className="input" defaultValue={overall?.rewardPaidTarget ?? 0} />
        </Field>
      </div>
      <div>
        <div className="label">担当者別 MTG件数</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {users.map((u) => (
            <Field key={u.id} label={u.name}>
              <input name={`user_${u.id}`} type="number" min={0} className="input" defaultValue={u.target} />
            </Field>
          ))}
        </div>
      </div>
      <ErrorMessage message={state?.error} />
      <SuccessMessage message={state?.success} />
      <SubmitButton>保存</SubmitButton>
    </form>
  );
}
