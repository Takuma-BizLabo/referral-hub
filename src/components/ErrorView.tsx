"use client";
import Link from "next/link";
import { useEffect } from "react";

/** error.tsx 共通の表示 */
export function ErrorView({ error, reset, compact }: { error: Error & { digest?: string }; reset: () => void; compact?: boolean }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  // 本番では Server Component の例外メッセージは伏せられるため、汎用の文言を出す
  const isDb = /prisma|database|ECONNREFUSED|connect/i.test(error.message ?? "");
  return (
    <div className={compact ? "py-10" : "min-h-screen flex items-center justify-center px-4 py-10"}>
      <div className="card max-w-lg w-full mx-auto p-6 text-center">
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-2xl font-bold">!</div>
        <h1 className="text-lg font-semibold text-gray-900">画面を表示できませんでした</h1>
        <p className="text-sm text-gray-600 mt-2">
          {isDb ? "データベースに接続できませんでした。少し時間をおいてから再度お試しください。" : "予期しないエラーが発生しました。もう一度お試しください。解決しない場合は管理者に連絡してください。"}
        </p>
        {error.digest && <p className="text-[11px] text-gray-400 mt-2 font-mono">エラーID: {error.digest}</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => reset()} className="btn-primary">
            再読み込み
          </button>
          <Link href="/" className="btn-secondary">
            ダッシュボードへ
          </Link>
        </div>
      </div>
    </div>
  );
}
