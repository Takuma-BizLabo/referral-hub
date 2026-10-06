import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { VendorForm } from "../VendorForm";

export const metadata = { title: "ベンダー登録" };

export default async function NewVendorPage() {
  await requireUser();
  return (
    <div>
      <PageHeader title="ベンダー登録" />
      <VendorForm />
    </div>
  );
}
