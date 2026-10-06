// 手動でリマインド判定を1回実行する: npm run cron
process.env.TZ = process.env.TZ || "Asia/Tokyo";

async function main() {
  const { runReminders } = await import("../src/lib/cron/reminders");
  const r = await runReminders();
  console.log(`通知を ${r.created} 件作成しました`);
}

main().then(() => process.exit(0));
