import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ReferralForm } from "../../ReferralForm";

export const metadata = { title: "紹介案件編集" };

export default async function EditReferralPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const referral = await prisma.referral.findUnique({ where: { id: Number(id) }, include: { vendor: true, contact: true } });
  if (!referral) notFound();
  return (
    <div>
      <PageHeader title={`紹介案件編集：${referral.contact.name} × ${referral.vendor.name}`} />
      <ReferralForm referral={referral} vendors={[]} contacts={[]} />
    </div>
  );
}
