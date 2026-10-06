import { prisma } from "./db";
import { NOTIFICATION_TYPES } from "./labels";

export const SETTING_DEFAULTS = {
  stagnationDays: "7",
  dailyDigestHour: "8",
  minutesMissingHours: "24",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSetting(key: SettingKey): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? SETTING_DEFAULTS[key];
}

export async function getSettingNumber(key: SettingKey): Promise<number> {
  const n = Number(await getSetting(key));
  return Number.isFinite(n) ? n : Number(SETTING_DEFAULTS[key]);
}

export async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

/** 通知種別ごとの LINE 送信 ON/OFF */
export async function getLineEnabledMap(): Promise<Record<string, boolean>> {
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: "line." } } });
  const map: Record<string, boolean> = {};
  for (const t of NOTIFICATION_TYPES) {
    const row = rows.find((r) => r.key === `line.${t.key}`);
    map[t.key] = row ? row.value === "1" : t.defaultLine;
  }
  return map;
}
