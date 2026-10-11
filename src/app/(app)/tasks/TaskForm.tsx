"use client";
import { useStickyAction } from "@/lib/use-sticky-action";
import { useEffect, useRef, useState } from "react";
import { AttachmentPicker, renamePasted, validateFiles } from "@/components/AttachmentPicker";
import { fmtBytes, MAX_FILE_BYTES, MAX_FILES } from "@/lib/attachments";
import { createTaskAction } from "./actions";
import { ErrorMessage, Field, SuccessMessage } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function TaskForm({
  users,
  meId,
  defaultLink,
  defaultTitle,
  defaultBody,
  defaultAssigneeId,
}: {
  users: { id: number; name: string }[];
  meId: number;
  defaultLink?: string;
  defaultTitle?: string;
  defaultBody?: string;
  defaultAssigneeId?: number;
}) {
  const [state, action, actionPending, actionSubmit] = useStickyAction(createTaskAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  useEffect(() => {
    if (state?.success) {
      ref.current?.reset();
      setFiles([]);
    }
  }, [state]);
  const fileError = validateFiles(files);
  // フォームのどこで貼り付けても、画像・ファイルなら添付に追加する
  const onPaste = (e: React.ClipboardEvent<HTMLFormElement>) => {
    const pasted = Array.from(e.clipboardData?.files ?? []);
    if (pasted.length === 0) return;
    e.preventDefault();
    setFiles((prev) => [...prev, ...pasted.map(renamePasted)]);
  };
  const others = users.filter((u) => u.id !== meId);
  return (
    <form ref={ref} action={action} onSubmit={actionSubmit} onPaste={onPaste} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="宛先" required>
          <select name="assigneeId" className="input" defaultValue={defaultAssigneeId && users.some((u) => u.id === defaultAssigneeId) ? defaultAssigneeId : (others[0]?.id ?? "")} required>
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
        <input name="title" className="input" placeholder="例: CastingONE に 10/9 の候補日を返信して" defaultValue={defaultTitle ?? ""} required />
      </Field>
      <Field label="内容">
        <textarea name="body" defaultValue={defaultBody ?? ""} className="input" rows={defaultBody ? 10 : 3} placeholder="依頼の詳細、確認してほしいこと、参考情報など" />
      </Field>
      <Field label="関連ページURL" hint="MTGや紹介案件のページURLを貼ると「関連ページ」ボタンになります">
        <input name="linkUrl" className="input" placeholder="/meetings/12 など" defaultValue={defaultLink ?? ""} />
      </Field>
      <Field label="添付ファイル" hint={`${MAX_FILES}件まで・1ファイル${fmtBytes(MAX_FILE_BYTES)}まで。画像はこのフォーム上で Cmd+V（Ctrl+V）で貼り付けできます`}>
        <AttachmentPicker files={files} onChange={setFiles} />
        {fileError && <p className="mt-1 text-xs text-rose-600">{fileError}</p>}
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="important" /> <span className="badge bg-rose-100 text-rose-800 border-rose-200">重要</span> として目立たせる
      </label>
      <ErrorMessage message={state?.error} />
      <SuccessMessage message={state?.success} />
      <SubmitButton pending={actionPending} disabled={!!fileError} pendingText={files.length ? "アップロード中..." : "処理中..."}>
        タスクを依頼する
      </SubmitButton>
    </form>
  );
}
