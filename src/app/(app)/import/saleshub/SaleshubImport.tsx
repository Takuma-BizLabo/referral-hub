"use client";
import { useActionState, useState, useTransition } from "react";
import { analyzeSaleshubAction, registerSaleshubAction, type AnalyzeResult } from "./actions";
import { Card, ErrorMessage, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { fmtYen } from "@/lib/utils";

type Opt = { id: number; name: string };

const SAMPLE = `お世話になっております。松田と申します。

貴社がご紹介を希望されている企業に心当たりがあったため、ご連絡いたしました。

以下の企業の知り合いがいます。
株式会社エスプール / 人事部(課長クラス)

貴社サービスの詳細などを含め、打ち合わせにて詳細を伺いたいと考えています。
今週か来週あたりでお時間をいただけますでしょうか？

---
お世話になっております。CastingONEの大場です。
対象企業様はターゲット企業様となります。
まずは一度、サービス概要や事例などのご説明の時間をいただけますと幸いです。
お打ち合わせはオンラインを想定しています。`;

export function SaleshubImport({
  vendors,
  users,
  defaultAssigneeId,
}: {
  vendors: (Opt & { referralFee: number })[];
  users: Opt[];
  defaultAssigneeId: number;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [pending, start] = useTransition();
  const [state, action] = useActionState(registerSaleshubAction, undefined);
  const [vendorId, setVendorId] = useState<string>("");

  const analyze = () => {
    start(async () => {
      const r = await analyzeSaleshubAction(text);
      setResult(r);
      setVendorId(r.vendorMatch ? String(r.vendorMatch.id) : "");
    });
  };

  const selectedVendor = vendors.find((v) => String(v.id) === vendorId);
  const assigneeGuess = result?.parsed.senderName ? users.find((u) => u.name.includes(result.parsed.senderName!)) : undefined;

  return (
    <div className="space-y-4">
      <Card title="1. チャット本文を貼り付け">
        <textarea
          className="input font-normal"
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="セールスハブのチャット画面で、こちらの送信文とベンダーの返信をまとめてコピーして貼り付けてください"
        />
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn-primary" onClick={analyze} disabled={pending || !text.trim()}>
            {pending ? "解析中..." : "2. 解析する"}
          </button>
          <button className="btn-secondary" type="button" onClick={() => setText(SAMPLE)}>
            サンプルを入れる
          </button>
        </div>
      </Card>

      {result && (
        <form action={action} className="space-y-4">
          <input type="hidden" name="rawText" value={text} />
          <Card title="3. ベンダー（サービス提供企業）">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="既存ベンダーから選ぶ" hint={result.vendorMatch ? `「${result.vendorMatch.name}」が見つかりました` : "見つからない場合は右で新規登録"}>
                <select name="vendorId" className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                  <option value="">（新規登録する）</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}（単価 {fmtYen(v.referralFee)}）
                    </option>
                  ))}
                </select>
              </Field>
              {!vendorId && (
                <>
                  <Field label="ベンダー名（新規）" required>
                    <input name="vendorName" className="input" defaultValue={result.parsed.vendorName ?? ""} />
                  </Field>
                  <Field label="担当者名">
                    <input name="vendorContactName" className="input" defaultValue={result.parsed.vendorContactName ?? ""} />
                  </Field>
                  <Field label="紹介報酬単価（円）" hint="セールスハブの案件ページに記載の金額">
                    <input name="referralFee" type="number" min={0} step={1000} className="input" defaultValue={0} />
                  </Field>
                  <Field label="サービス概要" className="sm:col-span-2">
                    <input name="serviceSummary" className="input" />
                  </Field>
                </>
              )}
              <Field label="セールスハブ案件URL" className="sm:col-span-2">
                <input name="saleshubUrl" type="url" className="input" placeholder="https://saleshub.jp/..." />
              </Field>
            </div>
            {selectedVendor && (
              <p className="text-xs text-gray-500 mt-2">
                この単価で紹介案件が作成されます：<span className="font-semibold">{fmtYen(selectedVendor.referralFee)}</span>
                {result.vendorMatch?.meetingStatus === "DONE" ? "（ベンダーMTG 実施済）" : "（ベンダーMTG 未実施）"}
              </p>
            )}
          </Card>

          <Card title="4. 商談担当者へのMTGタスク">
            <label className="flex items-center gap-2 text-sm mb-3">
              <input type="checkbox" name="createMeeting" defaultChecked={result.parsed.wantsMeeting || true} /> ベンダーMTGを登録して担当者に割り当てる（管理者の承認待ちになります）
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="商談担当者" required hint={assigneeGuess ? `本文の名乗り「${result.parsed.senderName}」から推定` : undefined}>
                <select name="assigneeId" className="input" defaultValue={assigneeGuess?.id ?? defaultAssigneeId}>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="形式">
                <select name="format" className="input" defaultValue={result.parsed.format ?? "ONLINE"}>
                  <option value="ONLINE">オンライン</option>
                  <option value="VISIT">訪問</option>
                </select>
              </Field>
              <Field label="日時（決まっていれば）">
                <input name="scheduledAt" type="datetime-local" className="input" />
              </Field>
              <Field label="会議URL・場所">
                <input name="place" className="input" />
              </Field>
              <Field label="次アクション">
                <input name="nextAction" className="input" defaultValue={`ベンダーと日程調整（${result.parsed.dateHints[0] ?? "今週〜来週"}）`} />
              </Field>
              <Field label="次アクション期限">
                <input name="nextActionDue" type="date" className="input" />
              </Field>
              <Field label="ベンダーからの依頼内容（MTGに添付）" className="sm:col-span-2">
                <textarea
                  name="requestNote"
                  className="input"
                  rows={4}
                  defaultValue={[
                    result.parsed.candidates.length ? `ピックアップ：${result.parsed.candidates.map((c) => c.company + (c.dept ? " / " + c.dept : "")).join("、")}` : "",
                    result.parsed.agenda.length ? `確認事項：\n・${result.parsed.agenda.join("\n・")}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n\n")}
                />
              </Field>
            </div>
          </Card>

          <Card title="5. 紹介候補（繋がりリストとの突き合わせ）">
            {result.candidateMatches.length === 0 ? (
              <p className="text-sm text-gray-500">本文から企業名を抽出できませんでした。登録後、紹介案件画面から手動で追加できます。</p>
            ) : (
              <div className="space-y-3">
                {result.candidateMatches.map((c) => (
                  <div key={c.company} className="border border-gray-200 rounded-lg p-3">
                    <div className="text-sm font-semibold">
                      {c.company}
                      {c.dept && <span className="text-gray-500 font-normal ml-2">/ {c.dept}</span>}
                    </div>
                    {c.contacts.length === 0 ? (
                      <p className="text-xs text-amber-700 mt-1">繋がりリストに該当する会社がありません。先に繋がりを登録してください。</p>
                    ) : (
                      <div className="mt-2 space-y-1">
                        {c.contacts.map((ct) => (
                          <label key={ct.id} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" name="contactIds" value={ct.id} defaultChecked={c.contacts.length === 1 && !ct.referredBefore} />
                            <span>
                              {ct.name}
                              <span className="text-gray-500 text-xs ml-1">
                                {ct.company} {ct.title ? "/ " + ct.title : ""}
                              </span>
                            </span>
                            {ct.referredBefore && <span className="badge bg-amber-100 text-amber-800 border-amber-200">このベンダーに紹介済</span>}
                            {selectedVendor && <span className="text-xs text-gray-500 ml-auto">単価 {fmtYen(selectedVendor.referralFee)}</span>}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <Field label="ピックアップ内容（紹介案件に記録）">
                  <input name="pickupNote" className="input" defaultValue={result.parsed.candidates.map((c) => c.company + (c.dept ? " / " + c.dept : "")).join("、")} />
                </Field>
                <p className="text-xs text-gray-500">チェックした繋がりは「ピックアップ受付」の紹介案件として登録されます。ベンダーMTGが実施済になるまで「打診中」以降へは進められません。</p>
              </div>
            )}
          </Card>

          <ErrorMessage message={state?.error} />
          <SubmitButton className="btn-primary px-6 py-2.5">6. まとめて登録する</SubmitButton>
        </form>
      )}
    </div>
  );
}
