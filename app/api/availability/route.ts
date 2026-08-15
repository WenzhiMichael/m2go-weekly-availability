import {
  cleanAvailability,
  getAvailabilityD1,
  initializeAvailabilityDatabase,
  normalizeName,
  parseAvailability,
  requestedWeek,
  type AvailabilityRow,
} from "../../../db/availability";
import { currentWeekStart, validIsoDate } from "../../../db/schedule";

async function readWeek(weekStart: string) {
  const result = await getAvailabilityD1().prepare(
    `SELECT id, week_start, normalized_name, display_name, availability_json, created_at, updated_at
     FROM weekly_availability WHERE week_start = ? ORDER BY id`,
  ).bind(weekStart).all<AvailabilityRow>();
  return result.results.map(parseAvailability);
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "未知错误";
  return Response.json({ error: message }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    await initializeAvailabilityDatabase();
    const weekStart = requestedWeek(new URL(request.url).searchParams.get("week"));
    return Response.json({ weekStart, currentWeekStart: currentWeekStart(), records: await readWeek(weekStart) });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    await initializeAvailabilityDatabase();
    const body = await request.json() as { name?: unknown; weekStart?: unknown; availability?: unknown };
    const name = normalizeName(body.name);
    if (!name) return Response.json({ error: "姓名只能填写一个英文名，例如 Alex。" }, { status: 400 });
    if (!validIsoDate(body.weekStart)) return Response.json({ error: "周日期不正确。" }, { status: 400 });
    const weekStart = requestedWeek(body.weekStart);
    const availability = cleanAvailability(body.availability, weekStart);
    if (!availability) return Response.json({ error: "可上班时间不正确，请重新选择。" }, { status: 400 });

    const db = getAvailabilityD1();
    await db.prepare(
      `INSERT INTO weekly_availability (week_start, normalized_name, display_name, availability_json)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(week_start, normalized_name) DO UPDATE SET
         display_name = excluded.display_name,
         availability_json = excluded.availability_json,
         updated_at = CURRENT_TIMESTAMP`,
    ).bind(weekStart, name.toLowerCase(), name, JSON.stringify(availability)).run();

    return Response.json({ ok: true, weekStart, currentWeekStart: currentWeekStart(), records: await readWeek(weekStart) });
  } catch (error) {
    return routeError(error);
  }
}
