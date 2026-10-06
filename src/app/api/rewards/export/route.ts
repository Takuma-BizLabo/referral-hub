import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { REFERRAL_LABEL, REWARD_LABEL } from "@/lib/labels";
import { toInputDate } from "@/lib/utils";
import type { Prisma, RewardStatus } from "@prisma/client";

function csvCell(v: string | number | null | undefined) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const where: Prisma.ReferralWhereInput =
    status && status in REWARD_LABEL ? { rewardStatus: status as RewardStatus } : { rewardStatus: { not: "UNFIXED" } };
  const rows = await prisma.referral.findMany({ where, include: { vendor: true, contact: true }, orderBy: { id: "asc" } });

  const header = ["案件ID", "ベンダー", "紹介先氏名", "紹介先会社", "紹介ステータス", "面談実施日", "報酬額", "報酬ステータス", "承認日", "請求日", "入金予定日", "入金日"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.vendor.name,
        r.contact.name,
        r.contact.company,
        REFERRAL_LABEL[r.status],
        toInputDate(r.meetingDoneAt),
        r.rewardAmount,
        REWARD_LABEL[r.rewardStatus],
        toInputDate(r.rewardApprovedAt),
        toInputDate(r.invoicedAt),
        toInputDate(r.paymentDueAt),
        toInputDate(r.paidAt),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  // Excel で開けるように BOM 付き UTF-8
  const body = "﻿" + lines.join("\r\n");
  const filename = `rewards_${toInputDate(new Date())}.csv`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
