"use client";
import { useStickyAction } from "@/lib/use-sticky-action";

import { saveThresholdsAction } from "./actions";
import { ErrorMessage, Field, SuccessMessage } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { NOTIFICATION_TYPES } from "@/lib/labels";

export function ThresholdsForm({
  stagnationDays,
  dailyDigestHour,
  minutesMissingHours,
  lineMap,
}: {
  stagnationDays: string;
  dailyDigestHour: string;
  minutesMissingHours: string;
  lineMap: Record<string, boolean>;
}) {
  const [state, action, actionPending, actionSubmit] = useStickyAction(saveThresholdsAction, undefined);
  return (
    <form action={action} onSubmit={actionSubmit} className="space-y-5 max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="紹介案件の停滞日数" hint="同じステータスでこの日数以上なら通知">
          <input name="stagnationDays" type="number" min={1} max={90} className="input" defaultValue={stagnationDays} />
        </Field>
        <Field label="日次通知の時刻（時）" hint="前日・期限当日・停滞・入金遅延の判定時刻">
          <input name="dailyDigestHour" type="number" min={0} max={23} className="input" defaultValue={dailyDigestHour} />
        </Field>
        <Field label="議事メモ未入力の猶予（時間）" hint="実施後この時間を過ぎたら通知">
          <input name="minutesMissingHours" type="number" min={1} max={168} className="input" defaultValue={minutesMissingHours} />
        </Field>
      </div>
      <div>
        <div className="label">LINE にも送る通知の種類</div>
        <p className="text-xs text-gray-500 mb-2">OFF の種類はツール内（ベル）のみ。LINE 無料枠は月200通です。</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {NOTIFICATION_TYPES.map((t) => (
            <label key={t.key} className="flex items-center gap-2 text-sm border border-gray-200 rounded-lg px-3 py-2">
              <input type="checkbox" name={`line_${t.key}`} defaultChecked={lineMap[t.key]} />
              {t.label}
            </label>
          ))}
        </div>
      </div>
      <ErrorMessage message={state?.error} />
      <SuccessMessage message={state?.success} />
      <SubmitButton pending={actionPending}>保存</SubmitButton>
    </form>
  );
}
