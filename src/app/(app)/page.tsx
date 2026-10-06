import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <div>
      <PageHeader title="ダッシュボード" description={`${user.name} さん、おつかれさまです`} />
      <p className="text-sm text-gray-500">（実装中）</p>
    </div>
  );
}
