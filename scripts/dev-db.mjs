// ローカル開発用の組み込み PostgreSQL を起動します（Postgres のインストール不要）。
// 使い方: npm run db:dev   （Ctrl+C で停止）
import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.resolve(".pgdata");
const port = Number(process.env.PGPORT || 5433);
const first = !fs.existsSync(path.join(dataDir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
});

if (first) {
  console.log("初回起動: データベースを初期化しています...");
  await pg.initialise();
}
await pg.start();
if (first) {
  await pg.createDatabase("referral_hub");
}
console.log(`PostgreSQL 起動中: postgresql://postgres:postgres@localhost:${port}/referral_hub`);
console.log("停止するには Ctrl+C を押してください。");

const stop = async () => {
  console.log("\n停止しています...");
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
