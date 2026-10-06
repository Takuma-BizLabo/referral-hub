"use server";
import { runWithFlash } from "@/lib/flash";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { assertAdmin } from "@/lib/auth";
import { setSetting } from "@/lib/settings";
import { errorState, type ActionState } from "@/lib/action-state";
import { str } from "@/lib/utils";

export async function issueIngestTokenAction() {
  await runWithFlash(null, async () => {
    await assertAdmin();
    await setSetting("saleshub.ingestToken", randomBytes(24).toString("base64url"));
    await setSetting("saleshub.enabled", "1");
    revalidatePath("/settings/saleshub");
  });
}

export async function saveSaleshubSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    await setSetting("saleshub.enabled", formData.get("enabled") === "on" ? "1" : "0");
    await setSetting("saleshub.schedulerUserId", str(formData.get("schedulerUserId")) ?? "");
    const stale = Number(formData.get("staleMinutes") ?? 120);
    await setSetting("saleshubStaleMinutes", String(Number.isFinite(stale) && stale >= 10 ? stale : 120));
    revalidatePath("/settings/saleshub");
    return { success: "保存しました" };
  } catch (e) {
    return errorState(e);
  }
}

export async function rebuildCandidatesAction() {
  await runWithFlash(null, async () => {
    await assertAdmin();
    const { rebuildCandidates } = await import("@/lib/saleshub/rules");
    const r = await rebuildCandidates();
    await setSetting("saleshub.lastRebuild", `${new Date().toISOString()}|${r.threads}|${r.created}|${r.unmatched.slice(0, 20).join("、")}`);
    revalidatePath("/settings/saleshub");
    revalidatePath("/referrals");
  });
}
