import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS_COLOR } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  children,
  className,
  actions,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={cn("card", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5">
          {title && <h2 className="text-sm font-semibold text-gray-800">{title}</h2>}
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Badge({ value, label, className }: { value: string; label: string; className?: string }) {
  return <span className={cn("badge", STATUS_COLOR[value] ?? "bg-gray-100 text-gray-700 border-gray-200", className)}>{label}</span>;
}

export function Field({
  label,
  children,
  required,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="py-10 text-center text-sm text-gray-400">{message}</div>;
}

export function ErrorMessage({ message }: { message?: string | null }) {
  if (!message) return null;
  return <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</div>;
}

export function SuccessMessage({ message }: { message?: string | null }) {
  if (!message) return null;
  return <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>;
}

export function Stat({ label, value, sub, href }: { label: string; value: ReactNode; sub?: string; href?: string }) {
  const body = (
    <div className="card px-4 py-3 h-full">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-semibold text-gray-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:opacity-80">
      {body}
    </Link>
  ) : (
    body
  );
}

export function ProgressBar({ value, target }: { value: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const color = pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-blue-500" : "bg-amber-500";
  return (
    <div>
      <div className="h-2 w-full rounded bg-gray-200 overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {target > 0 ? `${pct}%` : "目標未設定"}
      </div>
    </div>
  );
}

export function Tabs({ items }: { items: { href: string; label: string; active: boolean }[] }) {
  return (
    <div className="flex gap-1 border-b border-gray-200 mb-4 overflow-x-auto no-scrollbar">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px",
            t.active ? "border-blue-600 text-blue-700 font-medium" : "border-transparent text-gray-500 hover:text-gray-800",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function Description({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
      {items.map((it) => (
        <div key={it.label}>
          <dt className="text-xs text-gray-500">{it.label}</dt>
          <dd className="text-gray-900 mt-0.5 break-words whitespace-pre-wrap">{it.value ?? "-"}</dd>
        </div>
      ))}
    </dl>
  );
}
