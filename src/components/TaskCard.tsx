import type { Task, User } from "@prisma/client";
import { cn, fmtDate, fmtDateTime } from "@/lib/utils";
import { completeTaskAction, deleteTaskAction, reopenTaskAction, resendTaskAction } from "@/app/(app)/tasks/actions";
import { CompleteTaskForm } from "./TaskControls";
import { SubmitButton } from "@/components/SubmitButton";

import { fmtBytes, isImageType, type AttachmentMeta } from "@/lib/attachments";
import { linkify } from "./Linkify";
import { TaskChatInput } from "./TaskChatInput";
import { deleteTaskCommentAction } from "@/app/(app)/tasks/actions";

/** アプリ内パスは公開URLに変換して表示（コピーして共有しやすいように） */
function displayLink(url: string) {
  if (/^https?:\/\//.test(url)) return url;
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  return base ? `${base}${url}` : url;
}

export type TaskCommentView = { id: number; authorId: number; body: string | null; createdAt: Date; author: { name: string }; attachments: AttachmentMeta[] };
export type TaskWithUsers = Task & { requester: User; assignee: User; attachments?: AttachmentMeta[]; comments?: TaskCommentView[] };

function AttachmentList({ items, className }: { items: AttachmentMeta[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((a) =>
        isImageType(a.mimeType) ? (
          <a key={a.id} href={`/tasks/attachments/${a.id}`} target="_blank" rel="noreferrer" className="block rounded-lg border border-gray-200 overflow-hidden bg-white hover:opacity-90" title={a.filename}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/tasks/attachments/${a.id}`} alt={a.filename} className="h-20 w-28 object-cover" loading="lazy" />
            <span className="block max-w-28 truncate px-1.5 py-0.5 text-[11px] text-gray-600">{a.filename}</span>
          </a>
        ) : (
          <a
            key={a.id}
            href={`/tasks/attachments/${a.id}?download=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-800 hover:bg-gray-100 max-w-full"
          >
            <span>📎</span>
            <span className="truncate max-w-56">{a.filename}</span>
            <span className="text-gray-500 shrink-0">{fmtBytes(a.size)}</span>
          </a>
        ),
      )}
    </div>
  );
}

/** タスクごとのやりとり。自分のメッセージは右、相手は左。新しいものが下（開いたときは最新が見える位置） */
function TaskChat({ task, meId, isAdmin }: { task: TaskWithUsers; meId: number; isAdmin: boolean }) {
  const comments = task.comments ?? [];
  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <div className="mb-2 text-xs font-semibold text-gray-600">💬 やりとり{comments.length ? `（${comments.length}）` : ""}</div>
      {comments.length > 0 && (
        <div className="flex max-h-[28rem] flex-col-reverse overflow-y-auto rounded-lg bg-gray-50 p-2">
          <div className="space-y-2">
            {comments.map((c) => {
              const mine = c.authorId === meId;
              return (
                <div key={c.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] min-w-0", mine && "text-right")}>
                    <div className="mb-0.5 text-[11px] text-gray-500">
                      {mine ? "あなた" : c.author.name} ・ {fmtDateTime(c.createdAt)}
                      {(mine || isAdmin) && (
                        <form action={deleteTaskCommentAction} className="inline">
                          <input type="hidden" name="id" value={c.id} />
                          <SubmitButton className="ml-2 text-[11px] text-gray-400 underline hover:text-rose-600" pendingText="..." confirm="このメッセージを取り消しますか？">
                            取消
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                    <div className={cn("inline-block rounded-2xl px-3 py-2 text-left text-sm", mine ? "rounded-tr-sm bg-blue-100 text-gray-900" : "rounded-tl-sm border border-gray-200 bg-white text-gray-900")}>
                      {c.body && <p className="whitespace-pre-wrap break-words">{linkify(c.body)}</p>}
                      {c.attachments.length > 0 && <AttachmentList items={c.attachments} className={c.body ? "mt-2" : ""} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <TaskChatInput taskId={task.id} />
    </div>
  );
}

export function TaskCard({ task, meId, isAdmin, focus }: { task: TaskWithUsers; meId: number; isAdmin: boolean; focus?: boolean }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = task.status === "OPEN" && task.dueDate && task.dueDate < today;
  const mine = task.assigneeId === meId;
  const canAct = mine || task.requesterId === meId || isAdmin;
  return (
    <div
      id={`task-${task.id}`}
      className={cn(
        "rounded-xl border p-4 bg-white",
        task.status === "DONE" ? "border-gray-200 opacity-75" : task.important || overdue ? "border-rose-300 border-l-4 border-l-rose-500 shadow-sm" : "border-gray-200 border-l-4 border-l-primary",
        focus && "ring-2 ring-blue-400",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {task.status === "DONE" ? (
              <span className="badge bg-emerald-100 text-emerald-800 border-emerald-200">完了</span>
            ) : (
              <span className={cn("badge", task.important ? "bg-rose-100 text-rose-800 border-rose-200" : "bg-blue-50 text-blue-800 border-blue-200")}>{task.important ? "重要" : "未完了"}</span>
            )}
            {overdue && <span className="badge bg-rose-600 text-white border-rose-600">期限超過</span>}
            <h3 className={cn("font-semibold text-gray-900 text-base break-words min-w-0", task.status === "DONE" && "line-through text-gray-500")}>{task.title}</h3>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {task.requester.name} → <span className={cn("font-medium", mine && task.status === "OPEN" && "text-rose-700")}>{task.assignee.name}{mine ? "（あなた）" : ""}</span>
            ・ 依頼 {fmtDateTime(task.createdAt)}
            {task.dueDate && <span className={cn("ml-2", overdue && "text-rose-600 font-medium")}>期限 {fmtDate(task.dueDate)}</span>}
          </div>
        </div>
      </div>
      {task.body && <p className="text-sm text-gray-800 whitespace-pre-wrap break-words mt-3">{linkify(task.body)}</p>}
      {task.attachments && task.attachments.length > 0 && <AttachmentList items={task.attachments} className="mt-3" />}
      {task.linkUrl && (
        <a
          href={task.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-3 rounded-lg border-2 border-blue-300 bg-blue-50 px-3 py-2.5 hover:bg-blue-100 hover:border-blue-400 transition-colors"
        >
          <span className="shrink-0 rounded-md bg-blue-600 px-2 py-1 text-xs font-bold text-white">関連ページ</span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-blue-800 underline underline-offset-2">{displayLink(task.linkUrl)}</span>
          <span className="shrink-0 text-xs text-blue-700">新しいタブで開く ↗</span>
        </a>
      )}
      {task.status === "DONE" && (
        <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-900">
          {fmtDateTime(task.doneAt)} に {task.assignee.name} が完了{task.doneComment ? `：${task.doneComment}` : ""}
        </div>
      )}
      {canAct && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {task.status === "OPEN" ? (
            <CompleteTaskForm id={task.id} action={completeTaskAction} />
          ) : (
            <form action={reopenTaskAction}>
              <input type="hidden" name="id" value={task.id} />
              <SubmitButton className="btn-secondary btn-sm">未完了に戻す</SubmitButton>
            </form>
          )}
          {task.status === "OPEN" && (task.requesterId === meId || isAdmin) && task.assigneeId !== meId && (
            <form action={resendTaskAction}>
              <input type="hidden" name="id" value={task.id} />
              <SubmitButton className="btn-secondary btn-sm" pendingText="送信中...">LINEで再通知</SubmitButton>
            </form>
          )}
          {(task.requesterId === meId || isAdmin) && (
            <form action={deleteTaskAction}>
              <input type="hidden" name="id" value={task.id} />
              <SubmitButton className="btn-danger btn-sm" confirm="このタスクを削除しますか？">削除</SubmitButton>
            </form>
          )}
        </div>
      )}
      <TaskChat task={task} meId={meId} isAdmin={isAdmin} />
    </div>
  );
}
