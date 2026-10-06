import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { VendorForm } from "../../VendorForm";
import { idParam } from "@/lib/params";

export const metadata = { title: "ベンダー編集" };

export default async function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const vendor = await prisma.vendor.findUnique({ where: { id: idParam(id) } });
  if (!vendor) notFound();
  return (
    <div>
      <PageHeader title={`ベンダー編集：${vendor.name}`} />
      <VendorForm vendor={vendor} />
    </div>
  );
}
