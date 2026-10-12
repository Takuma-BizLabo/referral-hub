"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateReferralMeetingAtAction, updateThankYouFeeAction } from "./actions";
import { cn } from "@/lib/utils";

type SaveFn = (id: number, value: string) => Promise<{ ok: boolean; error?: string }>;

/** 一覧のセルをその場で編集する共通部品。表示中はクリックで入力欄に切り替わる */
function InlineCell({
  id,
  initial,
  display,
  emptyLabel,
  inputType,
  placeholder,
  save: saveFn,
  align = "left",
  format,
}: {
  id: number;
  initial: string;
  display: string | null;
  emptyLabel: string;
  inputType: "datetime-local" | "text";
  placeholder?: string;
  save: SaveFn;
  align?: "left" | "right";
  format?: (v: string) => string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const r = await saveFn(id, value);
      if (!r.ok) {
        setError(r.error ?? "保存できませんでした");
        return;
      }
      setError(null);
      setEditing(false);
      router.refresh();
    });
  const cancel = () => {
    setValue(initial);
    setError(null);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1 min-w-44">
        <input
          autoFocus
          type={inputType}
          inputMode={inputType === "text" ? "numeric" : undefined}
          className={cn("input text-xs py-1", align === "right" && "text-right")}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(format ? format(e.target.value) : e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") cancel();
          }}
        />
        <div className="flex gap-1">
          <button type="button" className="btn-primary btn-sm" disabled={pending} onClick={save}>
            {pending ? "保存中..." : "保存"}
          </button>
          <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={cancel}>
            取消
          </button>
        </div>
        {error && <p className="text-[11px] text-rose-600">{error}</p>}
      </div>
    );
  }

  if (!display) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-700"
        onClick={() => setEditing(true)}
      >
        ＋ {emptyLabel}
      </button>
    );
  }
  return (
    <button
      type="button"
      className={cn("group inline-flex items-center gap-1 rounded px-1 -mx-1 hover:bg-white/70 whitespace-nowrap", align === "right" && "justify-end")}
      title="クリックして変更"
      onClick={() => setEditing(true)}
    >
      <span>{display}</span>
      <span className="text-xs text-gray-300 group-hover:text-gray-600">✎</span>
    </button>
  );
}

/** 面談日時（datetime-local の値と表示用文字列を受け取る） */
export function MeetingAtCell({ id, value, display }: { id: number; value: string; display: string | null }) {
  return <InlineCell id={id} initial={value} display={display} emptyLabel="日時を入力" inputType="datetime-local" save={updateReferralMeetingAtAction} />;
}

const yen = (raw: string) => {
  const d = raw.normalize("NFKC").replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
  return d === "" ? "" : Number(d).toLocaleString("ja-JP");
};

/** 謝礼金（null は未入力） */
export function ThankYouFeeCell({ id, value }: { id: number; value: number | null }) {
  return (
    <InlineCell
      id={id}
      initial={value === null ? "" : value.toLocaleString("ja-JP")}
      display={value === null ? null : `¥${value.toLocaleString("ja-JP")}`}
      emptyLabel="謝礼金"
      inputType="text"
      placeholder="例: 10,000"
      save={updateThankYouFeeAction}
      align="right"
      format={yen}
    />
  );
}
