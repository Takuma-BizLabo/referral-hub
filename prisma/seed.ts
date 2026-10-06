// 動作確認用シードデータ。npm run db:seed で投入（既存データがあれば重複登録しません）。
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const day = (offset: number, hour = 10, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, minute, 0, 0);
  return d;
};
const dateOnly = (offset: number) => day(offset, 0, 0);

async function main() {
  const hash = (pw: string) => bcrypt.hash(pw, 10);

  // ---- ユーザー ----
  const admin = await prisma.user.upsert({
    where: { loginId: "admin" },
    update: {},
    create: { loginId: "admin", name: "管理者", role: "ADMIN", passwordHash: await hash("admin1234") },
  });
  const matsuda = await prisma.user.upsert({
    where: { loginId: "matsuda" },
    update: {},
    create: { loginId: "matsuda", name: "松田", role: "MEMBER", passwordHash: await hash("matsuda1234") },
  });
  const sato = await prisma.user.upsert({
    where: { loginId: "member2" },
    update: {},
    create: { loginId: "member2", name: "佐々木", role: "MEMBER", passwordHash: await hash("member1234") },
  });
  console.log("users:", admin.loginId, matsuda.loginId, sato.loginId);

  if ((await prisma.vendor.count()) > 0) {
    console.log("ベンダーが既に存在するため、以降のシードはスキップしました");
    return;
  }

  // ---- ベンダー3社 ----
  const [castingone, hrforce, cloudsign] = await Promise.all([
    prisma.vendor.create({
      data: {
        name: "CastingONE",
        contactName: "大場 充",
        contactEmail: "oba@example.com",
        serviceSummary: "派遣・人材サービス向けの採用管理（ATS）・求職者管理ツール",
        referralFee: 50000,
        saleshubUrl: "https://saleshub.jp/example/castingone",
        meetingStatus: "DONE",
        memo: "人事部門の決裁者を希望。中堅以上の人材会社がターゲット",
      },
    }),
    prisma.vendor.create({
      data: {
        name: "HRフォース株式会社",
        contactName: "田中 美咲",
        contactEmail: "tanaka@example.com",
        serviceSummary: "中小企業向け採用代行（RPO）・求人原稿作成",
        referralFee: 30000,
        saleshubUrl: "https://saleshub.jp/example/hrforce",
        meetingStatus: "NOT_DONE",
        memo: "従業員30名以上の製造・建設業が中心",
      },
    }),
    prisma.vendor.create({
      data: {
        name: "株式会社クラウドサイン",
        contactName: "鈴木 健太",
        contactEmail: "suzuki@example.com",
        serviceSummary: "電子契約・契約管理クラウド",
        referralFee: 40000,
        saleshubUrl: "https://saleshub.jp/example/cloudsign",
        meetingStatus: "DONE",
      },
    }),
  ]);

  // ---- 繋がり20件 ----
  const industries = ["製造", "建設", "卸売", "IT", "人材", "飲食", "不動産", "医療", "物流", "小売"];
  const regions = ["東京", "神奈川", "大阪", "愛知", "福岡"];
  const sizes = ["10〜30名", "30〜50名", "50〜100名", "100〜300名", "300名以上"];
  const titles = ["代表取締役", "取締役", "人事部長", "総務部長", "営業部長", "経営企画室長", "人事課長"];
  const names = [
    ["山田 太郎", "株式会社サンプル商事"],
    ["佐藤 花子", "サンプル工業株式会社"],
    ["鈴木 一郎", "有限会社スズキ建設"],
    ["高橋 直樹", "株式会社エスプール"],
    ["田中 恵子", "タナカ物流株式会社"],
    ["伊藤 健", "株式会社イトウフーズ"],
    ["渡辺 由美", "ワタナベ不動産株式会社"],
    ["中村 翔太", "株式会社ナカムラIT"],
    ["小林 美穂", "コバヤシメディカル株式会社"],
    ["加藤 大輔", "株式会社カトウリテール"],
    ["吉田 翔", "ヨシダ精機株式会社"],
    ["山本 彩", "株式会社ヤマモト人材"],
    ["松本 隆", "マツモト建設株式会社"],
    ["井上 さくら", "株式会社イノウエ商会"],
    ["木村 拓也", "キムラテック株式会社"],
    ["林 真理子", "株式会社ハヤシフーズ"],
    ["清水 洋平", "シミズ不動産株式会社"],
    ["山口 麻衣", "株式会社ヤマグチクリニック"],
    ["森 健太郎", "モリ運輸株式会社"],
    ["池田 奈々", "株式会社イケダストア"],
  ];
  const tagNames = ["決裁者", "人事", "製造業", "紹介可", "要フォロー"];
  const tags = await Promise.all(tagNames.map((name) => prisma.tag.upsert({ where: { name }, update: {}, create: { name } })));
  const contacts = [];
  for (let i = 0; i < names.length; i++) {
    const [name, company] = names[i];
    const c = await prisma.contact.create({
      data: {
        name,
        company,
        title: titles[i % titles.length],
        industry: industries[i % industries.length],
        employeeSize: sizes[i % sizes.length],
        region: regions[i % regions.length],
        email: `contact${i + 1}@example.com`,
        phone: `03-0000-${String(1000 + i).padStart(4, "0")}`,
        isOnSaleshub: i % 3 !== 0,
        relationMemo: ["前職の取引先", "異業種交流会で知り合う", "大学の同期", "知人の紹介"][i % 4],
        tags: { create: [{ tagId: tags[i % tags.length].id }, ...(i % 2 === 0 ? [{ tagId: tags[0].id === tags[i % tags.length].id ? tags[3].id : tags[0].id }] : [])] },
      },
    });
    contacts.push(c);
  }

  // ---- ベンダーMTG ----
  const m1 = await prisma.vendorMeeting.create({
    data: {
      vendorId: castingone.id,
      assigneeId: matsuda.id,
      scheduledAt: day(-7, 14),
      format: "ONLINE",
      place: "https://zoom.us/j/000000001",
      approvalStatus: "APPROVED",
      executionStatus: "DONE",
      doneAt: day(-7, 15),
      minutes: "ターゲットは人材派遣業の人事責任者。導入事例3件を共有してもらった。紹介時は『採用管理の効率化』を切り口に。",
      requestNote: "株式会社エスプール / 人事部(課長クラス) をピックアップ。オンラインで事前MTG希望。",
    },
  });
  const m2 = await prisma.vendorMeeting.create({
    data: {
      vendorId: hrforce.id,
      assigneeId: matsuda.id,
      scheduledAt: day(1, 11),
      format: "ONLINE",
      place: "https://meet.google.com/xxx-yyyy-zzz",
      approvalStatus: "APPROVED",
      executionStatus: "CONFIRMED",
      nextAction: "事例資料を事前に受け取る",
      nextActionDue: dateOnly(0),
      requestNote: "製造業の人事決裁者を2社ピックアップ。",
    },
  });
  const m3 = await prisma.vendorMeeting.create({
    data: {
      vendorId: cloudsign.id,
      assigneeId: sato.id,
      scheduledAt: day(3, 16),
      format: "VISIT",
      place: "東京都港区〇〇ビル 5F",
      approvalStatus: "PENDING",
      executionStatus: "SCHEDULING",
      requestNote: "契約書の多い不動産・建設業の決裁者を希望。",
    },
  });
  const m4 = await prisma.vendorMeeting.create({
    data: {
      vendorId: cloudsign.id,
      assigneeId: sato.id,
      scheduledAt: day(-14, 10),
      format: "ONLINE",
      approvalStatus: "APPROVED",
      executionStatus: "DONE",
      doneAt: day(-14, 11),
      minutes: null, // 議事メモ未入力のサンプル
    },
  });
  const m5 = await prisma.vendorMeeting.create({
    data: {
      vendorId: hrforce.id,
      assigneeId: sato.id,
      scheduledAt: day(-2, 13),
      format: "ONLINE",
      approvalStatus: "REJECTED",
      rejectReason: "日時が先方の希望と違います。再調整してください。",
      executionStatus: "RESCHEDULE",
    },
  });
  for (const m of [m1, m2, m3, m4, m5]) {
    await prisma.statusHistory.create({
      data: { entityType: "VENDOR_MEETING", entityId: m.id, field: "approvalStatus", fromValue: null, toValue: m.approvalStatus, changedById: admin.id },
    });
  }

  // ---- 紹介案件 ----
  const esp = contacts.find((c) => c.company === "株式会社エスプール")!;
  const refs = [
    {
      vendorId: castingone.id,
      contactId: esp.id,
      status: "MEETING_DONE" as const,
      meetingAt: day(-3, 15),
      meetingFormat: "ONLINE" as const,
      meetingDoneAt: day(-3, 16),
      meetingResult: "導入前向き。来月トライアル開始予定。",
      rewardAmount: 50000,
      rewardStatus: "APPLIED" as const,
      pickupNote: "株式会社エスプール / 人事部(課長クラス)",
      pickedUpAt: dateOnly(-12),
      statusChangedAt: day(-3, 16),
    },
    {
      vendorId: castingone.id,
      contactId: contacts[11].id,
      status: "MEETING_CONFIRMED" as const,
      meetingAt: day(2, 11),
      meetingFormat: "ONLINE" as const,
      meetingPlace: "https://zoom.us/j/000000002",
      rewardAmount: 50000,
      rewardStatus: "UNFIXED" as const,
      pickedUpAt: dateOnly(-6),
      statusChangedAt: day(-1, 9),
    },
    {
      vendorId: castingone.id,
      contactId: contacts[4].id,
      status: "CONTACTING" as const,
      rewardAmount: 50000,
      rewardStatus: "UNFIXED" as const,
      nextAction: "先方に打診のメールを送る",
      nextActionDue: dateOnly(-1),
      pickedUpAt: dateOnly(-10),
      statusChangedAt: day(-9, 9), // 停滞サンプル
    },
    {
      vendorId: cloudsign.id,
      contactId: contacts[6].id,
      status: "MEETING_DONE" as const,
      meetingAt: day(-20, 14),
      meetingDoneAt: day(-20, 15),
      meetingResult: "検討中。来期予算で判断。",
      rewardAmount: 40000,
      rewardStatus: "INVOICED" as const,
      rewardApprovedAt: day(-18, 10),
      invoicedAt: dateOnly(-15),
      paymentDueAt: dateOnly(-2), // 入金遅延サンプル
      pickedUpAt: dateOnly(-30),
      statusChangedAt: day(-20, 15),
    },
    {
      vendorId: cloudsign.id,
      contactId: contacts[12].id,
      status: "MEETING_DONE" as const,
      meetingAt: day(-40, 10),
      meetingDoneAt: day(-40, 11),
      meetingResult: "導入決定。",
      rewardAmount: 40000,
      rewardStatus: "PAID" as const,
      rewardApprovedAt: day(-38, 10),
      invoicedAt: dateOnly(-35),
      paymentDueAt: dateOnly(-5),
      paidAt: dateOnly(-6),
      pickedUpAt: dateOnly(-50),
      statusChangedAt: day(-40, 11),
    },
    {
      vendorId: hrforce.id,
      contactId: contacts[1].id,
      status: "RECEIVED" as const,
      rewardAmount: 30000,
      rewardStatus: "UNFIXED" as const,
      pickupNote: "製造業の人事決裁者",
      pickedUpAt: dateOnly(-1),
      statusChangedAt: day(-1, 9),
    },
    {
      vendorId: cloudsign.id,
      contactId: contacts[2].id,
      status: "DECLINED" as const,
      rewardAmount: 40000,
      rewardStatus: "UNFIXED" as const,
      meetingResult: "先方多忙のため今回は見送り",
      pickedUpAt: dateOnly(-25),
      statusChangedAt: day(-22, 9),
    },
  ];
  for (const r of refs) {
    const created = await prisma.referral.create({ data: r });
    await prisma.statusHistory.create({
      data: { entityType: "REFERRAL", entityId: created.id, field: "status", fromValue: null, toValue: r.status, changedById: admin.id },
    });
  }

  // ---- 今月の目標 ----
  const ym = new Date().toISOString().slice(0, 7);
  await prisma.monthlyGoal.create({ data: { yearMonth: ym, userId: null, meetingTarget: 6, referralTarget: 8, rewardAccrualTarget: 300000, rewardPaidTarget: 200000 } });
  await prisma.monthlyGoal.create({ data: { yearMonth: ym, userId: matsuda.id, meetingTarget: 4 } });
  await prisma.monthlyGoal.create({ data: { yearMonth: ym, userId: sato.id, meetingTarget: 2 } });

  console.log("seed 完了: ベンダー3社 / 繋がり20件 / MTG5件 / 紹介案件7件");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
