"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtBytes, isImageType, MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES } from "@/lib/attachments";
import { cn } from "@/lib/utils";

/** 貼り付けた画像は「image.png」になりがちなので、日時入りの名前にする */
export function renamePasted(f: File, i = 0): File {
  if (f.name && !/^image\.(png|jpe?g|gif|webp)$/i.test(f.name)) return f;
  const ext = (f.type.split("/")[1] || "png").replace("jpeg", "jpg");
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const name = `貼り付け画像_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${i ? `_${i}` : ""}.${ext}`;
  return new File([f], name, { type: f.type || "image/png" });
}

export function validateFiles(files: File[]): string | null {
  if (files.length > MAX_FILES) return `添付できるのは${MAX_FILES}件までです（いま ${files.length} 件）`;
  const big = files.find((f) => f.size > MAX_FILE_BYTES);
  if (big) return `「${big.name}」が大きすぎます（${fmtBytes(big.size)}）。1ファイル${fmtBytes(MAX_FILE_BYTES)}までです`;
  const total = files.reduce((a, f) => a + f.size, 0);
  if (total > MAX_TOTAL_BYTES) return `合計が大きすぎます（${fmtBytes(total)}）`;
  return null;
}

/**
 * 添付ファイルの選択欄。ファイル選択・ドラッグ&ドロップ・（フォーム側の）貼り付けで追加でき、個別に外せる。
 * 実際に送信されるのは name="files" の隠し input（state と同期）。
 */
export function AttachmentPicker({ files, onChange }: { files: File[]; onChange: (files: File[] | ((prev: File[]) => File[])) => void }) {
  const hiddenRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

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
    if (arr.length) onChange((prev) => [...prev, ...arr.map((f, i) => renamePasted(f, i))]);
  };

  return (
    <div>
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
      <div
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
        className={cn(
          "rounded-lg border-2 border-dashed px-3 py-3 text-center text-xs text-gray-600 transition-colors",
          dragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-gray-50",
        )}
      >
        <button type="button" className="btn-secondary btn-sm" onClick={() => pickerRef.current?.click()}>
          ファイルを選択
        </button>
        <p className="mt-1.5">
          ここにドラッグ&ドロップ、またはスクショを <b>Cmd+V</b>（Windows は Ctrl+V）で貼り付け
        </p>
      </div>
      {files.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="relative rounded-lg border border-gray-200 bg-white text-xs">
              {previews[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previews[i]!} alt={f.name} className="h-20 w-28 rounded-t-lg object-cover" />
              ) : (
                <div className="flex h-20 w-28 items-center justify-center rounded-t-lg bg-gray-50 text-2xl">📎</div>
              )}
              <div className="w-28 truncate px-1.5 py-0.5 text-[11px] text-gray-700" title={f.name}>
                {f.name}
              </div>
              <div className="px-1.5 pb-1 text-[10px] text-gray-400">{fmtBytes(f.size)}</div>
              <button
                type="button"
                aria-label={`${f.name} を外す`}
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-[11px] text-white hover:bg-rose-600"
                onClick={() => onChange((prev) => prev.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
