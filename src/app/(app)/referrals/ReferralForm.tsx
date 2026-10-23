"use client";
import { useStickyAction } from "@/lib/use-sticky-action";
import { useMemo, useState } from "react";
import Link from "next/link";
import { createReferralAction, updateReferralAction } from "./actions";
import { ErrorMessage, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { toInputDate, toInputDateTime } from "@/lib/utils";
import type { Referral } from "@prisma/client";
import { MoneyInput } from "@/components/MoneyInput";
import { judgeFee, type FeeJudgement, type FeeRule } from "@/lib/fee-table";

type VendorOpt = { id: number; name: string; referralFee: number; meetingStatus: string; feeTable: FeeRule[] };
type ContactOpt = { id: number; name: string; company: string | null; title: string | null; employeeSize: string | null; relationMemo?: string | null };

/** ベンダーの単価表と繋がりの規模・役職から判定（単価表がない・未選択なら null） */
function judge(v: VendorOpt | undefined, c: ContactOpt | undefined): FeeJudgement | null {
  if (!v || !c || v.feeTable.length === 0) return null;
  return judgeFee(v.feeTable, c);
}

export function ReferralForm({
  referral,
  vendors,
  contacts,
  defaultVendorId,
  defaultContactId,
  defaultReward,
  defaultUndetermined,
  defaultPickupNote,
}: {
  referral?: Referral;
  vendors: VendorOpt[];
  contacts: ContactOpt[];
  defaultVendorId?: number;
  defaultContactId?: number;
  /** セールスハブの協力金など、ベンダー単価と異なる初期値 */
  defaultReward?: number;
  defaultUndetermined?: boolean;
  defaultPickupNote?: string;
}) {
  const [state, action, actionPending, actionSubmit] = useStickyAction(referral ? updateReferralAction : createReferralAction, undefined);
  const [vendorId, setVendorId] = useState<number | "">(referral?.vendorId ?? defaultVendorId ?? "");
  const [contactId, setContactId] = useState<number | "">(referral?.contactId ?? defaultContactId ?? "");
  const [filter, setFilter] = useState("");
  const initialJudgement = referral || defaultReward !== undefined || defaultUndetermined ? null : judge(vendors.find((x) => x.id === defaultVendorId), contacts.find((x) => x.id === defaultContactId));
  const [reward, setReward] = useState<string>(() => {
    if (referral) return String(referral.rewardAmount);
    if (defaultReward !== undefined) return String(defaultReward);
    if (initialJudgement) return initialJudgement.kind === "matched" ? String(initialJudgement.fee) : "";
    const v = vendors.find((x) => x.id === defaultVendorId);
    return v ? String(v.referralFee) : "";
  });
  const [undetermined, setUndetermined] = useState<boolean>(
    referral ? referral.rewardUndetermined : Boolean(defaultUndetermined) || (initialJudgement !== null && initialJudgement.kind !== "matched"),
  );
  const vendor = vendors.find((v) => v.id === vendorId);
  const contact = contacts.find((c) => c.id === contactId);
  const judgement = referral ? null : judge(vendor, contact);

  /** ベンダーか紹介先を選び直したら、単価表（なければベンダー単価）で報酬額を入れ直す */
  const applyFee = (v: VendorOpt | undefined, c: ContactOpt | undefined) => {
    const j = judge(v, c);
    if (j) {
      setReward(j.kind === "matched" ? String(j.fee) : "");
      setUndetermined(j.kind !== "matched");
    } else if (v) {
      setReward(String(v.referralFee));
      setUndetermined(false);
    }
  };

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return contacts.slice(0, 200);
    return contacts
      .filter((c) => [c.name, c.company, c.title].some((x) => (x ?? "").toLowerCase().includes(f)))
      .slice(0, 200);
  }, [contacts, filter]);

  return (
    <form action={action} onSubmit={actionSubmit} className="card p-4 space-y-4 max-w-3xl">
      {referral && <input type="hidden" name="id" value={referral.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {referral ? (
          <input type="hidden" name="vendorId" value={referral.vendorId} />
        ) : (
          <Field label="ベンダー" required hint={vendor ? `${vendor.feeTable.length ? "単価表あり" : `単価 ¥${vendor.referralFee.toLocaleString()}`} ／ MTG ${vendor.meetingStatus === "DONE" ? "実施済" : vendor.meetingStatus === "NOT_REQUIRED" ? "不要" : "未実施"}` : undefined}>
            <select
              name="vendorId"
              className="input"
              value={vendorId}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : "";
                setVendorId(id);
                applyFee(vendors.find((x) => x.id === id), contact);
              }}
              required
            >
              <option value="">選択してください</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {referral ? (
          <input type="hidden" name="contactId" value={referral.contactId} />
        ) : (
          <Field label="紹介先（繋がり）" required>
            <input type="hidden" name="contactId" value={contactId} />
            {contact ? (
              <div className="flex items-start justify-between gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2">
                <div className="min-w-0 text-sm">
                  <div className="text-[11px] font-medium text-blue-700">選択中</div>
                  <div className="font-medium text-gray-900">{contact.company ?? contact.name}</div>
                  <div className="text-xs text-gray-600">{[contact.company ? contact.name : null, contact.title, vendor?.feeTable.length ? contact.employeeSize : null].filter(Boolean).join(" ／ ")}</div>
                </div>
                <button type="button" className="btn-secondary btn-sm shrink-0" onClick={() => setContactId("")}>
                  変更
                </button>
              </div>
            ) : (
              <>
                <input className="input mb-1" placeholder="会社名・氏名で絞り込み" value={filter} onChange={(e) => setFilter(e.target.value)} />
                <ul className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100" role="listbox" aria-label="紹介先（繋がり）">
                  {filtered.length === 0 ? (
                    <li className="px-3 py-2 text-xs text-gray-400">該当する繋がりがありません</li>
                  ) : (
                    filtered.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={false}
                          className="block w-full px-3 py-1.5 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                          onClick={() => {
                            setContactId(c.id);
                            applyFee(vendor, c);
                          }}
                        >
                          <span className="block text-sm font-medium text-gray-900">{c.company ?? c.name}</span>
                          <span className="block text-xs text-gray-500">{[c.company ? c.name : null, c.title, vendor?.feeTable.length ? c.employeeSize : null].filter(Boolean).join(" ／ ")}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                {state?.error && !contactId && <p className="mt-1 text-xs text-rose-600">紹介先を選んでください</p>}
              </>
            )}
          </Field>
        )}
        <Field label="ピックアップ日">
          <input name="pickedUpAt" type="date" className="input" defaultValue={toInputDate(referral?.pickedUpAt ?? new Date())} />
        </Field>
        <Field label="報酬額（円）" hint={vendor?.feeTable.length ? "単価表から自動入力。変更可" : "ベンダー単価から自動入力。変更可"}>
          <MoneyInput name="rewardAmount" value={reward} onChange={setReward} />
          <label className="flex items-center gap-2 text-sm mt-2">
            <input type="checkbox" name="rewardUndetermined" checked={undetermined} onChange={(e) => setUndetermined(e.target.checked)} /> 単価未定（ベンダーに確認中）
          </label>
          {judgement && <FeeHint judgement={judgement} onPick={(fee) => { setReward(String(fee)); setUndetermined(false); }} />}
        </Field>
        <Field label="謝礼金（円）" hint="紹介先へのお礼。未定なら空欄">
          <MoneyInput name="thankYouFee" defaultValue={referral?.thankYouFee ?? ""} />
        </Field>
        <Field label="ピックアップ内容" className="sm:col-span-2" hint="セールスハブでベンダーが希望した相手の情報など">
          <textarea name="pickupNote" className="input" rows={2} defaultValue={referral?.pickupNote ?? defaultPickupNote ?? ""} />
        </Field>
        <Field label="面談日時">
          <input name="meetingAt" type="datetime-local" className="input" defaultValue={toInputDateTime(referral?.meetingAt ?? null)} />
        </Field>
        <Field label="面談形式">
          <select name="meetingFormat" className="input" defaultValue={referral?.meetingFormat ?? ""}>
            <option value="">未定</option>
            <option value="ONLINE">オンライン</option>
            <option value="VISIT">訪問</option>
          </select>
        </Field>
        <Field label="会議URL・場所" className="sm:col-span-2">
          <input name="meetingPlace" className="input" defaultValue={referral?.meetingPlace ?? ""} />
        </Field>
        {referral && (
          <Field label="面談結果メモ" className="sm:col-span-2">
            <textarea name="meetingResult" className="input" rows={3} defaultValue={referral?.meetingResult ?? ""} />
          </Field>
        )}
        <Field label="次アクション">
          <input name="nextAction" className="input" defaultValue={referral?.nextAction ?? ""} />
        </Field>
        <Field label="次アクション期限">
          <input name="nextActionDue" type="date" className="input" defaultValue={toInputDate(referral?.nextActionDue ?? null)} />
        </Field>
        <Field label="メモ" className="sm:col-span-2">
          <textarea name="memo" className="input" rows={2} defaultValue={referral?.memo ?? ""} />
        </Field>
      </div>
      <ErrorMessage message={state?.error} />
      {!referral && state?.error?.startsWith("重複") && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ignoreDuplicate" value="1" /> 重複を無視して登録
        </label>
      )}
      <div className="flex gap-2">
        <SubmitButton pending={actionPending}>{referral ? "保存" : "登録"}</SubmitButton>
        <Link href={referral ? `/referrals/${referral.id}` : "/referrals"} className="btn-secondary">
          キャンセル
        </Link>
      </div>
    </form>
  );
}

/** 単価表での判定結果（決まらないときは理由と候補の金額） */
function FeeHint({ judgement: j, onPick }: { judgement: FeeJudgement; onPick: (fee: number) => void }) {
  if (j.kind === "matched") {
    return <p className="text-xs text-emerald-700 mt-1.5">単価表：{j.reason} → ¥{j.fee.toLocaleString("ja-JP")}</p>;
  }
  return (
    <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mt-1.5 space-y-1">
      <p>
        単価表で決まりません：{j.reason}
        {j.kind === "outside" ? "。紹介する場合はベンダーに単価を確認してください" : ""}
      </p>
      {j.kind === "ambiguous" && (
        <div className="flex flex-wrap items-center gap-1">
          <span>規模を確かめて選ぶ：</span>
          {j.candidates.map((f) => (
            <button key={f} type="button" className="btn-secondary btn-sm" onClick={() => onPick(f)}>
              ¥{f.toLocaleString("ja-JP")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
