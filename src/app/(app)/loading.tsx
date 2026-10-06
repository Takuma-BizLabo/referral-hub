/** 画面遷移中のスケルトン（サイドバーはそのまま、本文だけ差し替え） */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="読み込み中">
      <div className="space-y-2">
        <div className="h-6 w-48 rounded bg-gray-200" />
        <div className="h-4 w-72 max-w-full rounded bg-gray-100" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-24 rounded-full bg-gray-200" />
        <div className="h-8 w-28 rounded-full bg-gray-100" />
        <div className="h-8 w-20 rounded-full bg-gray-100" />
      </div>
      <div className="card p-4 space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className="h-4 flex-1 rounded bg-gray-100" />
            <div className="hidden sm:block h-4 w-20 rounded bg-gray-100" />
          </div>
        ))}
      </div>
      <span className="sr-only">読み込み中...</span>
    </div>
  );
}
