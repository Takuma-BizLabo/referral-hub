/** 本文中の http(s) URL をリンクにする（新しいタブで開く）。サーバー・クライアントどちらからも使える */
export function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s<>"'）)」』]+)/g);
  return parts.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline break-all hover:text-blue-900">
        {p}
      </a>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}
