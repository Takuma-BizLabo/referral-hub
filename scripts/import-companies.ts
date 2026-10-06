// data/*.csv の会社リストを繋がりリストへ取り込む: npx tsx scripts/import-companies.ts
import { importCompanyLists } from "../src/lib/import-companies";
import { prisma } from "../src/lib/db";

importCompanyLists()
  .then((r) => console.log(`掲載済み ${r.registered} 行 / リスト ${r.connections} 行 → 新規 ${r.created} 件 / 更新 ${r.updated} 件`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
