"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import { errorState, type ActionState } from "@/lib/action-state";
import { num } from "@/lib/utils";

export async function saveGoalsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    const yearMonth = String(formData.get("yearMonth") ?? "");
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) throw new Error("対象月が不正です");

    // 全体目標
    const overall = await prisma.monthlyGoal.findFirst({ where: { yearMonth, userId: null } });
    const overallData = {
      meetingTarget: num(formData.get("meetingTarget")),
      referralTarget: num(formData.get("referralTarget")),
      rewardAccrualTarget: num(formData.get("rewardAccrualTarget")),
      rewardPaidTarget: num(formData.get("rewardPaidTarget")),
    };
    if (overall) await prisma.monthlyGoal.update({ where: { id: overall.id }, data: overallData });
    else await prisma.monthlyGoal.create({ data: { yearMonth, userId: null, ...overallData } });

    // 担当者別 MTG 目標
    const users = await prisma.user.findMany({ where: { isActive: true } });
    for (const u of users) {
      const v = formData.get(`user_${u.id}`);
      if (v === null) continue;
      const target = num(v);
      const existing = await prisma.monthlyGoal.findFirst({ where: { yearMonth, userId: u.id } });
      if (existing) await prisma.monthlyGoal.update({ where: { id: existing.id }, data: { meetingTarget: target } });
      else await prisma.monthlyGoal.create({ data: { yearMonth, userId: u.id, meetingTarget: target } });
    }
    revalidatePath("/goals");
    revalidatePath("/");
    return { success: "目標を保存しました" };
  } catch (e) {
    return errorState(e);
  }
}
