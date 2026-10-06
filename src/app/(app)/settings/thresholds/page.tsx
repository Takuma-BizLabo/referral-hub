import { requireAdmin } from "@/lib/auth";
import { Card } from "@/components/ui";
import { getLineEnabledMap, getSetting } from "@/lib/settings";
import { ThresholdsForm } from "./ThresholdsForm";

export const metadata = { title: "通知・閾値" };

export default async function ThresholdsPage() {
  await requireAdmin();
  const [stagnationDays, dailyDigestHour, minutesMissingHours, lineMap] = await Promise.all([
    getSetting("stagnationDays"),
    getSetting("dailyDigestHour"),
    getSetting("minutesMissingHours"),
    getLineEnabledMap(),
  ]);
  return (
    <Card title="通知・閾値の設定">
      <ThresholdsForm stagnationDays={stagnationDays} dailyDigestHour={dailyDigestHour} minutesMissingHours={minutesMissingHours} lineMap={lineMap} />
    </Card>
  );
}
