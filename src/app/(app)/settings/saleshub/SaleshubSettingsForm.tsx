"use client";
import { useStickyAction } from "@/lib/use-sticky-action";

import { saveSaleshubSettingsAction } from "./actions";
import { ErrorMessage, Field, SuccessMessage } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function SaleshubSettingsForm({
  enabled,
  schedulerUserId,
  staleMinutes,
  users,
}: {
  enabled: boolean;
  schedulerUserId: string;
  staleMinutes: number;
  users: { id: number; name: string }[];
}) {
  const [state, action, actionPending, actionSubmit] = useStickyAction(saveSaleshubSettingsAction, undefined);
  return (
    <form action={action} onSubmit={actionSubmit} className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={enabled} /> セールスハブ連携を有効にする
      </label>
      <Field label="自動作成する MTG の商談担当者" hint="ベンダーMTG は毎回この人に割り当てます">
        <select name="schedulerUserId" className="input" defaultValue={schedulerUserId}>
          <option value="">自動（名前に「松田」を含むユーザー）</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="受信が途絶えたと判断する時間（分）" hint="この時間、拡張から受信がなければ管理者に通知">
        <input name="staleMinutes" type="number" min={10} className="input" defaultValue={staleMinutes} />
      </Field>
      <ErrorMessage message={state?.error} />
      <SuccessMessage message={state?.success} />
      <SubmitButton pending={actionPending} className="btn-secondary">保存</SubmitButton>
    </form>
  );
}
