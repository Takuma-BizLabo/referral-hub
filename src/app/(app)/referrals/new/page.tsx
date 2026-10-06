import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ReferralForm } from "../ReferralForm";

export const metadata = { title: "紹介案件登録" };

export default async function NewReferralPage({ searchParams }: { searchParams: Promise<{ vendorId?: string; contactId?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const [vendors, contacts] = await Promise.all([
    prisma.vendor.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, referralFee: true, meetingStatus: true } }),
    prisma.contact.findMany({ where: { isActive: true }, orderBy: [{ company: "asc" }, { name: "asc" }], select: { id: true, name: true, company: true, title: true } }),
  ]);
  return (
    <div>
      <PageHeader title="紹介案件登録" description="ベンダーがピックアップした繋がりを登録します" />
      <ReferralForm
        vendors={vendors}
        contacts={contacts}
        defaultVendorId={sp.vendorId ? Number(sp.vendorId) : undefined}
        defaultContactId={sp.contactId ? Number(sp.contactId) : undefined}
      />
    </div>
  );
}
