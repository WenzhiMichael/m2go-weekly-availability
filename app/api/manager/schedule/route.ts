import { addDays, validIsoDate } from "../../../../db/schedule";
import { employeeIdFrom, getAvailabilityD1, getEmployee, initializeAvailabilityDatabase, nextWeekStart } from "../../../../db/availability";
import { hasManagerSession } from "../../../../db/manager-auth";

export async function POST(request: Request) {
  if (!(await hasManagerSession(request))) return Response.json({ error: "请先登录经理页面。" }, { status: 401 });
  await initializeAvailabilityDatabase();
  const body = await request.json() as { weekStart?: unknown; shiftDate?: unknown; shiftCode?: unknown; employeeId?: unknown; assigned?: unknown };
  const employeeId = employeeIdFrom(body.employeeId);
  const weekStart = nextWeekStart();
  const allowedDates = new Set(Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)));
  if (body.weekStart !== weekStart || !validIsoDate(body.shiftDate) || !allowedDates.has(body.shiftDate)) return Response.json({ error: "只能安排下周班表。" }, { status: 400 });
  if (body.shiftCode !== "early" && body.shiftCode !== "late") return Response.json({ error: "班次不正确。" }, { status: 400 });
  if (!employeeId || !(await getEmployee(employeeId))) return Response.json({ error: "员工不正确。" }, { status: 400 });
  if (typeof body.assigned !== "boolean") return Response.json({ error: "排班状态不正确。" }, { status: 400 });
  const db = getAvailabilityD1();
  if (body.assigned) {
    await db.prepare(
      `INSERT OR IGNORE INTO weekly_schedule_assignments
       (week_start, shift_date, shift_code, employee_id, state) VALUES (?, ?, ?, ?, 'draft')`,
    ).bind(weekStart, body.shiftDate, body.shiftCode, employeeId).run();
  } else {
    await db.prepare(
      `DELETE FROM weekly_schedule_assignments
       WHERE week_start = ? AND shift_date = ? AND shift_code = ? AND employee_id = ? AND state = 'draft'`,
    ).bind(weekStart, body.shiftDate, body.shiftCode, employeeId).run();
  }
  return Response.json({ ok: true });
}
