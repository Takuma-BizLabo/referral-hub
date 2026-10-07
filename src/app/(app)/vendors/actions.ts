"use server";
import { runWithFlash } from "@/lib/flash";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertUser } from "@/lib/auth";
import { recordHistory } from "@/lib/history";
import { errorState, type ActionState } from "@/lib/action-state";
import { httpUrl, money, str } from "@/lib/utils";
import type { VendorMeetingStatus } from "@prisma/client";

function vendorData(formData: FormData) {
  const name = str(formData.get("name"));
  if (!name) throw new Error("社名は必須です");
  return {
    name,
    contactName: str(formData.get("contactName")),
    contactEmail: str(formData.get("contactEmail")),
    contactPhone: str(formData.get("contactPhone")),
    serviceSummary: str(formData.get("serviceSummary")),
    referralFee: money(formData.get("referralFee")),
    saleshubUrl: httpUrl(str(formData.get("saleshubUrl")), "セールスハブ案件URL"),
    memo: str(formData.get("memo")),
  };
}

export async function createVendorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: number;
  try {
    await assertUser();
    const vendor = await prisma.vendor.create({ data: vendorData(formData) });
    id = vendor.id;
  } catch (e) {
    return errorState(e);
  }
  revalidatePath("/vendors");
  redirect(`/vendors/${id}`);
}

export async function updateVendorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = Number(formData.get("id"));
  try {
    await assertUser();
    await prisma.vendor.update({ where: { id }, data: vendorData(formData) });
  } catch (e) {
    return errorState(e);
  }
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
  redirect(`/vendors/${id}`);
}

/** ベンダーMTGの状態（未実施／実施済）を手動で切り替える */
export async function setVendorMeetingStatusAction(formData: FormData) {
  await runWithFlash(formData, async () => {
    const user = await assertUser();
    const id = Number(formData.get("id"));
    const status = String(formData.get("status")) as VendorMeetingStatus;
    if (status !== "DONE" && status !== "NOT_DONE" && status !== "NOT_REQUIRED") throw new Error("不正な値です");
    await prisma.$transaction(async (tx) => {
      const v = await tx.vendor.findUniqueOrThrow({ where: { id } });
      await tx.vendor.update({ where: { id }, data: { meetingStatus: status } });
      await recordHistory(tx, {
        entityType: "VENDOR",
        entityId: id,
        field: "meetingStatus",
        fromValue: v.meetingStatus,
        toValue: status,
        changedById: user.id,
      });
    });
    revalidatePath(`/vendors/${id}`);
    revalidatePath("/vendors");
    revalidatePath("/meetings", "layout");
    revalidatePath("/referrals", "layout");
  });
}

export async function toggleVendorActiveAction(formData: FormData) {
  await runWithFlash(formData, async () => {
    await assertUser();
    const id = Number(formData.get("id"));
    const v = await prisma.vendor.findUniqueOrThrow({ where: { id } });
    await prisma.vendor.update({ where: { id }, data: { isActive: !v.isActive } });
    revalidatePath(`/vendors/${id}`);
    revalidatePath("/vendors");
  });
}
