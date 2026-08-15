import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the M2GO schedule application", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>M2GO 员工班表<\/title>/i);
  assert.match(html, /M2GO/);
  assert.match(html, /正在打开 M2GO 班表/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps product metadata and removes starter preview code", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /ScheduleApp/);
  assert.match(layout, /lang="zh-CN"/);
  assert.match(packageJson, /m2go-staff-schedule/);
  assert.doesNotMatch(`${page}\n${layout}\n${packageJson}`, /_sites-preview|react-loading-skeleton|Starter Project/);
});

test("renders the manager entry without exposing manager data", async () => {
  const response = await render("/manager");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>M2GO 经理总表<\/title>/i);
  assert.match(html, /正在打开经理页面/);
});

test("keeps employee and manager data paths separate", async () => {
  const [employeeUi, availabilityRoute, employeeListRoute, managerRoute, employeeAuth, exampleEnv] = await Promise.all([
    readFile(new URL("../app/ScheduleApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/availability/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/employees/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/manager/availability/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/employee-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(employeeUi, /employee-grid|selectEmployee/);
  assert.match(employeeUi, /个人专属链接|publishedSchedules/);
  assert.match(availabilityRoute, /getEmployeeSession/);
  assert.doesNotMatch(availabilityRoute, /body\.employeeId|searchParams\.get\("employeeId"\)/);
  assert.match(employeeListRoute, /员工名单不公开/);
  assert.doesNotMatch(availabilityRoute, /getManagerWeek/);
  assert.match(managerRoute, /hasManagerSession/);
  assert.match(employeeAuth, /SHA-256|HttpOnly|SameSite=Strict/);
  assert.doesNotMatch(exampleEnv, /pbkdf2_sha256\$\d+\$[^\r\n]+/);
});

test("keeps manager draft separate from published schedule", async () => {
  const [draftRoute, publishRoute, managerUi] = await Promise.all([
    readFile(new URL("../app/api/manager/schedule/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/manager/schedule/publish/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/manager/ManagerApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(draftRoute, /state\) VALUES \(\?, \?, \?, \?, 'draft'\)/);
  assert.match(publishRoute, /DELETE FROM weekly_schedule_assignments[\s\S]*state = 'published'/);
  assert.match(publishRoute, /SELECT week_start, shift_date, shift_code, employee_id, 'published'/);
  assert.match(managerUi, /availabilityCoverage|发布最终班表|同班关系/);
});
