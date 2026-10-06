"use client";
import { useActionState } from "react";
import Link from "next/link";
import { createContactAction, updateContactAction } from "./actions";
import { ErrorMessage, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import type { Contact } from "@prisma/client";

export function ContactForm({
  contact,
  tags,
  allTags,
}: {
  contact?: Contact;
  tags?: string[];
  allTags: string[];
}) {
  const [state, action] = useActionState(contact ? updateContactAction : createContactAction, undefined);
  return (
    <form action={action} className="card p-4 space-y-4 max-w-3xl">
      {contact && <input type="hidden" name="id" value={contact.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="氏名" required>
          <input name="name" className="input" defaultValue={contact?.name} required />
        </Field>
        <Field label="会社名">
          <input name="company" className="input" defaultValue={contact?.company ?? ""} />
        </Field>
        <Field label="役職">
          <input name="title" className="input" defaultValue={contact?.title ?? ""} />
        </Field>
        <Field label="業種">
          <input name="industry" className="input" defaultValue={contact?.industry ?? ""} />
        </Field>
        <Field label="従業員規模">
          <input name="employeeSize" className="input" placeholder="例: 50〜100名" defaultValue={contact?.employeeSize ?? ""} />
        </Field>
        <Field label="地域">
          <input name="region" className="input" placeholder="例: 東京" defaultValue={contact?.region ?? ""} />
        </Field>
        <Field label="メール">
          <input name="email" type="email" className="input" defaultValue={contact?.email ?? ""} />
        </Field>
        <Field label="電話">
          <input name="phone" className="input" defaultValue={contact?.phone ?? ""} />
        </Field>
        <Field label="その他連絡先" className="sm:col-span-2" hint="LINE、Facebook など">
          <input name="otherContact" className="input" defaultValue={contact?.otherContact ?? ""} />
        </Field>
        <Field label="タグ" className="sm:col-span-2" hint="カンマ区切りで複数指定できます">
          <input name="tags" className="input" list="tag-options" defaultValue={tags?.join(", ") ?? ""} />
          <datalist id="tag-options">
            {allTags.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="isOnSaleshub" defaultChecked={contact?.isOnSaleshub ?? false} /> セールスハブに登録済み
        </label>
        <Field label="関係性メモ" className="sm:col-span-2">
          <textarea name="relationMemo" className="input" rows={3} defaultValue={contact?.relationMemo ?? ""} />
        </Field>
      </div>
      <ErrorMessage message={state?.error} />
      {!contact && state?.error?.startsWith("重複") && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ignoreDuplicate" value="1" /> 重複を無視して登録
        </label>
      )}
      <div className="flex gap-2">
        <SubmitButton>{contact ? "保存" : "登録"}</SubmitButton>
        <Link href={contact ? `/contacts/${contact.id}` : "/contacts"} className="btn-secondary">
          キャンセル
        </Link>
      </div>
    </form>
  );
}
