"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  addDays, assignmentKey, customTimes, dayOptions, endTimes, formatAssignment, isPreset,
  isStandardAssignment, shortDate, weekdays,
  type AvailabilityMap, type Employee, type ScheduleAssignment,
} from "./schedule-utils";

type PublishedWeek = { weekStart: string; publishedAt: string | null; assignments: ScheduleAssignment[]; employees: Employee[] };
type EmployeeData = {
  employee: Employee;
  record: { availability: AvailabilityMap; updatedAt: string | null };
  weekStart: string;
  currentWeekStart: string;
  publishedSchedules: { current: PublishedWeek; next: PublishedWeek };
  error?: string;
};

export default function ScheduleApp() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [activeView, setActiveView] = useState<"availability" | "schedule">("availability");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [weekStart, setWeekStart] = useState("");
  const [availability, setAvailability] = useState<AvailabilityMap>({});
  const [published, setPublished] = useState<EmployeeData["publishedSchedules"] | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [customStart, setCustomStart] = useState("11");
  const [customEnd, setCustomEnd] = useState("6");
  const saveQueue = useRef(Promise.resolve());
  const dates = useMemo(() => weekStart ? Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)) : [], [weekStart]);

  async function load() {
    try {
      const response = await fetch("/api/availability", { cache: "no-store" });
      const data = await response.json() as EmployeeData;
      if (response.status === 401) { setAuthorized(false); return; }
      if (!response.ok) throw new Error(data.error || "个人时间暂时无法打开。");
      setAuthorized(true); setEmployee(data.employee); setWeekStart(data.weekStart);
      setAvailability(data.record.availability); setPublished(data.publishedSchedules);
      setStatus(data.record.updatedAt ? "saved" : "idle");
    } catch (caught) {
      setStatus("error"); setMessage(caught instanceof Error ? caught.message : "个人时间暂时无法打开。");
    } finally { setLoading(false); }
  }

  useEffect(() => { const timer = window.setTimeout(load, 0); return () => window.clearTimeout(timer); }, []);

  function save(next: AvailabilityMap) {
    setStatus("saving");
    const payload = { weekStart, availability: next };
    saveQueue.current = saveQueue.current.then(async () => {
      const response = await fetch("/api/availability", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as EmployeeData;
      if (!response.ok) throw new Error(data.error || "自动保存失败。");
      setAvailability(data.record.availability); setStatus("saved"); setMessage("下周可上班时间已自动保存。");
    }).catch((caught: Error) => { setStatus("error"); setMessage(caught.message); });
  }

  function updateDay(date: string, code: string | null) {
    const next = { ...availability };
    if (code) next[date] = code; else delete next[date];
    setAvailability(next); save(next);
  }

  function openEditor(index: number) {
    const current = availability[dates[index]];
    if (current && !isPreset(current, index)) {
      const [start, end] = current.split("-"); setCustomStart(start); setCustomEnd(end);
    } else { setCustomStart(index < 5 ? "11" : "11:30"); setCustomEnd("6"); }
    setEditingDay(index);
  }

  function saveCustom(event: FormEvent) {
    event.preventDefault();
    if (editingDay === null) return;
    const start = customTimes(editingDay).find((time) => time.value === customStart)?.minutes ?? 0;
    const end = endTimes(editingDay).find((time) => time.value === customEnd)?.minutes ?? 0;
    if (end <= start) { setMessage("结束时间必须晚于开始时间，C 代表午夜 12 点。"); return; }
    updateDay(dates[editingDay], `${customStart}-${customEnd}`); setEditingDay(null);
  }

  async function logout() {
    await fetch("/api/employee/logout", { method: "POST" });
    setAuthorized(false); setEmployee(null); setPublished(null);
  }

  if (loading) return <main className="loading-screen brand-loading"><img src="/m2go-logo.svg" width={180} height={90} alt="M2GO by Mandarin" /><strong>正在打开 M2GO 班表</strong></main>;
  if (!authorized || !employee) return <AccessPage />;

  return (
    <main className="app-shell employee-page">
      <BrandHeader subtitle="STAFF SCHEDULE" actions={<><span className="week-pill">每周一更新</span><button className="ghost-action" onClick={logout}>退出</button></>} />
      <section className="dashboard-head employee-head"><div><p className="eyebrow">员工个人页面</p><h1>你好，<br /><em>{employee.displayName}</em></h1><p>提交下周可以上班的时间；你的选择只有你和经理能够看到。</p></div><aside className="week-summary"><span>NEXT WEEK</span><strong>{shortDate(weekStart)} — {dates[6] && shortDate(dates[6])}</strong><p>正在收集下周时间</p></aside></section>
      {message && <Notice error={status === "error"} text={message} close={() => setMessage("")} />}
      <nav className="workspace-tabs employee-tabs" aria-label="员工页面"><button className={activeView === "availability" ? "active" : ""} onClick={() => setActiveView("availability")}>下周时间</button><button className={activeView === "schedule" ? "active" : ""} onClick={() => setActiveView("schedule")}>正式班表</button></nav>

      {activeView === "availability" ? <section className="surface availability-surface">
        <div className="section-heading"><div><p className="step-label">下周可上班时间</p><h2>{employee.displayName}，请选择每一天</h2><p>可选早班、晚班、全天或自定义时间，修改后会自动保存。</p></div><div className={`save-state ${status}`}><i />{status === "saving" ? "自动保存中…" : status === "saved" ? "已自动保存" : status === "error" ? "保存失败" : "修改后自动保存"}</div></div>
        <div className="availability-list">{dates.map((date, index) => { const selected = availability[date]; return <article className={`availability-row ${selected ? "has-value" : ""}`} key={date}><header><span>{weekdays[index]}</span><strong>{shortDate(date)}</strong>{selected && <em>{selected}</em>}</header><div className="availability-actions">{dayOptions(index).map((option) => <button key={option.value} className={selected === option.value ? "selected" : ""} onClick={() => updateDay(date, selected === option.value ? null : option.value)}><span>{option.label}</span><small>{option.hint}</small>{selected === option.value && <b>✓</b>}</button>)}<button className={selected && !isPreset(selected, index) ? "selected custom" : "custom"} onClick={() => openEditor(index)}><span>自定义</span><small>{selected && !isPreset(selected, index) ? selected : "选择时间"}</small>{selected && !isPreset(selected, index) && <b>✓</b>}</button>{selected && <button className="clear-choice" onClick={() => updateDay(date, null)}>清空</button>}</div></article>; })}</div>
        <footer className="privacy-footer"><strong>C = 12:00 AM</strong><span>每天保存一个连续时段 · 其他员工看不到你的选择</span></footer>
      </section> : <ScheduleView published={published} employee={employee} />}

      <footer className="site-footer"><strong>M2GO by Mandarin</strong><span>个人可上班时间不会向其他员工公开。</span></footer>
      <nav className="mobile-bottom-nav" aria-label="员工手机导航"><button className={activeView === "availability" ? "active" : ""} onClick={() => setActiveView("availability")}><span>＋</span>下周时间</button><button className={activeView === "schedule" ? "active" : ""} onClick={() => setActiveView("schedule")}><span>▦</span>正式班表</button></nav>

      {editingDay !== null && <div className="modal-backdrop"><button type="button" className="modal-scrim" onClick={() => setEditingDay(null)} aria-label="关闭自定义时间窗口" /><section className="modal" role="dialog" aria-modal="true" aria-labelledby="custom-title"><header><div><p className="step-label">自定义时间</p><h2 id="custom-title">{weekdays[editingDay]} · {shortDate(dates[editingDay])}</h2></div><button onClick={() => setEditingDay(null)} aria-label="关闭">×</button></header><form onSubmit={saveCustom}><div className="custom-time-row"><label>开始时间<select value={customStart} onChange={(event) => setCustomStart(event.target.value)}>{customTimes(editingDay).map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select></label><span>→</span><label>结束时间<select value={customEnd} onChange={(event) => setCustomEnd(event.target.value)}>{endTimes(editingDay).map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select></label></div><p>结束时间必须晚于开始时间；C 代表午夜 12 点。</p><footer><button type="button" onClick={() => setEditingDay(null)}>取消</button><button className="primary" type="submit">保存这个时段</button></footer></form></section></div>}
    </main>
  );
}

function BrandHeader({ subtitle, actions }: { subtitle: string; actions: React.ReactNode }) {
  return <header className="brand-header"><div className="official-brand"><img src="/m2go-logo.svg" width={112} height={56} alt="M2GO by Mandarin" /><span>{subtitle}</span></div><div className="header-actions">{actions}</div></header>;
}

function Notice({ error, text, close }: { error: boolean; text: string; close: () => void }) {
  return <div className={`notice ${error ? "notice-error" : ""}`} role="status"><span>{error ? "!" : "✓"}</span>{text}<button onClick={close} aria-label="关闭提示">×</button></div>;
}

function ScheduleView({ published, employee }: { published: EmployeeData["publishedSchedules"] | null; employee: Employee }) {
  const current = published?.current ?? null;
  const next = published?.next?.publishedAt ? published.next : null;
  return <div className="schedule-view"><MyShiftSummary schedule={current} employee={employee} label="我的本周班次" />{next && <MyShiftSummary schedule={next} employee={employee} label="我的下周班次" />}<PublishedSchedule schedule={current} activeEmployeeId={employee.id} label="本周完整班表" pending />{next && <PublishedSchedule schedule={next} activeEmployeeId={employee.id} label="下周完整班表" />}</div>;
}

function MyShiftSummary({ schedule, employee, label }: { schedule: PublishedWeek | null; employee: Employee; label: string }) {
  if (!schedule?.publishedAt) return null;
  const dates = Array.from({ length: 7 }, (_, index) => addDays(schedule.weekStart, index));
  const shifts = dates.map((date, dayIndex) => {
    const own = schedule.assignments.filter((item) => item.employeeId === employee.id && item.shiftDate === date).sort((a, b) => a.startMinutes - b.startMinutes);
    if (!own.length) return null;
    return { date, dayIndex, startMinutes: own[0].startMinutes, endMinutes: Math.max(...own.map((item) => item.endMinutes)) };
  }).filter(Boolean) as Array<{ date: string; dayIndex: number; startMinutes: number; endMinutes: number }>;
  return <section className="surface my-shifts"><div className="section-heading"><div><p className="step-label">{label}</p><h2>{shifts.length ? `${shifts.length} 天有班` : "这周没有安排班次"}</h2></div><span className="count-badge">{shortDate(schedule.weekStart)} — {shortDate(dates[6])}</span></div>{shifts.length > 0 && <div className="my-shift-grid">{shifts.map((shift) => <article key={shift.date}><span>{weekdays[shift.dayIndex]}</span><strong>{shortDate(shift.date)}</strong><b>{formatAssignment(shift)}</b></article>)}</div>}</section>;
}

function PublishedSchedule({ schedule, activeEmployeeId, label, pending = false }: { schedule: PublishedWeek | null; activeEmployeeId: number; label: string; pending?: boolean }) {
  if (!schedule?.publishedAt) return pending ? <section className="surface pending-schedule"><div className="section-heading"><div><p className="step-label">{label}</p><h2>经理正在安排中</h2><p>正式发布后会显示在这里，经理的草稿不会提前公开。</p></div><span className="count-badge muted">尚未发布</span></div></section> : null;
  const dates = Array.from({ length: 7 }, (_, index) => addDays(schedule.weekStart, index));
  const assignmentFor = (date: string, shiftCode: "early" | "late", employeeId: number) => schedule.assignments.find((item) => assignmentKey(item.shiftDate, item.shiftCode, item.employeeId) === assignmentKey(date, shiftCode, employeeId));
  return <section className="surface published-schedule"><div className="section-heading"><div><p className="step-label">{label}</p><h2>{shortDate(schedule.weekStart)} — {shortDate(dates[6])}</h2><p>这是经理最后发布的版本。</p></div><span className="count-badge">已发布</span></div><div className="team-table-wrap"><table className="team-table published-table"><thead><tr><th rowSpan={2}>Name</th>{dates.map((date, index) => <th key={date} colSpan={2}>{shortDate(date)}<small>{weekdays[index].slice(-1)}</small></th>)}</tr><tr>{dates.flatMap((_, index) => [<th key={`${index}-early`}>{index < 5 ? "11–6" : "11:30–6"}</th>, <th key={`${index}-late`}>6–C</th>])}</tr></thead><tbody>{schedule.employees.map((person) => <tr className={person.id === activeEmployeeId ? "my-schedule-row" : ""} key={person.id}><th>{person.displayName}{person.id === activeEmployeeId && <small>我</small>}</th>{dates.flatMap((date, dayIndex) => (["early", "late"] as const).map((shiftCode) => { const assignment = assignmentFor(date, shiftCode, person.id); const custom = assignment && !isStandardAssignment(assignment, dayIndex) ? formatAssignment(assignment) : ""; return <td className={assignment ? "scheduled" : ""} key={`${date}-${shiftCode}`} aria-label={assignment ? `${person.displayName} ${date} ${formatAssignment(assignment)}` : undefined}>{custom}</td>; }))}</tr>)}</tbody></table></div></section>;
}

function AccessPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [setupEmployee, setSetupEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const setupMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("setup") === "1";
  const invalid = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("access") === "invalid";

  useEffect(() => {
    async function loadAccess() {
      if (setupMode) {
        const response = await fetch("/api/employee/setup", { cache: "no-store" });
        const data = await response.json() as { employee?: Employee; error?: string };
        if (response.ok && data.employee) setSetupEmployee(data.employee); else setError(data.error || "设置链接无效。");
        return;
      }
      const response = await fetch("/api/employees", { cache: "no-store" });
      const data = await response.json() as { employees?: Employee[]; error?: string };
      if (response.ok) setEmployees(data.employees ?? []); else setError(data.error || "员工名单暂时无法打开。");
    }
    const timer = window.setTimeout(loadAccess, 0); return () => window.clearTimeout(timer);
  }, [setupMode]);

  async function login(event: FormEvent) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError("");
    const response = await fetch("/api/employee/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ employeeId: selected.id, pin }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setError(data.error || "登录失败。"); setBusy(false); return; }
    window.location.replace("/");
  }

  async function setupPin(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/employee/setup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin, confirmPin }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setError(data.error || "PIN 暂时无法设置。"); setBusy(false); return; }
    window.location.replace("/");
  }

  return <main className="auth-shell"><BrandHeader subtitle="STAFF ACCESS" actions={<Link className="ghost-action" href="/manager">经理入口</Link>} />{setupMode ? <section className="auth-layout"><div className="auth-copy"><p className="eyebrow">第一次使用／重置 PIN</p><h1>设置你的<br /><em>四位 PIN。</em></h1><p>{setupEmployee ? `你好，${setupEmployee.displayName}。这个 PIN 由你自己记住，经理只能重置，不能查看。` : "正在确认你的设置链接。"}</p></div><form className="pin-card" onSubmit={setupPin}><span className="auth-kicker">STAFF PIN</span><h2>{setupEmployee ? `${setupEmployee.displayName}，设置 PIN` : "等待链接确认"}</h2><label>输入四位数字<input aria-label="设置四位员工 PIN" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" required /></label><label>再输入一次<input aria-label="确认四位员工 PIN" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} type="password" value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" required /></label><button disabled={!setupEmployee || pin.length !== 4 || confirmPin.length !== 4 || busy}>{busy ? "设置中…" : "设置并进入我的页面"}</button>{error && <p className="form-error" role="alert">{error}</p>}<small>链接设置成功后会自动失效。</small></form></section> : <section className="staff-auth-layout"><div className="auth-copy"><p className="eyebrow">员工入口</p><h1>选择名字，<br /><em>进入我的时间表。</em></h1><p>登录后只会看到并修改你自己的可上班时间。这台手机会记住登录状态 30 天。</p>{invalid && <p className="form-error">这个设置链接无效或已经使用，请联系经理重新发送。</p>}</div>{selected ? <form className="pin-card staff-pin-card" onSubmit={login}><button type="button" className="back-choice" onClick={() => { setSelected(null); setPin(""); setError(""); }}>← 重新选择名字</button><span className="auth-kicker">EMPLOYEE #{String(selected.id).padStart(2, "0")}</span><h2>{selected.displayName}</h2><label>四位员工 PIN<input aria-label={`${selected.displayName} 四位员工 PIN`} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" required /></label><button disabled={pin.length !== 4 || busy}>{busy ? "登录中…" : "进入我的时间表"}</button>{error && <p className="form-error" role="alert">{error}</p>}<small>忘记 PIN？请联系经理重新发送设置链接。</small></form> : <div className="staff-name-picker">{employees.map((person) => <button key={person.id} onClick={() => { setSelected(person); setError(""); }}><span>#{String(person.id).padStart(2, "0")}</span><strong>{person.displayName}</strong><small>这是我 →</small></button>)}{error && <p className="form-error" role="alert">{error}</p>}</div>}</section>}</main>;
}
