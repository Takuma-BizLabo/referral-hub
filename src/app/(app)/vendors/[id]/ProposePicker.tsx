"use client";
import { useMemo, useState } from "react";
import { proposeContactsAction } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { cn } from "@/lib/utils";

export type ProposeCandidate = { id: number; company: string | null; name: string; title: string | null; employeeSize: string | null; fee: string };

/** ベンダーに提案した人事を、まだ紹介していない繋がりから選んで追加する */
export function ProposePicker({ vendorId, candidates }: { vendorId: number; candidates: ProposeCandidate[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return candidates;
    return candidates.filter((c) => [c.company, c.name, c.title].some((v) => v?.toLowerCase().includes(t)));
  }, [q, candidates]);

  if (!open) {
    return (
      <button type="button" className="btn-primary btn-sm" onClick={() => setOpen(true)}>
        ＋ 提案した人事を追加
      </button>
    );
  }
  const toggle = (id: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <form action={proposeContactsAction} className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
      <input type="hidden" name="vendorId" value={vendorId} />
      <input type="hidden" name="returnTo" value={`/vendors/${vendorId}`} />
      {[...picked].map((id) => (
        <input key={id} type="hidden" name="contactId" value={id} />
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <input className="input flex-1 min-w-48" placeholder="会社名・氏名・役職で絞り込み" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <span className="text-xs text-gray-500">{list.length} 人</span>
      </div>
      <ul className="mt-2 max-h-80 overflow-y-auto divide-y divide-gray-100 rounded-md border border-gray-200 bg-white">
        {list.length === 0 && <li className="px-3 py-4 text-center text-sm text-gray-400">該当する繋がりがありません</li>}
        {list.map((c) => (
          <li key={c.id}>
            <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50", picked.has(c.id) && "bg-blue-50")}>
              <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-gray-900">{c.company ?? c.name}</span>
                <span className="block truncate text-xs text-gray-500">
                  {c.company ? c.name : ""}
                  {c.title ? ` ・ ${c.title}` : ""}
                  {c.employeeSize ? ` ・ ${c.employeeSize}` : ""}
                </span>
              </span>
              <span className={cn("shrink-0 text-xs", c.fee === "未定" ? "text-amber-700" : "text-gray-700")}>{c.fee}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SubmitButton className="btn-primary btn-sm" disabled={picked.size === 0} pendingText="追加中...">
          選んだ {picked.size} 人を提案に追加
        </SubmitButton>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => {
            setOpen(false);
            setPicked(new Set());
            setQ("");
          }}
        >
          閉じる
        </button>
        <span className="text-xs text-gray-500">報酬は単価表（なければベンダー単価）から自動で入ります</span>
      </div>
    </form>
  );
}
