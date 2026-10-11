"use client";
import { useStickyAction } from "@/lib/use-sticky-action";
import { useEffect, useRef, useState } from "react";
import { fmtBytes, MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES } from "@/lib/attachments";
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
  const [picked, setPicked] = useState<{ name: string; size: number }[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  useEffect(() => {
    if (state?.success) {
      ref.current?.reset();
      setPicked([]);
    }
  }, [state]);
  const others = users.filter((u) => u.id !== meId);
  return (
    <form ref={ref} action={action} onSubmit={actionSubmit} className="space-y-3">
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
      <Field label="添付ファイル" hint={`${MAX_FILES}件まで・1ファイル${fmtBytes(MAX_FILE_BYTES)}まで（PDF・画像・Excel・Word など）`}>
        <input
          name="files"
          type="file"
          multiple
          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-semibold hover:file:bg-gray-50"
          onChange={(e) => {
            const list = Array.from(e.target.files ?? []);
            setPicked(list.map((f) => ({ name: f.name, size: f.size })));
            const big = list.find((f) => f.size > MAX_FILE_BYTES);
            const total = list.reduce((a, f) => a + f.size, 0);
            setFileError(
              list.length > MAX_FILES
                ? `添付できるのは${MAX_FILES}件までです`
                : big
                  ? `「${big.name}」が大きすぎます（${fmtBytes(big.size)}）`
                  : total > MAX_TOTAL_BYTES
                    ? `合計が大きすぎます（${fmtBytes(total)}）`
                    : null,
            );
          }}
        />
        {picked.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
            {picked.map((f) => (
              <li key={f.name}>
                📎 {f.name}（{fmtBytes(f.size)}）
              </li>
            ))}
          </ul>
        )}
        {fileError && <p className="mt-1 text-xs text-rose-600">{fileError}</p>}
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="important" /> <span className="badge bg-rose-100 text-rose-800 border-rose-200">重要</span> として目立たせる
      </label>
      <ErrorMessage message={state?.error} />
      <SuccessMessage message={state?.success} />
      <SubmitButton pending={actionPending} disabled={!!fileError} pendingText={picked.length ? "アップロード中..." : "処理中..."}>
        タスクを依頼する
      </SubmitButton>
    </form>
  );
}
