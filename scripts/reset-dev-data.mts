// 開発用DB（ローカル組み込みPostgres）の業務データを全削除する。本番では使わないこと。
import { PrismaClient } from "@prisma/client";
const url = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(url)) {
  console.error("ローカルDB以外では実行できません:", url);
  process.exit(1);
}
const p = new PrismaClient();
await p.$executeRawUnsafe(
  'TRUNCATE "Notification","StatusHistory","Referral","VendorMeeting","ContactTag","Tag","Contact","Vendor","MonthlyGoal","Setting","Session","User" RESTART IDENTITY CASCADE',
);
console.log("開発データを削除しました");
await p.$disconnect();
