"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertAdmin, assertUser } from "@/lib/auth";
import { recordHistory } from "@/lib/history";
import { notify, notifyAdmins } from "@/lib/notifications";
import { errorState, type ActionState } from "@/lib/action-state";
import { fmtDateTime, parseDateInput, parseDateTimeInput, str } from "@/lib/utils";
import type { ExecutionStatus, MeetingFormat } from "@prisma/client";
import { EXECUTION_LABEL } from "@/lib/labels";

function meetingData(formData: FormData) {
  const vendorId = Number(formData.get("vendorId"));
  const assigneeId = Number(formData.get("assigneeId"));
  if (!vendorId) throw new Error("ベンダーを選んでください");
  if (!assigneeId) throw new Error("商談担当者を選んでください");
  const format = (str(formData.get("format")) ?? "ONLINE") as MeetingFormat;
  return {
    vendorId,
    assigneeId,
    scheduledAt: parseDateTimeInput(formData.get("scheduledAt")),
    format,
    place: str(formData.get("place")),
    nextAction: str(formData.get("nextAction")),
    nextActionDue: parseDateInput(formData.get("nextActionDue")),
    requestNote: str(formData.get("requestNote")),
  };
}

function revalidateMeeting(id: number, vendorId: number) {
  revalidatePath("/meetings");
  revalidatePath("/meetings/calendar");
  revalidatePath(`/meetings/${id}`);
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/approvals");
  revalidatePath("/");
}

export async function createMeetingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let id: number;
  try {
    const user = await assertUser();
    const data = meetingData(formData);
    const executionStatus = (str(formData.get("executionStatus")) ?? "SCHEDULING") as ExecutionStatus;
    const m = await prisma.$transaction(async (tx) => {
      const created = await tx.vendorMeeting.create({
        data: { ...data, executionStatus, approvalStatus: "PENDING" },
        include: { vendor: true, assignee: true },
      });
      await recordHistory(tx, {
        entityType: "VENDOR_MEETING",
        entityId: created.id,
        field: "approvalStatus",
        fromValue: null,
        toValue: "PENDING",
        changedById: user.id,
      });
      return created;
    });
    id = m.id;
    await notifyAdmins({
      type: "APPROVAL_PENDING",
      title: `【承認待ち】${m.vendor.name} のベンダーMTG`,
      body: `${m.assignee.name} が登録 ／ ${m.scheduledAt ? fmtDateTime(m.scheduledAt) : "日時未定"}`,
      linkUrl: `/meetings/${m.id}`,
    });
    if (m.assigneeId !== user.id) {
      await notify({
        userId: m.assigneeId,
        type: "TASK_ASSIGNED",
        title: `【MTG担当】${m.vendor.name} のベンダーMTGが割り当てられました`,
        body: m.requestNote ?? m.nextAction ?? undefined,
        linkUrl: `/meetings/${m.id}`,
      });
    }
    revalidateMeeting(m.id, m.vendorId);
  } catch (e) {
    return errorState(e);
  }
  redirect(`/meetings/${id}`);
}

export async function updateMeetingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = Number(formData.get("id"));
  try {
    const user = await assertUser();
    const data = meetingData(formData);
    const before = await prisma.vendorMeeting.findUniqueOrThrow({ where: { id }, include: { vendor: true } });
    const resubmit = before.approvalStatus === "REJECTED";
    await prisma.$transaction(async (tx) => {
      await tx.vendorMeeting.update({
        where: { id },
        data: { ...data, ...(resubmit ? { approvalStatus: "PENDING", rejectReason: null } : {}) },
      });
      if (before.assigneeId !== data.assigneeId) {
        await recordHistory(tx, {
          entityType: "VENDOR_MEETING",
          entityId: id,
          field: "assigneeId",
          fromValue: String(before.assigneeId),
          toValue: String(data.assigneeId),
          changedById: user.id,
        });
      }
      if (resubmit) {
        await recordHistory(tx, {
          entityType: "VENDOR_MEETING",
          entityId: id,
          field: "approvalStatus",
          fromValue: "REJECTED",
          toValue: "PENDING",
          note: "修正して再申請",
          changedById: user.id,
        });
      }
    });
    if (resubmit) {
      await notifyAdmins({
        type: "APPROVAL_PENDING",
        title: `【再申請】${before.vendor.name} のベンダーMTG`,
        body: `${user.name} が修正して再申請しました`,
        linkUrl: `/meetings/${id}`,
      });
    }
    revalidateMeeting(id, before.vendorId);
  } catch (e) {
    return errorState(e);
  }
  redirect(`/meetings/${id}`);
}

/** 実施ステータス変更（カンバン・詳細から） */
export async function setExecutionStatusAction(formData: FormData) {
  const user = await assertUser();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status")) as ExecutionStatus;
  if (!(status in EXECUTION_LABEL)) throw new Error("不正なステータスです");
  const markVendorDone = formData.get("markVendorDone") === "on";
  const m = await prisma.vendorMeeting.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction(async (tx) => {
    await tx.vendorMeeting.update({
      where: { id },
      data: { executionStatus: status, ...(status === "DONE" && !m.doneAt ? { doneAt: new Date() } : {}) },
    });
    await recordHistory(tx, {
      entityType: "VENDOR_MEETING",
      entityId: id,
      field: "executionStatus",
      fromValue: m.executionStatus,
      toValue: status,
      changedById: user.id,
    });
    if (status === "DONE" && markVendorDone) {
      const v = await tx.vendor.findUniqueOrThrow({ where: { id: m.vendorId } });
      if (v.meetingStatus !== "DONE") {
        await tx.vendor.update({ where: { id: v.id }, data: { meetingStatus: "DONE" } });
        await recordHistory(tx, {
          entityType: "VENDOR",
          entityId: v.id,
          field: "meetingStatus",
          fromValue: v.meetingStatus,
          toValue: "DONE",
          note: `MTG #${id} 実施済に伴い更新`,
          changedById: user.id,
        });
      }
    }
  });
  revalidateMeeting(id, m.vendorId);
}

export async function saveMinutesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await assertUser();
    const id = Number(formData.get("id"));
    const m = await prisma.vendorMeeting.update({
      where: { id },
      data: {
        minutes: str(formData.get("minutes")),
        nextAction: str(formData.get("nextAction")),
        nextActionDue: parseDateInput(formData.get("nextActionDue")),
      },
    });
    revalidateMeeting(id, m.vendorId);
    return { success: "保存しました" };
  } catch (e) {
    return errorState(e);
  }
}

export async function approveMeetingAction(formData: FormData) {
  const admin = await assertAdmin();
  const id = Number(formData.get("id"));
  const m = await prisma.vendorMeeting.findUniqueOrThrow({ where: { id }, include: { vendor: true } });
  await prisma.$transaction(async (tx) => {
    await tx.vendorMeeting.update({ where: { id }, data: { approvalStatus: "APPROVED", rejectReason: null } });
    await recordHistory(tx, {
      entityType: "VENDOR_MEETING",
      entityId: id,
      field: "approvalStatus",
      fromValue: m.approvalStatus,
      toValue: "APPROVED",
      changedById: admin.id,
    });
  });
  await notify({
    userId: m.assigneeId,
    type: "APPROVED",
    title: `【承認済】${m.vendor.name} のベンダーMTGが承認されました`,
    linkUrl: `/meetings/${id}`,
  });
  revalidateMeeting(id, m.vendorId);
}

export async function rejectMeetingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin();
    const id = Number(formData.get("id"));
    const reason = str(formData.get("reason"));
    if (!reason) throw new Error("差し戻し理由を入力してください");
    const m = await prisma.vendorMeeting.findUniqueOrThrow({ where: { id }, include: { vendor: true } });
    await prisma.$transaction(async (tx) => {
      await tx.vendorMeeting.update({ where: { id }, data: { approvalStatus: "REJECTED", rejectReason: reason } });
      await recordHistory(tx, {
        entityType: "VENDOR_MEETING",
        entityId: id,
        field: "approvalStatus",
        fromValue: m.approvalStatus,
        toValue: "REJECTED",
        note: reason,
        changedById: admin.id,
      });
    });
    await notify({
      userId: m.assigneeId,
      type: "REJECTED",
      title: `【差し戻し】${m.vendor.name} のベンダーMTG`,
      body: `理由: ${reason}`,
      linkUrl: `/meetings/${id}`,
    });
    revalidateMeeting(id, m.vendorId);
    return { success: "差し戻しました" };
  } catch (e) {
    return errorState(e);
  }
}
