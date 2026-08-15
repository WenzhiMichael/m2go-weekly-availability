import { env } from "cloudflare:workers";
import { addDays, currentWeekStart, mondayFor, validIsoDate } from "./schedule";

export type AvailabilityMap = Record<string, string>;

export type EmployeeRow = {
  id: number;
  display_name: string;
  active: number;
  created_at: string;
  updated_at: string;
};

export type AvailabilityRow = {
  id: number;
  week_start: string;
  employee_id: number;
  availability_json: string;
  created_at: string;
  updated_at: string;
};

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS availability_employees (
    id INTEGER PRIMARY KEY,
    display_name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_availability_employees_display_name
   ON availability_employees(display_name COLLATE NOCASE)`,
  `CREATE TABLE IF NOT EXISTS employee_weekly_availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start TEXT NOT NULL,
    employee_id INTEGER NOT NULL REFERENCES availability_employees(id) ON DELETE CASCADE,
    availability_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_weekly_availability_week_employee
   ON employee_weekly_availability(week_start, employee_id)`,
  `CREATE TABLE IF NOT EXISTS manager_login_attempts (
    client_key TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 0,
    window_started INTEGER NOT NULL
  )`,
  "PRAGMA optimize",
];

export function getAvailabilityD1() {
  if (!env.DB) throw new Error("M2GO 数据库尚未连接。");
  return env.DB;
}

export function validEmployeeId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 8;
}

export function employeeIdFrom(value: unknown) {
  const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return validEmployeeId(parsed) ? parsed : null;
}

export function cleanDisplayName(value: unknown) {
  if (typeof value !== "string") return null;
  const clean = value.trim().replace(/\s+/g, " ");
  const hasControlCharacter = Array.from(clean).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  if (!clean || clean.length > 40 || hasControlCharacter) return null;
  return clean;
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

export function parseAvailability(row: AvailabilityRow | null | undefined): AvailabilityMap {
  if (!row) return {};
  try {
    return JSON.parse(row.availability_json) as AvailabilityMap;
  } catch {
    return {};
  }
}

export function publicEmployee(row: EmployeeRow) {
  return { id: row.id, displayName: row.display_name };
}

export async function initializeAvailabilityDatabase() {
  const db = getAvailabilityD1();
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  await db.batch(Array.from({ length: 8 }, (_, index) => {
    const id = index + 1;
    return db.prepare("INSERT OR IGNORE INTO availability_employees (id, display_name) VALUES (?, ?)").bind(id, String(id));
  }));
}

export async function listEmployees() {
  const result = await getAvailabilityD1().prepare(
    `SELECT id, display_name, active, created_at, updated_at
     FROM availability_employees WHERE active = 1 ORDER BY id`,
  ).all<EmployeeRow>();
  return result.results.map(publicEmployee);
}

export async function getEmployee(employeeId: number) {
  const row = await getAvailabilityD1().prepare(
    `SELECT id, display_name, active, created_at, updated_at
     FROM availability_employees WHERE id = ? AND active = 1`,
  ).bind(employeeId).first<EmployeeRow>();
  return row ? publicEmployee(row) : null;
}

export async function getEmployeeAvailability(employeeId: number, weekStart: string) {
  const row = await getAvailabilityD1().prepare(
    `SELECT id, week_start, employee_id, availability_json, created_at, updated_at
     FROM employee_weekly_availability WHERE week_start = ? AND employee_id = ?`,
  ).bind(weekStart, employeeId).first<AvailabilityRow>();
  return {
    employeeId,
    weekStart,
    availability: parseAvailability(row),
    updatedAt: row?.updated_at ?? null,
  };
}

export async function getManagerWeek(weekStart: string) {
  const result = await getAvailabilityD1().prepare(
    `SELECT e.id AS employee_id, e.display_name, a.id, a.week_start, a.availability_json,
            a.created_at, a.updated_at
     FROM availability_employees e
     LEFT JOIN employee_weekly_availability a
       ON a.employee_id = e.id AND a.week_start = ?
     WHERE e.active = 1 ORDER BY e.id`,
  ).bind(weekStart).all<EmployeeRow & AvailabilityRow>();
  return result.results.map((row) => ({
    employeeId: row.employee_id,
    displayName: row.display_name,
    weekStart,
    availability: parseAvailability(row.id ? row : null),
    updatedAt: row.updated_at ?? null,
  }));
}

export function requestedWeek(value: string | null) {
  return value && validIsoDate(value) ? mondayFor(value) : currentWeekStart();
}
