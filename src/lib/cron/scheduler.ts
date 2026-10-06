
const INTERVAL_MS = 5 * 60 * 1000;
const g = globalThis as unknown as { __rhSchedulerStarted?: boolean };

/** 5分ごとにリマインド判定を実行する（単一常駐プロセス前提） */
export function startScheduler() {
  if (g.__rhSchedulerStarted) return;
  g.__rhSchedulerStarted = true;
  const tick = async () => {
    try {
      const { runReminders } = await import("./reminders");
      const r = await runReminders();
      if (r.created > 0) console.log(`[cron] 通知を ${r.created} 件作成`);
    } catch (e) {
      console.error("[cron] エラー", e);
    }
  };
  setTimeout(tick, 15_000);
  setInterval(tick, INTERVAL_MS);
  console.log("[cron] リマインド判定を5分間隔で開始");
}
