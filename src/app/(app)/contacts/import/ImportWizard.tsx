"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Papa from "papaparse";
import Encoding from "encoding-japanese";
import { CONTACT_FIELDS, type ContactFieldKey } from "@/lib/contacts";
import { checkDuplicatesAction, importContactsAction, type DuplicateInfo, type ImportDecision, type ImportRow } from "../actions";
import { Card, ErrorMessage } from "@/components/ui";

const SYNONYMS: Record<ContactFieldKey, string[]> = {
  name: ["氏名", "名前", "お名前", "担当者名", "name", "姓名", "決裁者名"],
  company: ["会社名", "企業名", "社名", "法人名", "company", "勤務先"],
  title: ["役職", "肩書", "役職名", "title", "position"],
  industry: ["業種", "業界", "industry"],
  employeeSize: ["従業員規模", "従業員数", "規模", "社員数", "employees"],
  region: ["地域", "都道府県", "エリア", "所在地", "region", "住所"],
  email: ["メール", "メールアドレス", "email", "e-mail", "mail"],
  phone: ["電話", "電話番号", "tel", "phone", "携帯"],
  otherContact: ["その他連絡先", "連絡先", "line", "sns", "facebook"],
  isOnSaleshub: ["セールスハブ", "セールスハブ登録", "saleshub", "sh登録"],
  relationMemo: ["関係性", "関係性メモ", "メモ", "備考", "memo", "note", "関係"],
  tags: ["タグ", "tags", "tag", "分類"],
};

function guessMapping(headers: string[]): Partial<Record<ContactFieldKey, string>> {
  const m: Partial<Record<ContactFieldKey, string>> = {};
  for (const f of CONTACT_FIELDS) {
    const hit = headers.find((h) => {
      const hl = h.trim().toLowerCase();
      return SYNONYMS[f.key].some((s) => hl === s.toLowerCase() || hl.includes(s.toLowerCase()));
    });
    if (hit && !Object.values(m).includes(hit)) m[f.key] = hit;
  }
  return m;
}

function decodeFile(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const detected = Encoding.detect(bytes);
  const enc = detected && detected !== "BINARY" ? detected : "UTF8";
  const unicode = Encoding.convert(bytes, { to: "UNICODE", from: enc as Encoding.Encoding });
  return Encoding.codeToString(unicode).replace(/^﻿/, "");
}

export function ImportWizard() {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [raw, setRaw] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<ContactFieldKey, string>>>({});
  const [dups, setDups] = useState<DuplicateInfo[] | null>(null);
  const [decisions, setDecisions] = useState<Record<number, ImportDecision>>({});
  const [result, setResult] = useState<Awaited<ReturnType<typeof importContactsAction>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const rows: ImportRow[] = useMemo(
    () =>
      raw.map((r) => {
        const out: ImportRow = {};
        for (const f of CONTACT_FIELDS) {
          const col = mapping[f.key];
          out[f.key] = col ? (r[col] ?? "") : "";
        }
        return out;
      }),
    [raw, mapping],
  );

  const onFile = async (file: File | undefined) => {
    setError(null);
    setDups(null);
    setResult(null);
    if (!file) return;
    setFileName(file.name);
    const text = decodeFile(await file.arrayBuffer());
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    if (parsed.errors.length && parsed.data.length === 0) {
      setError("CSVを読み込めませんでした: " + parsed.errors[0].message);
      return;
    }
    const hs = (parsed.meta.fields ?? []).filter((h) => h && h.trim() !== "");
    setHeaders(hs);
    setRaw(parsed.data);
    setMapping(guessMapping(hs));
  };

  const runCheck = () => {
    setError(null);
    if (!mapping.name) {
      setError("「氏名」に対応する列を選んでください");
      return;
    }
    start(async () => {
      try {
        const d = await checkDuplicatesAction(rows);
        setDups(d);
        const init: Record<number, ImportDecision> = {};
        for (const x of d) init[x.index] = "skip";
        setDecisions(init);
      } catch (e) {
        setError(`重複の確認に失敗しました。${e instanceof Error ? e.message : ""}（ファイルが大きすぎる場合は分割してください）`);
      }
    });
  };

  const runImport = () => {
    start(async () => {
      try {
        const decs = (dups ?? []).map((d) => ({ index: d.index, decision: decisions[d.index] ?? "skip", existingId: d.existingId }));
        const r = await importContactsAction(rows, decs);
        setResult(r);
      } catch (e) {
        setError(`取込に失敗しました。${e instanceof Error ? e.message : ""}（ファイルが大きすぎる場合は分割してください）`);
      }
    });
  };

  if (result) {
    return (
      <Card title="取込結果">
        <ul className="text-sm space-y-1">
          <li>新規登録: {result.created} 件</li>
          <li>上書き更新: {result.updated} 件</li>
          <li>スキップ: {result.skipped} 件</li>
        </ul>
        {result.errors.length > 0 && (
          <div className="mt-3">
            <ErrorMessage message={`エラー ${result.errors.length} 件`} />
            <ul className="text-xs text-rose-700 mt-1 list-disc pl-5">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Link href="/contacts" className="btn-primary">
            繋がりリストへ
          </Link>
          <button className="btn-secondary" onClick={() => window.location.reload()}>
            続けて取り込む
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card title="1. CSVファイルを選択">
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="text-sm" />
        {fileName && (
          <p className="text-xs text-gray-500 mt-2">
            {fileName}：{raw.length} 行、{headers.length} 列
          </p>
        )}
        <p className="text-xs text-gray-400 mt-2">
          1行目を見出し行として扱います。文字コードは自動判定（UTF-8 / Shift_JIS）。
        </p>
      </Card>

      {headers.length > 0 && (
        <Card title="2. 列の対応付け">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CONTACT_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="label">
                  {f.label}
                  {"required" in f && f.required && <span className="text-rose-500 ml-0.5">*</span>}
                </label>
                <select
                  className="input"
                  value={mapping[f.key] ?? ""}
                  onChange={(e) => {
                    setDups(null);
                    setMapping({ ...mapping, [f.key]: e.target.value || undefined });
                  }}
                >
                  <option value="">（取り込まない）</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <h3 className="text-xs font-medium text-gray-600 mt-5 mb-2">プレビュー（先頭5行）</h3>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  {CONTACT_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                    <th key={f.key}>{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    {CONTACT_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                      <td key={f.key} className="max-w-48 truncate">
                        {r[f.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ErrorMessage message={dups ? null : error} />
          <div className="mt-4">
            <button className="btn-primary" onClick={runCheck} disabled={pending}>
              {pending && !dups ? "確認中..." : "3. 重複を確認する"}
            </button>
          </div>
        </Card>
      )}

      {dups && (
        <Card title={`3. 重複の確認（${dups.length} 件）`}>
          {dups.length === 0 ? (
            <p className="text-sm text-gray-600">重複はありませんでした。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>行</th>
                    <th>CSVの内容</th>
                    <th>既存の繋がり</th>
                    <th>一致理由</th>
                    <th>処理</th>
                  </tr>
                </thead>
                <tbody>
                  {dups.map((d) => (
                    <tr key={d.index}>
                      <td>{d.index + 1}</td>
                      <td>
                        {rows[d.index].name}（{rows[d.index].company || "会社不明"}）
                      </td>
                      <td>{d.existingLabel}</td>
                      <td className="text-xs">{d.reason}</td>
                      <td>
                        <select
                          className="input"
                          value={decisions[d.index] ?? "skip"}
                          onChange={(e) => setDecisions({ ...decisions, [d.index]: e.target.value as ImportDecision })}
                        >
                          <option value="skip">スキップ（既存を残す）</option>
                          <option value="overwrite">上書き（既存を更新）</option>
                          <option value="create">両方登録（別人として追加）</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <ErrorMessage message={dups ? error : null} />
          <div className="mt-4 flex items-center gap-3">
            <button className="btn-primary" onClick={runImport} disabled={pending}>
              {pending ? "取込中..." : `4. ${rows.length} 行を取り込む`}
            </button>
            <span className="text-xs text-gray-500">重複以外の行はすべて新規登録されます</span>
          </div>
        </Card>
      )}
    </div>
  );
}
