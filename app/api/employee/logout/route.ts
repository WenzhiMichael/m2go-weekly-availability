import { clearEmployeeSessionCookie } from "../../../../db/employee-auth";

export async function POST(request: Request) {
  return Response.json({ ok: true }, { headers: { "set-cookie": clearEmployeeSessionCookie(request) } });
}
