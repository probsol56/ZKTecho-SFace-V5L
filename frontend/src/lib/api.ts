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

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API request failed: ${res.status} ${res.statusText} ${body}`);
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
