"use client";
import { startTransition, useActionState, type FormEvent } from "react";

/**
 * useActionState の代わりに使う。React 19 はフォームの action 完了時に入力欄を初期値へ戻すため、
 * サーバー側の入力エラーで入力内容が消えてしまう。onSubmit で送信して自動リセットを避ける。
 *   const [state, action, pending, onSubmit] = useStickyAction(fn, undefined);
 *   <form action={action} onSubmit={onSubmit}> ... <SubmitButton pending={pending}>
 */
export function useStickyAction<S>(fn: (prev: Awaited<S>, formData: FormData) => S | Promise<S>, initial: Awaited<S>) {
  // サーバーに届かない・拒否された場合（本文が1MBを超える、通信エラーなど）に、画面全体のエラー表示にせず
  // フォーム上にエラーを出す。redirect()・notFound() は Next が処理するのでそのまま投げ直す。
  const safe = async (prev: Awaited<S>, formData: FormData): Promise<Awaited<S>> => {
    try {
      return await fn(prev, formData);
    } catch (e) {
      const digest = (e as { digest?: unknown } | null)?.digest;
      if (typeof digest === "string" && /^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR)/.test(digest)) throw e;
      return { error: "送信できませんでした。入力内容が大きすぎる（1MBまで）か、通信に失敗した可能性があります。内容を確認してもう一度お試しください。" } as Awaited<S>;
    }
  };
  const [state, dispatch, pending] = useActionState(safe, initial);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return; // 二重送信防止
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(fd));
  };
  return [state, dispatch, pending, onSubmit] as const;
}
