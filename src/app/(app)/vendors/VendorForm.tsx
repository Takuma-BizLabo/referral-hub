"use client";
import { useStickyAction } from "@/lib/use-sticky-action";

import Link from "next/link";
import { createVendorAction, updateVendorAction } from "./actions";
import { ErrorMessage, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import type { Vendor } from "@prisma/client";
import { MoneyInput } from "@/components/MoneyInput";
import { FeeTableEditor } from "./FeeTableEditor";
import { parseFeeTable } from "@/lib/fee-table";
import { parseCriteria } from "@/lib/candidates";
import { TITLE_CLASSES } from "@/lib/title";

export function VendorForm({ vendor }: { vendor?: Vendor }) {
  const cr = parseCriteria(vendor?.criteria);
  const [state, action, actionPending, actionSubmit] = useStickyAction(vendor ? updateVendorAction : createVendorAction, undefined);
  return (
    <form action={action} onSubmit={actionSubmit} className="card p-4 space-y-4 max-w-3xl">
      {vendor && <input type="hidden" name="id" value={vendor.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="社名" required className="sm:col-span-2">
          <input name="name" className="input" defaultValue={vendor?.name} required />
        </Field>
        <Field label="担当者名">
          <input name="contactName" className="input" defaultValue={vendor?.contactName ?? ""} />
        </Field>
        <Field label="紹介報酬単価（円）" required>
          <MoneyInput name="referralFee" defaultValue={vendor?.referralFee ?? 0} required />
        </Field>
        <Field label="メールアドレス">
          <input name="contactEmail" type="email" className="input" defaultValue={vendor?.contactEmail ?? ""} />
        </Field>
        <Field label="電話番号">
          <input name="contactPhone" className="input" defaultValue={vendor?.contactPhone ?? ""} />
        </Field>
        <Field label="セールスハブ案件URL" className="sm:col-span-2">
          <input name="saleshubUrl" type="url" className="input" placeholder="https://" defaultValue={vendor?.saleshubUrl ?? ""} />
        </Field>
        <Field label="サービス概要" className="sm:col-span-2">
          <textarea name="serviceSummary" className="input" rows={3} defaultValue={vendor?.serviceSummary ?? ""} />
        </Field>
        <Field label="お繋ぎの手順" className="sm:col-span-2" hint="紹介するときの流れ・注意点（事前確認、日程調整の方法など）">
          <textarea name="introSteps" className="input" rows={5} defaultValue={vendor?.introSteps ?? ""} />
        </Field>
        <Field label="お繋ぎ文章" className="sm:col-span-2" hint="紹介先へ送る文面。「〇〇様」は紹介案件の画面で紹介先の氏名に置き換わります">
          <textarea name="introMessage" className="input" rows={8} defaultValue={vendor?.introMessage ?? ""} />
        </Field>
        <Field label="単価表（従業員数×役職で協力金が変わる場合）" className="sm:col-span-2">
          <FeeTableEditor defaultRules={parseFeeTable(vendor?.feeTable)} />
        </Field>
        <div className="sm:col-span-2 rounded-lg border border-gray-200 p-3">
          <div className="mb-1 text-sm font-semibold text-gray-800">候補の条件（候補ピックアップに使う）</div>
          <p className="mb-3 text-xs text-gray-500">入れた条件と単価表に合う人事を、ベンダー詳細の「提案した人事を追加」で上に出します。空の項目は問いません。</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="従業員数（以上）">
              <input name="criteriaMin" type="number" min={0} className="input" placeholder="例: 100" defaultValue={cr.minEmployees ?? ""} />
            </Field>
            <Field label="従業員数（未満）">
              <input name="criteriaMax" type="number" min={0} className="input" placeholder="例: 1000" defaultValue={cr.maxEmployees ?? ""} />
            </Field>
            <Field label="役職クラス" className="sm:col-span-2">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                {TITLE_CLASSES.map((c) => (
                  <label key={c} className="flex items-center gap-1.5">
                    <input type="checkbox" name="criteriaClasses" value={c} defaultChecked={cr.classes?.includes(c)} /> {c}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="部署" hint="例: 人事">
              <input name="criteriaDept" className="input" defaultValue={cr.dept ?? ""} />
            </Field>
            <Field label="業種" hint="「、」区切りでどれか">
              <input name="criteriaIndustries" className="input" placeholder="例: IT、人材" defaultValue={cr.industries?.join("、") ?? ""} />
            </Field>
            <Field label="地域" hint="「、」区切りでどれか">
              <input name="criteriaRegions" className="input" placeholder="例: 東京都、大阪府" defaultValue={cr.regions?.join("、") ?? ""} />
            </Field>
            <Field label="除外する企業（NGリスト）" hint="1行に1社" className="sm:col-span-2">
              <textarea name="criteriaExclude" className="input" rows={3} defaultValue={cr.excludeCompanies?.join("\n") ?? ""} />
            </Field>
          </div>
        </div>
        <Field label="メモ" className="sm:col-span-2">
          <textarea name="memo" className="input" rows={3} defaultValue={vendor?.memo ?? ""} />
        </Field>
      </div>
      <ErrorMessage message={state?.error} />
      <div className="flex gap-2">
        <SubmitButton pending={actionPending}>{vendor ? "保存" : "登録"}</SubmitButton>
        <Link href={vendor ? `/vendors/${vendor.id}` : "/vendors"} className="btn-secondary">
          キャンセル
        </Link>
      </div>
    </form>
  );
}
