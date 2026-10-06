import Link from "next/link";
import type { Task, User } from "@prisma/client";
import { cn, fmtDate, fmtDateTime } from "@/lib/utils";
import { completeTaskAction, deleteTaskAction, reopenTaskAction } from "@/app/(app)/tasks/actions";
import { CompleteTaskForm } from "./TaskControls";
import { SubmitButton } from "@/components/SubmitButton";

export type TaskWithUsers = Task & { requester: User; assignee: User };

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
            <h3 className={cn("font-semibold text-gray-900 text-base", task.status === "DONE" && "line-through text-gray-500")}>{task.title}</h3>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {task.requester.name} → <span className={cn("font-medium", mine && task.status === "OPEN" && "text-rose-700")}>{task.assignee.name}{mine ? "（あなた）" : ""}</span>
            ・ 依頼 {fmtDateTime(task.createdAt)}
            {task.dueDate && <span className={cn("ml-2", overdue && "text-rose-600 font-medium")}>期限 {fmtDate(task.dueDate)}</span>}
          </div>
        </div>
        {task.linkUrl && (
          <Link href={task.linkUrl} className="btn-secondary btn-sm">
            関連ページ
          </Link>
        )}
      </div>
      {task.body && <p className="text-sm text-gray-800 whitespace-pre-wrap mt-3">{task.body}</p>}
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
          {(task.requesterId === meId || isAdmin) && (
            <form action={deleteTaskAction}>
              <input type="hidden" name="id" value={task.id} />
              <SubmitButton className="btn-danger btn-sm" confirm="このタスクを削除しますか？">削除</SubmitButton>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
