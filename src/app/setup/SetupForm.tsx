"use client";
import { useActionState } from "react";
import { setupAdminAction } from "./actions";
import { ErrorMessage, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function SetupForm() {
  const [state, action] = useActionState(setupAdminAction, undefined);
  return (
    <form action={action} className="card p-5 space-y-4">
      <Field label="ログインID" required hint="半角英数字 3文字以上">
        <input name="loginId" className="input" autoComplete="username" required />
      </Field>
      <Field label="氏名" required>
        <input name="name" className="input" required />
      </Field>
      <Field label="パスワード" required hint="8文字以上">
        <input name="password" type="password" className="input" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="パスワード（確認）" required>
        <input name="confirm" type="password" className="input" autoComplete="new-password" required minLength={8} />
      </Field>
      <ErrorMessage message={state?.error} />
      <SubmitButton className="btn-primary w-full py-2">管理者を作成してログイン</SubmitButton>
    </form>
  );
}
