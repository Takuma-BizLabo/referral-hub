import type { ExecutionStatus } from "@prisma/client";
import { formatTargetAmount, formatTargetsTotal, type MeetingTarget } from "./meeting-targets";
import { fmtDate, fmtDateTime } from "./utils";
import { EXECUTION_LABEL } from "./labels";

/** LINE に貼って送るための、案件（ベンダーMTG）ごとの「次にやること」まとめ文 */
export type BriefInput = {
  id: number;
  vendorName: string;
  requestNote: string | null;
  executionStatus: ExecutionStatus;
  scheduledAt: Date | null;
  place: string | null;
  nextAction: string | null;
  nextActionDue: Date | null;
  minutes: string | null;
  fee: number | null;
  vendorFee: number;
  saleshubUrl: string | null;
  assigneeName: string;
  receivedCount: number; // ピックアップ受付のままの紹介案件数
};

function appUrl(path: string) {
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

function requestTitle(note: string | null) {
  const line = (note ?? "").split("\n").find((l) => l.startsWith("依頼:") || l.startsWith("依頼："));
  return line ? line.replace(/^依頼[:：]\s*/, "").trim() : null;
}

function saleshubLink(note: string | null, vendorUrl: string | null) {
  const m = (note ?? "").match(/https:\/\/saleshub\.jp\/proposals\/\d+/);
  return m ? m[0] : vendorUrl;
}

export function buildMeetingBrief(m: BriefInput, targets: MeetingTarget[], opts: { greeting?: boolean } = {}): string {
  const lines: string[] = [];
  const isUrl = (s: string | null) => !!s && /^https?:\/\//.test(s);
  const title = requestTitle(m.requestNote);
  const due = m.nextActionDue ? `（期限 ${fmtDate(m.nextActionDue)}）` : "";

  if (opts.greeting) lines.push(`${m.assigneeName.split(/\s/)[0]}さん`, "");
  lines.push(`■ ${m.vendorName}`);
  if (title) lines.push(`依頼：${title}`);
  lines.push(`状態：${EXECUTION_LABEL[m.executionStatus]}${m.scheduledAt && m.executionStatus !== "SCHEDULING" ? `（${fmtDateTime(m.scheduledAt)}）` : ""}`);
  lines.push("");

  // ---- 次にやること ----
  const todo: string[] = [];
  switch (m.executionStatus) {
    case "SCHEDULING":
    case "RESCHEDULE":
      if (isUrl(m.place)) todo.push(`日程調整：下記URLから候補日を予約して、セールスハブで日時を返信${due}\n   ${m.place}`);
      else todo.push(`日程調整：ベンダーと事前MTGの日程を調整して、セールスハブで返信${due}`);
      break;
    case "CONFIRMED":
      todo.push(`事前MTG実施：${m.scheduledAt ? fmtDateTime(m.scheduledAt) : "日時未定"}${isUrl(m.place) ? `\n   ${m.place}` : m.place ? `（${m.place}）` : ""}`);
      todo.push("MTGで確認：お繋ぎ先がターゲットか／単価（協力金）／紹介の進め方");
      break;
    case "DONE":
      if (!m.minutes) todo.push("議事メモをツールに入力（繋げる人物・単価の確認結果）");
      if (m.receivedCount > 0) todo.push(`お繋ぎ先 ${m.receivedCount} 件に打診する`);
      break;
    case "CANCELLED":
      todo.push("このMTGはキャンセル済み（対応不要）");
      break;
  }
  // 単価まわり
  const undetermined = targets.filter((t) => t.amount === null);
  if (undetermined.length) todo.push(`単価確認：${undetermined.map((t) => t.name).join("、")} の単価をベンダーに確認`);
  if (m.fee === null && m.vendorFee === 0 && targets.every((t) => t.amount === null || t.amount === 0)) todo.push("単価確認：この依頼の協力金が未登録。金額を確認して共有");
  if (targets.length === 0) todo.push("お繋ぎ先が未定：繋げる人物をベンダーと相談");
  // 個別の次アクション（自動文言と重複しないものだけ）
  if (m.nextAction && !/^(日程調整URLから|ベンダーと日程調整|MTGを実施し)/.test(m.nextAction)) todo.push(`${m.nextAction}${due}`);

  lines.push("▼次にやること");
  todo.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
  lines.push("");

  // ---- お繋ぎ先・単価 ----
  lines.push("▼お繋ぎ先・単価");
  if (targets.length) {
    for (const t of targets) lines.push(`・${t.name}（${formatTargetAmount(t.amount)}）`);
    lines.push(`合計：${formatTargetsTotal(targets, m.fee ?? m.vendorFee)}`);
  } else {
    lines.push(`・未定（依頼の協力金 ${m.fee !== null ? `¥${m.fee.toLocaleString()}` : m.vendorFee ? `¥${m.vendorFee.toLocaleString()}` : "未登録"}）`);
  }
  lines.push("");

  // ---- リンク ----
  const sh = saleshubLink(m.requestNote, m.saleshubUrl);
  if (sh) lines.push(`セールスハブ：${sh}`);
  lines.push(`ツール：${appUrl(`/meetings/${m.id}`)}`);
  return lines.join("\n");
}

/** 複数案件をまとめた文面 */
export function buildBulkBrief(assigneeName: string | null, briefs: string[]): string {
  const head = assigneeName ? [`${assigneeName.split(/\s/)[0]}さん`, `対応をお願いしたい案件が ${briefs.length} 件あります。`, ""] : [];
  return [...head, briefs.join("\n\n――――――――――\n\n")].join("\n");
}
