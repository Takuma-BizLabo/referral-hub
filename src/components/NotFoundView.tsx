import Link from "next/link";

export function NotFoundView({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? "py-10" : "min-h-screen flex items-center justify-center px-4 py-10"}>
      <div className="card max-w-lg w-full mx-auto p-6 text-center">
        <div className="text-4xl font-black text-gray-300">404</div>
        <h1 className="text-lg font-semibold text-gray-900 mt-2">ページが見つかりません</h1>
        <p className="text-sm text-gray-600 mt-2">URL が間違っているか、データが削除された可能性があります。</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn-primary">
            ダッシュボードへ
          </Link>
          <Link href="/meetings" className="btn-secondary">
            ベンダーMTG
          </Link>
          <Link href="/referrals" className="btn-secondary">
            紹介案件
          </Link>
        </div>
      </div>
    </div>
  );
}
