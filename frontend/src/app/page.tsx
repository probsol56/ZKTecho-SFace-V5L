import Link from "next/link";
import { getDashboardSummary } from "@/lib/api";
import type { DeviceStatus } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { DeviceIcon, LogsIcon, PeopleIcon, PulseIcon } from "@/components/icons";
import { RefreshButton } from "./RefreshButton";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<DeviceStatus, string> = {
  online: "Online",
  offline: "Offline",
  never: "Never synced",
};

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";

  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return "Just now";

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;

  const diffDay = Math.round(diffHour / 24);
  return `${diffDay}d ago`;
}

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Dashboard"
        description="Live status of connected terminals and today's sync activity."
        action={<RefreshButton />}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Devices" value={summary.totalDevices} icon={<DeviceIcon className="h-5 w-5" />} />
        <StatCard
          label="Online"
          value={summary.onlineDevices}
          icon={<PulseIcon className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Offline"
          value={summary.offlineDevices}
          icon={<PulseIcon className="h-5 w-5" />}
          tone={summary.offlineDevices > 0 ? "danger" : "default"}
        />
        <StatCard label="Employees" value={summary.totalEmployees} icon={<PeopleIcon className="h-5 w-5" />} />
        <StatCard label="Logs today" value={summary.todayLogCount} icon={<LogsIcon className="h-5 w-5" />} />
      </div>

      <Card>
        {summary.devices.length === 0 ? (
          <EmptyState
            title="No devices yet"
            description="Add a SpeedFace terminal to start seeing machine and sync status here."
            action={
              <Link href="/devices" className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted">
                Go to devices
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-strong text-left text-xs font-medium tracking-wide text-muted uppercase">
                  <th className="px-4 py-3">Device</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">IP address</th>
                  <th className="px-4 py-3">Last synced</th>
                  <th className="px-4 py-3">Logs today</th>
                </tr>
              </thead>
              <tbody>
                {summary.devices.map((device) => (
                  <tr key={device.id} className="border-b border-border last:border-0 hover:bg-background">
                    <td className="px-4 py-3 font-medium text-foreground">{device.name}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={device.status === "online" ? "success" : device.status === "offline" ? "danger" : "neutral"}>
                        {STATUS_LABEL[device.status]}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3 font-mono text-muted">{device.ipAddress}</td>
                    <td className="px-4 py-3 text-muted">{formatRelativeTime(device.lastSyncedAt)}</td>
                    <td className="px-4 py-3 font-mono text-muted">{device.todayLogCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
