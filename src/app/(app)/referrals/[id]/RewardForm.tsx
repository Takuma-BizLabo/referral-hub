"use client";
import { useActionState } from "react";
import { saveRewardAction } from "../actions";
import { ErrorMessage, Field, SuccessMessage } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function RewardForm({
  id,
  rewardAmount,
  invoicedAt,
  paymentDueAt,
  paidAt,
  approvedAt,
}: {
  id: number;
  rewardAmount: number;
  invoicedAt: string;
  paymentDueAt: string;
  paidAt: string;
  approvedAt: string | null;
}) {
  const [state, action] = useActionState(saveRewardAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="報酬額（円）">
          <input name="rewardAmount" type="number" min={0} step={1000} className="input" defaultValue={rewardAmount} />
        </Field>
        <Field label="請求日">
          <input name="invoicedAt" type="date" className="input" defaultValue={invoicedAt} />
        </Field>
        <Field label="入金予定日" hint="過ぎても未入金なら管理者に通知">
          <input name="paymentDueAt" type="date" className="input" defaultValue={paymentDueAt} />
        </Field>
        <Field label="入金日">
          <input name="paidAt" type="date" className="input" defaultValue={paidAt} />
        </Field>
      </div>
      {approvedAt && <p className="text-xs text-gray-500">計上承認日時：{approvedAt}</p>}
      <ErrorMessage message={state?.error} />
      <SuccessMessage message={state?.success} />
      <SubmitButton className="btn-secondary">保存</SubmitButton>
    </form>
  );
}
