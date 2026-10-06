import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SettingsTabs } from "./SettingsTabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div>
      <PageHeader title="設定" />
      <SettingsTabs isAdmin={user.role === "ADMIN"} />
      {children}
    </div>
  );
}
