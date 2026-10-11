"use server";
import { runWithFlash } from "@/lib/flash";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertUser } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { errorState, type ActionState } from "@/lib/action-state";
import { fmtDate, parseDateInput, safeLinkUrl, str } from "@/lib/utils";
import { fmtBytes, MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES } from "@/lib/attachments";

/** フォームの files から空でないファイルを取り出して検証する */
function pickFiles(formData: FormData): File[] {
  const files = formData.getAll("files").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f && (f as File).size > 0);
  if (files.length > MAX_FILES) throw new Error(`添付できるファイルは${MAX_FILES}件までです`);
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) throw new Error(`「${f.name}」が大きすぎます（${fmtBytes(f.size)}）。1ファイル${fmtBytes(MAX_FILE_BYTES)}までです`);
  }
  const total = files.reduce((a, f) => a + f.size, 0);
  if (total > MAX_TOTAL_BYTES) throw new Error(`添付ファイルの合計が大きすぎます（${fmtBytes(total)}）。合計${fmtBytes(MAX_TOTAL_BYTES)}までです`);
  return files;
}

function cleanFilename(name: string) {
  // パス区切り・制御文字を除き、長すぎる名前は切り詰める
  const base = name.replace(/^.*[\\/]/, "").replace(/[\u0000-\u001f\u007f]/g, "").trim() || "file";
  return base.length > 150 ? base.slice(0, 150) : base;
}

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
    if (title.length > 200) throw new Error("タイトルは200文字以内にしてください");
    const linkRaw = str(formData.get("linkUrl"));
    const linkUrl = safeLinkUrl(linkRaw);
    if (linkRaw && !linkUrl) throw new Error("関連ページURLは「/meetings/12」のようなパス、または http(s):// から始まるURLで入力してください");
    if (!assigneeId) throw new Error("宛先を選んでください");
    const assignee = await prisma.user.findFirst({ where: { id: assigneeId, isActive: true } });
    if (!assignee) throw new Error("宛先のユーザーが見つかりません");
    const files = pickFiles(formData);
    const fileRows = await Promise.all(
      files.map(async (f) => ({
        filename: cleanFilename(f.name),
        mimeType: (f.type || "application/octet-stream").slice(0, 100),
        size: f.size,
        data: Buffer.from(await f.arrayBuffer()),
        uploadedById: me.id,
      })),
    );
    const task = await prisma.task.create({
      data: {
        title,
        body: str(formData.get("body")),
        requesterId: me.id,
        assigneeId,
        important: formData.get("important") === "on",
        dueDate: parseDateInput(formData.get("dueDate")),
        linkUrl,
        ...(fileRows.length ? { attachments: { create: fileRows } } : {}),
      },
    });
    if (assigneeId !== me.id) {
      await notify({
        userId: assigneeId,
        type: "TASK_ASSIGNED",
        title: `【タスク依頼】${me.name} → ${task.title}`,
        body: [task.body?.slice(0, 200), task.dueDate ? `期限: ${fmtDate(task.dueDate)}` : null, fileRows.length ? `添付: ${fileRows.map((f) => f.filename).join("、")}` : null].filter(Boolean).join("\n"),
        linkUrl: `/tasks?focus=${task.id}`,
      });
    }
    revalidateTasks();
    return { success: `${assignee.name} さんにタスクを依頼しました${fileRows.length ? `（添付 ${fileRows.length} 件）` : ""}` };
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
    // 同時に2人が完了を押しても、通知が二重に出ないよう「未完了のものだけ」更新する
    const upd = await prisma.task.updateMany({ where: { id, status: "OPEN" }, data: { status: "DONE", doneAt: new Date(), doneComment: comment } });
    if (upd.count === 0) return;
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
    if (task.status === "OPEN") return;
    const upd = await prisma.task.updateMany({ where: { id, status: "DONE" }, data: { status: "OPEN", doneAt: null, doneComment: null } });
    if (upd.count === 0) return;
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

/** 担当者へタスクを再通知する（LINE 連携前に依頼した場合や、念押ししたいとき） */
export async function resendTaskAction(formData: FormData) {
  await runWithFlash(formData, async () => {
    const me = await assertUser();
    const id = Number(formData.get("id"));
    const task = await prisma.task.findUniqueOrThrow({ where: { id }, include: { assignee: true, attachments: { select: { filename: true } } } });
    if (task.requesterId !== me.id && me.role !== "ADMIN") throw new Error("再通知できるのは依頼者か管理者です");
    if (task.status !== "OPEN") throw new Error("完了済みのタスクは再通知できません");
    await notify({
      userId: task.assigneeId,
      type: "TASK_ASSIGNED",
      title: `【タスク依頼・再送】${me.name} → ${task.title}`,
      body: [
        task.body?.slice(0, 300),
        task.dueDate ? `期限: ${fmtDate(task.dueDate)}` : null,
        task.attachments.length ? `添付: ${task.attachments.map((a) => a.filename).join("、")}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      linkUrl: `/tasks?focus=${task.id}`,
    });
    revalidateTasks();
    return { notice: `${task.assignee.name} さんに再通知しました${task.assignee.lineUserId ? "（LINE にも送信）" : "（LINE 未連携のためツール内のみ）"}` };
  });
}
