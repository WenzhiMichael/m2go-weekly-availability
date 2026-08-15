"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDays, assignmentKey, availabilityCoverage, dayOptions, shortDate, weekdays,
  type AvailabilityMap, type ScheduleAssignment, type ShiftCode,
} from "../schedule-utils";

type ManagerRecord = { employeeId: number; displayName: string; weekStart: string; availability: AvailabilityMap; updatedAt: string | null };
type PairPreference = { employeeAId: number; employeeBId: number; preferenceType: "prefer" | "avoid" };
type LinkState = { employeeId: number; hasLink: boolean; linkUpdatedAt: string | null; pinConfigured: boolean };
type ManagerData = {
  weekStart: string; currentWeekStart: string; records: ManagerRecord[]; draftAssignments: ScheduleAssignment[];
  publishedAt: string | null; pairPreferences: PairPreference[]; linkStates: LinkState[]; error?: string;
};

export default function ManagerApp() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [pin, setPin] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [currentWeekStart, setCurrentWeekStart] = useState("");
  const [records, setRecords] = useState<ManagerRecord[]>([]);
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [preferences, setPreferences] = useState<PairPreference[]>([]);
  const [linkStates, setLinkStates] = useState<LinkState[]>([]);
  const [generatedLinks, setGeneratedLinks] = useState<Record<number, string>>({});
  const [draftNames, setDraftNames] = useState<Record<number, string>>({});
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [pairA, setPairA] = useState(1);
  const [pairB, setPairB] = useState(2);
  const [pairType, setPairType] = useState<"prefer" | "avoid">("avoid");
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
      setRecords(data.records); setAssignments(data.draftAssignments); setPreferences(data.pairPreferences);
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

  async function savePreference(event: FormEvent) {
    event.preventDefault(); setError("");
    const response = await fetch("/api/manager/preferences", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ employeeAId: pairA, employeeBId: pairB, preferenceType: pairType }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setError(data.error || "同班关系无法保存。"); return; }
    const [employeeAId, employeeBId] = pairA < pairB ? [pairA, pairB] : [pairB, pairA];
    setPreferences((current) => [...current.filter((item) => item.employeeAId !== employeeAId || item.employeeBId !== employeeBId), { employeeAId, employeeBId, preferenceType: pairType }]);
    setMessage("经理专用的同班关系已保存。");
  }

  async function removePreference(item: PairPreference) {
    await fetch("/api/manager/preferences", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ employeeAId: item.employeeAId, employeeBId: item.employeeBId, preferenceType: null }) });
    setPreferences((current) => current.filter((value) => value !== item));
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
  const warnings = buildWarnings(records, assignments, preferences, dates);
  const filled = records.filter((record) => record.updatedAt).length;
  return (
    <main className="site-shell manager-page">
      <header className="site-header"><Link className="brand-lockup brand-link" href="/"><span className="brand-mark">M2</span><div><strong>M2GO</strong><small>MANAGER SCHEDULING</small></div></Link><div className="header-actions"><Link className="header-link" href="/">员工页面</Link><button className="header-link" onClick={logout}>退出经理</button></div></header>
      <section className="manager-hero compact-hero"><div><p className="eyebrow">经理排班</p><h1>看清时间，<br /><em>点击完成排班。</em></h1><p className="hero-copy">浅绿表示可以完整上班，黄色表示只能覆盖部分时间。深绿勾选是你的最终安排。</p></div><aside className="week-card"><span>{editable ? "NEXT WEEK" : "HISTORY"}</span><strong>{shortDate(weekStart)} — {dates[6] && shortDate(dates[6])}</strong><p>{filled} / 8 人已提交 · {publishedAt ? "已发布" : "未发布"}</p></aside></section>
      {(message || error) && <div className={`notice ${error ? "notice-error" : ""}`} role="status"><span>{error ? "!" : "✓"}</span>{error || message}<button onClick={() => { setMessage(""); setError(""); }} aria-label="关闭提示">×</button></div>}
      <div className="week-navigation"><button onClick={() => loadManager(addDays(weekStart, -7))}>← 上一周</button><strong>{editable ? "正在安排下周" : "历史记录（只读）"}</strong><button onClick={() => loadManager(addDays(weekStart, 7))} disabled={weekStart >= targetWeek}>下一周 →</button></div>

      <section className="team-section schedule-builder">
        <div className="section-heading"><div><p className="step-label">01 · 下周排班</p><h2>可上班时间＋最终选择</h2><p>直接点击格子选人。灰色或黄色仍可安排，但系统会在发布前提醒。</p></div><div className="legend"><span className="legend-full">完整可上</span><span className="legend-partial">部分可上</span><span className="legend-selected">已安排</span><span className="legend-conflict">冲突安排</span></div></div>
        <div className="team-table-wrap"><table className="team-table manager-schedule-table"><thead><tr><th rowSpan={2}>Name</th>{dates.map((date, index) => <th key={date} colSpan={2}>{shortDate(date)}<small>{weekdays[index].slice(-1)}</small></th>)}</tr><tr>{dates.flatMap((_, index) => dayOptions(index).slice(0, 2).map((option) => <th key={`${index}-${option.value}`}>{option.value}</th>))}</tr></thead><tbody>{records.map((record) => <tr key={record.employeeId}><th>{record.displayName}{!record.updatedAt && <small>未交</small>}</th>{dates.flatMap((date, dayIndex) => (["early", "late"] as const).map((shiftCode) => { const coverage = availabilityCoverage(record.availability[date], dayIndex, shiftCode); const selected = assignedSet.has(assignmentKey(date, shiftCode, record.employeeId)); return <td key={`${date}-${shiftCode}`}><button disabled={!editable} className={`schedule-cell coverage-${coverage} ${selected ? "is-selected" : ""} ${selected && coverage !== "full" ? "has-conflict" : ""}`} onClick={() => toggleAssignment(date, shiftCode, record.employeeId)} aria-label={`${record.displayName} ${date} ${shiftCode}`}>{selected ? "✓" : coverage === "partial" ? "部分" : ""}</button></td>; }))}</tr>)}</tbody></table></div>
        <div className="publish-bar"><div><strong>发布前检查</strong><span>{warnings.length ? `${warnings.length} 项需要留意` : "没有发现冲突"}</span></div><button disabled={!editable} onClick={publishSchedule}>{publishedAt ? "重新发布最终班表" : "发布最终班表"}</button></div>
        {warnings.length > 0 && <div className="warning-list">{warnings.map((warning) => <p key={warning}>! {warning}</p>)}</div>}
      </section>

      <section className="manager-section"><div className="section-heading"><div><p className="step-label">02 · 同班关系</p><h2>只给经理看的提醒</h2><p>员工不会看到这些设置，系统只提醒，不会阻止你的决定。</p></div><span className="count-badge">{preferences.length} 条关系</span></div><form className="preference-form" onSubmit={savePreference}><select value={pairA} onChange={(event) => setPairA(Number(event.target.value))}>{records.map((record) => <option key={record.employeeId} value={record.employeeId}>{record.displayName}</option>)}</select><span>和</span><select value={pairB} onChange={(event) => setPairB(Number(event.target.value))}>{records.map((record) => <option key={record.employeeId} value={record.employeeId}>{record.displayName}</option>)}</select><select value={pairType} onChange={(event) => setPairType(event.target.value as "prefer" | "avoid")}><option value="avoid">不能同班</option><option value="prefer">希望同班</option></select><button>保存关系</button></form><div className="preference-list">{preferences.map((item) => <div key={`${item.employeeAId}-${item.employeeBId}`}><strong>{nameFor(records, item.employeeAId)} ＋ {nameFor(records, item.employeeBId)}</strong><span className={item.preferenceType}>{item.preferenceType === "avoid" ? "不能同班" : "希望同班"}</span><button onClick={() => removePreference(item)}>删除</button></div>)}</div></section>

      <section className="manager-section"><div className="section-heading"><div><p className="step-label">03 · 员工 PIN</p><h2>修改名称并发送 PIN 设置链接</h2><p>员工打开一次性链接后自己设置四位 PIN。忘记 PIN 时在这里重置，旧 PIN 和旧登录会立即失效。</p></div><span className="count-badge">经理看不到员工 PIN</span></div><div className="manager-name-grid">{records.map((record) => { const linkState = linkStates.find((item) => item.employeeId === record.employeeId); return <div className="manager-name-card link-card" key={record.employeeId}><span>#{String(record.employeeId).padStart(2, "0")}</span><input aria-label={`员工 ${record.employeeId} 姓名`} maxLength={40} value={draftNames[record.employeeId] ?? ""} onChange={(event) => setDraftNames((current) => ({ ...current, [record.employeeId]: event.target.value }))} /><button onClick={() => saveName(record.employeeId)} disabled={savingId === record.employeeId || (draftNames[record.employeeId] ?? "").trim() === record.displayName}>保存名</button><button className="link-button" onClick={() => generateLink(record.employeeId)} disabled={savingId === record.employeeId}>{linkState?.pinConfigured ? "重置 PIN 并复制链接" : linkState?.hasLink ? "重新生成设置链接" : "生成 PIN 设置链接"}</button>{generatedLinks[record.employeeId] && <input className="generated-link" readOnly value={generatedLinks[record.employeeId]} onFocus={(event) => event.currentTarget.select()} aria-label={`${record.displayName} 新 PIN 设置链接`} />}</div>; })}</div></section>
      <footer className="site-footer"><strong>M2GO · MANAGER</strong><span>经理草稿与员工可上班时间不会向其他员工公开。</span></footer>
    </main>
  );
}

function ManagerLogin({ pin, setPin, login, error }: { pin: string; setPin: (value: string) => void; login: (event: FormEvent) => void; error: string }) {
  return <main className="manager-shell"><header className="site-header"><Link className="brand-lockup brand-link" href="/"><span className="brand-mark">M2</span><div><strong>M2GO</strong><small>MANAGER ACCESS</small></div></Link><Link className="header-link" href="/">返回员工入口</Link></header><section className="manager-login"><div className="manager-login-copy"><p className="eyebrow">经理专用</p><h1>全员时间，<br /><em>一张表排清。</em></h1><p>登录后查看所有人的下周时间、安排最终班表并发布给员工。</p></div><form className="pin-card" onSubmit={login}><span className="lock-mark">M</span><p className="step-label">Manager PIN</p><h2>输入六位经理 PIN</h2><input aria-label="六位经理 PIN" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" type="password" required /><button disabled={pin.length !== 6}>进入经理排班</button>{error && <p className="form-error" role="alert">{error}</p>}</form></section></main>;
}

function nameFor(records: ManagerRecord[], employeeId: number) { return records.find((record) => record.employeeId === employeeId)?.displayName ?? `#${employeeId}`; }

function buildWarnings(records: ManagerRecord[], assignments: ScheduleAssignment[], preferences: PairPreference[], dates: string[]) {
  const warnings: string[] = [];
  for (const item of assignments) {
    const record = records.find((value) => value.employeeId === item.employeeId);
    const dayIndex = dates.indexOf(item.shiftDate);
    if (record && availabilityCoverage(record.availability[item.shiftDate], dayIndex, item.shiftCode) !== "full") warnings.push(`${record.displayName} 被安排在未完整覆盖的 ${shortDate(item.shiftDate)} ${item.shiftCode === "early" ? "早班" : "晚班"}`);
  }
  for (const pair of preferences) {
    const first = assignments.filter((item) => item.employeeId === pair.employeeAId);
    const secondKeys = new Set(assignments.filter((item) => item.employeeId === pair.employeeBId).map((item) => `${item.shiftDate}|${item.shiftCode}`));
    const together = first.some((item) => secondKeys.has(`${item.shiftDate}|${item.shiftCode}`));
    if (pair.preferenceType === "avoid" && together) warnings.push(`${nameFor(records, pair.employeeAId)} 和 ${nameFor(records, pair.employeeBId)} 被安排在同一班次`);
    if (pair.preferenceType === "prefer" && first.length > 0 && !together) warnings.push(`${nameFor(records, pair.employeeAId)} 和 ${nameFor(records, pair.employeeBId)} 尚未安排共同班次`);
  }
  for (const record of records) if (!record.updatedAt) warnings.push(`${record.displayName} 尚未提交下周时间`);
  return [...new Set(warnings)];
}
