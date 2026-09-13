import Link from "next/link";
import { getDailyAttendance } from "@/lib/api";
import {
  FILTERABLE_STATUSES,
  STATUS_LABEL,
  STATUS_TONE,
  formatLateMinutes,
  formatMinutesAsHours,
  isAttendanceStatus,
  monthOf,
  todayInBusinessZone,
} from "@/lib/attendance";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { SubmitButton } from "@/components/ui/SubmitButton";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = { date?: string; status?: string; page?: string };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = params.page ? Math.max(1, Number(params.page)) : 1;

  const result = await getDailyAttendance({
    date: params.date,
    status: params.status,
    page,
    pageSize: PAGE_SIZE,
  });

  const { date, isWeekend, isFinalized, summary, employees } = result;
  const rows = employees.items;
  const hasStatusFilter = Boolean(params.status);
  const isToday = date === todayInBusinessZone();

  const pageHref = (targetPage: number) => {
    const query = new URLSearchParams();
    query.set("date", date);
    if (params.status) query.set("status", params.status);
    query.set("page", String(targetPage));
    return `/attendance?${query.toString()}`;
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Daily attendance"
        description={
          isWeekend
            ? "This day is a weekend — no attendance is expected."
            : isFinalized
              ? "This day is closed. Everyone without a punch is counted absent."
              : "This day is still open. People who have not punched yet show as “Not yet”, not absent."
        }
      />

      <Card className="p-5">
        <form className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Date
            <input
              type="date"
              name="date"
              defaultValue={date}
              className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-normal text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Status
            <select
              name="status"
              defaultValue={params.status ?? ""}
              className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-normal text-foreground"
            >
              <option value="">All statuses</option>
              {FILTERABLE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </label>
          <SubmitButton pendingLabel="Loading…">Apply</SubmitButton>
          {(hasStatusFilter || !isToday) && (
            <Link
              href="/attendance"
              className="text-sm font-medium text-muted underline underline-offset-4 hover:text-foreground"
            >
              Back to today
            </Link>
          )}
        </form>
      </Card>

      {!isWeekend && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Present" value={summary.present} tone="success" />
          <StatCard label="Late" value={summary.late} />
          <StatCard
            label={isFinalized ? "Absent" : "Not yet in"}
            value={isFinalized ? summary.absent : summary.pending}
            tone={isFinalized ? "danger" : "default"}
          />
          <StatCard label="Hours worked" value={formatMinutesAsHours(summary.totalWorkedMinutes)} />
        </div>
      )}

      <Card>
        {rows.length === 0 ? (
          isWeekend ? (
            <EmptyState
              title="Weekend"
              description="No attendance is tracked on this day. Change the weekend days in the work schedule if that is wrong."
            />
          ) : hasStatusFilter ? (
            <EmptyState
              title="No one matches this status"
              description="Try a different status or another date."
              action={
                <Link
                  href={`/attendance?date=${date}`}
                  className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted"
                >
                  Show everyone
                </Link>
              }
            />
          ) : (
            <EmptyState
              title="No employees yet"
              description="Sync a device to bring employee records in, then punches will roll up here automatically."
              action={
                <Link
                  href="/devices"
                  className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted"
                >
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
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Check in</th>
                  <th className="px-4 py-3">Check out</th>
                  <th className="px-4 py-3">Worked</th>
                  <th className="px-4 py-3">Late by</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const status = isAttendanceStatus(row.status) ? row.status : "Pending";
                  return (
                    <tr key={row.employeeId} className="border-b border-border last:border-0 hover:bg-background">
                      <td className="px-4 py-3">
                        <Link
                          href={`/attendance/${row.employeeId}?month=${monthOf(date)}`}
                          className="flex items-center gap-3 font-medium text-foreground hover:underline hover:underline-offset-4"
                        >
                          <Avatar label={row.employeeName} />
                          {row.employeeName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-muted">{row.deviceUserId}</td>
                      <td className="px-4 py-3">
                        <StatusPill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusPill>
                      </td>
                      <td className="px-4 py-3 font-mono text-muted">{row.checkInLocal ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-muted">{row.checkOutLocal ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">{formatMinutesAsHours(row.workedMinutes)}</td>
                      <td className="px-4 py-3 text-muted">{formatLateMinutes(row.lateMinutes)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {employees.totalCount > 0 && (
        <Pagination page={employees.page} totalPages={employees.totalPages} buildHref={pageHref} />
      )}
    </div>
  );
}
