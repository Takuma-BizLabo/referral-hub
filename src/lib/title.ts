/**
 * 繋がりの役職は1つの欄に「部長クラス（経営企画Div. 人事チーム責任者）」の形で保存する。
 * クラス＝セールスハブに登録する区分、括弧内＝正確な役職。画面では2つに分けて表示・入力する。
 */
export const TITLE_CLASSES = ["代表取締役", "会長", "顧問", "役員・取締役クラス", "本部長クラス", "部長クラス", "課長クラス", "主任・係長クラス", "一般社員"] as const;

/** 正確な役職からクラスを推定する（セールスハブの区分で登録していない繋がり用） */
export function classFromDetail(detail: string): string | null {
  const s = detail.normalize("NFKC").replace(/\s/g, "");
  if (/副社長/.test(s)) return "役員・取締役クラス";
  if (/代表|社長|CEO/i.test(s)) return "代表取締役";
  if (/会長/.test(s)) return "会長";
  if (/顧問/.test(s)) return "顧問";
  if (/取締役|役員|CxO|CHRO|CTO|CFO|COO|VP/i.test(s)) return "役員・取締役クラス";
  if (/本部長/.test(s)) return "本部長クラス";
  if (/部長|室長|責任者|ゼネラルマネージャー|事業部長/.test(s) && !/副部長|部長代理/.test(s)) return "部長クラス";
  if (/課長|マネージャー|副部長|部長代理|次長/.test(s)) return "課長クラス";
  if (/主任|係長|リーダー/.test(s)) return "主任・係長クラス";
  return null;
}

/** 保存値をクラスと正確な役職に分ける */
export function splitTitle(title: string | null | undefined): { cls: string | null; detail: string | null } {
  const t = (title ?? "").trim();
  if (!t) return { cls: null, detail: null };
  const m = t.match(/^(.*?(?:クラス|一般社員|代表取締役|会長|顧問))\s*[（(](.*)[）)]\s*$/);
  if (m && (TITLE_CLASSES as readonly string[]).includes(m[1])) return { cls: m[1], detail: m[2].trim() || null };
  if ((TITLE_CLASSES as readonly string[]).includes(t)) return { cls: t, detail: null };
  // 「代表」「執行役員」など正確な役職だけが入っている
  return { cls: classFromDetail(t), detail: t };
}

/** クラスと正確な役職から保存値を作る */
export function joinTitle(cls: string | null, detail: string | null): string | null {
  const c = cls?.trim() || null;
  const d = detail?.trim() || null;
  if (c && d && d !== c) return `${c}（${d}）`;
  return c ?? d;
}
