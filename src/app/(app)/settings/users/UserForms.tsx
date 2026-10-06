"use client";
import { useStickyAction } from "@/lib/use-sticky-action";
import { useState } from "react";
import { createUserAction, resetPasswordAction, updateUserAction } from "./actions";
import { ErrorMessage, Field, SuccessMessage, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { ROLE_LABEL } from "@/lib/labels";
import type { Role } from "@prisma/client";

export function CreateUserForm() {
  const [state, action, actionPending, actionSubmit] = useStickyAction(createUserAction, undefined);
  return (
    <form action={action} onSubmit={actionSubmit} className="space-y-3">
      <Field label="ログインID" required hint="半角英数字 3文字以上">
        <input name="loginId" className="input" required />
      </Field>
      <Field label="氏名" required>
        <input name="name" className="input" required />
      </Field>
      <Field label="初期パスワード" required hint="8文字以上。本人に伝えてください">
        <input name="password" className="input" required minLength={8} />
      </Field>
      <Field label="権限">
        <select name="role" className="input" defaultValue="MEMBER">
          <option value="MEMBER">商談担当者</option>
          <option value="ADMIN">管理者</option>
        </select>
      </Field>
      <ErrorMessage message={state?.error} />
      <SuccessMessage message={state?.success} />
      <SubmitButton pending={actionPending}>作成</SubmitButton>
    </form>
  );
}

type U = { id: number; loginId: string; name: string; role: Role; isActive: boolean; lineLinked: boolean };

export function UserRow({ user }: { user: U }) {
  const [mode, setMode] = useState<"view" | "edit" | "password">("view");
  const [editState, editAction, editActionPending, editActionSubmit] = useStickyAction(updateUserAction, undefined);
  const [pwState, pwAction, pwActionPending, pwActionSubmit] = useStickyAction(resetPasswordAction, undefined);

  if (mode === "edit") {
    return (
      <tr>
        <td colSpan={6}>
          <form action={editAction} onSubmit={editActionSubmit} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={user.id} />
            <div className="text-sm text-gray-500 self-center">{user.loginId}</div>
            <Field label="氏名">
              <input name="name" className="input" defaultValue={user.name} required />
            </Field>
            <Field label="権限">
              <select name="role" className="input" defaultValue={user.role}>
                <option value="MEMBER">商談担当者</option>
                <option value="ADMIN">管理者</option>
              </select>
            </Field>
            <label className="flex items-center gap-1 text-sm pb-2">
              <input type="checkbox" name="isActive" defaultChecked={user.isActive} /> 有効
            </label>
            <SubmitButton pending={editActionPending}>保存</SubmitButton>
            <button type="button" className="btn-secondary" onClick={() => setMode("view")}>
              キャンセル
            </button>
            <div className="basis-full">
              <ErrorMessage message={editState?.error} />
              <SuccessMessage message={editState?.success} />
            </div>
          </form>
        </td>
      </tr>
    );
  }
  if (mode === "password") {
    return (
      <tr>
        <td colSpan={6}>
          <form action={pwAction} onSubmit={pwActionSubmit} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={user.id} />
            <div className="text-sm text-gray-500 self-center">
              {user.loginId}（{user.name}）
            </div>
            <Field label="新しいパスワード" hint="8文字以上">
              <input name="password" className="input" required minLength={8} />
            </Field>
            <SubmitButton pending={pwActionPending}>再設定</SubmitButton>
            <button type="button" className="btn-secondary" onClick={() => setMode("view")}>
              キャンセル
            </button>
            <div className="basis-full">
              <ErrorMessage message={pwState?.error} />
              <SuccessMessage message={pwState?.success} />
            </div>
          </form>
        </td>
      </tr>
    );
  }
  return (
    <tr className={user.isActive ? "" : "opacity-50"}>
      <td className="font-mono text-xs">{user.loginId}</td>
      <td>{user.name}</td>
      <td>
        <Badge value={user.role === "ADMIN" ? "APPROVED" : "SCHEDULING"} label={ROLE_LABEL[user.role]} />
      </td>
      <td className="text-xs">{user.lineLinked ? "連携済" : "未連携"}</td>
      <td className="text-xs">{user.isActive ? "有効" : "無効"}</td>
      <td className="text-right whitespace-nowrap">
        <button className="btn-secondary btn-sm mr-1" onClick={() => setMode("edit")}>
          編集
        </button>
        <button className="btn-secondary btn-sm" onClick={() => setMode("password")}>
          パスワード再設定
        </button>
      </td>
    </tr>
  );
}
