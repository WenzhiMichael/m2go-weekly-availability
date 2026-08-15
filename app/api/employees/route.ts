export async function GET() {
  return Response.json({ error: "员工名单不公开，请使用个人专属链接。" }, { status: 410 });
}
