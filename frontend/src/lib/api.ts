export const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:5098";

export type Device = {
  id: number;
  name: string;
  ipAddress: string;
  port: number;
  serialNumber: string | null;
  lastSyncedAt: string | null;
};

export type Employee = {
  id: number;
  deviceUserId: string;
  name: string;
  cardNumber: string | null;
  role: number;
  isActive: boolean;
  joinDate: string | null;
};

export type AttendanceLogEntry = {
  id: number;
  employeeName: string;
  deviceUserId: string;
  deviceName: string;
  timestamp: string;
  verifyMode: number;
  inOutMode: number;
};

export type SyncResult = {
  usersUpserted: number;
  logsInserted: number;
};

// A user as it actually exists on a terminal right now - not an Employee row,
// which has no per-device mapping (see backend/AttendanceApi/Models/Employee.cs).
export type DeviceUser = {
  deviceUserId: string;
  name: string;
  cardNumber: string | null;
  role: number;
};

export type TemplateTransferOutcome = {
  deviceUserId: string;
  employeeName: string;
  success: boolean;
  error: string | null;
};

export type DeviceStatus = "online" | "offline" | "never";

export type DeviceStatusSummary = {
  id: number;
  name: string;
  ipAddress: string;
  serialNumber: string | null;
  lastSyncedAt: string | null;
  status: DeviceStatus;
  todayLogCount: number;
};

export type DashboardSummary = {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  totalEmployees: number;
  todayLogCount: number;
  devices: DeviceStatusSummary[];
};

export type PagedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

// Times are returned twice: the raw UTC instant, and a "HH:mm" string already
// converted to the office timezone. Render the *Local fields - formatting the
// instant in the browser would show the viewer's timezone instead.
export type DailyAttendanceRow = {
  employeeId: number;
  employeeName: string;
  deviceUserId: string;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInLocal: string | null;
  checkOutLocal: string | null;
  workedMinutes: number;
  lateMinutes: number;
  punchCount: number;
};

export type DailyAttendanceSummary = {
  totalEmployees: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  pending: number;
  totalWorkedMinutes: number;
  totalLateMinutes: number;
};

export type DailyAttendanceList = {
  date: string;
  isWeekend: boolean;
  isFinalized: boolean;
  timeZoneId: string;
  summary: DailyAttendanceSummary;
  employees: PagedResult<DailyAttendanceRow>;
};

export type EmployeeMonthDay = {
  date: string;
  dayOfWeek: string;
  isWeekend: boolean;
  status: string;
  checkInLocal: string | null;
  checkOutLocal: string | null;
  workedMinutes: number;
  lateMinutes: number;
};

export type EmployeeMonthTotals = {
  presentDays: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
  weekendDays: number;
  workingDays: number;
  totalWorkedMinutes: number;
  totalLateMinutes: number;
};

export type EmployeeMonth = {
  employeeId: number;
  employeeName: string;
  deviceUserId: string;
  month: string;
  fromDate: string;
  toDate: string;
  timeZoneId: string;
  totals: EmployeeMonthTotals;
  days: EmployeeMonthDay[];
};

export type WorkSchedule = {
  startTime: string;
  endTime: string;
  graceMinutes: number;
  weekendDays: string[];
  timeZoneId: string;
  updatedAt: string;
};

export type RecomputeResult = {
  daysProcessed: number;
  rowsWritten: number;
  rowsDeleted: number;
  absencesCreated: number;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, statusText: string, body: string) {
    super(`API request failed: ${status} ${statusText} ${body}`);
    this.name = "ApiError";
    this.status = status;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, res.statusText, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function getDevices() {
  return apiFetch<Device[]>("/api/devices");
}

export function getDashboardSummary() {
  return apiFetch<DashboardSummary>("/api/dashboard/summary");
}

export function createDevice(input: { name: string; ipAddress: string; port: number; serialNumber?: string }) {
  return apiFetch<Device>("/api/devices", { method: "POST", body: JSON.stringify(input) });
}

export function updateDevice(id: number, input: { name: string; ipAddress: string; port: number; serialNumber?: string }) {
  return apiFetch<Device>(`/api/devices/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteDevice(id: number) {
  return apiFetch<void>(`/api/devices/${id}`, { method: "DELETE" });
}

export function syncDevice(id: number) {
  return apiFetch<SyncResult>(`/api/devices/${id}/sync`, { method: "POST" });
}

export function getDeviceLiveUsers(deviceId: number) {
  return apiFetch<DeviceUser[]>(`/api/devices/${deviceId}/live-users`);
}

export function getEmployees(params: { page?: number; pageSize?: number } = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));

  const qs = query.toString();
  return apiFetch<PagedResult<Employee>>(`/api/employees${qs ? `?${qs}` : ""}`);
}

export function getAttendanceLogs(params: {
  deviceId?: number;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params.deviceId) query.set("deviceId", String(params.deviceId));
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));

  const qs = query.toString();
  return apiFetch<PagedResult<AttendanceLogEntry>>(`/api/attendancelogs${qs ? `?${qs}` : ""}`);
}

export function updateEmployee(id: number, input: { name: string; isActive: boolean; joinDate: string | null }) {
  return apiFetch<Employee>(`/api/employees/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function getDailyAttendance(params: {
  date?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params.date) query.set("date", params.date);
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));

  const qs = query.toString();
  return apiFetch<DailyAttendanceList>(`/api/attendance-days${qs ? `?${qs}` : ""}`);
}

export function getEmployeeMonth(employeeId: number, month?: string) {
  const qs = month ? `?month=${encodeURIComponent(month)}` : "";
  return apiFetch<EmployeeMonth>(`/api/attendance-days/employees/${employeeId}${qs}`);
}

export function recomputeAttendanceDays(input: { from: string; to: string; employeeIds?: number[] }) {
  return apiFetch<RecomputeResult>("/api/attendance-days/recompute", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getWorkSchedule() {
  return apiFetch<WorkSchedule>("/api/work-schedule");
}

export function updateWorkSchedule(input: {
  startTime: string;
  endTime: string;
  graceMinutes: number;
  weekendDays: string[];
}) {
  return apiFetch<WorkSchedule>("/api/work-schedule", { method: "PUT", body: JSON.stringify(input) });
}
