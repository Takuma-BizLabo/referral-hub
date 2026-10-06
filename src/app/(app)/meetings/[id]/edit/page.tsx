import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { MeetingForm } from "../../MeetingForm";
import { idParam } from "@/lib/params";

export const metadata = { title: "ベンダーMTG編集" };

export default async function EditMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [meeting, vendors, users] = await Promise.all([
    prisma.vendorMeeting.findUnique({ where: { id: idParam(id) }, include: { vendor: true } }),
    prisma.vendor.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!meeting) notFound();
  return (
    <div>
      <PageHeader title={`ベンダーMTG編集：${meeting.vendor.name}`} />
      <MeetingForm meeting={meeting} vendors={vendors} users={users} />
    </div>
  );
}
