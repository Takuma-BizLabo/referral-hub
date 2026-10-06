"use server";
import { runWithFlash } from "@/lib/flash";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertUser } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { errorState, type ActionState } from "@/lib/action-state";
import { fmtDate, parseDateInput, str } from "@/lib/utils";

function revalidateTasks() {
  revalidatePath("/tasks");
  revalidatePath("/", "layout");
}

export async function createTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const me = await assertUser();
    const title = str(formData.get("title"));
    const assigneeId = Number(formData.get("assigneeId"));
    if (!title) throw new Error("タイトルを入力してください");
    if (!assigneeId) throw new Error("宛先を選んでください");
    const assignee = await prisma.user.findFirst({ where: { id: assigneeId, isActive: true } });
    if (!assignee) throw new Error("宛先のユーザーが見つかりません");
    const task = await prisma.task.create({
      data: {
        title,
        body: str(formData.get("body")),
        requesterId: me.id,
        assigneeId,
        important: formData.get("important") === "on",
        dueDate: parseDateInput(formData.get("dueDate")),
        linkUrl: str(formData.get("linkUrl")),
      },
    });
    if (assigneeId !== me.id) {
      await notify({
        userId: assigneeId,
        type: "TASK_ASSIGNED",
        title: `【タスク依頼】${me.name} → ${task.title}`,
        body: [task.body?.slice(0, 200), task.dueDate ? `期限: ${fmtDate(task.dueDate)}` : null].filter(Boolean).join("\n"),
        linkUrl: `/tasks?focus=${task.id}`,
      });
    }
    revalidateTasks();
    return { success: `${assignee.name} さんにタスクを依頼しました` };
  } catch (e) {
    return errorState(e);
  }
}

export async function completeTaskAction(formData: FormData) {
  await runWithFlash(formData, async () => {
    const me = await assertUser();
    const id = Number(formData.get("id"));
    const comment = str(formData.get("comment"));
    const task = await prisma.task.findUniqueOrThrow({ where: { id }, include: { requester: true, assignee: true } });
    if (task.assigneeId !== me.id && task.requesterId !== me.id && me.role !== "ADMIN") throw new Error("このタスクを完了にする権限がありません");
    if (task.status === "DONE") return;
    await prisma.task.update({ where: { id }, data: { status: "DONE", doneAt: new Date(), doneComment: comment } });
    if (task.requesterId !== me.id) {
      await notify({
        userId: task.requesterId,
        type: "TASK_DONE",
        title: `【完了】${me.name} がタスクを完了: ${task.title}`,
        body: comment ?? undefined,
        linkUrl: `/tasks?tab=requested&focus=${task.id}`,
      });
    }
    revalidateTasks();
  });
}

export async function reopenTaskAction(formData: FormData) {
  await runWithFlash(formData, async () => {
    const me = await assertUser();
    const id = Number(formData.get("id"));
    const task = await prisma.task.findUniqueOrThrow({ where: { id } });
    if (task.assigneeId !== me.id && task.requesterId !== me.id && me.role !== "ADMIN") throw new Error("権限がありません");
    await prisma.task.update({ where: { id }, data: { status: "OPEN", doneAt: null, doneComment: null } });
    if (task.assigneeId !== me.id) {
      await notify({ userId: task.assigneeId, type: "TASK_ASSIGNED", title: `【再開】${me.name} がタスクを未完了に戻しました: ${task.title}`, linkUrl: `/tasks?focus=${task.id}` });
    }
    revalidateTasks();
  });
}

export async function deleteTaskAction(formData: FormData) {
  await runWithFlash(formData, async () => {
    const me = await assertUser();
    const id = Number(formData.get("id"));
    const task = await prisma.task.findUniqueOrThrow({ where: { id } });
    if (task.requesterId !== me.id && me.role !== "ADMIN") throw new Error("依頼者のみ削除できます");
    await prisma.task.delete({ where: { id } });
    revalidateTasks();
  });
}
