"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStickyAction } from "@/lib/use-sticky-action";
import { addTaskCommentAction } from "@/app/(app)/tasks/actions";
import { renamePasted, validateFiles } from "./AttachmentPicker";
import { fmtBytes, isImageType } from "@/lib/attachments";
import { ErrorMessage } from "./ui";

/** タスクのチャット入力欄。Cmd+Enter（Ctrl+Enter）で送信、画像は貼り付け・ドロップで添付 */
export function TaskChatInput({ taskId }: { taskId: number }) {
  const [state, action, pending, onSubmit] = useStickyAction(addTaskCommentAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (state?.success) {
      setText("");
      setFiles([]);
    }
  }, [state]);

  // state → 送信用 input に反映
  useEffect(() => {
    if (!hiddenRef.current) return;
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    hiddenRef.current.files = dt.files;
  }, [files]);

  const previews = useMemo(() => files.map((f) => (isImageType(f.type) ? URL.createObjectURL(f) : null)), [files]);
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);

  const add = (list: FileList | File[] | null | undefined) => {
    const arr = Array.from(list ?? []);
    if (arr.length) setFiles((prev) => [...prev, ...arr.map((f, i) => renamePasted(f, i))]);
  };
  const fileError = validateFiles(files);
  const empty = !text.trim() && files.length === 0;

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={onSubmit}
      onPaste={(e) => {
        const pasted = Array.from(e.clipboardData?.files ?? []);
        if (pasted.length === 0) return;
        e.preventDefault();
        add(pasted);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        add(e.dataTransfer.files);
      }}
      className={`mt-2 rounded-lg border bg-white p-2 ${dragging ? "border-blue-400 bg-blue-50" : "border-gray-300"}`}
    >
      <input type="hidden" name="taskId" value={taskId} />
      <input ref={hiddenRef} name="files" type="file" multiple className="hidden" tabIndex={-1} aria-hidden />
      <input
        ref={pickerRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      <textarea
        name="body"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (!empty && !fileError) formRef.current?.requestSubmit();
          }
        }}
        rows={2}
        className="w-full resize-y border-0 p-1 text-sm focus:outline-none focus:ring-0"
        placeholder="報告・指示・質問を入力（Cmd+Enter で送信。スクショは貼り付けで添付）"
      />
      {files.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="relative flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 py-1 pl-1 pr-6 text-xs">
              {previews[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previews[i]!} alt={f.name} className="h-8 w-10 rounded object-cover" />
              ) : (
                <span>📎</span>
              )}
              <span className="max-w-40 truncate" title={f.name}>
                {f.name}
              </span>
              <span className="text-gray-400">{fmtBytes(f.size)}</span>
              <button
                type="button"
                aria-label={`${f.name} を外す`}
                className="absolute right-1 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-gray-600 text-[10px] text-white hover:bg-rose-600"
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {fileError && <p className="mb-1 text-xs text-rose-600">{fileError}</p>}
      <ErrorMessage message={state?.error} />
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn-secondary btn-sm" onClick={() => pickerRef.current?.click()}>
          📎 ファイル
        </button>
        <button type="submit" className="btn-primary btn-sm" disabled={pending || empty || !!fileError}>
          {pending ? (files.length ? "アップロード中..." : "送信中...") : "送信"}
        </button>
      </div>
    </form>
  );
}
