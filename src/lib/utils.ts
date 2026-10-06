import { format, isValid, parseISO } from "date-fns";
import { ja } from "date-fns/locale";

export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  if (!isValid(date)) return "-";
  return format(date, "yyyy/MM/dd(E) HH:mm", { locale: ja });
}

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  if (!isValid(date)) return "-";
  return format(date, "yyyy/MM/dd(E)", { locale: ja });
}

export function fmtMonthDay(d: Date | string | null | undefined) {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  if (!isValid(date)) return "-";
  return format(date, "M/d(E) HH:mm", { locale: ja });
}

/** 報酬額の表示（単価未定なら「未定」） */
export function fmtReward(n: number | null | undefined, undetermined?: boolean) {
  if (undetermined) return "未定";
  return fmtYen(n);
}

export function fmtYen(n: number | null | undefined) {
  if (n === null || n === undefined) return "-";
  return "¥" + n.toLocaleString("ja-JP");
}

/** <input type="datetime-local"> 用の値 */
export function toInputDateTime(d: Date | null | undefined) {
  if (!d) return "";
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

/** <input type="date"> 用の値 */
export function toInputDate(d: Date | null | undefined) {
  if (!d) return "";
  return format(d, "yyyy-MM-dd");
}

export function parseDateTimeInput(v: FormDataEntryValue | null): Date | null {
  if (!v || typeof v !== "string" || v.trim() === "") return null;
  const d = parseISO(v);
  return isValid(d) ? d : null;
}

export function parseDateInput(v: FormDataEntryValue | null): Date | null {
  if (!v || typeof v !== "string" || v.trim() === "") return null;
  const d = parseISO(v);
  return isValid(d) ? d : null;
}

export function str(v: FormDataEntryValue | null): string | null {
  if (v === null || typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function num(v: FormDataEntryValue | null, fallback = 0): number {
  if (v === null || typeof v !== "string" || v.trim() === "") return fallback;
  const n = Number(v.replace(/[,¥\s]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

export function int(v: FormDataEntryValue | null): number | null {
  if (v === null || typeof v !== "string" || v.trim() === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export function yearMonthOf(d: Date) {
  return format(d, "yyyy-MM");
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
