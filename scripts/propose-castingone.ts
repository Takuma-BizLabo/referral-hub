// CastingONE への提案リスト（2026-10-14）を「ベンダーに提案した人事」に登録する（何度実行しても重複しない）
// 本番: railway ssh --service web -- npx tsx scripts/propose-castingone.ts [--dry]
import { prisma } from "../src/lib/db";
import { rewardFor } from "../src/lib/fee-table";

type Item = { company: string; role: string; size: string; name: string; title: string; dept: string | null };
// name / title / dept は繋がりリストにない会社を新しく登録するときに使う
const items: Item[] = [
  { company: "アデコ株式会社", role: "LHHJapan事業部長", size: "43,500名（グループ全体）", name: "担当者（LHHJapan・事業部長）", title: "事業部長", dept: "LHHJapan" },
  { company: "ソシオークホールディングス株式会社", role: "DivisionLeader", size: "17,048名", name: "担当者（DivisionLeader）", title: "DivisionLeader", dept: null },
  { company: "株式会社メドレー", role: "人事部/実務担当者", size: "1850名", name: "担当者（人事部・実務担当者）", title: "実務担当者", dept: "人事部" },
  { company: "株式会社JSOL", role: "HR本部 人財開発部 シニアスペシャリスト", size: "1,400名", name: "担当者（人財開発部・シニアスペシャリスト）", title: "シニアスペシャリスト", dept: "HR本部 人財開発部" },
  { company: "株式会社エスプール", role: "採用統括/採用推進部 課長", size: "1314名", name: "担当者（採用推進部・課長）", title: "課長", dept: "採用推進部" },
  { company: "カネ美食品株式会社", role: "総務人事本部 部長", size: "1200名（正社員のみ）", name: "担当者（総務人事本部・部長）", title: "部長", dept: "総務人事本部" },
  { company: "株式会社サング", role: "人事部課長", size: "740名（正社員280名）", name: "担当者（人事部・課長）", title: "課長", dept: "人事部" },
  { company: "株式会社GENOVA", role: "人事部主任", size: "530名", name: "担当者（人事部・主任）", title: "主任", dept: "人事部" },
  { company: "株式会社イメージ・マジック", role: "採用担当", size: "511名（アルバイト含む）", name: "担当者（採用担当）", title: "採用担当", dept: null },
  { company: "株式会社アッカ・インターナショナル", role: "セクションマネージャー", size: "507名", name: "担当者（セクションマネージャー）", title: "セクションマネージャー", dept: null },
  { company: "株式会社中北製作所", role: "課長", size: "380名", name: "担当者（課長）", title: "課長", dept: null },
  { company: "株式会社be", role: "人事担当", size: "300名", name: "担当者（人事担当）", title: "人事担当", dept: "人事部" },
  { company: "株式会社CTF GROUP", role: "マネージャー", size: "250名", name: "担当者（マネージャー）", title: "マネージャー", dept: null },
  { company: "Terra Charge株式会社", role: "人事部", size: "217名", name: "担当者（人事部）", title: "人事部", dept: "人事部" },
  { company: "株式会社リーディングマーク", role: "人事部", size: "211名", name: "担当者（人事部）", title: "人事部", dept: "人事部" },
  { company: "株式会社アドインテ", role: "経営企画Div.人事チーム責任者", size: "186名", name: "担当者（人事チーム責任者）", title: "人事チーム責任者", dept: "経営企画Div. 人事チーム" },
  { company: "株式会社キカガク", role: "採用責任者", size: "152名", name: "担当者（採用責任者）", title: "採用責任者", dept: null },
  { company: "株式会社インプル", role: "ディレクター", size: "145名", name: "担当者（ディレクター）", title: "ディレクター", dept: null },
  { company: "株式会社Enjin", role: "採用戦略マネージャー", size: "141名", name: "担当者（採用戦略マネージャー）", title: "採用戦略マネージャー", dept: null },
  { company: "SATORI株式会社", role: "採用チームリーダー", size: "117名", name: "担当者（採用チームリーダー）", title: "採用チームリーダー", dept: null },
  { company: "株式会社CENTER", role: "専務取締役", size: "110名", name: "担当者（専務取締役）", title: "専務取締役", dept: null },
  { company: "HEROZ株式会社", role: "Bloom Works Group Consulting Unit", size: "110名", name: "担当者（Bloom Works Group Consulting Unit）", title: "Bloom Works Group Consulting Unit", dept: null },
  { company: "株式会社XAION DATA", role: "採用マネージャー", size: "103名", name: "担当者（採用マネージャー）", title: "採用マネージャー", dept: null },
];

async function main() {
  const dry = process.argv.includes("--dry");
  const vendors = await prisma.vendor.findMany({ where: { name: { contains: "CastingONE", mode: "insensitive" } } });
  if (vendors.length !== 1) throw new Error(`ベンダー「CastingONE」が ${vendors.length} 件見つかりました（1件である必要があります）`);
  const vendor = vendors[0];
  const added: string[] = [];
  const skipped: string[] = [];
  const created: string[] = [];
  let sized = 0;
  for (const it of items) {
    const contacts = await prisma.contact.findMany({
      where: { company: it.company, isActive: true },
      include: { referrals: { where: { vendorId: vendor.id } } },
      orderBy: { id: "asc" },
    });
    const existing = contacts.find((c) => c.referrals.length > 0);
    if (existing) {
      skipped.push(`${it.company}（登録済み: ${existing.referrals[0].status}）`);
      continue;
    }
    let contact = contacts[0];
    if (!contact) {
      created.push(it.company);
      if (dry) {
        added.push(it.company);
        continue;
      }
      contact = {
        ...(await prisma.contact.create({
          data: { company: it.company, name: it.name, title: it.title, employeeSize: it.size, relationMemo: it.dept ? `部署: ${it.dept}` : null },
        })),
        referrals: [],
      };
    } else if (!contact.employeeSize) {
      sized++;
      if (!dry) contact = { ...(await prisma.contact.update({ where: { id: contact.id }, data: { employeeSize: it.size } })), referrals: [] };
    }
    added.push(it.company);
    if (dry) continue;
    const fee = rewardFor(vendor, contact);
    const r = await prisma.referral.create({
      data: {
        vendorId: vendor.id,
        contactId: contact.id,
        rewardAmount: fee.rewardAmount,
        rewardUndetermined: fee.rewardUndetermined,
        pickupNote: `${it.company} / ${it.role}・従業員数 ${it.size}（ベンダーに提案）${fee.reason ? "／" + fee.reason : ""}`,
        memo: "CastingONE への提案リスト（2026-10-14）から追加",
      },
    });
    await prisma.statusHistory.create({
      data: { entityType: "REFERRAL", entityId: r.id, field: "status", fromValue: null, toValue: "RECEIVED", note: "ベンダーに提案", changedById: null },
    });
  }
  console.log(`${dry ? "[確認のみ] " : ""}ベンダー: ${vendor.name}（#${vendor.id}）`);
  console.log(`追加 ${added.length} 件 / スキップ ${skipped.length} 件 / 繋がりを新規登録 ${created.length} 件 / 従業員数を入力 ${sized} 件`);
  if (skipped.length) console.log("スキップ:", skipped.join("、"));
  if (created.length) console.log("新規登録:", created.join("、"));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
