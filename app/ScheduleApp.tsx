"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type AvailabilityMap = Record<string, string>;
type AvailabilityRecord = { id: number; weekStart: string; name: string; availability: AvailabilityMap; updatedAt: string };
type ApiData = { weekStart: string; currentWeekStart: string; records: AvailabilityRecord[]; error?: string };

const weekdays = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];

function dateFromIso(iso: string) {
  return new Date(`${iso}T12:00:00Z`);
}

function isoFromDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addDays(iso: string, days: number) {
  const date = dateFromIso(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return isoFromDate(date);
}

function titleName(value: string) {
  const clean = value.trim();
  if (!/^[A-Za-z]+$/.test(clean)) return null;
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

function dayOptions(index: number) {
  const opening = index < 5 ? "11-6" : "11:30-6";
  const full = index < 5 ? "11-C" : "11:30-C";
  return [
    { label: "早班", value: opening, hint: opening },
    { label: "晚班", value: "6-C", hint: "6-C" },
    { label: "全天", value: full, hint: full },
  ];
}

function isPreset(code: string, index: number) {
  return dayOptions(index).some((option) => option.value === code);
}

function shortDate(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", timeZone: "UTC" }).format(dateFromIso(iso));
}

function englishDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(dateFromIso(iso));
}

export default function ScheduleApp() {
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState("");
  const [records, setRecords] = useState<AvailabilityRecord[]>([]);
  const [nameInput, setNameInput] = useState("");
  const [activeName, setActiveName] = useState("");
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
    async function refreshWeek() {
      try {
        const response = await fetch("/api/availability", { cache: "no-store" });
        const data = await response.json() as ApiData;
        if (!response.ok) throw new Error(data.error || "班表暂时无法打开。");
        if (weekStartRef.current && weekStartRef.current !== data.weekStart) {
          setNameInput("");
          setActiveName("");
          setAvailability({});
          setStatus("idle");
          setMessage("已经进入新的一周，请重新选择你的名字和可上班时间。");
        }
        weekStartRef.current = data.weekStart;
        setWeekStart(data.weekStart);
        setRecords(data.records);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "班表暂时无法打开。");
      } finally {
        setLoading(false);
      }
    }
    refreshWeek();
    const timer = window.setInterval(refreshWeek, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function activateName(raw: string) {
    const formatted = titleName(raw);
    if (!formatted) {
      setMessage("姓名请只填写一个英文名，例如 Alex。");
      return;
    }
    const record = records.find((item) => item.name.toLowerCase() === formatted.toLowerCase());
    setNameInput(formatted);
    setActiveName(formatted);
    setAvailability(record?.availability ?? {});
    setStatus(record ? "saved" : "idle");
    setMessage(record ? `已打开 ${formatted} 这周的时间。` : `你好，${formatted}。请选择这周可以上班的时间。`);
  }

  function submitName(event: FormEvent) {
    event.preventDefault();
    activateName(nameInput);
  }

  function save(next: AvailabilityMap) {
    if (!activeName || !weekStart) return;
    setStatus("saving");
    const payload = { name: activeName, weekStart, availability: next };
    saveQueue.current = saveQueue.current.then(async () => {
      const response = await fetch("/api/availability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as ApiData;
      if (!response.ok) throw new Error(data.error || "自动保存失败。");
      setRecords(data.records);
      setStatus("saved");
      setMessage("已自动保存，大家现在都能看到最新时间。");
    }).catch((error: Error) => {
      setStatus("error");
      setMessage(error.message);
    });
  }

  function updateDay(date: string, code: string | null) {
    if (!activeName) {
      setMessage("请先填写并确认你的英文名。");
      return;
    }
    const next = { ...availability };
    if (code) next[date] = code;
    else delete next[date];
    setAvailability(next);
    setRecords((current) => {
      const exists = current.some((item) => item.name.toLowerCase() === activeName.toLowerCase());
      const updated = current.map((item) => item.name.toLowerCase() === activeName.toLowerCase() ? { ...item, availability: next } : item);
      return exists ? updated : [...updated, { id: -1, weekStart, name: activeName, availability: next, updatedAt: "" }].sort((a, b) => a.name.localeCompare(b.name));
    });
    save(next);
  }

  function openEditor(index: number) {
    if (!activeName) {
      setMessage("请先填写并确认你的英文名。");
      return;
    }
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
    const starts = customTimes(editingDay);
    const ends = endTimes(editingDay);
    const startMinutes = starts.find((time) => time.value === customStart)?.minutes ?? 0;
    const endMinutes = ends.find((time) => time.value === customEnd)?.minutes ?? 0;
    if (endMinutes <= startMinutes) {
      setMessage("结束时间必须晚于开始时间，C 代表午夜 12 点。");
      return;
    }
    updateDay(dates[editingDay], `${customStart}-${customEnd}`);
    setEditingDay(null);
  }

  async function copySummary() {
    if (!activeName) {
      setMessage("请先选择你的名字。");
      return;
    }
    const lines = dates.filter((date) => availability[date]).map((date) => `${englishDate(date)}: ${availability[date]}`);
    const text = [`Name: ${activeName}`, ...lines].join("\n");
    await navigator.clipboard.writeText(text);
    setMessage(lines.length ? "已复制，可以直接发到群里。" : "已复制姓名；你还没有选择可上班时间。");
  }

  if (loading) {
    return <main className="loading-screen"><span className="brand-mark">M2</span><strong>正在打开 M2GO 班表</strong></main>;
  }

  return (
    <main className="site-shell">
      <header className="site-header">
        <div className="brand-lockup"><span className="brand-mark">M2</span><div><strong>M2GO</strong><small>WEEKLY AVAILABILITY</small></div></div>
        <span className="week-pill">每周一自动更新</span>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">本周可上班时间</p>
          <h1>大家一起写班表，<br /><em>简单又清楚。</em></h1>
          <p className="hero-copy">选择你每天可以上班的一个时段。每次修改都会自动保存，不需要再分前台或后厨。</p>
        </div>
        <aside className="week-card">
          <span>THIS WEEK</span>
          <strong>{weekStart && shortDate(weekStart)} — {weekEnd && shortDate(weekEnd)}</strong>
          <p>周一至周日 · Toronto time</p>
        </aside>
      </section>

      {message && <div className={`notice ${status === "error" ? "notice-error" : ""}`} role="status"><span>{status === "error" ? "!" : "✓"}</span>{message}<button onClick={() => setMessage("")} aria-label="关闭提示">×</button></div>}

      <section className="name-panel">
        <div><p className="step-label">01 · 你的名字</p><h2>先找到或填写你的英文名</h2><p>只填一个名字，大小写会自动整理。</p></div>
        <form className="name-form" onSubmit={submitName}>
          <label htmlFor="employee-name">English first name</label>
          <div><input id="employee-name" value={nameInput} onChange={(event) => { setNameInput(event.target.value); setActiveName(""); }} placeholder="例如 Alex" autoComplete="given-name" /><button>开始填写</button></div>
          {records.length > 0 && <div className="name-suggestions"><span>本周名单：</span>{records.map((record) => <button type="button" key={record.name} className={activeName === record.name ? "active" : ""} onClick={() => activateName(record.name)}>{record.name}</button>)}</div>}
        </form>
      </section>

      <section className={`availability-section ${!activeName ? "locked" : ""}`}>
        <div className="section-heading"><div><p className="step-label">02 · 选择时间</p><h2>{activeName ? `${activeName}，你哪天可以上班？` : "选择你每天可以上班的时间"}</h2></div><div className={`save-state ${status}`}><i />{status === "saving" ? "自动保存中…" : status === "saved" ? "已自动保存" : status === "error" ? "保存失败" : "修改后自动保存"}</div></div>
        <div className="day-grid">
          {dates.map((date, index) => {
            const selected = availability[date];
            return (
              <article className={`day-card ${selected ? "has-value" : ""}`} key={date}>
                <header><span>{weekdays[index]}</span><strong>{shortDate(date)}</strong></header>
                <div className="shift-options">
                  {dayOptions(index).map((option) => <button key={option.value} disabled={!activeName} className={selected === option.value ? "selected" : ""} onClick={() => updateDay(date, selected === option.value ? null : option.value)}><span>{option.label}</span><strong>{option.hint}</strong><i>{selected === option.value ? "✓" : "+"}</i></button>)}
                  <button disabled={!activeName} className={selected && !isPreset(selected, index) ? "selected custom-selected" : "edit-option"} onClick={() => openEditor(index)}><span>自定义</span><strong>{selected && !isPreset(selected, index) ? selected : "Edit"}</strong><i>✎</i></button>
                </div>
                {selected && <button className="clear-day" onClick={() => updateDay(date, null)}>清空当天</button>}
              </article>
            );
          })}
        </div>
        {!activeName && <div className="locked-note">↑ 先确认名字，就可以开始选择</div>}
        <footer className="availability-footer"><p><strong>C = 12:00 AM</strong>（当天午夜）· 每天只保存一个连续时段</p><button onClick={copySummary} disabled={!activeName}>复制我的时间</button></footer>
      </section>

      <section className="team-section">
        <div className="section-heading"><div><p className="step-label">03 · 全员总表</p><h2>本周大家的可上班时间</h2><p>绿色格子代表可以上这个班；自定义时段会直接写在当天。</p></div><span className="count-badge">{records.length} 人已填写</span></div>
        <div className="team-table-wrap">
          <table className="team-table">
            <thead><tr><th rowSpan={2}>Name</th>{dates.map((date, index) => <th key={date} colSpan={2}>{shortDate(date)}<small>{weekdays[index].slice(-1)}</small></th>)}</tr><tr>{dates.flatMap((_, index) => dayOptions(index).slice(0, 2).map((option) => <th key={`${index}-${option.value}`}>{option.value}</th>))}</tr></thead>
            <tbody>{records.length ? records.map((record) => <tr key={record.name}><th>{record.name}</th>{dates.flatMap((date, index) => renderAvailabilityCells(record.availability[date], index, `${record.name}-${date}`))}</tr>) : <tr><td colSpan={15} className="empty-table">本周还没有人填写</td></tr>}</tbody>
          </table>
        </div>
      </section>

      <footer className="site-footer"><strong>M2GO</strong><span>每周一自动切换到新的一周，之前的记录会保留。</span></footer>

      {editingDay !== null && <div className="modal-backdrop"><button type="button" className="modal-scrim" onClick={() => setEditingDay(null)} aria-label="关闭自定义时间窗口" /><section className="modal" role="dialog" aria-modal="true" aria-labelledby="custom-title"><header><div><p className="step-label">自定义时间</p><h2 id="custom-title">{weekdays[editingDay]} · {shortDate(dates[editingDay])}</h2></div><button onClick={() => setEditingDay(null)} aria-label="关闭">×</button></header><form onSubmit={saveCustom}><div className="custom-time-row"><label>开始时间<select value={customStart} onChange={(event) => setCustomStart(event.target.value)}>{customTimes(editingDay).map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select></label><span>→</span><label>结束时间<select value={customEnd} onChange={(event) => setCustomEnd(event.target.value)}>{endTimes(editingDay).map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select></label></div><p>结束时间必须晚于开始时间；C 代表午夜 12 点。</p><footer><button type="button" onClick={() => setEditingDay(null)}>取消</button><button className="primary" type="submit">保存这个时段</button></footer></form></section></div>}
    </main>
  );
}

function customTimes(dayIndex: number) {
  const opening = dayIndex < 5 ? 11 : 11.5;
  return Array.from({ length: 13 }, (_, index) => {
    const hourValue = opening + index;
    const hour24 = Math.floor(hourValue);
    const minute = hourValue % 1 ? ":30" : "";
    const hour12 = hour24 === 12 ? 12 : hour24 - 12;
    return {
      value: `${hour12}${minute}`,
      label: `${hour12}:${minute ? "30" : "00"} ${hour24 < 12 ? "AM" : "PM"}`,
      minutes: hourValue * 60,
    };
  });
}

function endTimes(dayIndex: number) {
  return [...customTimes(dayIndex).slice(1), { value: "C", label: "C · 12:00 AM", minutes: 1440 }];
}

function renderAvailabilityCells(code: string | undefined, dayIndex: number, key: string) {
  if (!code) return [<td key={`${key}-a`} />, <td key={`${key}-b`} />];
  const [early, closing, full] = dayOptions(dayIndex).map((item) => item.value);
  if (code === full) return [<td className="available" key={`${key}-a`}>✓</td>, <td className="available" key={`${key}-b`}>✓</td>];
  if (code === early) return [<td className="available" key={`${key}-a`}>✓</td>, <td key={`${key}-b`} />];
  if (code === closing) return [<td key={`${key}-a`} />, <td className="available" key={`${key}-b`}>✓</td>];
  return [<td className="available custom-cell" colSpan={2} key={`${key}-custom`}>{code}</td>];
}
