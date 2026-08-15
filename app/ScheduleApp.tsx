"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  addDays,
  customTimes,
  dayOptions,
  endTimes,
  englishDate,
  isPreset,
  shortDate,
  weekdays,
  type AvailabilityMap,
  type Employee,
} from "./schedule-utils";

type EmployeeListData = { employees: Employee[]; weekStart: string; error?: string };
type AvailabilityData = {
  employee: Employee;
  record: { employeeId: number; weekStart: string; availability: AvailabilityMap; updatedAt: string | null };
  weekStart: string;
  error?: string;
};

export default function ScheduleApp() {
  const [loading, setLoading] = useState(true);
  const [loadingEmployee, setLoadingEmployee] = useState(false);
  const [weekStart, setWeekStart] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null);
  const [availability, setAvailability] = useState<AvailabilityMap>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [customStart, setCustomStart] = useState("11");
  const [customEnd, setCustomEnd] = useState("6");
  const saveQueue = useRef(Promise.resolve());
  const weekStartRef = useRef("");

  const dates = useMemo(() => weekStart ? Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)) : [], [weekStart]);
  const weekEnd = dates[6] ?? "";

  useEffect(() => {
    async function refreshEmployees() {
      try {
        const response = await fetch("/api/employees", { cache: "no-store" });
        const data = await response.json() as EmployeeListData;
        if (!response.ok) throw new Error(data.error || "员工名单暂时无法打开。");
        if (weekStartRef.current && weekStartRef.current !== data.weekStart) {
          setActiveEmployee(null);
          setAvailability({});
          setStatus("idle");
          setMessage("已经进入新的一周，请重新选择你的名字。");
        }
        weekStartRef.current = data.weekStart;
        setWeekStart(data.weekStart);
        setEmployees(data.employees);
        setActiveEmployee((current) => current ? data.employees.find((employee) => employee.id === current.id) ?? null : null);
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "员工名单暂时无法打开。");
      } finally {
        setLoading(false);
      }
    }
    refreshEmployees();
    const timer = window.setInterval(refreshEmployees, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function selectEmployee(employee: Employee) {
    setLoadingEmployee(true);
    setMessage("");
    try {
      const response = await fetch(`/api/availability?employeeId=${employee.id}&week=${weekStart}`, { cache: "no-store" });
      const data = await response.json() as AvailabilityData;
      if (!response.ok) throw new Error(data.error || "个人时间暂时无法打开。");
      setActiveEmployee(data.employee);
      setAvailability(data.record.availability);
      setStatus(data.record.updatedAt ? "saved" : "idle");
      setMessage(`已打开 ${data.employee.displayName} 的个人时间。`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "个人时间暂时无法打开。");
    } finally {
      setLoadingEmployee(false);
    }
  }

  function leaveEmployee() {
    setActiveEmployee(null);
    setAvailability({});
    setStatus("idle");
    setMessage("请选择你自己的名字。");
  }

  function save(next: AvailabilityMap) {
    if (!activeEmployee || !weekStart) return;
    setStatus("saving");
    const payload = { employeeId: activeEmployee.id, weekStart, availability: next };
    saveQueue.current = saveQueue.current.then(async () => {
      const response = await fetch("/api/availability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as AvailabilityData;
      if (!response.ok) throw new Error(data.error || "自动保存失败。");
      setAvailability(data.record.availability);
      setStatus("saved");
      setMessage("已自动保存你的个人时间。");
    }).catch((error: Error) => {
      setStatus("error");
      setMessage(error.message);
    });
  }

  function updateDay(date: string, code: string | null) {
    if (!activeEmployee) return;
    const next = { ...availability };
    if (code) next[date] = code;
    else delete next[date];
    setAvailability(next);
    save(next);
  }

  function openEditor(index: number) {
    if (!activeEmployee) return;
    const current = availability[dates[index]];
    if (current && !isPreset(current, index)) {
      const [start, end] = current.split("-");
      setCustomStart(start);
      setCustomEnd(end);
    } else {
      setCustomStart(index < 5 ? "11" : "11:30");
      setCustomEnd(index < 5 ? "6" : "6:30");
    }
    setEditingDay(index);
  }

  function saveCustom(event: FormEvent) {
    event.preventDefault();
    if (editingDay === null) return;
    const startMinutes = customTimes(editingDay).find((time) => time.value === customStart)?.minutes ?? 0;
    const endMinutes = endTimes(editingDay).find((time) => time.value === customEnd)?.minutes ?? 0;
    if (endMinutes <= startMinutes) {
      setMessage("结束时间必须晚于开始时间，C 代表午夜 12 点。");
      return;
    }
    updateDay(dates[editingDay], `${customStart}-${customEnd}`);
    setEditingDay(null);
  }

  async function copySummary() {
    if (!activeEmployee) return;
    const lines = dates.filter((date) => availability[date]).map((date) => `${englishDate(date)}: ${availability[date]}`);
    await navigator.clipboard.writeText([`Name: ${activeEmployee.displayName}`, ...lines].join("\n"));
    setMessage(lines.length ? "已复制，可以直接发到群里。" : "已复制姓名；你还没有选择可上班时间。");
  }

  if (loading) {
    return <main className="loading-screen"><span className="brand-mark">M2</span><strong>正在打开 M2GO 班表</strong></main>;
  }

  return (
    <main className="site-shell">
      <header className="site-header">
        <div className="brand-lockup"><span className="brand-mark">M2</span><div><strong>M2GO</strong><small>WEEKLY AVAILABILITY</small></div></div>
        <div className="header-actions"><span className="week-pill">每周一自动更新</span><Link className="header-link" href="/manager">经理入口</Link></div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">本周可上班时间</p>
          <h1>{activeEmployee ? <>你好，<em>{activeEmployee.displayName}</em></> : <>找到你的名字，<br /><em>填写自己的时间。</em></>}</h1>
          <p className="hero-copy">{activeEmployee ? "这里仅显示你选择的员工位置。修改后会自动保存。" : "从下面八个员工位置中选择你自己，然后填写每天可以上班的一个连续时段。"}</p>
        </div>
        <aside className="week-card">
          <span>THIS WEEK</span>
          <strong>{weekStart && shortDate(weekStart)} — {weekEnd && shortDate(weekEnd)}</strong>
          <p>周一至周日 · Toronto time</p>
        </aside>
      </section>

      {message && <div className={`notice ${status === "error" ? "notice-error" : ""}`} role="status"><span>{status === "error" ? "!" : "✓"}</span>{message}<button onClick={() => setMessage("")} aria-label="关闭提示">×</button></div>}

      {!activeEmployee ? (
        <section className="employee-picker">
          <div className="section-heading"><div><p className="step-label">01 · 选择员工</p><h2>请找到你自己的名字</h2><p>现在的数字只是待定名称，经理之后可以直接修改。</p></div><span className="count-badge">8 个员工位置</span></div>
          <div className="employee-grid">
            {employees.map((employee) => (
              <button className="employee-choice" key={employee.id} onClick={() => selectEmployee(employee)} disabled={loadingEmployee}>
                <span>#{String(employee.id).padStart(2, "0")}</span>
                <strong>{employee.displayName}</strong>
                <small>选择我的时间表 →</small>
              </button>
            ))}
          </div>
          <p className="privacy-note">请只选择自己的名字。员工暂时不设 PIN；全员总表只有经理可以打开。</p>
        </section>
      ) : (
        <>
          <div className="employee-active-bar"><button onClick={leaveEmployee}>← 返回员工列表</button><div><span>当前员工</span><strong>{activeEmployee.displayName}</strong></div></div>
          <section className="availability-section">
            <div className="section-heading"><div><p className="step-label">02 · 选择时间</p><h2>{activeEmployee.displayName}，你哪天可以上班？</h2></div><div className={`save-state ${status}`}><i />{status === "saving" ? "自动保存中…" : status === "saved" ? "已自动保存" : status === "error" ? "保存失败" : "修改后自动保存"}</div></div>
            <div className="day-grid">
              {dates.map((date, index) => {
                const selected = availability[date];
                return (
                  <article className={`day-card ${selected ? "has-value" : ""}`} key={date}>
                    <header><span>{weekdays[index]}</span><strong>{shortDate(date)}</strong></header>
                    <div className="shift-options">
                      {dayOptions(index).map((option) => <button key={option.value} className={selected === option.value ? "selected" : ""} onClick={() => updateDay(date, selected === option.value ? null : option.value)}><span>{option.label}</span><strong>{option.hint}</strong><i>{selected === option.value ? "✓" : "+"}</i></button>)}
                      <button className={selected && !isPreset(selected, index) ? "selected custom-selected" : "edit-option"} onClick={() => openEditor(index)}><span>自定义</span><strong>{selected && !isPreset(selected, index) ? selected : "Edit"}</strong><i>✎</i></button>
                    </div>
                    {selected && <button className="clear-day" onClick={() => updateDay(date, null)}>清空当天</button>}
                  </article>
                );
              })}
            </div>
            <footer className="availability-footer"><p><strong>C = 12:00 AM</strong>（当天午夜）· 每天只保存一个连续时段</p><button onClick={copySummary}>复制我的时间</button></footer>
          </section>
        </>
      )}

      <footer className="site-footer"><strong>M2GO</strong><span>每周一自动切换到新的一周，之前的记录会保留。</span></footer>

      {editingDay !== null && <div className="modal-backdrop"><button type="button" className="modal-scrim" onClick={() => setEditingDay(null)} aria-label="关闭自定义时间窗口" /><section className="modal" role="dialog" aria-modal="true" aria-labelledby="custom-title"><header><div><p className="step-label">自定义时间</p><h2 id="custom-title">{weekdays[editingDay]} · {shortDate(dates[editingDay])}</h2></div><button onClick={() => setEditingDay(null)} aria-label="关闭">×</button></header><form onSubmit={saveCustom}><div className="custom-time-row"><label>开始时间<select value={customStart} onChange={(event) => setCustomStart(event.target.value)}>{customTimes(editingDay).map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select></label><span>→</span><label>结束时间<select value={customEnd} onChange={(event) => setCustomEnd(event.target.value)}>{endTimes(editingDay).map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select></label></div><p>结束时间必须晚于开始时间；C 代表午夜 12 点。</p><footer><button type="button" onClick={() => setEditingDay(null)}>取消</button><button className="primary" type="submit">保存这个时段</button></footer></form></section></div>}
    </main>
  );
}
