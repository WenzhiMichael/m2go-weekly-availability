import {
  addDays,
  currentWeekStart,
  endsNextDay,
  ensureWeek,
  getD1,
  initializeDatabase,
  mondayFor,
  validIsoDate,
  validTime,
} from "../../../db/schedule";

type Payload = {
  action?: string;
  id?: number;
  weekStart?: string;
  shiftDate?: string;
  label?: string;
  startTime?: string;
  endTime?: string;
  employeeId?: number | null;
  note?: string;
  name?: string;
  role?: string;
  active?: boolean;
  status?: "draft" | "published";
  updateTemplate?: boolean;
};

function cleanText(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "未知错误";
  return Response.json({ error: message }, { status: 500 });
}

async function readSchedule(weekStart: string) {
  const db = getD1();
  await ensureWeek(weekStart);
  const [week, employees, shifts, templates] = await Promise.all([
    db.prepare("SELECT week_start, status, note, created_at, updated_at FROM schedule_weeks WHERE week_start = ?").bind(weekStart).first(),
    db.prepare("SELECT id, name, role, color, active, created_at FROM employees ORDER BY active DESC, name COLLATE NOCASE").all(),
    db.prepare(
      `SELECT s.id, s.week_start, s.shift_date, s.label, s.start_time, s.end_time,
              s.ends_next_day, s.employee_id, s.note, s.updated_at, e.name AS employee_name, e.color AS employee_color
       FROM shifts s LEFT JOIN employees e ON e.id = s.employee_id
       WHERE s.week_start = ? ORDER BY s.shift_date, s.start_time, s.id`,
    ).bind(weekStart).all(),
    db.prepare(
      `SELECT t.id, t.weekday, t.label, t.start_time, t.end_time, t.ends_next_day,
              t.employee_id, t.note, e.name AS employee_name
       FROM shift_templates t LEFT JOIN employees e ON e.id = t.employee_id
       ORDER BY t.weekday, t.start_time, t.id`,
    ).all(),
  ]);
  return { week, employees: employees.results, shifts: shifts.results, templates: templates.results };
}

export async function GET(request: Request) {
  try {
    await initializeDatabase();
    const requested = new URL(request.url).searchParams.get("week");
    const weekStart = requested && validIsoDate(requested) ? mondayFor(requested) : currentWeekStart();
    const data = await readSchedule(weekStart);
    return Response.json({ ...data, weekStart, currentWeekStart: currentWeekStart(), nextWeekStart: addDays(weekStart, 7) });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    await initializeDatabase();
    const body = (await request.json()) as Payload;
    const db = getD1();

    if (body.action === "saveShift") {
      if (!body.id || !validTime(body.startTime) || !validTime(body.endTime)) {
        return Response.json({ error: "班次时间不完整。" }, { status: 400 });
      }
      const label = cleanText(body.label, 30);
      if (!label) return Response.json({ error: "请填写班次名称。" }, { status: 400 });
      await db.prepare(
        `UPDATE shifts SET label = ?, start_time = ?, end_time = ?, ends_next_day = ?, employee_id = ?, note = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      ).bind(label, body.startTime, body.endTime, endsNextDay(body.startTime, body.endTime), body.employeeId ?? null, cleanText(body.note, 300), body.id).run();

      if (body.updateTemplate) {
        const shift = await db.prepare("SELECT shift_date FROM shifts WHERE id = ?").bind(body.id).first<{ shift_date: string }>();
        if (shift) {
          const weekday = Math.round((Date.parse(`${shift.shift_date}T12:00:00Z`) - Date.parse(`${mondayFor(shift.shift_date)}T12:00:00Z`)) / 86400000);
          await db.prepare(
            `INSERT INTO shift_templates (weekday, label, start_time, end_time, ends_next_day, employee_id, note)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(weekday, label) DO UPDATE SET start_time = excluded.start_time, end_time = excluded.end_time,
               ends_next_day = excluded.ends_next_day, employee_id = excluded.employee_id, note = excluded.note`,
          ).bind(weekday, label, body.startTime, body.endTime, endsNextDay(body.startTime, body.endTime), body.employeeId ?? null, cleanText(body.note, 300)).run();
        }
      }
    } else if (body.action === "createShift") {
      if (!validIsoDate(body.weekStart) || !validIsoDate(body.shiftDate) || !validTime(body.startTime) || !validTime(body.endTime)) {
        return Response.json({ error: "新班次的日期或时间不正确。" }, { status: 400 });
      }
      const weekStart = mondayFor(body.weekStart);
      await ensureWeek(weekStart);
      const label = cleanText(body.label, 30) || "自定义班";
      await db.prepare(
        `INSERT INTO shifts (week_start, shift_date, label, start_time, end_time, ends_next_day, employee_id, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(weekStart, body.shiftDate, label, body.startTime, body.endTime, endsNextDay(body.startTime, body.endTime), body.employeeId ?? null, cleanText(body.note, 300)).run();
    } else if (body.action === "deleteShift") {
      if (!body.id) return Response.json({ error: "找不到这个班次。" }, { status: 400 });
      await db.prepare("DELETE FROM shifts WHERE id = ?").bind(body.id).run();
    } else if (body.action === "addEmployee") {
      const name = cleanText(body.name, 60);
      if (!name) return Response.json({ error: "请填写员工姓名。" }, { status: 400 });
      const palette = ["#75A9F2", "#F29B75", "#7CC9A5", "#B394E8", "#E1B85F", "#E27C9D"];
      const count = await db.prepare("SELECT COUNT(*) AS count FROM employees").first<{ count: number }>();
      await db.prepare("INSERT INTO employees (name, role, color) VALUES (?, ?, ?)")
        .bind(name, cleanText(body.role, 30) || "front", palette[(count?.count ?? 0) % palette.length]).run();
    } else if (body.action === "updateEmployee") {
      if (!body.id) return Response.json({ error: "找不到这位员工。" }, { status: 400 });
      const name = cleanText(body.name, 60);
      if (!name) return Response.json({ error: "员工姓名不能为空。" }, { status: 400 });
      await db.prepare("UPDATE employees SET name = ?, role = ?, active = ? WHERE id = ?")
        .bind(name, cleanText(body.role, 30) || "front", body.active === false ? 0 : 1, body.id).run();
    } else if (body.action === "saveTemplate") {
      if (!body.id || !validTime(body.startTime) || !validTime(body.endTime)) {
        return Response.json({ error: "固定班时间不完整。" }, { status: 400 });
      }
      await db.prepare(
        `UPDATE shift_templates SET start_time = ?, end_time = ?, ends_next_day = ?, employee_id = ?, note = ? WHERE id = ?`,
      ).bind(body.startTime, body.endTime, endsNextDay(body.startTime, body.endTime), body.employeeId ?? null, cleanText(body.note, 300), body.id).run();
    } else if (body.action === "publishWeek") {
      if (!validIsoDate(body.weekStart) || !["draft", "published"].includes(body.status ?? "")) {
        return Response.json({ error: "周状态不正确。" }, { status: 400 });
      }
      await ensureWeek(mondayFor(body.weekStart));
      await db.prepare("UPDATE schedule_weeks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE week_start = ?")
        .bind(body.status, mondayFor(body.weekStart)).run();
    } else {
      return Response.json({ error: "不支持这个操作。" }, { status: 400 });
    }

    const weekStart = validIsoDate(body.weekStart) ? mondayFor(body.weekStart) : currentWeekStart();
    const data = await readSchedule(weekStart);
    return Response.json({ ok: true, ...data, weekStart, currentWeekStart: currentWeekStart() });
  } catch (error) {
    return routeError(error);
  }
}
