import { employeeIdFrom, getAvailabilityD1, getEmployee, initializeAvailabilityDatabase } from "../../../../db/availability";
import { hasManagerSession } from "../../../../db/manager-auth";

export async function POST(request: Request) {
  if (!(await hasManagerSession(request))) return Response.json({ error: "请先登录经理页面。" }, { status: 401 });
  await initializeAvailabilityDatabase();
  const body = await request.json() as { employeeAId?: unknown; employeeBId?: unknown; preferenceType?: unknown };
  const first = employeeIdFrom(body.employeeAId);
  const second = employeeIdFrom(body.employeeBId);
  if (!first || !second || first === second || !(await getEmployee(first)) || !(await getEmployee(second))) return Response.json({ error: "请选择两位不同员工。" }, { status: 400 });
  const [employeeAId, employeeBId] = first < second ? [first, second] : [second, first];
  const db = getAvailabilityD1();
  if (body.preferenceType === null) {
    await db.prepare("DELETE FROM employee_pair_preferences WHERE employee_a_id = ? AND employee_b_id = ?").bind(employeeAId, employeeBId).run();
  } else if (body.preferenceType === "prefer" || body.preferenceType === "avoid") {
    await db.prepare(
      `INSERT INTO employee_pair_preferences (employee_a_id, employee_b_id, preference_type)
       VALUES (?, ?, ?)
       ON CONFLICT(employee_a_id, employee_b_id) DO UPDATE SET preference_type = excluded.preference_type, updated_at = CURRENT_TIMESTAMP`,
    ).bind(employeeAId, employeeBId, body.preferenceType).run();
  } else {
    return Response.json({ error: "关系类型不正确。" }, { status: 400 });
  }
  return Response.json({ ok: true });
}
