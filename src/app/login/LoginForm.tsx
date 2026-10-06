"use client";
import { useActionState } from "react";
import { loginAction } from "./actions";
import { ErrorMessage, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="card p-5 space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="ログインID" required>
        <input name="loginId" className="input" autoComplete="username" autoFocus required />
      </Field>
      <Field label="パスワード" required>
        <input name="password" type="password" className="input" autoComplete="current-password" required />
      </Field>
      <ErrorMessage message={state?.error} />
      <SubmitButton className="btn-primary w-full py-2">ログイン</SubmitButton>
    </form>
  );
}
