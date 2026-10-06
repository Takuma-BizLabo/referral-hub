"use client";
import { useState } from "react";
import { SubmitButton } from "./SubmitButton";

export function CompleteTaskForm({ id, action }: { id: number; action: (formData: FormData) => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="btn-primary btn-sm" onClick={() => setOpen(true)}>
        ✓ 完了にする
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 w-full">
      <input type="hidden" name="id" value={id} />
      <input name="comment" className="input flex-1 min-w-48" placeholder="ひとこと（任意）例: 日程調整しました、10/9 11:40で確定" autoFocus />
      <SubmitButton className="btn-primary btn-sm">完了</SubmitButton>
      <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(false)}>
        キャンセル
      </button>
    </form>
  );
}
