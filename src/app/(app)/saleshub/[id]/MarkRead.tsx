"use client";
import { useEffect } from "react";
import { markThreadReadAction } from "../actions";

/** 表示したら既読にする（未読がある場合のみ呼ぶ） */
export function MarkThreadRead({ threadId }: { threadId: number }) {
  useEffect(() => {
    markThreadReadAction(threadId).catch(() => {});
  }, [threadId]);
  return null;
}
