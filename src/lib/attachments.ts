/** タスク添付ファイルの制限と表示用ユーティリティ（サーバー・クライアント共用） */
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 1ファイル 10MB
export const MAX_FILES = 5; // 1タスク 5件
export const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 1回の送信 25MB

/** ブラウザで直接開いてよい（スクリプトを含まない）形式。これ以外は必ずダウンロード扱い */
export const INLINE_SAFE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "text/plain"];

export function isImageType(mime: string) {
  return ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(mime);
}

export function fmtBytes(n: number) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

export type AttachmentMeta = { id: number; filename: string; mimeType: string; size: number };

/** 一覧で読み込む列（本体の data は含めない） */
export const ATTACHMENT_META_SELECT = { id: true, filename: true, mimeType: true, size: true } as const;
