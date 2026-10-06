"use client";
import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { createReferralAction, updateReferralAction } from "./actions";
import { ErrorMessage, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { toInputDate, toInputDateTime } from "@/lib/utils";
import type { Referral } from "@prisma/client";

type VendorOpt = { id: number; name: string; referralFee: number; meetingStatus: string };
type ContactOpt = { id: number; name: string; company: string | null; title: string | null };

export function ReferralForm({
  referral,
  vendors,
  contacts,
  defaultVendorId,
  defaultContactId,
}: {
  referral?: Referral;
  vendors: VendorOpt[];
  contacts: ContactOpt[];
  defaultVendorId?: number;
  defaultContactId?: number;
}) {
  const [state, action] = useActionState(referral ? updateReferralAction : createReferralAction, undefined);
  const [vendorId, setVendorId] = useState<number | "">(referral?.vendorId ?? defaultVendorId ?? "");
  const [contactId, setContactId] = useState<number | "">(referral?.contactId ?? defaultContactId ?? "");
  const [filter, setFilter] = useState("");
  const [reward, setReward] = useState<string>(() => {
    if (referral) return String(referral.rewardAmount);
    const v = vendors.find((x) => x.id === defaultVendorId);
    return v ? String(v.referralFee) : "";
  });
  const vendor = vendors.find((v) => v.id === vendorId);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return contacts.slice(0, 200);
    return contacts
      .filter((c) => [c.name, c.company, c.title].some((x) => (x ?? "").toLowerCase().includes(f)))
      .slice(0, 200);
  }, [contacts, filter]);

  return (
    <form action={action} className="card p-4 space-y-4 max-w-3xl">
      {referral && <input type="hidden" name="id" value={referral.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {referral ? (
          <input type="hidden" name="vendorId" value={referral.vendorId} />
        ) : (
          <Field label="ベンダー" required hint={vendor ? `単価 ¥${vendor.referralFee.toLocaleString()} ／ MTG ${vendor.meetingStatus === "DONE" ? "実施済" : "未実施"}` : undefined}>
            <select
              name="vendorId"
              className="input"
              value={vendorId}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : "";
                setVendorId(id);
                const v = vendors.find((x) => x.id === id);
                if (v && (reward === "" || reward === String(vendor?.referralFee ?? ""))) setReward(String(v.referralFee));
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
            <input className="input mb-1" placeholder="氏名・会社名で絞り込み" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <select name="contactId" className="input" value={contactId} onChange={(e) => setContactId(e.target.value ? Number(e.target.value) : "")} required size={5}>
              {filtered.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.company ? `（${c.company}${c.title ? " / " + c.title : ""}）` : ""}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="ピックアップ日">
          <input name="pickedUpAt" type="date" className="input" defaultValue={toInputDate(referral?.pickedUpAt ?? new Date())} />
        </Field>
        <Field label="報酬額（円）" hint="ベンダー単価から自動入力。変更可">
          <input name="rewardAmount" type="number" min={0} step={1000} className="input" value={reward} onChange={(e) => setReward(e.target.value)} />
        </Field>
        <Field label="ピックアップ内容" className="sm:col-span-2" hint="セールスハブでベンダーが希望した相手の情報など">
          <textarea name="pickupNote" className="input" rows={2} defaultValue={referral?.pickupNote ?? ""} />
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
        <SubmitButton>{referral ? "保存" : "登録"}</SubmitButton>
        <Link href={referral ? `/referrals/${referral.id}` : "/referrals"} className="btn-secondary">
          キャンセル
        </Link>
      </div>
    </form>
  );
}
