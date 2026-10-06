"use client";
import { useActionState, useEffect, useRef } from "react";
import { createTaskAction } from "./actions";
import { ErrorMessage, Field, SuccessMessage } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function TaskForm({ users, meId, defaultLink }: { users: { id: number; name: string }[]; meId: number; defaultLink?: string }) {
  const [state, action] = useActionState(createTaskAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.success) ref.current?.reset();
  }, [state]);
  const others = users.filter((u) => u.id !== meId);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="宛先" required>
          <select name="assigneeId" className="input" defaultValue={others[0]?.id ?? ""} required>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.id === meId ? "（自分）" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="期限">
          <input name="dueDate" type="date" className="input" />
        </Field>
      </div>
      <Field label="タイトル" required>
        <input name="title" className="input" placeholder="例: CastingONE に 10/9 の候補日を返信して" required />
      </Field>
      <Field label="内容">
        <textarea name="body" className="input" rows={3} placeholder="依頼の詳細、確認してほしいこと、参考情報など" />
      </Field>
      <Field label="関連ページURL" hint="MTGや紹介案件のページURLを貼ると「関連ページ」ボタンになります">
        <input name="linkUrl" className="input" placeholder="/meetings/12 など" defaultValue={defaultLink ?? ""} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="important" /> <span className="badge bg-rose-100 text-rose-800 border-rose-200">重要</span> として目立たせる
      </label>
      <ErrorMessage message={state?.error} />
      <SuccessMessage message={state?.success} />
      <SubmitButton>タスクを依頼する</SubmitButton>
    </form>
  );
}
