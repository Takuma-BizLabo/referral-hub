"use client";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText = "処理中...",
  confirm,
  disabled,
  pending: pendingProp,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  pendingText?: string;
  confirm?: string;
  disabled?: boolean;
  /** useStickyAction の pending（onSubmit で送信するフォーム用）。省略時は useFormStatus */
  pending?: boolean;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button
      type="submit"
      className={className}
      disabled={pending || disabled}
      aria-busy={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      {...rest}
    >
      {pending ? pendingText : children}
    </button>
  );
}
