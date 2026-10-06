import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { SaleshubImport } from "./SaleshubImport";
import { threadAsText } from "@/lib/saleshub/ingest";

export const metadata = { title: "セールスハブ取込" };

export default async function SaleshubImportPage({ searchParams }: { searchParams: Promise<{ thread?: string }> }) {
  const user = await requireUser();
  const { thread } = await searchParams;
  const initial = thread ? await threadAsText(Number(thread)) : null;
  const [vendors, users] = await Promise.all([
    prisma.vendor.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, referralFee: true } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div>
      <PageHeader
        title="セールスハブ取込"
        description="セールスハブのチャット本文を貼り付けると、ベンダー・担当者へのMTGタスク・紹介候補を抽出して登録します"
      />
      <SaleshubImport vendors={vendors} users={users} defaultAssigneeId={user.id} initialText={initial?.text ?? ""} />
    </div>
  );
}
