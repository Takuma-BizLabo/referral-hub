"use client";
import { useStickyAction } from "@/lib/use-sticky-action";

import { saveRewardAction } from "../actions";
import { ErrorMessage, Field, SuccessMessage } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { MoneyInput } from "@/components/MoneyInput";

export function RewardForm({
  id,
  rewardAmount,
  invoicedAt,
  paymentDueAt,
  paidAt,
  approvedAt,
  undetermined,
}: {
  id: number;
  rewardAmount: number;
  undetermined: boolean;
  invoicedAt: string;
  paymentDueAt: string;
  paidAt: string;
  approvedAt: string | null;
}) {
  const [state, action, actionPending, actionSubmit] = useStickyAction(saveRewardAction, undefined);
  return (
    <form action={action} onSubmit={actionSubmit} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="報酬額（円）">
          <MoneyInput name="rewardAmount" defaultValue={rewardAmount} />
          <label className="flex items-center gap-2 text-xs mt-2">
            <input type="checkbox" name="rewardUndetermined" defaultChecked={undetermined} /> 単価未定
          </label>
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
      <SubmitButton pending={actionPending} className="btn-secondary">保存</SubmitButton>
    </form>
  );
}
