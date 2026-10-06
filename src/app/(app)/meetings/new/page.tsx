import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { MeetingForm } from "../MeetingForm";

export const metadata = { title: "ベンダーMTG登録" };

export default async function NewMeetingPage({ searchParams }: { searchParams: Promise<{ vendorId?: string }> }) {
  const user = await requireUser();
  const { vendorId } = await searchParams;
  const [vendors, users] = await Promise.all([
    prisma.vendor.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div>
      <PageHeader title="ベンダーMTG登録" description="登録すると管理者の承認待ちになります" />
      <MeetingForm vendors={vendors} users={users} defaultVendorId={vendorId ? Number(vendorId) : undefined} defaultAssigneeId={user.id} />
    </div>
  );
}
