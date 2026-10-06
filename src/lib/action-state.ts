import { friendlyErrorMessage } from "./errors";

export type ActionState = { error?: string; success?: string } | undefined;

export function errorState(e: unknown): ActionState {
  return { error: friendlyErrorMessage(e) };
}
