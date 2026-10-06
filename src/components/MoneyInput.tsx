"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

const toRaw = (v: string) => v.normalize("NFKC").replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
const fmt = (raw: string) => (raw === "" ? "" : Number(raw).toLocaleString("ja-JP"));

/**
 * 金額入力（表示は 40,000 のように桁区切り、送信値は数字のみ）。
 * value/onChange を渡すと制御コンポーネントとして動く。
 */
export function MoneyInput({
  name,
  defaultValue,
  value,
  onChange,
  required,
  disabled,
  placeholder,
  className,
  id,
}: {
  name: string;
  defaultValue?: number | string | null;
  value?: string;
  onChange?: (raw: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const [inner, setInner] = useState(() => toRaw(defaultValue === null || defaultValue === undefined ? "" : String(defaultValue)));
  const raw = value !== undefined ? toRaw(value) : inner;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">¥</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={cn("input pl-7 text-right tabular-nums", className)}
        value={fmt(raw)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        onChange={(e) => {
          const r = toRaw(e.target.value).slice(0, 12);
          if (value === undefined) setInner(r);
          onChange?.(r);
        }}
      />
      <input type="hidden" name={name} value={raw} />
    </div>
  );
}
