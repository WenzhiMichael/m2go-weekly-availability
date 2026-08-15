import { getAvailabilityD1, initializeAvailabilityDatabase, nextWeekStart } from "../../../../../db/availability";
import { hasManagerSession } from "../../../../../db/manager-auth";

export async function POST(request: Request) {
  if (!(await hasManagerSession(request))) return Response.json({ error: "请先登录经理页面。" }, { status: 401 });
  await initializeAvailabilityDatabase();
  const body = await request.json() as { weekStart?: unknown };
  const weekStart = nextWeekStart();
  if (body.weekStart !== weekStart) return Response.json({ error: "只能保存下周班表。" }, { status: 400 });

  const result = await getAvailabilityD1().prepare(
    "UPDATE weekly_schedule_assignments SET updated_at = CURRENT_TIMESTAMP WHERE week_start = ? AND state = 'draft'",
  ).bind(weekStart).run();

  return Response.json({ ok: true, savedAt: new Date().toISOString(), assignments: result.meta.changes ?? 0 });
}
