import Link from "next/link";
import { vendorColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

export function VendorTag({ id, name, link = true, className }: { id: number; name: string; link?: boolean; className?: string }) {
  const c = vendorColor(id);
  const inner = <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold whitespace-nowrap", c.bg, c.text, className)}>{name}</span>;
  return link ? <Link href={`/vendors/${id}`}>{inner}</Link> : inner;
}

export function VendorChips({
  vendors,
  counts,
  activeId,
  hrefFor,
  total,
  allHref,
}: {
  vendors: { id: number; name: string }[];
  counts: Record<number, number>;
  activeId?: number;
  hrefFor: (id: number) => string;
  total: number;
  allHref: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      <Link href={allHref} className={cn("chip", !activeId && "chip-active")}>
        全案件 <span className="font-bold">{total}</span>
      </Link>
      {vendors.map((v) => (
        <Link key={v.id} href={hrefFor(v.id)} className={cn("chip", activeId === v.id && "chip-active")}>
          <span className={cn("w-2.5 h-2.5 rounded-full", vendorColor(v.id).dot)} />
          {v.name} <span className="font-bold">{counts[v.id] ?? 0}</span>
        </Link>
      ))}
    </div>
  );
}
