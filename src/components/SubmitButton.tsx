"use client";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText = "処理中...",
  confirm,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  pendingText?: string;
  confirm?: string;
  name?: string;
  value?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      {...rest}
    >
      {pending ? pendingText : children}
    </button>
  );
}
