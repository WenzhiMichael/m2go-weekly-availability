import { env } from "cloudflare:workers";

export type D1Row = Record<string, string | number | null>;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'front',
    color TEXT NOT NULL DEFAULT '#75A9F2',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS schedule_weeks (
    week_start TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'draft',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS shift_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    label TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    ends_next_day INTEGER NOT NULL DEFAULT 0,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    note TEXT NOT NULL DEFAULT '',
    UNIQUE (weekday, label)
  )`,
  `CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start TEXT NOT NULL REFERENCES schedule_weeks(week_start) ON DELETE CASCADE,
    shift_date TEXT NOT NULL,
    label TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    ends_next_day INTEGER NOT NULL DEFAULT 0,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    note TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (shift_date, label)
  )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_shifts_week_start ON shifts(week_start)`,
  `CREATE INDEX IF NOT EXISTS idx_shifts_employee_week ON shifts(employee_id, week_start)`,
  `CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(active)`,
  "PRAGMA optimize",
];

export function getD1() {
  if (!env.DB) throw new Error("M2GO 排班数据库尚未连接。");
  return env.DB;
}

function isoFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addDays(isoDate: string, amount: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return isoFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function mondayFor(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  const weekday = date.getUTCDay();
  return addDays(isoDate, -(weekday === 0 ? 6 : weekday - 1));
}

export function currentTorontoDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function currentWeekStart(now = new Date()) {
  return mondayFor(currentTorontoDate(now));
}

export function validIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

export function validTime(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function endsNextDay(startTime: string, endTime: string) {
  return endTime <= startTime ? 1 : 0;
}

export async function initializeDatabase() {
  const db = getD1();
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)").bind("timezone", "America/Toronto"),
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)").bind("store_name", "M2GO"),
  ]);

  const templateCount = await db.prepare("SELECT COUNT(*) AS count FROM shift_templates").first<{ count: number }>();
  if (!templateCount?.count) {
    const inserts = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      inserts.push(
        db.prepare("INSERT INTO shift_templates (weekday, label, start_time, end_time, ends_next_day) VALUES (?, ?, ?, ?, ?)")
          .bind(weekday, "早班", "11:00", "18:00", 0),
        db.prepare("INSERT INTO shift_templates (weekday, label, start_time, end_time, ends_next_day) VALUES (?, ?, ?, ?, ?)")
          .bind(weekday, "晚班", "18:00", "00:30", 1),
      );
    }
    await db.batch(inserts);
  }
}

export async function ensureWeek(weekStart: string) {
  const db = getD1();
  await db.prepare("INSERT OR IGNORE INTO schedule_weeks (week_start) VALUES (?)").bind(weekStart).run();
  const existing = await db.prepare("SELECT COUNT(*) AS count FROM shifts WHERE week_start = ?").bind(weekStart).first<{ count: number }>();
  if (existing?.count) return;

  const templates = await db.prepare(
    "SELECT weekday, label, start_time, end_time, ends_next_day, employee_id, note FROM shift_templates ORDER BY weekday, start_time",
  ).all<D1Row>();
  const inserts = templates.results.map((template) => {
    const shiftDate = addDays(weekStart, Number(template.weekday));
    return db.prepare(
      `INSERT OR IGNORE INTO shifts
       (week_start, shift_date, label, start_time, end_time, ends_next_day, employee_id, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      weekStart,
      shiftDate,
      template.label,
      template.start_time,
      template.end_time,
      template.ends_next_day,
      template.employee_id,
      template.note,
    );
  });
  if (inserts.length) await db.batch(inserts);
}
