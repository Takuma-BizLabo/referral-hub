export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.env.TZ = process.env.TZ || "Asia/Tokyo";
    if (process.env.CRON_ENABLED !== "false") {
      const { startScheduler } = await import("./lib/cron/scheduler");
      startScheduler();
    }
  }
}
