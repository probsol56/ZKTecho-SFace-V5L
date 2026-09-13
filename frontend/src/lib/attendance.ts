import type { StatusPillTone } from "@/components/ui/StatusPill";

// The office timezone the backend buckets days in. Any time rendered from a raw
// UTC instant must pass this to toLocaleString, or it renders in the viewer's
// timezone and contradicts the day the row belongs to.
export const BUSINESS_TIME_ZONE = "Asia/Dhaka";

export const ATTENDANCE_STATUSES = ["Present", "Late", "Absent", "Leave", "Pending", "Weekend"] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

// Statuses a user can usefully filter the daily roster by. Weekend days return no
// rows at all, so filtering by it would always be empty.
export const FILTERABLE_STATUSES = ["Present", "Late", "Absent", "Pending"] as const;

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  Present: "Present",
  Late: "Late",
  Absent: "Absent",
  Leave: "Leave",
  Pending: "Not yet",
  Weekend: "Weekend",
};

export const STATUS_TONE: Record<AttendanceStatus, StatusPillTone> = {
  Present: "success",
  Late: "warning",
  Absent: "danger",
  Leave: "neutral",
  Pending: "neutral",
  Weekend: "neutral",
};

const MINUTES_PER_HOUR = 60;

export function formatMinutesAsHours(minutes: number): string {
  if (minutes <= 0) return "—";

  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const remainder = minutes % MINUTES_PER_HOUR;

  if (hours === 0) return `${remainder}m`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

export function formatLateMinutes(minutes: number): string {
  return minutes <= 0 ? "—" : `${minutes}m`;
}

// "2026-09-13" -> "2026-09", for linking a day into the monthly view.
export function monthOf(date: string): string {
  return date.slice(0, "yyyy-MM".length);
}

export function todayInBusinessZone(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: BUSINESS_TIME_ZONE });
}

export function isAttendanceStatus(value: string): value is AttendanceStatus {
  return ATTENDANCE_STATUSES.some((status) => status === value);
}
