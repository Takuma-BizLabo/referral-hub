"use client";
import { useRef } from "react";

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
    <form action={action} ref={ref} onClick={(e) => e.stopPropagation()}>
      <input type="hidden" name="id" value={id} />
      {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <select name={name} defaultValue={value} className={className} onChange={() => ref.current?.requestSubmit()}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </form>
  );
}
