"use client";
import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { ReturnToInput } from "./ReturnTo";
import { cn } from "@/lib/utils";

export function StatusSelect({
  action,
  id,
  value,
  options,
  name = "status",
  className = "input text-xs py-0.5 w-auto",
  extra,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: number;
  value: string;
  options: { value: string; label: string }[];
  name?: string;
  className?: string;
  extra?: Record<string, string>;
}) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form action={action} ref={ref} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 max-w-full">
      <input type="hidden" name="id" value={id} />
      <ReturnToInput />
      {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Select name={name} value={value} options={options} className={className} onChange={() => ref.current?.requestSubmit()} />
    </form>
  );
}

function Select({
  name,
  value,
  options,
  className,
  onChange,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  className: string;
  onChange: () => void;
}) {
  const { pending } = useFormStatus();
  const sel = useRef<HTMLSelectElement>(null);
  // 送信が終わったら（失敗して元のページに戻った場合も）サーバー側の最新値に合わせる
  useEffect(() => {
    if (!pending && sel.current) sel.current.value = value;
  }, [pending, value]);
  return (
    <>
      <select ref={sel} name={name} defaultValue={value} className={cn(className, pending && "opacity-60")} disabled={pending} onChange={onChange} aria-busy={pending}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {pending && <span className="inline-block w-3 h-3 rounded-full border-2 border-gray-300 border-t-primary animate-spin shrink-0" aria-label="更新中" />}
    </>
  );
}
