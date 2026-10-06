"use server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { setSetting } from "@/lib/settings";
import { NOTIFICATION_TYPES } from "@/lib/labels";
import { errorState, type ActionState } from "@/lib/action-state";
import { num } from "@/lib/utils";

export async function saveThresholdsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    const stagnation = num(formData.get("stagnationDays"), 7);
    const hour = num(formData.get("dailyDigestHour"), 8);
    const minutesHours = num(formData.get("minutesMissingHours"), 24);
    if (!Number.isInteger(stagnation) || stagnation < 1 || stagnation > 90) throw new Error("停滞日数は1〜90の整数で指定してください");
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error("通知時刻は0〜23の整数で指定してください");
    if (!Number.isInteger(minutesHours) || minutesHours < 1 || minutesHours > 720) throw new Error("議事メモの猶予時間は1〜720の整数で指定してください");
    await setSetting("stagnationDays", String(stagnation));
    await setSetting("dailyDigestHour", String(hour));
    await setSetting("minutesMissingHours", String(minutesHours));
    for (const t of NOTIFICATION_TYPES) {
      await setSetting(`line.${t.key}`, formData.get(`line_${t.key}`) === "on" ? "1" : "0");
    }
    revalidatePath("/settings/thresholds");
    return { success: "保存しました" };
  } catch (e) {
    return errorState(e);
  }
}
