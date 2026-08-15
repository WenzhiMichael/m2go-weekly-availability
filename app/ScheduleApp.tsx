"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  addDays, assignmentKey, customTimes, dayOptions, endTimes, isPreset, shortDate, weekdays,
  type AvailabilityMap, type Employee, type ScheduleAssignment,
} from "./schedule-utils";

type EmployeeData = {
  employee: Employee;
  record: { availability: AvailabilityMap; updatedAt: string | null };
  weekStart: string;
  currentWeekStart: string;
  publishedSchedules: {
    current: { weekStart: string; publishedAt: string | null; assignments: ScheduleAssignment[]; employees: Employee[] };
    next: { weekStart: string; publishedAt: string | null; assignments: ScheduleAssignment[]; employees: Employee[] };
  };
  error?: string;
};

export default function ScheduleApp() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
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
      setAuthorized(true);
      setEmployee(data.employee);
      setWeekStart(data.weekStart);
      setAvailability(data.record.availability);
      setPublished(data.publishedSchedules);
      setStatus(data.record.updatedAt ? "saved" : "idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "个人时间暂时无法打开。");
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
      setAvailability(data.record.availability);
      setStatus("saved");
      setMessage("下周可上班时间已自动保存。");
    }).catch((error: Error) => { setStatus("error"); setMessage(error.message); });
  }

  function updateDay(date: string, code: string | null) {
    const next = { ...availability };
    if (code) next[date] = code; else delete next[date];
    setAvailability(next); save(next);
  }

  function openEditor(index: number) {
    const current = availability[dates[index]];
    if (current && !isPreset(current, index)) {
      const [start, end] = current.split("-");
      setCustomStart(start); setCustomEnd(end);
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

  if (loading) return <main className="loading-screen"><span className="brand-mark">M2</span><strong>正在打开 M2GO 班表</strong></main>;
  if (!authorized || !employee) return <AccessPage />;

  return (
    <main className="site-shell">
      <header className="site-header"><div className="brand-lockup"><span className="brand-mark">M2</span><div><strong>M2GO</strong><small>MY WEEK</small></div></div><div className="header-actions"><span className="week-pill">每周一自动更新</span><button className="header-link" onClick={logout}>退出我的页面</button></div></header>
      <section className="hero compact-hero"><div><p className="eyebrow">员工个人页面</p><h1>你好，<em>{employee.displayName}</em></h1><p className="hero-copy">先查看本周正式班表，再提交你下周可以上班的时间。你的提交只有你和经理能看到。</p></div><aside className="week-card"><span>NEXT WEEK</span><strong>{shortDate(weekStart)} — {dates[6] && shortDate(dates[6])}</strong><p>正在收集下周时间</p></aside></section>
      {message && <div className={`notice ${status === "error" ? "notice-error" : ""}`} role="status"><span>{status === "error" ? "!" : "✓"}</span>{message}<button onClick={() => setMessage("")} aria-label="关闭提示">×</button></div>}
      <PublishedSchedule schedule={published?.current ?? null} activeEmployeeId={employee.id} label="本周正式班表" pending />
      {published?.next.publishedAt && <PublishedSchedule schedule={published.next} activeEmployeeId={employee.id} label="下周已发布班表" />}
      <section className="availability-section">
        <div className="section-heading"><div><p className="step-label">02 · 提交下周时间</p><h2>{employee.displayName}，下周哪天可以上班？</h2><p className="section-copy">只会保存到你的个人记录，其他员工无法查看。</p></div><div className={`save-state ${status}`}><i />{status === "saving" ? "自动保存中…" : status === "saved" ? "已自动保存" : status === "error" ? "保存失败" : "修改后自动保存"}</div></div>
        <div className="day-grid">{dates.map((date, index) => { const selected = availability[date]; return <article className={`day-card ${selected ? "has-value" : ""}`} key={date}><header><span>{weekdays[index]}</span><strong>{shortDate(date)}</strong></header><div className="shift-options">{dayOptions(index).map((option) => <button key={option.value} className={selected === option.value ? "selected" : ""} onClick={() => updateDay(date, selected === option.value ? null : option.value)}><span>{option.label}</span><strong>{option.hint}</strong><i>{selected === option.value ? "✓" : "+"}</i></button>)}<button className={selected && !isPreset(selected, index) ? "selected custom-selected" : "edit-option"} onClick={() => openEditor(index)}><span>自定义</span><strong>{selected && !isPreset(selected, index) ? selected : "Edit"}</strong><i>✎</i></button></div>{selected && <button className="clear-day" onClick={() => updateDay(date, null)}>清空当天</button>}</article>; })}</div>
        <footer className="availability-footer"><p><strong>C = 12:00 AM</strong>（当天午夜）· 每天保存一个连续时段</p></footer>
      </section>
      <footer className="site-footer"><strong>M2GO</strong><span>个人可上班时间不会向其他员工公开。</span></footer>
      {editingDay !== null && <div className="modal-backdrop"><button type="button" className="modal-scrim" onClick={() => setEditingDay(null)} aria-label="关闭自定义时间窗口" /><section className="modal" role="dialog" aria-modal="true" aria-labelledby="custom-title"><header><div><p className="step-label">自定义时间</p><h2 id="custom-title">{weekdays[editingDay]} · {shortDate(dates[editingDay])}</h2></div><button onClick={() => setEditingDay(null)} aria-label="关闭">×</button></header><form onSubmit={saveCustom}><div className="custom-time-row"><label>开始时间<select value={customStart} onChange={(event) => setCustomStart(event.target.value)}>{customTimes(editingDay).map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select></label><span>→</span><label>结束时间<select value={customEnd} onChange={(event) => setCustomEnd(event.target.value)}>{endTimes(editingDay).map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select></label></div><p>结束时间必须晚于开始时间；C 代表午夜 12 点。</p><footer><button type="button" onClick={() => setEditingDay(null)}>取消</button><button className="primary" type="submit">保存这个时段</button></footer></form></section></div>}
    </main>
  );
}

function AccessPage() {
  const invalid = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("access") === "invalid";
  return <main className="manager-shell"><header className="site-header"><div className="brand-lockup"><span className="brand-mark">M2</span><div><strong>M2GO</strong><small>STAFF ACCESS</small></div></div><Link className="header-link" href="/manager">经理入口</Link></header><section className="access-landing"><div><p className="eyebrow">员工入口</p><h1>使用你的<br /><em>个人专属链接。</em></h1><p>为了保护每个人提交的时间，员工名单不再公开。请打开经理私下发给你的链接，并把它收藏到手机。</p>{invalid && <p className="form-error">这个链接无效或已经被经理重置，请索取新链接。</p>}</div><aside className="access-card"><span className="lock-mark">✓</span><h2>互相看不到提交时间</h2><p>你只能填写自己的时间；经理发布后，大家才会看到完整正式班表。</p></aside></section></main>;
}

type PublishedWeek = EmployeeData["publishedSchedules"]["current"];
function PublishedSchedule({ schedule, activeEmployeeId, label, pending = false }: { schedule: PublishedWeek | null; activeEmployeeId: number; label: string; pending?: boolean }) {
  if (!schedule?.publishedAt) return pending ? <section className="team-section pending-schedule"><div className="section-heading"><div><p className="step-label">01 · {label}</p><h2>经理正在安排中</h2><p>正式发布后会显示在这里，经理的草稿不会提前公开。</p></div><span className="count-badge">尚未发布</span></div></section> : null;
  const dates = Array.from({ length: 7 }, (_, index) => addDays(schedule.weekStart, index));
  const assigned = new Set(schedule.assignments.map((item) => assignmentKey(item.shiftDate, item.shiftCode, item.employeeId)));
  return <section className="team-section"><div className="section-heading"><div><p className="step-label">01 · {label}</p><h2>{shortDate(schedule.weekStart)} — {shortDate(dates[6])}</h2><p>这是经理最后发布的版本。</p></div><span className="count-badge">已发布</span></div><div className="team-table-wrap"><table className="team-table published-table"><thead><tr><th rowSpan={2}>Name</th>{dates.map((date, index) => <th key={date} colSpan={2}>{shortDate(date)}<small>{weekdays[index].slice(-1)}</small></th>)}</tr><tr>{dates.flatMap((_, index) => dayOptions(index).slice(0, 2).map((option) => <th key={`${index}-${option.value}`}>{option.value}</th>))}</tr></thead><tbody>{schedule.employees.map((person) => <tr className={person.id === activeEmployeeId ? "my-schedule-row" : ""} key={person.id}><th>{person.displayName}{person.id === activeEmployeeId && <small>我</small>}</th>{dates.flatMap((date) => (["early", "late"] as const).map((shift) => <td className={assigned.has(assignmentKey(date, shift, person.id)) ? "scheduled" : ""} key={`${date}-${shift}`}>{assigned.has(assignmentKey(date, shift, person.id)) ? "✓" : ""}</td>))}</tr>)}</tbody></table></div></section>;
}
