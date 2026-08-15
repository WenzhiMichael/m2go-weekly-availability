export type AvailabilityMap = Record<string, string>;
export type Employee = { id: number; displayName: string };
export type ShiftCode = "early" | "late";
export type ScheduleAssignment = { shiftDate: string; shiftCode: ShiftCode; employeeId: number };

export const weekdays = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];

export function dateFromIso(iso: string) {
  return new Date(`${iso}T12:00:00Z`);
}

function isoFromDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, days: number) {
  const date = dateFromIso(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return isoFromDate(date);
}

export function dayOptions(index: number) {
  const opening = index < 5 ? "11-6" : "11:30-6";
  const full = index < 5 ? "11-C" : "11:30-C";
  return [
    { label: "早班", value: opening, hint: opening },
    { label: "晚班", value: "6-C", hint: "6-C" },
    { label: "全天", value: full, hint: full },
  ];
}

export function isPreset(code: string, index: number) {
  return dayOptions(index).some((option) => option.value === code);
}

export function shortDate(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", timeZone: "UTC" }).format(dateFromIso(iso));
}

export function englishDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(dateFromIso(iso));
}

export function customTimes(dayIndex: number) {
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

export function endTimes(dayIndex: number) {
  return [...customTimes(dayIndex).slice(1), { value: "C", label: "C · 12:00 AM", minutes: 1440 }];
}

function minutes(part: string) {
  if (part === "C") return 1440;
  const [rawHour, rawMinute = "0"] = part.split(":");
  let hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (hour < 11) hour += 12;
  return hour * 60 + minute;
}

export function availabilityCoverage(code: string | undefined, dayIndex: number, shiftCode: ShiftCode) {
  if (!code) return "none" as const;
  const [start, end] = code.split("-").map(minutes);
  const shiftStart = shiftCode === "early" ? (dayIndex < 5 ? 660 : 690) : 1080;
  const shiftEnd = shiftCode === "early" ? 1080 : 1440;
  if (start <= shiftStart && end >= shiftEnd) return "full" as const;
  if (start < shiftEnd && end > shiftStart) return "partial" as const;
  return "none" as const;
}

export function assignmentKey(shiftDate: string, shiftCode: ShiftCode, employeeId: number) {
  return `${shiftDate}|${shiftCode}|${employeeId}`;
}
