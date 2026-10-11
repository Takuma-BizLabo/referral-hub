"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateMeetingPlaceAction } from "./actions";
import { cn } from "@/lib/utils";

/** 一覧の「打ち合わせURL・場所」をその場で入力・変更する */
export function MeetingPlaceCell({ id, place, compact }: { id: number; place: string | null; compact?: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(place ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const isUrl = !!place && /^https?:\/\//.test(place);

  const save = () =>
    start(async () => {
      const r = await updateMeetingPlaceAction(id, value);
      if (!r.ok) {
        setError(r.error ?? "保存できませんでした");
        return;
      }
      setError(null);
      setEditing(false);
      router.refresh();
    });

  if (editing) {
    return (
      <div className={cn("flex flex-col gap-1", compact ? "w-full" : "min-w-64")}>
        <input
          autoFocus
          className="input text-xs py-1"
          placeholder="https://zoom.us/j/... や住所"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") {
              setValue(place ?? "");
              setEditing(false);
            }
          }}
        />
        <div className="flex gap-1">
          <button type="button" className="btn-primary btn-sm" disabled={pending} onClick={save}>
            {pending ? "保存中..." : "保存"}
          </button>
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={pending}
            onClick={() => {
              setValue(place ?? "");
              setError(null);
              setEditing(false);
            }}
          >
            取消
          </button>
        </div>
        {error && <p className="text-[11px] text-rose-600">{error}</p>}
      </div>
    );
  }

  if (!place) {
    return (
      <button type="button" className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-700" onClick={() => setEditing(true)}>
        ＋ URLを入力
      </button>
    );
  }
  return (
    <div className={cn("flex items-center gap-1.5", compact ? "w-full" : "max-w-64")}>
      {isUrl ? (
        <a href={place} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-xs text-blue-700 underline underline-offset-2 hover:text-blue-900" title={place}>
          {place.replace(/^https?:\/\//, "")}
        </a>
      ) : (
        <span className="min-w-0 truncate text-xs text-gray-700" title={place}>
          {place}
        </span>
      )}
      <button type="button" className="shrink-0 rounded px-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="打ち合わせURLを編集" onClick={() => setEditing(true)}>
        ✎
      </button>
    </div>
  );
}
