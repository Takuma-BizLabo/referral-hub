"use client";
import { useActionState } from "react";
import Link from "next/link";
import { createVendorAction, updateVendorAction } from "./actions";
import { ErrorMessage, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import type { Vendor } from "@prisma/client";

export function VendorForm({ vendor }: { vendor?: Vendor }) {
  const [state, action] = useActionState(vendor ? updateVendorAction : createVendorAction, undefined);
  return (
    <form action={action} className="card p-4 space-y-4 max-w-3xl">
      {vendor && <input type="hidden" name="id" value={vendor.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="社名" required className="sm:col-span-2">
          <input name="name" className="input" defaultValue={vendor?.name} required />
        </Field>
        <Field label="担当者名">
          <input name="contactName" className="input" defaultValue={vendor?.contactName ?? ""} />
        </Field>
        <Field label="紹介報酬単価（円）" required>
          <input name="referralFee" type="number" min={0} step={1000} className="input" defaultValue={vendor?.referralFee ?? 0} required />
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
        <Field label="メモ" className="sm:col-span-2">
          <textarea name="memo" className="input" rows={3} defaultValue={vendor?.memo ?? ""} />
        </Field>
      </div>
      <ErrorMessage message={state?.error} />
      <div className="flex gap-2">
        <SubmitButton>{vendor ? "保存" : "登録"}</SubmitButton>
        <Link href={vendor ? `/vendors/${vendor.id}` : "/vendors"} className="btn-secondary">
          キャンセル
        </Link>
      </div>
    </form>
  );
}
