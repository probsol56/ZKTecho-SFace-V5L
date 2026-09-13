import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError, getEmployeeMonth } from "@/lib/api";
import {
  STATUS_LABEL,
  STATUS_TONE,
  formatLateMinutes,
  formatMinutesAsHours,
  isAttendanceStatus,
} from "@/lib/attendance";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { SubmitButton } from "@/components/ui/SubmitButton";

export const dynamic = "force-dynamic";

const NOT_FOUND = 404;

type Params = { employeeId: string };
type SearchParams = { month?: string };

export default async function EmployeeAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { employeeId: rawEmployeeId } = await params;
  const { month: requestedMonth } = await searchParams;

  const employeeId = Number(rawEmployeeId);
  if (!Number.isInteger(employeeId) || employeeId <= 0) notFound();

  const monthly = await loadMonth(employeeId, requestedMonth);
  const { totals, days, month } = monthly;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={monthly.employeeName}
        description={`Device user ID ${monthly.deviceUserId} · times shown in ${monthly.timeZoneId}`}
      />

      <Card className="p-5">
        <form className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Month
            <input
              type="month"
              name="month"
              defaultValue={month}
              className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-normal text-foreground"
            />
          </label>
          <SubmitButton pendingLabel="Loading…">Show month</SubmitButton>
          <Link
            href="/attendance"
            className="text-sm font-medium text-muted underline underline-offset-4 hover:text-foreground"
          >
            Back to daily view
          </Link>
        </form>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Present days" value={totals.presentDays} tone="success" />
        <StatCard label="Late days" value={totals.lateDays} />
        <StatCard label="Absent days" value={totals.absentDays} tone="danger" />
        <StatCard label="Hours worked" value={formatMinutesAsHours(totals.totalWorkedMinutes)} />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-strong text-left text-xs font-medium tracking-wide text-muted uppercase">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Day</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Check in</th>
                <th className="px-4 py-3">Check out</th>
                <th className="px-4 py-3">Worked</th>
                <th className="px-4 py-3">Late by</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const status = isAttendanceStatus(day.status) ? day.status : "Pending";
                return (
                  <tr
                    key={day.date}
                    className={`border-b border-border last:border-0 hover:bg-background ${day.isWeekend ? "text-muted" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono">{day.date}</td>
                    <td className="px-4 py-3 text-muted">{day.dayOfWeek}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusPill>
                    </td>
                    <td className="px-4 py-3 font-mono text-muted">{day.checkInLocal ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-muted">{day.checkOutLocal ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{formatMinutesAsHours(day.workedMinutes)}</td>
                    <td className="px-4 py-3 text-muted">{formatLateMinutes(day.lateMinutes)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border-strong font-medium text-foreground">
                <td className="px-4 py-3" colSpan={5}>
                  {totals.workingDays} working days · {totals.weekendDays} weekend days
                </td>
                <td className="px-4 py-3">{formatMinutesAsHours(totals.totalWorkedMinutes)}</td>
                <td className="px-4 py-3">{formatLateMinutes(totals.totalLateMinutes)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

async function loadMonth(employeeId: number, month: string | undefined) {
  try {
    return await getEmployeeMonth(employeeId, month);
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === NOT_FOUND) notFound();
    throw error;
  }
}
