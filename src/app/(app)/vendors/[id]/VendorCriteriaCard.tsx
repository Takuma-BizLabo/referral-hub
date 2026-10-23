"use client";
import { useEffect, useState } from "react";
import { useStickyAction } from "@/lib/use-sticky-action";
import { saveVendorCriteriaAction } from "../actions";
import { ErrorMessage, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { TITLE_CLASSES } from "@/lib/title";
import { describeSet, setHasRules, setNameOf, type VendorCriteria } from "@/lib/candidates";
import { cn } from "@/lib/utils";

/** 入力中の1条件（入力欄はすべて文字列で持つ） */
type Draft = { label: string; min: string; max: string; newGrad: string; mid: string; classes: string[]; dept: string; industries: string; regions: string; note: string };

const emptyDraft = (): Draft => ({ label: "", min: "", max: "", newGrad: "", mid: "", classes: [], dept: "", industries: "", regions: "", note: "" });
const splitList = (s: string) =>
  s
    .split(/[、,，\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
const toNum = (s: string) => {
  const v = s.normalize("NFKC").replace(/[^\d]/g, "");
  return v === "" ? null : Number(v);
};

function toDrafts(vc: VendorCriteria): Draft[] {
  return vc.sets.map((s) => ({
    label: s.label ?? "",
    min: s.minEmployees != null ? String(s.minEmployees) : "",
    max: s.maxEmployees != null ? String(s.maxEmployees) : "",
    newGrad: s.minNewGrad != null ? String(s.minNewGrad) : "",
    mid: s.minMidCareer != null ? String(s.minMidCareer) : "",
    classes: s.classes ?? [],
    dept: s.dept ?? "",
    industries: (s.industries ?? []).join("、"),
    regions: (s.regions ?? []).join("、"),
    note: s.note ?? "",
  }));
}

function toJson(drafts: Draft[], exclude: string, excludeInd: string) {
  return JSON.stringify({
    sets: drafts.map((d) => ({
      label: d.label,
      minEmployees: toNum(d.min),
      maxEmployees: toNum(d.max),
      minNewGrad: toNum(d.newGrad),
      minMidCareer: toNum(d.mid),
      classes: d.classes,
      dept: d.dept,
      industries: splitList(d.industries),
      regions: splitList(d.regions),
      note: d.note,
    })),
    excludeCompanies: exclude
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean),
    excludeIndustries: splitList(excludeInd),
  });
}

/** ベンダー詳細の「紹介の条件」：条件をいくつでも追加でき、どれか1つに合う人事を候補ピックアップで上に出す */
export function VendorCriteriaCard({
  vendorId,
  criteria,
  wantedTarget,
  ngCompanies = [],
}: {
  vendorId: number;
  criteria: VendorCriteria;
  /** 先方希望ターゲット（先方から示された希望条件） */
  wantedTarget?: string | null;
  /** このベンダーが過去に NG を出した会社 */
  ngCompanies?: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>(() => toDrafts(criteria));
  const [exclude, setExclude] = useState(criteria.excludeCompanies.join("\n"));
  const [excludeInd, setExcludeInd] = useState((criteria.excludeIndustries ?? []).join("、"));
  const [wanted, setWanted] = useState(wantedTarget ?? "");
  const [state, action, pending, onSubmit] = useStickyAction(saveVendorCriteriaAction, undefined);

  // 保存できたら表示に戻す
  useEffect(() => {
    if (state?.success) setEditing(false);
  }, [state]);

  const startEdit = () => {
    setDrafts(criteria.sets.length ? toDrafts(criteria) : [emptyDraft()]);
    setExclude(criteria.excludeCompanies.join("\n"));
    setExcludeInd((criteria.excludeIndustries ?? []).join("、"));
    setWanted(wantedTarget ?? "");
    setEditing(true);
  };
  const update = (i: number, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  if (!editing) {
    return (
      <section id="vendor-criteria" className="card scroll-mt-20">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">先方希望ターゲット・紹介の条件（{criteria.sets.length}件）</h2>
          <button type="button" onClick={startEdit} className="btn-secondary btn-sm">
            {criteria.sets.length ? "条件を編集・追加" : "＋ 条件を追加"}
          </button>
        </div>
        <div className="p-4">
          {state?.success && <p className="mb-2 text-xs text-emerald-700">{state.success}</p>}
          <div className={cn("mb-3 rounded-lg border px-3 py-2", wantedTarget ? "border-amber-300 bg-amber-50" : "border-dashed border-gray-200")}>
            <div className="text-xs font-semibold text-amber-800">先方希望ターゲット</div>
            {wantedTarget ? (
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-900">{wantedTarget}</p>
            ) : (
              <p className="mt-0.5 text-xs text-gray-400">未入力（提案を断られたときなどに先方が示した希望条件を、「条件を編集・追加」から端的に入れてください）</p>
            )}
          </div>
          {(ngCompanies.length > 0 || criteria.excludeCompanies.length > 0 || !!criteria.excludeIndustries?.length) && (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
              <div className="font-semibold">NG確定（この会社・業種は提案しても通らない）</div>
              {ngCompanies.length > 0 && <div className="mt-0.5">過去にNG：{ngCompanies.join("、")}</div>}
              {!!criteria.excludeIndustries?.length && <div className="mt-0.5">除外する業種：{criteria.excludeIndustries.join("、")}</div>}
              {criteria.excludeCompanies.length > 0 && <div className="mt-0.5">除外する企業：{criteria.excludeCompanies.join("、")}</div>}
            </div>
          )}
          {criteria.sets.length === 0 && criteria.excludeCompanies.length === 0 && !criteria.excludeIndustries?.length ? (
            <p className="text-sm text-gray-500">まだ条件がありません。「＋ 条件を追加」で、紹介してほしい企業・人事の条件を入れると、下の「提案した人事を追加」で条件に合う人事が上に並びます。</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-gray-500">どれか1つの条件に合えば「条件に合う」として候補の上に並びます。</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {criteria.sets.map((s, i) => (
                  <li key={i} className="rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2 text-sm">
                    <div className="font-medium text-gray-800">{setNameOf(s, i)}</div>
                    {setHasRules(s) ? (
                      <div className="mt-0.5 text-xs text-gray-600">{describeSet(s).join(" ／ ")}</div>
                    ) : (
                      <div className="mt-0.5 text-xs text-gray-400">判定に使う項目なし（メモのみ）</div>
                    )}
                    {s.note && <div className="mt-1 whitespace-pre-wrap text-xs text-amber-800">{s.note}</div>}
                  </li>
                ))}
              </ul>
              {!!criteria.excludeIndustries?.length && (
                <p className="mt-2 text-xs text-gray-600">
                  <span className="text-gray-500">除外する業種：</span>
                  {criteria.excludeIndustries.join("、")}
                </p>
              )}
              {criteria.excludeCompanies.length > 0 && (
                <p className="mt-2 text-xs text-gray-600">
                  <span className="text-gray-500">除外する企業：</span>
                  {criteria.excludeCompanies.join("、")}
                </p>
              )}
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <form id="vendor-criteria" action={action} onSubmit={onSubmit} className="card scroll-mt-20">
      <input type="hidden" name="vendorId" value={vendorId} />
      <input type="hidden" name="criteriaJson" value={toJson(drafts, exclude, excludeInd)} />
      <input type="hidden" name="wantedTarget" value={wanted} />
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-800">紹介の条件を編集</h2>
        <p className="mt-0.5 text-xs text-gray-500">条件はいくつでも追加できます。どれか1つに合えば「条件に合う」になります。各条件の中の空の項目は問いません。</p>
      </div>
      <div className="space-y-3 p-4">
        <Field label="先方希望ターゲット" hint="先方から示された希望条件を端的に（例：従業員300名以上の製造業の人事部長。派遣会社はNG）">
          <textarea className="input" rows={2} value={wanted} onChange={(e) => setWanted(e.target.value)} />
        </Field>
        {drafts.map((d, i) => (
          <div key={i} className="rounded-lg border border-gray-200 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">条件{i + 1}</span>
              <input
                className="input max-w-72 py-1 text-sm"
                placeholder="名前（任意）例：大企業の人事部長"
                value={d.label}
                onChange={(e) => update(i, { label: e.target.value })}
              />
              <button type="button" onClick={() => setDrafts((ds) => [...ds.slice(0, i + 1), { ...d, label: "" }, ...ds.slice(i + 1)])} className="ml-auto text-xs text-gray-500 underline hover:text-gray-800">
                複製
              </button>
              <button type="button" onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))} className="text-xs text-rose-600 underline hover:text-rose-800">
                削除
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="従業員数（以上）">
                <input type="number" min={0} className="input" placeholder="例: 100" value={d.min} onChange={(e) => update(i, { min: e.target.value })} />
              </Field>
              <Field label="従業員数（未満）">
                <input type="number" min={0} className="input" placeholder="例: 1000" value={d.max} onChange={(e) => update(i, { max: e.target.value })} />
              </Field>
              <Field label="新卒採用（年間・以上）" hint="例: 20">
                <input type="number" min={0} className="input" placeholder="例: 20" value={d.newGrad} onChange={(e) => update(i, { newGrad: e.target.value })} />
              </Field>
              <Field label="中途採用（年間・以上）">
                <input type="number" min={0} className="input" placeholder="例: 10" value={d.mid} onChange={(e) => update(i, { mid: e.target.value })} />
              </Field>
              <Field label="役職クラス" className="sm:col-span-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                  {TITLE_CLASSES.map((c) => (
                    <label key={c} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={d.classes.includes(c)}
                        onChange={(e) => update(i, { classes: e.target.checked ? [...d.classes, c] : d.classes.filter((x) => x !== c) })}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="部署" hint="例: 人事">
                <input className="input" value={d.dept} onChange={(e) => update(i, { dept: e.target.value })} />
              </Field>
              <Field label="業種" hint="「、」区切りでどれか">
                <input className="input" placeholder="例: IT、人材" value={d.industries} onChange={(e) => update(i, { industries: e.target.value })} />
              </Field>
              <Field label="地域" hint="「、」区切りでどれか">
                <input className="input" placeholder="例: 東京都、大阪府" value={d.regions} onChange={(e) => update(i, { regions: e.target.value })} />
              </Field>
              <Field label="その他の条件・メモ" hint="判定には使わず表示だけ">
                <textarea className="input" rows={2} placeholder="例: 上場企業はNG、IT企業優先" value={d.note} onChange={(e) => update(i, { note: e.target.value })} />
              </Field>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setDrafts((ds) => [...ds, emptyDraft()])} className="btn-secondary btn-sm">
          ＋ 条件を追加
        </button>
        <Field label="除外する業種（全条件共通）" hint="「、」区切り。業種か会社名に含めば「合わない」（例: 派遣）">
          <input className="input" placeholder="例: 派遣" value={excludeInd} onChange={(e) => setExcludeInd(e.target.value)} />
        </Field>
        <Field label="除外する企業（NGリスト・全条件共通）" hint="1行に1社">
          <textarea className="input" rows={3} value={exclude} onChange={(e) => setExclude(e.target.value)} />
        </Field>
        <ErrorMessage message={state?.error} />
        <div className="flex gap-2">
          <SubmitButton pending={pending} pendingText="保存中...">
            保存
          </SubmitButton>
          <button type="button" onClick={() => setEditing(false)} className="btn-secondary">
            キャンセル
          </button>
        </div>
      </div>
    </form>
  );
}
