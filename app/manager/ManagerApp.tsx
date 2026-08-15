"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, dayOptions, shortDate, weekdays, type AvailabilityMap } from "../schedule-utils";

type ManagerRecord = {
  employeeId: number;
  displayName: string;
  weekStart: string;
  availability: AvailabilityMap;
  updatedAt: string | null;
};

type ManagerData = {
  weekStart: string;
  records: ManagerRecord[];
  error?: string;
};

export default function ManagerApp() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [pin, setPin] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [records, setRecords] = useState<ManagerRecord[]>([]);
  const [draftNames, setDraftNames] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const dates = useMemo(() => weekStart ? Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)) : [], [weekStart]);

  async function loadManager() {
    try {
      const response = await fetch("/api/manager/availability", { cache: "no-store" });
      const data = await response.json() as ManagerData;
      if (response.status === 401) {
        setAuthorized(false);
        return;
      }
      if (!response.ok) throw new Error(data.error || "经理总表暂时无法打开。");
      setAuthorized(true);
      setWeekStart(data.weekStart);
      setRecords(data.records);
      setDraftNames(Object.fromEntries(data.records.map((record) => [record.employeeId, record.displayName])));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "经理总表暂时无法打开。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(loadManager, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/manager/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) {
      setError(data.error || "经理登录失败。");
      return;
    }
    setPin("");
    setMessage("经理登录成功。");
    await loadManager();
  }

  async function logout() {
    await fetch("/api/manager/logout", { method: "POST" });
    setAuthorized(false);
    setRecords([]);
    setMessage("已退出经理页面。");
  }

  async function saveName(employeeId: number) {
    setSavingId(employeeId);
    setError("");
    const response = await fetch(`/api/manager/employees/${employeeId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: draftNames[employeeId] }),
    });
    const data = await response.json() as { employee?: { id: number; displayName: string }; error?: string };
    if (!response.ok) {
      setError(data.error || "姓名暂时无法保存。");
      setSavingId(null);
      return;
    }
    setRecords((current) => current.map((record) => record.employeeId === employeeId ? { ...record, displayName: data.employee!.displayName } : record));
    setDraftNames((current) => ({ ...current, [employeeId]: data.employee!.displayName }));
    setMessage(`员工 #${String(employeeId).padStart(2, "0")} 的名称已更新。`);
    setSavingId(null);
  }

  if (loading) {
    return <main className="loading-screen"><span className="brand-mark">M2</span><strong>正在打开经理页面</strong></main>;
  }

  if (!authorized) {
    return (
      <main className="manager-shell">
        <header className="site-header"><Link className="brand-lockup brand-link" href="/"><span className="brand-mark">M2</span><div><strong>M2GO</strong><small>MANAGER ACCESS</small></div></Link><Link className="header-link" href="/">返回员工页面</Link></header>
        <section className="manager-login">
          <div className="manager-login-copy"><p className="eyebrow">经理专用</p><h1>全员时间，<br /><em>只给经理看。</em></h1><p>登录后可以查看八位员工的完整周表，并把待定编号修改成正式姓名。</p></div>
          <form className="pin-card" onSubmit={login}>
            <span className="lock-mark">M</span>
            <p className="step-label">Manager PIN</p>
            <h2>输入六位经理 PIN</h2>
            <input aria-label="六位经理 PIN" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" type="password" required />
            <button disabled={pin.length !== 6}>进入经理总表</button>
            {error && <p className="form-error" role="alert">{error}</p>}
            {message && <p className="form-message">{message}</p>}
          </form>
        </section>
      </main>
    );
  }

  const filled = records.filter((record) => Object.keys(record.availability).length > 0).length;
  return (
    <main className="site-shell manager-page">
      <header className="site-header"><Link className="brand-lockup brand-link" href="/"><span className="brand-mark">M2</span><div><strong>M2GO</strong><small>MANAGER VIEW</small></div></Link><div className="header-actions"><Link className="header-link" href="/">员工页面</Link><button className="header-link" onClick={logout}>退出经理</button></div></header>
      <section className="manager-hero">
        <div><p className="eyebrow">经理总表</p><h1>八位员工，<br /><em>一张表看清。</em></h1><p className="hero-copy">只有通过经理 PIN 才能读取这里的汇总。姓名修改后，员工首页会自动更新。</p></div>
        <aside className="week-card"><span>THIS WEEK</span><strong>{weekStart && shortDate(weekStart)} — {dates[6] && shortDate(dates[6])}</strong><p>{filled} / 8 人已填写</p></aside>
      </section>
      {(message || error) && <div className={`notice ${error ? "notice-error" : ""}`} role="status"><span>{error ? "!" : "✓"}</span>{error || message}<button onClick={() => { setMessage(""); setError(""); }} aria-label="关闭提示">×</button></div>}

      <section className="manager-section">
        <div className="section-heading"><div><p className="step-label">01 · 员工名单</p><h2>修改待定名称</h2><p>内部员工位置不会改变，所以改名不会影响已经保存的班次。</p></div><span className="count-badge">固定 8 个位置</span></div>
        <div className="manager-name-grid">
          {records.map((record) => <div className="manager-name-card" key={record.employeeId}><span>#{String(record.employeeId).padStart(2, "0")}</span><input aria-label={`员工 ${record.employeeId} 姓名`} maxLength={40} value={draftNames[record.employeeId] ?? ""} onChange={(event) => setDraftNames((current) => ({ ...current, [record.employeeId]: event.target.value }))} /><button onClick={() => saveName(record.employeeId)} disabled={savingId === record.employeeId || (draftNames[record.employeeId] ?? "").trim() === record.displayName}>{savingId === record.employeeId ? "保存中…" : "保存"}</button></div>)}
        </div>
      </section>

      <section className="team-section">
        <div className="section-heading"><div><p className="step-label">02 · 全员总表</p><h2>本周可上班时间</h2><p>绿色格子代表可以上这个班；自定义时段直接显示在当天。</p></div><span className="count-badge">{filled} 人已填写</span></div>
        <div className="team-table-wrap"><table className="team-table"><thead><tr><th rowSpan={2}>Name</th>{dates.map((date, index) => <th key={date} colSpan={2}>{shortDate(date)}<small>{weekdays[index].slice(-1)}</small></th>)}</tr><tr>{dates.flatMap((_, index) => dayOptions(index).slice(0, 2).map((option) => <th key={`${index}-${option.value}`}>{option.value}</th>))}</tr></thead><tbody>{records.map((record) => <tr key={record.employeeId}><th>{record.displayName}</th>{dates.flatMap((date, index) => renderAvailabilityCells(record.availability[date], index, `${record.employeeId}-${date}`))}</tr>)}</tbody></table></div>
      </section>
      <footer className="site-footer"><strong>M2GO · MANAGER</strong><span>经理会话八小时后自动退出。</span></footer>
    </main>
  );
}

function renderAvailabilityCells(code: string | undefined, dayIndex: number, key: string) {
  if (!code) return [<td key={`${key}-a`} />, <td key={`${key}-b`} />];
  const [early, closing, full] = dayOptions(dayIndex).map((item) => item.value);
  if (code === full) return [<td className="available" key={`${key}-a`}>✓</td>, <td className="available" key={`${key}-b`}>✓</td>];
  if (code === early) return [<td className="available" key={`${key}-a`}>✓</td>, <td key={`${key}-b`} />];
  if (code === closing) return [<td key={`${key}-a`} />, <td className="available" key={`${key}-b`}>✓</td>];
  return [<td className="available custom-cell" colSpan={2} key={`${key}-custom`}>{code}</td>];
}
