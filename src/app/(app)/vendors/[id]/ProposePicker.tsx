"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { proposeContactsAction } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { cn } from "@/lib/utils";

export type ProposeCandidate = {
  id: number;
  company: string | null;
  name: string;
  title: string | null;
  employeeSize: string | null;
  fee: string;
  /** 候補の条件・単価表に：match＝合う／maybe＝要確認（データ不足）／no＝合わない */
  level: "match" | "maybe" | "no";
  /** 合う理由・確認すること・合わない理由 */
  notes: string[];
  /** 返信が返ってこない人事（グレーアウト） */
  noReply: boolean;
};

const LEVEL_LABEL = { match: "条件に合う", maybe: "要確認", no: "合わない" } as const;
const LEVEL_BADGE = {
  match: "bg-emerald-50 text-emerald-800 border-emerald-200",
  maybe: "bg-amber-50 text-amber-800 border-amber-200",
  no: "bg-gray-100 text-gray-500 border-gray-200",
} as const;

/** ベンダーに提案する人事を、まだ紹介していない繋がりから選んで追加する（候補の条件に合う順） */
export function ProposePicker({
  vendorId,
  candidates,
  usesFilter,
  criteriaSummary,
}: {
  vendorId: number;
  candidates: ProposeCandidate[];
  usesFilter: boolean;
  criteriaSummary: string[];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"match" | "maybe" | "all">(usesFilter ? "match" : "all");
  const [hideNoReply, setHideNoReply] = useState(true);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const counts = useMemo(
    () => ({ match: candidates.filter((c) => c.level === "match").length, maybe: candidates.filter((c) => c.level === "maybe").length, all: candidates.length }),
    [candidates],
  );
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return candidates.filter(
      (c) =>
        (tab === "all" || c.level === tab) &&
        (!hideNoReply || !c.noReply) &&
        (!t || [c.company, c.name, c.title].some((v) => v?.toLowerCase().includes(t))),
    );
  }, [q, tab, hideNoReply, candidates]);
  const noReplyCount = candidates.filter((c) => c.noReply && (tab === "all" || c.level === tab)).length;

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary btn-sm" onClick={() => setOpen(true)}>
          ＋ 提案した人事を追加
        </button>
        {usesFilter && (
          <span className="text-xs text-gray-500">
            候補の条件に合う人事 <b className="text-emerald-700">{counts.match}</b> 人・要確認 {counts.maybe} 人
          </span>
        )}
      </div>
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
      <div className="mb-2 text-xs text-gray-600">
        {usesFilter ? (
          <>
            候補の条件：{criteriaSummary.join(" ／ ")}
            <Link href={`/vendors/${vendorId}/edit`} className="ml-2 text-blue-700 underline">
              条件を変える
            </Link>
          </>
        ) : (
          <>
            候補の条件が未設定のため、全員を表示しています。
            <Link href={`/vendors/${vendorId}/edit`} className="ml-1 text-blue-700 underline">
              条件を入れる
            </Link>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {usesFilter &&
          (["match", "maybe", "all"] as const).map((k) => (
            <button key={k} type="button" className={cn("chip", tab === k && "chip-active")} onClick={() => setTab(k)}>
              {k === "all" ? "すべて" : LEVEL_LABEL[k]}（{counts[k]}）
            </button>
          ))}
        <input className="input flex-1 min-w-48" placeholder="会社名・氏名・役職で絞り込み" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={hideNoReply} onChange={(e) => setHideNoReply(e.target.checked)} /> 返信なしを隠す{noReplyCount ? `（${noReplyCount}）` : ""}
        </label>
        <span className="text-xs text-gray-500">{list.length} 人</span>
      </div>
      <ul className="mt-2 max-h-96 overflow-y-auto divide-y divide-gray-100 rounded-md border border-gray-200 bg-white">
        {list.length === 0 && <li className="px-3 py-4 text-center text-sm text-gray-400">該当する繋がりがありません</li>}
        {list.map((c) => (
          <li key={c.id} className={cn(c.noReply && "bg-gray-50 opacity-60")}>
            <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50", picked.has(c.id) && "bg-blue-50")}>
              <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-medium text-gray-900">{c.company ?? c.name}</span>
                  {usesFilter && <span className={cn("badge shrink-0", LEVEL_BADGE[c.level])}>{LEVEL_LABEL[c.level]}</span>}
                  {c.noReply && <span className="badge shrink-0 bg-gray-200 text-gray-600 border-gray-300">返信なし</span>}
                </span>
                <span className="block truncate text-xs text-gray-500">
                  {c.company ? c.name : ""}
                  {c.title ? ` ・ ${c.title}` : ""}
                  {c.employeeSize ? ` ・ ${c.employeeSize}` : ""}
                </span>
                {usesFilter && c.notes.length > 0 && <span className="block truncate text-[11px] text-gray-400">{c.notes.join(" ／ ")}</span>}
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
