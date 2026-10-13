"use client";
import Link from "next/link";
import { useEffect } from "react";

/**
 * ツールを更新（デプロイ）した後、更新前に開いていた画面からボタンを押すと、
 * 押した操作が新しいサーバーに見つからずこのエラーになる。画面を読み込み直せば直る。
 */
function isStaleDeployment(error: Error) {
  return error.name === "UnrecognizedActionError" || /was not found on the server|older or newer deployment|Failed to find Server Action/i.test(error.message ?? "");
}

const RELOAD_KEY = "rh:stale-reload-at";

/** error.tsx 共通の表示 */
export function ErrorView({ error, compact }: { error: Error & { digest?: string }; reset: () => void; compact?: boolean }) {
  const stale = isStaleDeployment(error);
  useEffect(() => {
    console.error(error);
    if (!stale) return;
    // 自動で1回だけ読み込み直す（直後にまた起きた場合はループしないよう案内だけ出す）
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
      // sessionStorage が使えない環境でも読み込み直しは行う
    }
    if (Date.now() - last > 30_000) window.location.reload();
  }, [error, stale]);
  // 本番では Server Component の例外メッセージは伏せられるため、汎用の文言を出す
  const isDb = /prisma|database|ECONNREFUSED|connect/i.test(error.message ?? "");
  return (
    <div className={compact ? "py-10" : "min-h-screen flex items-center justify-center px-4 py-10"}>
      <div className="card max-w-lg w-full mx-auto p-6 text-center">
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-2xl font-bold">!</div>
        <h1 className="text-lg font-semibold text-gray-900">{stale ? "ツールが新しくなりました" : "画面を表示できませんでした"}</h1>
        <p className="text-sm text-gray-600 mt-2">
          {stale
            ? "画面を開いている間にツールが更新されたため、操作を受け付けられませんでした。画面を読み込み直しています。読み込み直した後、もう一度操作してください。"
            : isDb
              ? "データベースに接続できませんでした。少し時間をおいてから再度お試しください。"
              : "予期しないエラーが発生しました。もう一度お試しください。解決しない場合は管理者に連絡してください。"}
        </p>
        {error.digest && <p className="text-[11px] text-gray-400 mt-2 font-mono">エラーID: {error.digest}</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {/* 更新後の画面ずれも直るよう、画面ごと読み込み直す */}
          <button type="button" onClick={() => window.location.reload()} className="btn-primary">
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
