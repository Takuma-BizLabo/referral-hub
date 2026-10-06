import Link from "next/link";
import { STATUS_COLOR } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function CountChips({
  items,
  active,
  totalLabel,
  total,
  allHref,
}: {
  items: { value: string; label: string; count: number; href: string }[];
  active?: string;
  totalLabel: string;
  total: number;
  allHref: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      <Link href={allHref} className={cn("badge px-2 py-1", !active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-300")}>
        {totalLabel} {total}
      </Link>
      {items.map((it) => (
        <Link
          key={it.value}
          href={it.href}
          className={cn("badge px-2 py-1", STATUS_COLOR[it.value] ?? "bg-gray-100 text-gray-700 border-gray-200", active === it.value && "ring-2 ring-gray-900")}
        >
          {it.label} {it.count}
        </Link>
      ))}
    </div>
  );
}
