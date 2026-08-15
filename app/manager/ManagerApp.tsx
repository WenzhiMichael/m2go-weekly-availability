"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDays, assignmentKey, availabilityCoverage, dayOptions, shortDate, weekdays,
  type AvailabilityMap, type ScheduleAssignment, type ShiftCode,
} from "../schedule-utils";

type ManagerRecord = { employeeId: number; displayName: string; weekStart: string; availability: AvailabilityMap; updatedAt: string | null };
type LinkState = { employeeId: number; hasLink: boolean; linkUpdatedAt: string | null; pinConfigured: boolean };
type ManagerData = {
  weekStart: string; currentWeekStart: string; records: ManagerRecord[]; draftAssignments: ScheduleAssignment[];
  publishedAt: string | null; linkStates: LinkState[]; error?: string;
};

export default function ManagerApp() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [pin, setPin] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [currentWeekStart, setCurrentWeekStart] = useState("");
  const [records, setRecords] = useState<ManagerRecord[]>([]);
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [linkStates, setLinkStates] = useState<LinkState[]>([]);
  const [generatedLinks, setGeneratedLinks] = useState<Record<number, string>>({});
  const [draftNames, setDraftNames] = useState<Record<number, string>>({});
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const dates = useMemo(() => weekStart ? Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)) : [], [weekStart]);
  const targetWeek = currentWeekStart ? addDays(currentWeekStart, 7) : "";
  const editable = weekStart === targetWeek;

  async function loadManager(requestedWeek?: string) {
    try {
      const query = requestedWeek ? `?week=${requestedWeek}` : "";
      const response = await fetch(`/api/manager/availability${query}`, { cache: "no-store" });
      const data = await response.json() as ManagerData;
      if (response.status === 401) { setAuthorized(false); return; }
      if (!response.ok) throw new Error(data.error || "经理排班页面暂时无法打开。");
      setAuthorized(true); setWeekStart(data.weekStart); setCurrentWeekStart(data.currentWeekStart);
      setRecords(data.records); setAssignments(data.draftAssignments);
      setLinkStates(data.linkStates); setPublishedAt(data.publishedAt);
      setDraftNames(Object.fromEntries(data.records.map((record) => [record.employeeId, record.displayName])));
      setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "经理排班页面暂时无法打开。"); }
    finally { setLoading(false); }
  }

  useEffect(() => { const timer = window.setTimeout(() => loadManager(), 0); return () => window.clearTimeout(timer); }, []);

  async function login(event: FormEvent) {
    event.preventDefault(); setError("");
    const response = await fetch("/api/manager/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setError(data.error || "经理登录失败。"); return; }
    setPin(""); setMessage("经理登录成功。"); await loadManager();
  }

  async function logout() { await fetch("/api/manager/logout", { method: "POST" }); setAuthorized(false); setRecords([]); }

  async function saveName(employeeId: number) {
    setSavingId(employeeId); setError("");
    const response = await fetch(`/api/manager/employees/${employeeId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: draftNames[employeeId] }) });
    const data = await response.json() as { employee?: { id: number; displayName: string }; error?: string };
    if (!response.ok || !data.employee) { setError(data.error || "姓名暂时无法保存。"); setSavingId(null); return; }
    setRecords((current) => current.map((record) => record.employeeId === employeeId ? { ...record, displayName: data.employee!.displayName } : record));
    setDraftNames((current) => ({ ...current, [employeeId]: data.employee!.displayName }));
    setMessage("员工名称已更新。"); setSavingId(null);
  }

  async function generateLink(employeeId: number) {
    setSavingId(employeeId); setError("");
    const response = await fetch(`/api/manager/employees/${employeeId}/link`, { method: "POST" });
    const data = await response.json() as { link?: string; error?: string };
    if (!response.ok || !data.link) { setError(data.error || "个人链接暂时无法生成。"); setSavingId(null); return; }
    setGeneratedLinks((current) => ({ ...current, [employeeId]: data.link! }));
    setLinkStates((current) => current.map((item) => item.employeeId === employeeId ? { ...item, hasLink: true, pinConfigured: false, linkUpdatedAt: new Date().toISOString() } : item));
    await navigator.clipboard.writeText(data.link);
    setMessage("PIN 设置链接已生成并复制。旧 PIN 和旧登录已经失效。"); setSavingId(null);
  }

  async function toggleAssignment(shiftDate: string, shiftCode: ShiftCode, employeeId: number) {
    if (!editable) return;
    const key = assignmentKey(shiftDate, shiftCode, employeeId);
    const assigned = assignments.some((item) => assignmentKey(item.shiftDate, item.shiftCode, item.employeeId) === key);
    setAssignments((current) => assigned ? current.filter((item) => assignmentKey(item.shiftDate, item.shiftCode, item.employeeId) !== key) : [...current, { shiftDate, shiftCode, employeeId }]);
    const response = await fetch("/api/manager/schedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ weekStart, shiftDate, shiftCode, employeeId, assigned: !assigned }) });
    if (!response.ok) { setError(((await response.json()) as { error?: string }).error || "排班暂时无法保存。"); await loadManager(weekStart); }
    else setMessage("排班草稿已自动保存，员工暂时看不到这次修改。");
  }

  async function publishSchedule() {
    if (!editable || !window.confirm("确认发布这份班表？员工发布后会看到完整正式班表。")) return;
    const response = await fetch("/api/manager/schedule/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ weekStart }) });
    const data = await response.json() as { publishedAt?: string; error?: string };
    if (!response.ok) { setError(data.error || "班表暂时无法发布。"); return; }
    setPublishedAt(data.publishedAt ?? new Date().toISOString()); setMessage("最终班表已发布，员工现在可以在个人页面看到完整班表。");
  }

  if (loading) return <main className="loading-screen"><span className="brand-mark">M2</span><strong>正在打开经理页面</strong></main>;
  if (!authorized) return <ManagerLogin pin={pin} setPin={setPin} login={login} error={error} />;

  const assignedSet = new Set(assignments.map((item) => assignmentKey(item.shiftDate, item.shiftCode, item.employeeId)));
  const warnings = buildWarnings(records, assignments, dates);
  const filled = records.filter((record) => record.updatedAt).length;
  return (
    <main className="site-shell manager-page">
      <header className="site-header"><Link className="brand-lockup brand-link" href="/"><span className="brand-mark">M2</span><div><strong>M2GO</strong><small>MANAGER SCHEDULING</small></div></Link><div className="header-actions"><Link className="header-link" href="/">员工页面</Link><button className="header-link" onClick={logout}>退出经理</button></div></header>
      <section className="manager-hero compact-hero"><div><p className="eyebrow">经理排班</p><h1>看清时间，<br /><em>点击完成排班。</em></h1><p className="hero-copy">黄色表示员工的时间只覆盖这个班次的一部分；红色边框表示经理仍然把时间不完整或不可用的员工安排进了该班次。</p></div><aside className="week-card"><span>{editable ? "NEXT WEEK" : "HISTORY"}</span><strong>{shortDate(weekStart)} — {dates[6] && shortDate(dates[6])}</strong><p>{filled} / 8 人已提交 · {publishedAt ? "已发布" : "未发布"}</p></aside></section>
      {(message || error) && <div className={`notice ${error ? "notice-error" : ""}`} role="status"><span>{error ? "!" : "✓"}</span>{error || message}<button onClick={() => { setMessage(""); setError(""); }} aria-label="关闭提示">×</button></div>}
      <div className="week-navigation"><button onClick={() => loadManager(addDays(weekStart, -7))}>← 上一周</button><strong>{editable ? "正在安排下周" : "历史记录（只读）"}</strong><button onClick={() => loadManager(addDays(weekStart, 7))} disabled={weekStart >= targetWeek}>下一周 →</button></div>

      <section className="team-section schedule-builder">
        <div className="section-heading"><div><p className="step-label">01 · 下周排班</p><h2>可上班时间＋最终选择</h2><p>浅绿可以完整覆盖班次；黄色只能覆盖一部分；灰色没有提交这个班次。经理仍可点击任何格子安排。</p></div><div className="legend"><span className="legend-full">浅绿：完整可上</span><span className="legend-partial">黄色：只覆盖部分</span><span className="legend-selected">深绿：已经安排</span><span className="legend-conflict">红框：安排有冲突</span></div></div>
        <div className="team-table-wrap"><table className="team-table manager-schedule-table"><thead><tr><th rowSpan={2}>Name</th>{dates.map((date, index) => <th key={date} colSpan={2}>{shortDate(date)}<small>{weekdays[index].slice(-1)}</small></th>)}</tr><tr>{dates.flatMap((_, index) => dayOptions(index).slice(0, 2).map((option) => <th key={`${index}-${option.value}`}>{option.value}</th>))}</tr></thead><tbody>{records.map((record) => <tr key={record.employeeId}><th>{record.displayName}{!record.updatedAt && <small>未交</small>}</th>{dates.flatMap((date, dayIndex) => (["early", "late"] as const).map((shiftCode) => { const coverage = availabilityCoverage(record.availability[date], dayIndex, shiftCode); const selected = assignedSet.has(assignmentKey(date, shiftCode, record.employeeId)); return <td key={`${date}-${shiftCode}`}><button disabled={!editable} className={`schedule-cell coverage-${coverage} ${selected ? "is-selected" : ""} ${selected && coverage !== "full" ? "has-conflict" : ""}`} onClick={() => toggleAssignment(date, shiftCode, record.employeeId)} aria-label={`${record.displayName} ${date} ${shiftCode}`}>{selected ? "✓" : coverage === "partial" ? "部分" : ""}</button></td>; }))}</tr>)}</tbody></table></div>
        <div className="publish-bar"><div><strong>发布前检查</strong><span>{warnings.length ? `${warnings.length} 项需要留意` : "没有发现冲突"}</span></div><button disabled={!editable} onClick={publishSchedule}>{publishedAt ? "重新发布最终班表" : "发布最终班表"}</button></div>
        {warnings.length > 0 && <div className="warning-list">{warnings.map((warning) => <p key={warning}>! {warning}</p>)}</div>}
      </section>

      <section className="manager-section"><div className="section-heading"><div><p className="step-label">02 · 员工 PIN</p><h2>修改名称并发送 PIN 设置链接</h2><p>员工打开一次性链接后自己设置四位 PIN。忘记 PIN 时在这里重置，旧 PIN 和旧登录会立即失效。</p></div><span className="count-badge">经理看不到员工 PIN</span></div><div className="manager-name-grid">{records.map((record) => { const linkState = linkStates.find((item) => item.employeeId === record.employeeId); return <div className="manager-name-card link-card" key={record.employeeId}><span>#{String(record.employeeId).padStart(2, "0")}</span><input aria-label={`员工 ${record.employeeId} 姓名`} maxLength={40} value={draftNames[record.employeeId] ?? ""} onChange={(event) => setDraftNames((current) => ({ ...current, [record.employeeId]: event.target.value }))} /><button onClick={() => saveName(record.employeeId)} disabled={savingId === record.employeeId || (draftNames[record.employeeId] ?? "").trim() === record.displayName}>保存名</button><button className="link-button" onClick={() => generateLink(record.employeeId)} disabled={savingId === record.employeeId}>{linkState?.pinConfigured ? "重置 PIN 并复制链接" : linkState?.hasLink ? "重新生成设置链接" : "生成 PIN 设置链接"}</button>{generatedLinks[record.employeeId] && <input className="generated-link" readOnly value={generatedLinks[record.employeeId]} onFocus={(event) => event.currentTarget.select()} aria-label={`${record.displayName} 新 PIN 设置链接`} />}</div>; })}</div></section>
      <footer className="site-footer"><strong>M2GO · MANAGER</strong><span>经理草稿与员工可上班时间不会向其他员工公开。</span></footer>
    </main>
  );
}

function ManagerLogin({ pin, setPin, login, error }: { pin: string; setPin: (value: string) => void; login: (event: FormEvent) => void; error: string }) {
  return <main className="manager-shell"><header className="site-header"><Link className="brand-lockup brand-link" href="/"><span className="brand-mark">M2</span><div><strong>M2GO</strong><small>MANAGER ACCESS</small></div></Link><Link className="header-link" href="/">返回员工入口</Link></header><section className="manager-login"><div className="manager-login-copy"><p className="eyebrow">经理专用</p><h1>全员时间，<br /><em>一张表排清。</em></h1><p>登录后查看所有人的下周时间、安排最终班表并发布给员工。</p></div><form className="pin-card" onSubmit={login}><span className="lock-mark">M</span><p className="step-label">Manager PIN</p><h2>输入六位经理 PIN</h2><input aria-label="六位经理 PIN" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" type="password" required /><button disabled={pin.length !== 6}>进入经理排班</button>{error && <p className="form-error" role="alert">{error}</p>}</form></section></main>;
}

function buildWarnings(records: ManagerRecord[], assignments: ScheduleAssignment[], dates: string[]) {
  const warnings: string[] = [];
  for (const item of assignments) {
    const record = records.find((value) => value.employeeId === item.employeeId);
    const dayIndex = dates.indexOf(item.shiftDate);
    if (record && availabilityCoverage(record.availability[item.shiftDate], dayIndex, item.shiftCode) !== "full") warnings.push(`${record.displayName} 被安排在未完整覆盖的 ${shortDate(item.shiftDate)} ${item.shiftCode === "early" ? "早班" : "晚班"}`);
  }
  for (const record of records) if (!record.updatedAt) warnings.push(`${record.displayName} 尚未提交下周时间`);
  return [...new Set(warnings)];
}
