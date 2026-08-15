import { getManagerWeek, initializeAvailabilityDatabase, requestedWeek } from "../../../../db/availability";
import { hasManagerSession } from "../../../../db/manager-auth";
import { currentWeekStart } from "../../../../db/schedule";

export async function GET(request: Request) {
  try {
    if (!(await hasManagerSession(request))) return Response.json({ error: "请先登录经理页面。" }, { status: 401 });
    await initializeAvailabilityDatabase();
    const weekStart = requestedWeek(new URL(request.url).searchParams.get("week"));
    return Response.json({
      weekStart,
      currentWeekStart: currentWeekStart(),
      records: await getManagerWeek(weekStart),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "经理总表暂时无法打开。";
    return Response.json({ error: message }, { status: 500 });
  }
}
