import {
  cleanAvailability,
  employeeIdFrom,
  getAvailabilityD1,
  getEmployee,
  getEmployeeAvailability,
  initializeAvailabilityDatabase,
  requestedWeek,
} from "../../../db/availability";
import { currentWeekStart, validIsoDate } from "../../../db/schedule";

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "未知错误";
  return Response.json({ error: message }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    await initializeAvailabilityDatabase();
    const url = new URL(request.url);
    const employeeId = employeeIdFrom(url.searchParams.get("employeeId"));
    if (!employeeId) return Response.json({ error: "员工编号不正确。" }, { status: 400 });
    const employee = await getEmployee(employeeId);
    if (!employee) return Response.json({ error: "找不到这位员工。" }, { status: 404 });
    const weekStart = requestedWeek(url.searchParams.get("week"));
    const record = await getEmployeeAvailability(employeeId, weekStart);
    return Response.json({ employee, record, weekStart, currentWeekStart: currentWeekStart() });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    await initializeAvailabilityDatabase();
    const body = await request.json() as { employeeId?: unknown; weekStart?: unknown; availability?: unknown };
    const employeeId = employeeIdFrom(body.employeeId);
    if (!employeeId) return Response.json({ error: "员工编号不正确。" }, { status: 400 });
    const employee = await getEmployee(employeeId);
    if (!employee) return Response.json({ error: "找不到这位员工。" }, { status: 404 });
    if (!validIsoDate(body.weekStart)) return Response.json({ error: "周日期不正确。" }, { status: 400 });
    const weekStart = requestedWeek(body.weekStart);
    const availability = cleanAvailability(body.availability, weekStart);
    if (!availability) return Response.json({ error: "可上班时间不正确，请重新选择。" }, { status: 400 });

    const db = getAvailabilityD1();
    await db.prepare(
      `INSERT INTO employee_weekly_availability (week_start, employee_id, availability_json)
       VALUES (?, ?, ?)
       ON CONFLICT(week_start, employee_id) DO UPDATE SET
         availability_json = excluded.availability_json,
         updated_at = CURRENT_TIMESTAMP`,
    ).bind(weekStart, employeeId, JSON.stringify(availability)).run();

    return Response.json({
      ok: true,
      employee,
      record: await getEmployeeAvailability(employeeId, weekStart),
      weekStart,
      currentWeekStart: currentWeekStart(),
    });
  } catch (error) {
    return routeError(error);
  }
}
