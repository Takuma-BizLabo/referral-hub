import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { VendorTag } from "@/components/VendorTag";
import { EXECUTION_LABEL } from "@/lib/labels";
import { getSettingRaw } from "@/lib/settings";
import { fmtDateTime, fmtYen } from "@/lib/utils";

export const metadata = { title: "セールスハブ受信箱" };

export default async function SaleshubInboxPage() {
  const user = await requireUser();
  const [threads, lastIngest, enabled] = await Promise.all([
    prisma.saleshubThread.findMany({
      include: { messages: { orderBy: { sentAt: "desc" }, take: 1 } },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    }),
    getSettingRaw("saleshub.lastIngestAt"),
    getSettingRaw("saleshub.enabled"),
  ]);
  const meetingIds = threads.map((t) => t.importedMeetingId).filter((x): x is number => !!x);
  const meetings = await prisma.vendorMeeting.findMany({ where: { id: { in: meetingIds } }, include: { assignee: true } });
  const vendorIds = threads.map((t) => t.vendorId).filter((x): x is number => !!x);
  const vendors = await prisma.vendor.findMany({ where: { id: { in: vendorIds } } });

  return (
    <div>
      <PageHeader
        title="セールスハブ受信箱"
        description={lastIngest ? `最終受信 ${fmtDateTime(new Date(lastIngest))}` : "まだ受信していません"}
        actions={user.role === "ADMIN" ? <Link href="/settings/saleshub" className="btn-secondary">連携設定</Link> : undefined}
      />
      {enabled !== "1" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 mb-3">
          セールスハブ連携は停止中です。管理者が「設定 → セールスハブ連携」で有効にしてください。
        </div>
      )}
      {threads.length === 0 ? (
        <div className="card">
          <EmptyState message="スレッドはまだありません。Chrome 拡張が動くと自動で表示されます。" />
        </div>
      ) : (
        <>
          {/* スマホ: カード表示 */}
          <ul className="md:hidden space-y-2">
            {threads.map((t) => {
              const last = t.messages[0];
              const m = meetings.find((x) => x.id === t.importedMeetingId);
              return (
                <li key={t.id} className="card p-3">
                  <Link href={`/saleshub/${t.id}`} className="block">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-blue-700">{t.vendorName}</span>
                      <span className="text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(t.lastMessageAt)}</span>
                    </div>
                    {t.requestTitle && <div className="text-xs text-gray-500 truncate mt-0.5">{t.requestTitle}</div>}
                    <div className="text-sm text-gray-700 mt-1 line-clamp-2">
                      {last ? (
                        <>
                          <span className={last.isMine ? "text-gray-500" : "font-medium text-gray-900"}>{last.isMine ? "自分" : last.senderName}：</span>
                          {last.body}
                        </>
                      ) : (
                        <span className="text-gray-400 text-xs">{t.lastSnippet}</span>
                      )}
                    </div>
                  </Link>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-gray-600">協力金 {t.fee ? fmtYen(t.fee) : "未取得"}</span>
                    {m ? (
                      <Link href={`/meetings/${m.id}`} className="inline-flex items-center gap-1 text-blue-700">
                        <Badge value={m.executionStatus} label={EXECUTION_LABEL[m.executionStatus]} />
                        {m.scheduledAt ? fmtDateTime(m.scheduledAt) : "日程未定"}
                      </Link>
                    ) : (
                      <Link href={`/import/saleshub?thread=${t.id}`} className="btn-secondary btn-sm">
                        手動で取込
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {/* PC: テーブル表示 */}
          <div className="card overflow-x-auto hidden md:block">
            <table className="table">
              <thead>
                <tr>
                  <th>ベンダー</th>
                  <th>依頼</th>
                  <th className="text-right">協力金</th>
                  <th>最新メッセージ</th>
                  <th>日時</th>
                  <th>ベンダーMTG</th>
                </tr>
              </thead>
              <tbody>
                {threads.map((t) => {
                  const last = t.messages[0];
                  const v = vendors.find((x) => x.id === t.vendorId);
                  const m = meetings.find((x) => x.id === t.importedMeetingId);
                  return (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap">
                        <Link href={`/saleshub/${t.id}`} className="font-medium text-blue-700 hover:underline">
                          {t.vendorName}
                        </Link>
                        {v && (
                          <div className="mt-1">
                            <VendorTag id={v.id} name={v.name} />
                          </div>
                        )}
                      </td>
                      <td className="max-w-xs truncate text-gray-600 text-xs">{t.requestTitle ?? "-"}</td>
                      <td className="text-right whitespace-nowrap text-sm">{t.fee ? fmtYen(t.fee) : <span className="text-gray-400 text-xs">未取得</span>}</td>
                      <td className="max-w-md">
                        {last ? (
                          <div className="text-sm">
                            <span className={last.isMine ? "text-gray-500" : "text-gray-900 font-medium"}>{last.isMine ? "自分" : last.senderName}：</span>
                            <span className="text-gray-700 line-clamp-2">{last.body}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">{t.lastSnippet}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-xs text-gray-500">{fmtDateTime(t.lastMessageAt)}</td>
                      <td className="whitespace-nowrap">
                        {m ? (
                          <Link href={`/meetings/${m.id}`} className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline">
                            <Badge value={m.executionStatus} label={EXECUTION_LABEL[m.executionStatus]} />
                            {m.scheduledAt ? fmtDateTime(m.scheduledAt) : "日程未定"}（{m.assignee.name}）
                          </Link>
                        ) : (
                          <Link href={`/import/saleshub?thread=${t.id}`} className="btn-secondary btn-sm">
                            手動で取込
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
