"use client";
import { useEffect } from "react";

/** ルートレイアウト自体が失敗したとき用（CSS が読めない可能性があるためインラインスタイル） */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="ja">
      <body style={{ fontFamily: "-apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif", background: "#f4f6fa", color: "#1f2937", margin: 0 }}>
        <div style={{ maxWidth: 480, margin: "80px auto", padding: 24, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, margin: 0 }}>画面を表示できませんでした</h1>
          <p style={{ fontSize: 14, color: "#4b5563" }}>予期しないエラーが発生しました。もう一度お試しください。</p>
          {error.digest && <p style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>エラーID: {error.digest}</p>}
          <button type="button" onClick={() => reset()} style={{ background: "#2f5bff", color: "#fff", border: 0, borderRadius: 8, padding: "8px 16px", fontWeight: 600, cursor: "pointer" }}>
            再読み込み
          </button>
        </div>
      </body>
    </html>
  );
}
