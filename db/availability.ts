import { env } from "cloudflare:workers";
import { addDays, currentWeekStart, mondayFor, validIsoDate } from "./schedule";

export type AvailabilityMap = Record<string, string>;

export type AvailabilityRow = {
  id: number;
  week_start: string;
  normalized_name: string;
  display_name: string;
  availability_json: string;
  created_at: string;
  updated_at: string;
};

const tableSql = `CREATE TABLE IF NOT EXISTS weekly_availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  availability_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

const indexSql = `CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_availability_week_name
ON weekly_availability(week_start, normalized_name)`;

export function getAvailabilityD1() {
  if (!env.DB) throw new Error("M2GO 数据库尚未连接。");
  return env.DB;
}

export function normalizeName(value: unknown) {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!/^[A-Za-z]+$/.test(clean)) return null;
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

function timeValue(part: string) {
  if (part === "C") return 24;
  const [rawHour, rawMinute = "0"] = part.split(":");
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (!Number.isInteger(hour) || ![0, 30].includes(minute) || hour < 1 || hour > 12) return null;
  const normalizedHour = hour === 12 ? 12 : hour < 11 ? hour + 12 : hour;
  return normalizedHour + minute / 60;
}

export function validAvailabilityCode(code: unknown) {
  if (typeof code !== "string" || !/^\d{1,2}(?::30)?-(?:C|\d{1,2}(?::30)?)$/.test(code)) return false;
  const [start, end] = code.split("-");
  const startValue = timeValue(start);
  const endValue = timeValue(end);
  return startValue !== null && endValue !== null && startValue < endValue;
}

export function cleanAvailability(value: unknown, weekStart: string): AvailabilityMap | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const allowedDates = new Set(Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)));
  const result: AvailabilityMap = {};
  for (const [date, code] of Object.entries(value)) {
    if (!allowedDates.has(date) || !validAvailabilityCode(code)) return null;
    result[date] = code as string;
  }
  return result;
}

export function parseAvailability(row: AvailabilityRow) {
  try {
    const parsed = JSON.parse(row.availability_json) as AvailabilityMap;
    return { id: row.id, weekStart: row.week_start, name: row.display_name, availability: parsed, updatedAt: row.updated_at };
  } catch {
    return { id: row.id, weekStart: row.week_start, name: row.display_name, availability: {}, updatedAt: row.updated_at };
  }
}

export async function initializeAvailabilityDatabase() {
  const db = getAvailabilityD1();
  await db.batch([db.prepare(tableSql), db.prepare(indexSql), db.prepare("PRAGMA optimize")]);
}

export function requestedWeek(value: string | null) {
  return value && validIsoDate(value) ? mondayFor(value) : currentWeekStart();
}
