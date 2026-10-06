export type ActionState = { error?: string; success?: string } | undefined;

export function errorState(e: unknown): ActionState {
  const message = e instanceof Error ? e.message : "エラーが発生しました";
  return { error: message };
}
