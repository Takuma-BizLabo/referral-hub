/**
 * 例外を画面に出せる日本語メッセージに変換する。
 * Prisma の例外は英語の技術的なメッセージなので、利用者向けの文言に置き換える。
 */
export function friendlyErrorMessage(e: unknown): string {
  if (e && typeof e === "object") {
    const name = (e as { name?: string }).name ?? "";
    const code = (e as { code?: string }).code;
    if (name === "PrismaClientKnownRequestError") {
      if (code === "P2025") return "対象のデータが見つかりません（削除された可能性があります）。画面を再読み込みしてください。";
      if (code === "P2002") return "同じ内容のデータが既に登録されています。";
      if (code === "P2003") return "関連するデータがあるため処理できません。";
      return "データベースの処理に失敗しました。時間をおいて再度お試しください。";
    }
    if (name === "PrismaClientInitializationError" || name === "PrismaClientRustPanicError" || name === "PrismaClientUnknownRequestError") {
      return "データベースに接続できませんでした。時間をおいて再度お試しください。";
    }
    if (name === "PrismaClientValidationError") return "入力内容に誤りがあります。";
  }
  if (e instanceof Error && e.message) return e.message;
  return "エラーが発生しました";
}

/** URL の ?error= に載せる既知のコード */
export const ERROR_CODE_MESSAGE: Record<string, string> = {
  forbidden: "その画面・操作は管理者のみ利用できます。",
};
