"use client";
import { startTransition, useActionState, type FormEvent } from "react";

/**
 * useActionState の代わりに使う。React 19 はフォームの action 完了時に入力欄を初期値へ戻すため、
 * サーバー側の入力エラーで入力内容が消えてしまう。onSubmit で送信して自動リセットを避ける。
 *   const [state, action, pending, onSubmit] = useStickyAction(fn, undefined);
 *   <form action={action} onSubmit={onSubmit}> ... <SubmitButton pending={pending}>
 */
export function useStickyAction<S>(fn: (prev: Awaited<S>, formData: FormData) => S | Promise<S>, initial: Awaited<S>) {
  const [state, dispatch, pending] = useActionState(fn, initial);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return; // 二重送信防止
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(fd));
  };
  return [state, dispatch, pending, onSubmit] as const;
}
