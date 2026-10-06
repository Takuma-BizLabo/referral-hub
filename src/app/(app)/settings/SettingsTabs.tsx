"use client";
import { usePathname } from "next/navigation";
import { Tabs } from "@/components/ui";

export function SettingsTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = [
    ...(isAdmin ? [{ href: "/settings/users", label: "ユーザー管理" }] : []),
    { href: "/settings/line", label: "LINE連携" },
    ...(isAdmin ? [{ href: "/settings/thresholds", label: "通知・閾値" }, { href: "/settings/saleshub", label: "セールスハブ連携" }] : []),
  ];
  return <Tabs items={items.map((i) => ({ ...i, active: pathname.startsWith(i.href) }))} />;
}
