"use client";
import { useStickyAction } from "@/lib/use-sticky-action";

import { loginAction } from "./actions";
import { ErrorMessage, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm({ next }: { next: string }) {
  const [state, action, actionPending, actionSubmit] = useStickyAction(loginAction, undefined);
  return (
    <form action={action} onSubmit={actionSubmit} className="card p-5 space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="ログインID" required>
        <input name="loginId" className="input" autoComplete="username" autoFocus required />
      </Field>
      <Field label="パスワード" required>
        <input name="password" type="password" className="input" autoComplete="current-password" required />
      </Field>
      <ErrorMessage message={state?.error} />
      <SubmitButton pending={actionPending} className="btn-primary w-full py-2">ログイン</SubmitButton>
    </form>
  );
}
