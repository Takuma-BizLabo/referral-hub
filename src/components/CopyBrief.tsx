"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 古いブラウザ・非HTTPS用のフォールバック
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

/** 一覧などに置く小さなコピーボタン */
export function CopyBriefButton({ text, label = "LINE用コピー", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={cn("btn-secondary btn-sm", done && "border-emerald-300 bg-emerald-50 text-emerald-800", className)}
      title="次にやること・単価をまとめた文面をコピー（LINEに貼り付けて送れます）"
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        }
      }}
    >
      {done ? "✓ コピーしました" : label}
    </button>
  );
}

/** 詳細画面用：プレビュー（編集可）＋コピー＋LINEで送る */
export function CopyBriefPanel({ text, taskHref }: { text: string; taskHref?: string }) {
  const [value, setValue] = useState(text);
  const [done, setDone] = useState(false);
  return (
    <div className="space-y-2">
      <textarea className="input font-mono text-xs leading-relaxed" rows={Math.min(18, value.split("\n").length + 1)} value={value} onChange={(e) => setValue(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn("btn-primary btn-sm", done && "bg-emerald-600 border-emerald-600")}
          onClick={async () => {
            if (await copyText(value)) {
              setDone(true);
              setTimeout(() => setDone(false), 1800);
            }
          }}
        >
          {done ? "✓ コピーしました" : "コピー"}
        </button>
        <a href={`https://line.me/R/share?text=${encodeURIComponent(value)}`} target="_blank" rel="noreferrer" className="btn-sm btn inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold bg-[#06C755] border-[#06C755] text-white hover:opacity-90">
          LINEで送る
        </a>
        {value !== text && (
          <button type="button" className="btn-secondary btn-sm" onClick={() => setValue(text)}>
            元に戻す
          </button>
        )}
        {taskHref && (
          <a href={taskHref} className="btn-secondary btn-sm">
            この内容でタスク依頼
          </a>
        )}
      </div>
      <p className="text-xs text-gray-500">文面は自由に書き換えてからコピーできます。「LINEで送る」はスマホ・PC の LINE で送り先を選ぶ画面が開きます。</p>
    </div>
  );
}
