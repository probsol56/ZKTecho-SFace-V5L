import Link from "next/link";
import { getAttendanceLogs, getDevices } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type SearchParams = { deviceId?: string; from?: string; to?: string; page?: string };

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const deviceId = params.deviceId ? Number(params.deviceId) : undefined;
  const page = params.page ? Math.max(1, Number(params.page)) : 1;

  const [logsResult, devices] = await Promise.all([
    getAttendanceLogs({ deviceId, from: params.from, to: params.to, page, pageSize: PAGE_SIZE }),
    getDevices(),
  ]);
  const { items: logs, totalCount, totalPages } = logsResult;

  const pageHref = (targetPage: number) => {
    const query = new URLSearchParams();
    if (params.deviceId) query.set("deviceId", params.deviceId);
    if (params.from) query.set("from", params.from);
    if (params.to) query.set("to", params.to);
    query.set("page", String(targetPage));
    return `/logs?${query.toString()}`;
  };

  const isDefaultRange = !params.from && !params.to;
  const hasFilters = Boolean(params.deviceId || params.from || params.to);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Attendance logs"
        description={isDefaultRange ? "Showing today's logs. Select a date below to see previous records." : undefined}
      />

      <Card className="p-5">
        <form className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Device
            <select
              name="deviceId"
              defaultValue={params.deviceId ?? ""}
              className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-normal text-foreground"
            >
              <option value="">All devices</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            From
            <input
              type="date"
              name="from"
              defaultValue={params.from ?? ""}
              className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-normal text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            To
            <input
              type="date"
              name="to"
              defaultValue={params.to ?? ""}
              className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-normal text-foreground"
            />
          </label>
          <SubmitButton pendingLabel="Filtering…">Filter</SubmitButton>
          {hasFilters && (
            <Link href="/logs" className="text-sm font-medium text-muted underline underline-offset-4 hover:text-foreground">
              Clear filters
            </Link>
          )}
        </form>
      </Card>

      <Card>
        {logs.length === 0 ? (
          hasFilters ? (
            <EmptyState
              title="No logs match these filters"
              description="Try a wider date range or a different device."
              action={
                <Link href="/logs" className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted">
                  Clear filters
                </Link>
              }
            />
          ) : (
            <EmptyState
              title="No attendance logs yet"
              description="Sync a device to start pulling attendance records."
              action={
                <Link href="/devices" className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted">
                  Go to devices
                </Link>
              }
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-strong text-left text-xs font-medium tracking-wide text-muted uppercase">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Device user ID</th>
                  <th className="px-4 py-3">Device</th>
                  <th className="px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-background">
                    <td className="px-4 py-3 font-medium text-foreground">{log.employeeName}</td>
                    <td className="px-4 py-3 font-mono text-muted">{log.deviceUserId}</td>
                    <td className="px-4 py-3 text-muted">{log.deviceName}</td>
                    <td className="px-4 py-3 font-mono text-muted">{new Date(log.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {totalCount > 0 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            Page {page} of {totalPages} &middot; {totalCount} logs
          </span>
          <div className="flex gap-2">
            <Link
              href={pageHref(page - 1)}
              aria-disabled={page <= 1}
              className={`flex items-center gap-1 rounded-md border border-border-strong px-3 py-1.5 ${
                page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-background"
              }`}
            >
              <ChevronLeftIcon className="h-4 w-4" />
              Previous
            </Link>
            <Link
              href={pageHref(page + 1)}
              aria-disabled={page >= totalPages}
              className={`flex items-center gap-1 rounded-md border border-border-strong px-3 py-1.5 ${
                page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-background"
              }`}
            >
              Next
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
